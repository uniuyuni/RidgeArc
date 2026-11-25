import {DEG,clamp,wrap,angleDelta,clock,sunPosition,destination,tilePixel,decodeElevation,elevationAngle,horizonAt,diskVisibility,diskBoundary,panoramaY,panoramaAltitude,daylightFrame} from './core.mjs';
const $=id=>document.getElementById(id), canvas=$('scene'),ctx=canvas.getContext('2d'), step=.25,N=1440;
let config={lat:35.416459,lon:139.048985,height:1.6,date:'2026-11-22'},profile=null,coverage=0,day=[],timer=null,frame=null;
const bands=[{start:30,end:2000,inc:25,z:14},{start:2050,end:8000,inc:65,z:13},{start:8150,end:70000,inc:220,z:10}];
const tiles=new Map();
function getTile(key){
 if(tiles.has(key))return tiles.get(key);
 const task=(async()=>{
  const response=await fetch('https://cyberjapandata.gsi.go.jp/xyz/dem_png/'+key+'.png',{signal:AbortSignal.timeout(15000)});
  if(!response.ok)return null;
  const bmp=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none'});
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(bmp,0,0);bmp.close();
  return g.getImageData(0,0,256,256).data;
 })().catch(()=>null);
 tiles.set(key,task);return task;
}
function recomputeDay(){day=Array.from({length:1440},(_,m)=>sunPosition(config.date,m,config.lat,config.lon));frame=daylightFrame(day)}
function lookup(p,loaded){const a=loaded.get(p.key);return a?decodeElevation(a[p.i],a[p.i+1],a[p.i+2]):null}
async function compute(){
 $('load').disabled=true;profile=null;coverage=0;tiles.clear();recomputeDay();render();events();
 const keys=new Set(), rays=[];
 const point=tilePixel(config.lat,config.lon,14);keys.add(point.key);
 for(let i=0;i<N;i++){
  const row=[];
  for(const band of bands){
   const segment=[];
   for(let d=band.start;d<=band.end;d+=band.inc){
    const p=tilePixel(...destination(config.lat,config.lon,i*step,d),band.z);
    keys.add(p.key);segment.push({key:p.key,i:p.i,d});
   }row.push(segment);
  }rays.push(row);
 }
 $('status').textContent='標高タイルを取得中：'+keys.size+'枚';
 const queue=[...keys], loaded=new Map();let done=0;
 await Promise.all(Array.from({length:8},async()=>{
  while(queue.length){const key=queue.pop();loaded.set(key,await getTile(key));done++;
   $('status').textContent='標高タイルを取得中 '+done+' / '+keys.size+'枚';
  }
 }));
 const ground=lookup(point,loaded);
 if(ground==null)throw Error('観測地点の標高が取得できません。座標または通信を確認してください。');
 const eye=ground+config.height, out=[[],[],[]], total=[];
 let valid=0,count=0;
 for(const ray of rays){
  let max=null;
  ray.forEach((seg,k)=>{
   let best=null;
   for(const p of seg){count++;const h=lookup(p,loaded);if(h==null)continue;valid++;
    const a=elevationAngle(h,eye,p.d);if(best==null||a>best)best=a;
   }
   out[k].push(best);if(best!=null&&(max==null||best>max))max=best;
  });total.push(max);
 }
 coverage=valid/count;profile={out,total,eye};
 $('status').textContent='観測高 '+eye.toFixed(1)+'m（DEM＋指定高）｜サンプル取得率 '+Math.round(coverage*100)+'%｜'+keys.size+'タイル。'+(coverage<.999?'欠損のため遮蔽判定は暫定。':'70km以遠と植生は未考慮。');
 render();events();
}
function horizon(a){return profile?horizonAt(profile.total,a,step):null}
function events(){
 const box=$('events');box.replaceChildren();
 if(!profile){box.textContent='地形を計算してください。';return;}
 if(coverage<.5){box.textContent='標高データの欠損が多いため、イベント判定を中止しました。';return;}
 let prev=null;
 for(let m=0;m<1440;m++){
  const s=day[m],v=s.alt<-2?0:diskVisibility(s,horizon);
  const state=v==null?null:v===0?0:v===1?2:1;
  if(m&&prev!=null&&state!=null&&state!==prev){
   let label=state===0?'完全遮蔽':prev===0?'出現開始':state===1?'部分遮蔽':'全円盤出現';
   if(prev===0&&state===2)label='全円盤出現';
   const el=document.createElement('span');el.textContent=clock(m)+' '+label;box.append(el);
  }prev=state;
 }
 if(!box.children.length)box.textContent='判定できる変化なし（または欠損）。';
}
function render(){
 const {center,span,bottom}=frame||daylightFrame(day),left=center-span/2,right=center+span/2;
 let top=(frame||daylightFrame(day)).top;
 if(profile){for(let a=left;a<=right;a+=step){const h=horizon(a);if(h!=null)top=Math.max(top,Math.min(panoramaY(89.8),panoramaY(h)+5));}}
 const plotW=1800,scale=plotW/span,plotH=Math.round((top-bottom)*scale),width=plotW+78,H=plotH+64;
 if(canvas.width!==width)canvas.width=width;if(canvas.height!==H)canvas.height=H;
 const zoom=+$('zoom').value;canvas.style.width=zoom+'%';$('zoomValue').textContent=zoom+'%';
 const cx=48+plotW/2,cy=22+plotH/2;
 const project=(a,h)=>[cx+angleDelta(a,center)*scale,22+(top-panoramaY(h))*scale];
 $('frameInfo').textContent='水平範囲 '+Math.round(wrap(left))+'° → '+Math.round(wrap(right))+'°（約 '+Math.round(span)+'°）｜山の形を局所的に保つ円筒投影';
 const m=+$('time').value,s=day[m]||sunPosition(config.date,m,config.lat,config.lon);
 $('clock').textContent=clock(m);$('az').textContent=s.az.toFixed(2)+'°';$('alt').textContent=s.alt.toFixed(2)+'°';
 const vis=profile&&coverage>=.5?diskVisibility(s,horizon):null;
 $('visible').textContent=vis==null?'—':Math.round(vis*100)+'%';
 ctx.fillStyle='#172431';ctx.fillRect(0,0,width,H);
 ctx.save();ctx.beginPath();ctx.rect(48,22,plotW,plotH);ctx.clip();
 let g=ctx.createLinearGradient(0,22,0,22+plotH);
 const daylight=clamp((s.geo+8)/20,0,1),warm=clamp(1-Math.abs(s.geo-1)/10,0,1);
 const mix=(a,b,t)=>'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')+')';
 if($('light').checked){
  g.addColorStop(0,mix([12,20,43],[78,145,190],daylight));
  g.addColorStop(1,mix([25,30,52],warm>.3?[223,153,100]:[177,210,230],Math.max(daylight,warm*.8)));
 }else{g.addColorStop(0,'#162c40');g.addColorStop(1,'#38516a')}
 ctx.fillStyle=g;ctx.fillRect(48,22,plotW,plotH);
 function trace(points){
  let prev=null;
  for(const p of points){if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[1])){prev=null;continue}
   if(!prev||Math.abs(p[0]-prev[0])>plotW*.6||Math.abs(p[1]-prev[1])>plotH*2)ctx.moveTo(...p);else ctx.lineTo(...p);prev=p;
  }
 }
 if($('grid').checked){
  ctx.strokeStyle='#ffffff25';ctx.lineWidth=1;ctx.beginPath();
  for(let a=Math.ceil(left/15)*15;a<=right;a+=15)trace([project(a,panoramaAltitude(bottom)),project(a,panoramaAltitude(top))]);
  for(let h=-10;h<=80;h+=10){ctx.moveTo(...project(left,h));ctx.lineTo(...project(right,h));}
  ctx.stroke();
 }
 function polygon(p){
  const v=diskBoundary(p,24).map(([a,h])=>project(a,h));
  if(v.some(q=>!q)||Math.max(...v.map(q=>q[0]))-Math.min(...v.map(q=>q[0]))>plotW/2)return;
  if(v.every(q=>q[0]<48)||v.every(q=>q[0]>48+plotW)||v.every(q=>q[1]<22)||v.every(q=>q[1]>22+plotH))return;
  ctx.moveTo(...v[0]);for(const q of v.slice(1))ctx.lineTo(...q);ctx.closePath();
 }
 if(s.alt>=-2){ctx.beginPath();polygon(s);ctx.fillStyle='#fff2ad';ctx.fill();}
 // Cylindrical panorama: each screen column corresponds to one azimuth.
 function rayAt(px,py){return [wrap(left+(px-48)/scale),panoramaAltitude(top-(py-22)/scale)];}
 function land(values,color){
  let run=[];
  function flush(){if(run.length<2){run=[];return;}ctx.beginPath();ctx.moveTo(run[0][0],22+plotH);for(const q of run)ctx.lineTo(...q);ctx.lineTo(run.at(-1)[0],22+plotH);ctx.closePath();ctx.fillStyle=color;ctx.fill();run=[];}
  const columns=Math.ceil(span/step);
  for(let i=0;i<=columns;i++){
   const a=left+span*i/columns,h=horizonAt(values,a,step);
   if(h==null){flush();continue}
   const px=48+plotW*i/columns,py=clamp(22+(top-panoramaY(h))*scale,22,22+plotH);
   run.push([px,py]);
  }flush();
 }
 if(profile){const colors=['#233747','#3f5869','#788b9b'];if($('layers').checked){for(let k=2;k>=0;k--)land(profile.out[k],colors[k])}else land(profile.total,colors[0]);}
 if($('path').checked){
  // Show the complete swept disk even when it lies behind a ridge; the solid
  // current disk was drawn before terrain and is correctly hidden by it.
  ctx.beginPath();for(const p of day)if(p.alt>=-2)polygon(p);ctx.fillStyle='#ffdb9248';ctx.fill();
  ctx.strokeStyle='#ffe5a8b0';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();trace(day.map(p=>p.alt>=-2?project(p.az,p.alt):null));ctx.stroke();ctx.setLineDash([]);
  ctx.font='12px system-ui';ctx.fillStyle='#fff4d8';ctx.textAlign='center';
  for(let i=0;i<1440;i+=60){const p=day[i],q=p&&p.alt>=0?project(p.az,p.alt):null;if(q&&q[0]>68&&q[0]<48+plotW-20&&q[1]>42&&q[1]<22+plotH)ctx.fillText(clock(i),q[0],q[1]-8);}
 }
 if(!profile){ctx.fillStyle='#e2edf5';ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillText('地形未計算 — 「地形を計算」を押してください',width/2,22+plotH/2);}
 ctx.restore();ctx.font='12px system-ui';ctx.fillStyle='#c7d5df';ctx.textAlign='center';
 for(let px=48;px<=48+plotW;px+=plotW/6){const [a]=rayAt(px,cy);ctx.fillText(Math.round(a)%360+'°',px,22+plotH+18)}
 ctx.textAlign='right';for(let py=22;py<=22+plotH;py+=plotH/5){const [,h]=rayAt(cx,py);ctx.fillText(Math.round(h)+'°',43,py+4)}
 ctx.textAlign='left';ctx.fillText('RidgeArc · '+config.date+' '+clock(m)+' JST · '+'自然パノラマ '+Math.round(span)+'°'+' · 出典：国土地理院標高タイルを加工',48,H-10);
 updateMapDirection();
}
let map=null,marker=null,viewLines=null;
function updateMapDirection(){
 if(!map||!marker||!viewLines)return;
 const p=marker.getLatLng(),o=frame||daylightFrame(day);
 viewLines.clearLayers();
 for(const [a,style] of [[o.center,{weight:2,dashArray:'5 5'}],[o.center-o.span/2,{weight:1}],[o.center+o.span/2,{weight:1}]]){
  const q=destination(p.lat,p.lng,a,5000);
  L.polyline([p,q],{color:'#de8700',...style,interactive:false}).addTo(viewLines);
 }
}
function selectPoint(lat,lon,pan=false){
 if(lat<20||lat>46||lon<122||lon>154){$('mapstatus').textContent='現在は日本国内向けです。';return}
 $('lat').value=lat.toFixed(6);$('lon').value=lon.toFixed(6);
 if(marker){marker.setLatLng([lat,lon]);if(pan)map.setView([lat,lon],Math.max(map.getZoom(),13))}
 $('mapstatus').textContent='選択地点 '+lat.toFixed(6)+', '+lon.toFixed(6)+' — 地形を計算してください。';
 updateMapDirection();
}
function initMap(){
 if(!window.L){$('mapstatus').textContent='地図の読み込みに失敗。緯度・経度の直接入力は可能です。';return}
 map=L.map('map').setView([config.lat,config.lon],13);
 const std=L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',{maxZoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'}).addTo(map);
 const photo=L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',{maxZoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'});
 L.control.layers({'標準地図':std,'航空写真':photo}).addTo(map);
 marker=L.marker([config.lat,config.lon],{draggable:true}).addTo(map);
 viewLines=L.layerGroup().addTo(map);
 map.on('click',e=>selectPoint(e.latlng.lat,e.latlng.lng));
 marker.on('dragend',()=>{const p=marker.getLatLng();selectPoint(p.lat,p.lng)});
 for(const id of ['lat','lon'])$(id).addEventListener('change',()=>{const a=+$('lat').value,b=+$('lon').value;if($('lat').value&&$('lon').value&&Number.isFinite(a)&&Number.isFinite(b))selectPoint(a,b,true)});
 $('search').addEventListener('click',async()=>{
  const q=$('place').value.trim();if(!q)return;
  $('search').disabled=true;$('mapstatus').textContent='検索中…';
  try{
   const r=await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q='+encodeURIComponent(q),{signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json(),list=$('results');list.replaceChildren();
   const valid=data.filter(x=>x.geometry?.coordinates?.length===2);
   if(!valid.length){list.hidden=true;$('mapstatus').textContent='検索結果なし。地図で選択してください。';return}
   for(const x of valid.slice(0,20)){const el=document.createElement('option');el.value=x.geometry.coordinates.join(',');el.textContent=x.properties.title;list.append(el)}
   list.hidden=false;list.dispatchEvent(new Event('change'));
  }catch(e){$('mapstatus').textContent='検索失敗。地図で選択してください。'}finally{$('search').disabled=false}
 });
 $('results').addEventListener('change',()=>{const [lon,lat]=$('results').value.split(',').map(Number);if(Number.isFinite(lat)&&Number.isFinite(lon))selectPoint(lat,lon,true)});
 $('place').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('search').click()}});
 updateMapDirection();
}
$('location').addEventListener('submit',async e=>{
 e.preventDefault();config={lat:+$('lat').value,lon:+$('lon').value,height:+$('height').value,date:$('date').value};
 if(!Number.isFinite(Date.parse(config.date+'T00:00:00+09:00')))return;
 try{await compute()}catch(err){profile=null;$('status').textContent='計算失敗：'+err.message;render();events()}finally{$('load').disabled=false}
});
for(const id of ['time','zoom','grid','path','layers','light'])$(id).addEventListener('input',render);
$('play').addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;$('play').textContent='▶ 再生'}else{$('play').textContent='Ⅱ 停止';timer=setInterval(()=>{$('time').value=(+$('time').value+2)%1440;render()},100)}});
$('save').addEventListener('click',()=>{canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='RidgeArc-'+config.date+'-'+clock(+$('time').value).replace(':','')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)})});
recomputeDay();render();
$('resetZoom').addEventListener('click',()=>{$('zoom').value=100;render();canvas.parentElement.scrollLeft=0});
initMap();

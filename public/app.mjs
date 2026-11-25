import {DEG,clamp,wrap,angleDelta,clock,sunPosition,destination,tilePixel,decodeElevation,elevationAngle,horizonAt,diskVisibility} from './core.mjs';
const $=id=>document.getElementById(id), canvas=$('scene'),ctx=canvas.getContext('2d'), step=.25,N=1440;
let config={lat:35.416459,lon:139.048985,height:1.6,date:'2026-11-22'},profile=null,coverage=0,day=[],timer=null;
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
function recomputeDay(){day=Array.from({length:1440},(_,m)=>sunPosition(config.date,m,config.lat,config.lon))}
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
 const [center,span]=$('view').value.split(',').map(Number),left=center-span/2,right=center+span/2;
 const width=span===360?1800:1200,plotW=width-78,scale=plotW/span,top=span===60?32:84,bottom=span===60?-12:-10,plotH=Math.round((top-bottom)*scale),H=plotH+64;
 canvas.width=width;canvas.height=H;canvas.classList.toggle('wide',span===360);
 const x=a=>48+(a-left)*scale,y=a=>22+(top-a)*scale;
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
 const grid=span===60?5:15;
 ctx.strokeStyle='#ffffff20';ctx.lineWidth=1;ctx.beginPath();
 for(let a=Math.ceil(left/grid)*grid;a<=right;a+=grid){ctx.moveTo(x(a),22);ctx.lineTo(x(a),22+plotH)}
 for(let a=Math.ceil(bottom/grid)*grid;a<=top;a+=grid){ctx.moveTo(48,y(a));ctx.lineTo(48+plotW,y(a))}ctx.stroke();
 function drawDisk(p){const a=center+angleDelta(p.az,center);if(a<left-2||a>right+2||p.alt<bottom-2||p.alt>top+2)return;
  ctx.moveTo(x(a)+p.radius*scale/Math.max(.05,Math.cos(p.alt*DEG)),y(p.alt));ctx.ellipse(x(a),y(p.alt),p.radius*scale/Math.max(.05,Math.cos(p.alt*DEG)),p.radius*scale,0,0,2*Math.PI);}
 if($('path').checked){ctx.beginPath();for(let i=0;i<1440;i++){const p=day[i];if(p&&p.alt>=-1)drawDisk(p)}ctx.fillStyle='#ffdb9270';ctx.fill();}
 ctx.beginPath();drawDisk(s);ctx.fillStyle='#fff2ad';ctx.fill();
 // Far-to-near compositing; each band has its own maximum elevation angle.
 function land(values,color){
  let run=[];
  function flush(){if(run.length<2){run=[];return;}ctx.beginPath();ctx.moveTo(x(run[0][0]),22+plotH);for(const [a,h] of run)ctx.lineTo(x(a),y(h));ctx.lineTo(x(run.at(-1)[0]),22+plotH);ctx.closePath();ctx.fillStyle=color;ctx.fill();run=[];}
  for(let a=left;a<=right+1e-6;a+=step){const h=horizonAt(values,a,step);if(h==null)flush();else run.push([a,h]);}flush();
 }
 if(profile){const colors=['#233747','#3f5869','#788b9b'];if($('layers').checked){for(let k=2;k>=0;k--)land(profile.out[k],colors[k])}else land(profile.total,colors[0]);}
 if($('path').checked){
  ctx.strokeStyle='#ffe5a8b0';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();let prev=null;
  for(let i=0;i<1440;i+=2){const p=day[i];if(!p||p.alt<-1){prev=null;continue}const a=center+angleDelta(p.az,center);if(a<left||a>right||p.alt>top){prev=null;continue}if(prev===null||Math.abs(a-prev)>10)ctx.moveTo(x(a),y(p.alt));else ctx.lineTo(x(a),y(p.alt));prev=a;}ctx.stroke();ctx.setLineDash([]);
  ctx.font='12px system-ui';ctx.fillStyle='#fff4d8';ctx.textAlign='center';
  for(let i=0;i<1440;i+=60){const p=day[i];if(!p||p.alt<0)continue;const a=center+angleDelta(p.az,center);if(a>left+2&&a<right-2&&p.alt<top-2)ctx.fillText(clock(i),x(a),y(p.alt)-8);}
 }
 if(!profile){ctx.fillStyle='#e2edf5';ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillText('地形未計算 — 「地形を計算」を押してください',width/2,22+plotH/2);}
 ctx.restore();ctx.font='12px system-ui';ctx.fillStyle='#c7d5df';ctx.textAlign='center';
 for(let a=Math.ceil(left/grid)*grid;a<=right;a+=grid)ctx.fillText(wrap(a)+'°',x(a),22+plotH+18);
 ctx.textAlign='right';for(let a=Math.ceil(bottom/grid)*grid;a<=top;a+=grid)ctx.fillText(a+'°',43,y(a)+4);
 ctx.textAlign='left';ctx.fillText('RidgeArc · '+config.date+' '+clock(m)+' JST · 方位角 / 仰角 · 出典：国土地理院標高タイルを加工',48,H-10);
}
$('location').addEventListener('submit',async e=>{
 e.preventDefault();config={lat:+$('lat').value,lon:+$('lon').value,height:+$('height').value,date:$('date').value};
 if(!Number.isFinite(Date.parse(config.date+'T00:00:00+09:00')))return;
 try{await compute()}catch(err){profile=null;$('status').textContent='計算失敗：'+err.message;render();events()}finally{$('load').disabled=false}
});
for(const id of ['time','view','path','layers','light'])$(id).addEventListener('input',render);
$('play').addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;$('play').textContent='▶ 再生'}else{$('play').textContent='Ⅱ 停止';timer=setInterval(()=>{$('time').value=(+$('time').value+2)%1440;render()},100)}});
$('save').addEventListener('click',()=>{canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='RidgeArc-'+config.date+'-'+clock(+$('time').value).replace(':','')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)})});
recomputeDay();render();

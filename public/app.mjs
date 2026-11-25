import {DEG,clamp,wrap,angleDelta,clock,sunPosition,destination,tilePixel,decodeElevation,elevationAngle,horizonAt,diskVisibility,diskBoundary,panoramaY,panoramaAltitude,daylightFrame,elevationStencil,interpolatedHeight,terrainBounds,visibleSurface,surfaceDistance,visibilityEstimate,contactEvents,projectTerrainRay,panoramaSlices,zoomWindow,zoomAnchor,shiftDate,dateRange} from './core.mjs';
const $=id=>document.getElementById(id), canvas=$('scene'),ctx=canvas.getContext('2d'), step=.25,N=1440;
const todayJST=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
let config={lat:35.416459,lon:139.048985,height:1.6,date:todayJST},profile=null,coverage=0,day=[],timer=null,frame=null,terrainStatus='';
let viewOffset=0,panFrame=0,viewY=null,viewGeometry=null,viewFrame=null,framePoint=null;
let comparison={key:'',paths:[]},comparisonTimer=null,dateRAF=0,hitSegments=[];
let terrainData=null,busy=false,pending=null,changeTimer=null,settleTimer=null,desired=null;
const pointKey=c=>[c.lat,c.lon].join('/');
$('date').value=todayJST;
// High-resolution requests are restricted to the immediate foreground.
const bands=[
 {start:2,end:80,inc:2,quality:'fine'},
 {start:85,end:300,inc:5,quality:'near'},
 {start:310,end:2000,inc:10,quality:'near'},
 {start:2025,end:8000,inc:40,quality:'mid'},
 {start:8080,end:70000,inc:180,quality:'far'}
];
const sourcePlan=[
 {id:'dem1a_png',name:'1m',z:17,groups:['fine'],smooth:true,minD:2},
 {id:'dem5a_png',name:'5m A',z:15,groups:['fine','near'],smooth:true,minD:5},
 {id:'dem5b_png',name:'5m B',z:15,groups:['fine','near'],smooth:true,minD:5},
 {id:'dem5c_png',name:'5m C',z:15,groups:['fine','near'],smooth:true,minD:5},
 {id:'dem_png',name:'10m',z:14,groups:['fine','near'],smooth:true,minD:10},
 {id:'dem_png',name:'中景',z:13,groups:['mid'],smooth:false,minD:0},
 {id:'dem_png',name:'遠景',z:10,groups:['far'],smooth:false,minD:0}
];
const tiles=new Map(),MAX_TILES=256;
function getTile(key){
 if(tiles.has(key)){
  const entry=tiles.get(key);
  if(!entry.retryAt||Date.now()<entry.retryAt){tiles.delete(key);tiles.set(key,entry);return entry.task;}
  tiles.delete(key);
 }
 const task=(async()=>{
  const response=await fetch('https://cyberjapandata.gsi.go.jp/xyz/'+key+'.png',{signal:AbortSignal.timeout(15000)});
  if(response.status===404)return null;
  if(!response.ok)throw Error('HTTP '+response.status);
  const bmp=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none'});
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(bmp,0,0);bmp.close();
  return g.getImageData(0,0,256,256).data;
 })();
 const entry={task:null,retryAt:0};
 entry.task=task.then(data=>{if(data==null)entry.retryAt=Date.now()+300000;return data;}).catch(()=>{if(tiles.get(key)===entry)tiles.delete(key);return null;});
 tiles.set(key,entry);
 while(tiles.size>MAX_TILES)tiles.delete(tiles.keys().next().value);
 return entry.task;
}
function recomputeDay(){
 day=Array.from({length:1440},(_,m)=>sunPosition(config.date,m,config.lat,config.lon));frame=daylightFrame(day);
 const key=pointKey(config);
 if(!viewFrame||framePoint!==key){viewFrame=frame;framePoint=key;viewOffset=0;viewY=null;}
}
function currentViewFrame(){return viewFrame||frame||daylightFrame(day)}
function syncDateSlider(){
 const date=$('date').value;if(!date)return;
 const start=date.slice(0,4)+'-01-01',end=date.slice(0,4)+'-12-31';
 $('dateSlider').max=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000);
 $('dateSlider').value=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000);
 $('dateLabel').textContent=date.replace(/-/g,'/');$('dateSlider').setAttribute('aria-valuetext',date);
}
function selectDate(date,preview=false){
 if(!date)return;
 $('date').value=date;syncDateSlider();
 // Reuse the geometry and full-resolution terrain texture during date scrubbing.
 const target=readConfig();
 if(target&&profile&&terrainData?.key===pointKey(target)&&pointKey(config)===pointKey(target)&&target.height===config.height&&!busy){
  desired=target;clearTimeout(changeTimer);clearTimeout(settleTimer);pending=null;
  if(dateRAF)cancelAnimationFrame(dateRAF);
  if(preview)dateRAF=requestAnimationFrame(()=>{dateRAF=0;applyTerrain(target,'date')});
  else{dateRAF=0;applyTerrain(target);}
 }else scheduleUpdate(preview?60:0,preview?'date':false);
}
function comparisonPaths(){
 if(!$('compare').checked)return [];
 const start=$('compareStart').value,end=$('compareEnd').value,interval=+$('compareStep').value;
 const key=[config.lat,config.lon,start,end,interval].join('/');
 if(comparison.key===key)return comparison.paths;
 const dates=dateRange(start,end,interval);
 if(!dates){comparison={key,paths:[]};$('compareInfo').textContent='開始日〜終了日を正しく指定してください（最大366日）。';$('comparePick').replaceChildren();return [];}
 const paths=dates.map((date,i)=>{
  const fraction=dates.length===1?.5:i/(dates.length-1),color='hsl('+Math.round(190+fraction*125)+' 85% 72%)';
  const points=[];
  for(let m=0;m<1440;m+=5){const p=sunPosition(date,m,config.lat,config.lon);points.push({...p,minute:m});}
  return {date,color,points};
 });
 comparison={key,paths};
 const pick=$('comparePick');pick.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='日付を選択…';pick.append(placeholder);
 for(const p of paths){const opt=document.createElement('option');opt.value=p.date;opt.textContent=p.date;pick.append(opt);}
 $('compareInfo').textContent=dates.length+'日分（'+start+' 〜 '+end+'）｜青→紫：日付順。線をクリックして日付を選択。';
 return paths;
}
function lookup(p,loaded,source){const a=loaded.get(source+'/'+p.key);return a?decodeElevation(a[p.i],a[p.i+1],a[p.i+2]):null}
function stencil(sample,source){
 return source.smooth?elevationStencil(sample.lat,sample.lon,source.z):[{...tilePixel(sample.lat,sample.lon,source.z),w:1}];
}
async function resolveSamples(samples,ground,source,stats,isCurrent){
 const candidates=samples.filter(p=>p.h==null&&source.groups.includes(p.group)&&p.d>=source.minD);
 if(!candidates.length&&ground.h!=null)return;
 if(!candidates.length&&!source.smooth)return;
 const keys=new Set();
 for(const p of candidates)for(const q of stencil(p,source))keys.add(source.id+'/'+q.key);
 if(source.smooth)for(const q of stencil(ground,source))keys.add(source.id+'/'+q.key);
 const loaded=new Map(),queue=[...keys];let done=0;
 await Promise.all(Array.from({length:6},async()=>{
  while(queue.length&&isCurrent()){const key=queue.pop();loaded.set(key,await getTile(key));done++;
   if(isCurrent())$('status').textContent='標高取得 '+source.name+' '+done+'/'+keys.size+' タイル';
  }
 }));
 if(!isCurrent())return;
 const read=p=>lookup(p,loaded,source.id);
 const localGround=source.smooth?interpolatedHeight(stencil(ground,source),read):null;
 if(ground.h==null&&localGround!=null){ground.h=localGround;ground.source=source.name}
 let used=0;
 for(const p of candidates){
  const h=interpolatedHeight(stencil(p,source),read);
  if(h==null)continue;
  // Reduce false nearby walls caused by vertical offsets between DEM sources.
  const correction=ground.h!=null&&localGround!=null?(ground.h-localGround)*clamp(1-p.d/300,0,1):0;
  p.h=h+correction;p.source=source.name;used++;
 }
 stats[source.name]=(stats[source.name]||0)+used;
}
async function loadTerrain(target,isCurrent){
 const rays=[],samples=[],ground={lat:target.lat,lon:target.lon,h:null};
 const distances=Float64Array.from(bands.flatMap(b=>Array.from({length:Math.floor((b.end-b.start)/b.inc)+1},(_,i)=>b.start+i*b.inc)));
 for(let i=0;i<N;i++){
  const row=[];
  for(const band of bands){
   for(let d=band.start;d<=band.end;d+=band.inc){
    const [lat,lon]=destination(target.lat,target.lon,i*step,d);
    const p={lat,lon,d,group:band.quality,h:null};samples.push(p);row.push(p);
   }
  }rays.push(row);
  if(i%120===119){await new Promise(r=>setTimeout(r,0));if(!isCurrent())return null;}
 }
 const stats={};
 for(const source of sourcePlan){if(!isCurrent())return null;await resolveSamples(samples,ground,source,stats,isCurrent);}
 if(!isCurrent())return null;
 if(ground.h==null)throw Error('観測地点の標高が取得できません。座標または通信を確認してください。');
 const heights=[],complete=[];let valid=0,count=0;
 for(const row of rays){
  let rv=0,rc=0;
  heights.push(Float64Array.from(row,p=>p.h??NaN));
  for(const p of row){if(p.d<10&&p.h==null)continue;count++;rc++;if(p.h!=null){valid++;rv++;}}
  complete.push(rc>0&&rv===rc);
 }
 const detail=Object.entries(stats).filter(([k,v])=>v>0&&['1m','5m A','5m B','5m C','10m'].includes(k)).map(([k])=>k).join(' / ');
 return {key:pointKey(target),distances,heights,complete,ground:ground.h,source:ground.source,detail,coverage:count?valid/count:0};
}
function applyTerrain(target,preview=false){
 const samePoint=pointKey(config)===pointKey(target),sameHeight=config.height===target.height,sameDate=config.date===target.date;
 config={...target};
 if(!samePoint||!sameDate||!day.length)recomputeDay();
 if(!terrainData||terrainData.key!==pointKey(target)){profile=null;return;}
 if(!profile||!samePoint||!sameHeight){
  const surfaces=terrainData.heights.map(h=>projectTerrainRay(terrainData.distances,h,terrainData.ground,target.height));
  const total=surfaces.map(s=>s.angle);
  profile={total,surfaces,complete:terrainData.complete,eye:terrainData.ground+target.height,bounds:terrainBounds(frame,[total],step),terrainCache:null};
 }else if(!sameDate){profile.bounds=terrainBounds(frame,[profile.total],step);}
 coverage=terrainData.coverage;
 terrainStatus='地表標高 '+terrainData.ground.toFixed(1)+'m ｜ 視点標高 '+profile.eye.toFixed(1)+'m（地上高 '+target.height.toFixed(1)+'m）｜ '+terrainData.source+' DEM ｜ 近距離 '+(terrainData.detail||'取得なし')+' ｜ 取得率 '+Math.round(coverage*100)+'%';
 $('status').textContent=terrainStatus+(preview?' ｜ 更新中…':'')+(coverage<.999?' ｜ 欠損あり':'');
 render(preview===true);
 clearTimeout(settleTimer);
 if(preview){$('events').textContent='遮蔽時刻を更新中…';settleTimer=setTimeout(()=>{if(!busy&&!pending&&desired&&pointKey(desired)===pointKey(config)&&desired.height===config.height&&desired.date===config.date){render();events();$('status').textContent=terrainStatus+(coverage<.999?' ｜ 欠損あり':'');}},240);}
 else events();
}
function readConfig(){
 const fields=['lat','lon','height','date'].map($);
 if(fields.some(f=>!f.value||!f.validity.valid))return null;
 const c={lat:+$('lat').value,lon:+$('lon').value,height:+$('height').value,date:$('date').value};
 return [c.lat,c.lon,c.height].every(Number.isFinite)&&Number.isFinite(Date.parse(c.date+'T00:00:00+09:00'))?c:null;
}
function scheduleUpdate(delay=150,preview=false){
 const c=readConfig();if(!c)return;
 desired=c;clearTimeout(changeTimer);clearTimeout(settleTimer);
 // Invalidate immediately when the chosen location changes; never show old terrain as current.
 if(pointKey(c)!==pointKey(config)){
  if(profile){profile=null;coverage=0;}
  config={...c};recomputeDay();render();$('events').textContent='新しい地点の地形を計算中…';
  $('status').textContent='地点変更：標高を準備中…';
 }
 if(terrainData?.key===pointKey(c)&&!busy){
  pending=null;changeTimer=setTimeout(()=>applyTerrain(c,preview),delay);return;
 }
 pending=c;
 changeTimer=setTimeout(()=>runPending(),delay);
}
async function runPending(){
 if(busy||!pending)return;
 busy=true;$('load').textContent='計算中…';$('load').disabled=true;
 try{
  while(pending){
   const target=pending;pending=null;
   const key=pointKey(target),current=()=>desired&&pointKey(desired)===key;
   if(terrainData?.key!==key){
    let result;
    try{result=await loadTerrain(target,current)}catch(e){if(!current())continue;throw e;}
    if(!result||!current())continue;
    terrainData=result;
   }
   if(!current())continue;
   const latest=desired;
   if(pending&&pointKey(pending)===key)pending=null;
   applyTerrain(latest);
  }
 }catch(e){profile=null;coverage=0;$('status').textContent='計算失敗：'+e.message;render();events();}
 finally{busy=false;$('load').disabled=false;$('load').textContent='再計算';if(pending)runPending();}
}
function horizon(a){return profile?horizonAt(profile.total,a,step):null}
function directionComplete(a){
 if(!profile)return false;
 const f=wrap(a)/step,i=Math.floor(f)%N;
 return profile.complete[i]&&(f-Math.floor(f)<1e-10||profile.complete[(i+1)%N]);
}
function estimate(s){return visibilityEstimate(s,horizon,directionComplete)}
function events(){
 const box=$('events');box.replaceChildren();
 if(!profile){box.textContent='地形を計算してください。';return;}
 const evaluate=m=>{
  const s=sunPosition(config.date,m,config.lat,config.lon);
  const v=estimate(s);
  return {state:v.estimate==null?null:v.estimate===0?0:v.estimate===1?2:1,uncertain:v.uncertain};
 };
 const contacts=contactEvents(evaluate);
 for(const c of contacts){
  const label=c.to===0?'完全遮蔽':c.from===0?'出現開始':c.to===2?'全円盤出現':'部分遮蔽';
  const m=Math.min(1439,Math.round(c.minute));
  const el=document.createElement('button');el.type='button';el.className='eventbutton';
  el.textContent=clock(m)+' '+label+(c.uncertain?'（暫定）':'');
  el.title='クリックして時刻を移動。地形・大気・時間サンプリングの誤差を含む概算。';
  el.addEventListener('click',()=>{$('time').value=m;render()});box.append(el);
 }
 if(!box.children.length)box.textContent='取得済み地形で判定できる変化なし（欠損・短時間の変化は未検出の場合があります）。';
}
function render(preview=false){
 const f=currentViewFrame(),baseSpan=f.span,center=wrap(f.center+viewOffset),zoom=+$('zoom').value/100,span=baseSpan/zoom,left=center-span/2,right=center+span/2;
 let baseTop=f.top,baseBottom=f.bottom;
 if(profile){const bounds=profile.panBounds||(profile.panBounds=terrainBounds({center:180,span:360},[profile.total],step));baseTop=Math.max(baseTop,panoramaY(bounds.high));baseBottom=Math.min(baseBottom,panoramaY(bounds.low));}
 const {top,bottom,mid}=zoomWindow(baseTop,baseBottom,zoom,viewY);
 const plotW=1800,baseScale=plotW/baseSpan,scale=baseScale*zoom,plotH=Math.round((baseTop-baseBottom)*baseScale),width=plotW+78,H=plotH+64;
 viewGeometry={center,span,top,bottom,mid,zoom,plotW,plotH,baseTop,baseBottom,scale};
 if(canvas.width!==width)canvas.width=width;if(canvas.height!==H)canvas.height=H;
 canvas.style.width='100%';$('zoomValue').textContent=zoom.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'×';
 const cx=48+plotW/2,cy=22+plotH/2;
 const project=(a,h)=>[cx+angleDelta(a,center)*scale,22+(top-panoramaY(h))*scale];
 $('frameInfo').textContent='水平範囲 '+Math.round(wrap(left))%360+'° → '+Math.round(wrap(right))%360+'°（約 '+Math.round(span)+'°）｜中心 '+Math.round(center)%360+'°';
 $('bearing').textContent=['北','北東','東','南東','南','南西','西','北西'][Math.round(center/45)%8]+' '+Math.round(center)%360+'°';
 $('panRange').value=viewOffset;
 const m=+$('time').value,s=day[m]||sunPosition(config.date,m,config.lat,config.lon);
 $('clock').textContent=clock(m);$('az').textContent=s.az.toFixed(2)+'°';$('alt').textContent=s.alt.toFixed(2)+'°';
 const vis=profile?estimate(s):null;
 $('visible').textContent=vis==null||vis.estimate==null?'—':Math.round(vis.estimate*100)+'%'+(vis.uncertain?'※':'');
 $('visibleNote').textContent=vis?.uncertain?'※ この方向に標高欠損。取得済み地形のみの推定。':vis?.missingHorizon?'この方向の地形が不足しています。':'取得済みの裸地DEMによる概算';
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
  const azStep=span>100?15:span>40?10:span>15?5:2,altStep=span>100?10:span>40?5:span>15?2:1;
  for(let a=Math.ceil(left/azStep)*azStep;a<=right;a+=azStep){ctx.moveTo(...project(a,panoramaAltitude(bottom)));ctx.lineTo(...project(a,panoramaAltitude(top)));}
  for(let h=Math.ceil(panoramaAltitude(bottom)/altStep)*altStep;h<=panoramaAltitude(top);h+=altStep){ctx.moveTo(...project(left,h));ctx.lineTo(...project(right,h));}
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
 // Render first-hit distances, not arbitrary range boundaries. Cache terrain
 // pixels so time slider changes do not recalculate the geometry.
 if(profile){
  const shaded=$('layers').checked;
  // Cache a complete cyclic terrain texture; panning only crops it, never refetches DEM.
  const quality=preview===true?.5:1;
  const rasterW=Math.max(1,Math.min(8192,Math.ceil(plotW*360/baseSpan*quality)));
  const rasterH=Math.max(1,Math.min(Math.ceil(plotH*quality),Math.floor(6000000/rasterW)));
  const sy=plotH/rasterH;
  const key=[plotW,plotH,baseSpan,baseTop,baseBottom,shaded,rasterW,rasterH].join('/');
  if(profile.terrainCache?.key!==key){
   const terrain=document.createElement('canvas');terrain.width=rasterW;terrain.height=rasterH;
   const tc=terrain.getContext('2d'),img=tc.createImageData(rasterW,rasterH),pixels=img.data;
   const slopes=Float64Array.from({length:rasterH},(_,y)=>Math.tan(panoramaAltitude(baseTop-(y+.5)*sy/baseScale)*DEG));
   const color=d=>{
    // Continuous atmospheric distance cue; not a physical illumination model.
    const t=clamp(Math.log1p(d/30)/Math.log1p(70000/30),0,1);
    return t;
   };
   for(let x=0;x<rasterW;x++){
    const az=(x+.5)*360/rasterW,f=az/step,i=Math.floor(f)%N,j=(i+1)%N,w=f-Math.floor(f);
    const h=horizon(az);if(h==null)continue;
    const edge=(baseTop-panoramaY(h))*baseScale/sy,y0=clamp(Math.floor(edge),0,rasterH);
    for(let y=y0;y<rasterH;y++){
     const cover=clamp(y+1-edge,0,1);
     if(cover<=0)continue;
     let t=0;
     if(shaded){
      const d0=surfaceDistance(profile.surfaces[i],slopes[y]),d1=surfaceDistance(profile.surfaces[j],slopes[y]);
      if(d0==null&&d1==null)continue;
      t=d0==null?color(d1):d1==null?color(d0):color(d0)*(1-w)+color(d1)*w;
     }
     const k=(y*rasterW+x)*4;
     pixels[k]=Math.round(25+107*t);pixels[k+1]=Math.round(43+108*t);pixels[k+2]=Math.round(56+112*t);pixels[k+3]=Math.round(255*cover);
    }
   }
   tc.putImageData(img,0,0);profile.terrainCache={key,terrain};
  }
  const texture=profile.terrainCache.terrain;
  const sourceY=(baseTop-top)/(baseTop-baseBottom)*texture.height,sourceH=(top-bottom)/(baseTop-baseBottom)*texture.height;
  let dx=48;
  for(const piece of panoramaSlices(left,span,texture.width)){
   const dw=plotW*piece.fraction;
   ctx.drawImage(texture,piece.x,sourceY,piece.width,sourceH,dx,22,dw,plotH);dx+=dw;
  }
 }
 // Date-range paths are solar-center trajectories, drawn independently of selected-day disk.
 hitSegments=[];
 const paths=comparisonPaths();
 for(const path of paths){
  if(path.date===config.date)continue;
  ctx.beginPath();ctx.strokeStyle=path.color;ctx.globalAlpha=paths.length>90?.35:paths.length>30?.55:.85;ctx.lineWidth=1.3;
  let prev=null;
  for(const p of path.points){
   if(p.alt<-2){prev=null;continue;}
   const q=project(p.az,p.alt);
   if(!prev||Math.abs(q[0]-prev.q[0])>plotW*.6){ctx.moveTo(...q);}
   else{
    ctx.lineTo(...q);
    if(Math.max(q[0],prev.q[0])>=48&&Math.min(q[0],prev.q[0])<=48+plotW&&Math.max(q[1],prev.q[1])>=22&&Math.min(q[1],prev.q[1])<=22+plotH)hitSegments.push({a:prev.q,b:q,date:path.date,m0:prev.m,m1:p.minute});
   }
   prev={q,m:p.minute};
  }
  ctx.stroke();
 }
 ctx.globalAlpha=1;
 if($('path').checked){
  // Show the complete swept disk even when it lies behind a ridge; the solid
  // current disk was drawn before terrain and is correctly hidden by it.
  ctx.beginPath();for(const p of day)if(p.alt>=-2)polygon(p);ctx.fillStyle='#ffdb9248';ctx.fill();
  ctx.strokeStyle='#ffe5a8b0';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();trace(day.map(p=>p.alt>=-2?project(p.az,p.alt):null));ctx.stroke();ctx.setLineDash([]);
  ctx.font='12px system-ui';ctx.fillStyle='#fff4d8';ctx.textAlign='center';
  for(let i=0;i<1440;i+=60){const p=day[i],q=p&&p.alt>=0?project(p.az,p.alt):null;if(q&&q[0]>68&&q[0]<48+plotW-20&&q[1]>42&&q[1]<22+plotH)ctx.fillText(clock(i),q[0],q[1]-8);}
 }
 if(!profile){ctx.fillStyle='#e2edf5';ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillText('地形データを準備中／地点を選択してください',width/2,22+plotH/2);}
 ctx.restore();ctx.font='12px system-ui';ctx.fillStyle='#c7d5df';ctx.textAlign='center';
 for(let px=48;px<=48+plotW;px+=plotW/6){const [a]=rayAt(px,cy);ctx.fillText(Math.round(a)%360+'°',px,22+plotH+18)}
 ctx.textAlign='right';for(let py=22;py<=22+plotH;py+=plotH/5){const [,h]=rayAt(cx,py);ctx.fillText(Math.round(h)+'°',43,py+4)}
 ctx.textAlign='left';ctx.fillText('RidgeArc · '+config.date+' '+clock(m)+' JST · '+'自然パノラマ '+Math.round(span)+'°'+' · 出典：国土地理院標高タイルを加工',48,H-10);
 updateMapDirection();
}
let map=null,marker=null,viewLines=null;
function updateMapDirection(){
 if(!map||!marker||!viewLines)return;
 const p=marker.getLatLng(),o=currentViewFrame(),center=wrap(o.center+viewOffset),span=o.span/(+$('zoom').value/100);
 viewLines.clearLayers();
 for(const [a,style] of [[center,{weight:2,dashArray:'5 5'}],[center-span/2,{weight:1}],[center+span/2,{weight:1}]]){
  const q=destination(p.lat,p.lng,a,5000);
  L.polyline([p,q],{color:'#de8700',...style,interactive:false}).addTo(viewLines);
 }
}
function selectPoint(lat,lon,pan=false){
 if(lat<20||lat>46||lon<122||lon>154){$('mapstatus').textContent='現在は日本国内向けです。';return}
 $('lat').value=lat.toFixed(6);$('lon').value=lon.toFixed(6);
 if(marker){marker.setLatLng([lat,lon]);if(pan)map.setView([lat,lon],Math.max(map.getZoom(),13))}
 $('mapstatus').textContent='選択地点 '+lat.toFixed(6)+', '+lon.toFixed(6)+' — 自動更新';
 updateMapDirection();scheduleUpdate(250);
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
$('location').addEventListener('submit',e=>{e.preventDefault();scheduleUpdate(0);});
function syncHeight(){
 const h=+$('height').value;if(!Number.isFinite(h)||!$('height').validity.valid)return;
 $('heightRange').max=Math.max(30,Math.ceil(h/10)*10);$('heightRange').value=h;
}
$('height').addEventListener('input',()=>{syncHeight();scheduleUpdate(90,true)});
$('heightRange').addEventListener('input',()=>{$('height').value=$('heightRange').value;scheduleUpdate(90,true)});
for(const id of ['height','heightRange'])$(id).addEventListener('change',()=>scheduleUpdate(0));
$('date').addEventListener('change',()=>selectDate($('date').value));
$('dateSlider').addEventListener('input',()=>selectDate(shiftDate($('date').value.slice(0,4)+'-01-01',+$('dateSlider').value),true));
$('dateSlider').addEventListener('change',()=>selectDate($('date').value));
$('prevDate').addEventListener('click',()=>selectDate(shiftDate($('date').value,-1)));
$('nextDate').addEventListener('click',()=>selectDate(shiftDate($('date').value,1)));
$('compareStart').value=todayJST;$('compareEnd').value=shiftDate(todayJST,14);
$('compare').addEventListener('change',()=>{$('compareFields').hidden=!$('compare').checked;render()});
for(const id of ['compareStart','compareEnd','compareStep'])$(id).addEventListener('change',()=>{clearTimeout(comparisonTimer);comparisonTimer=setTimeout(()=>render(),80)});
$('comparePick').addEventListener('change',()=>{if($('comparePick').value)selectDate($('comparePick').value);});
$('compareAround').addEventListener('click',()=>{$('compareStart').value=shiftDate($('date').value,-7);$('compareEnd').value=shiftDate($('date').value,7);$('compareStep').value='1';render()});
syncDateSlider();
for(const id of ['time','grid','path','layers','light'])$(id).addEventListener('input',render);
$('play').addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;$('play').textContent='▶ 再生'}else{$('play').textContent='Ⅱ 停止';timer=setInterval(()=>{$('time').value=(+$('time').value+2)%1440;render()},100)}});
$('save').addEventListener('click',()=>{canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='RidgeArc-'+config.date+'-'+clock(+$('time').value).replace(':','')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)})});
recomputeDay();render();
function requestView(){if(!panFrame)panFrame=requestAnimationFrame(()=>{panFrame=0;render()});}
function panTo(offset){viewOffset=angleDelta(offset,0);requestView();}
function changeZoom(value,anchor=null){
 const next=clamp(Math.round(value/25)*25,100,800),z=next/100,g=viewGeometry;
 if(g&&z!==g.zoom){
  if(z===1)viewY=null;
  else if(anchor){
   const p=zoomAnchor(g.center,g.mid,g.span,g.top-g.bottom,z,g.zoom,anchor.u,anchor.v);
   viewOffset=angleDelta(p.center,currentViewFrame().center);viewY=p.mid;
  }else if(g.zoom===1){
   const h=horizon(g.center);viewY=h==null?g.mid:panoramaY(h);
  }
 }
 $('zoom').value=next;requestView();
}
$('zoom').addEventListener('input',()=>changeZoom(+$('zoom').value));
$('zoomIn').addEventListener('click',()=>changeZoom(+$('zoom').value+50));
$('zoomOut').addEventListener('click',()=>changeZoom(+$('zoom').value-50));
$('panRange').addEventListener('input',()=>panTo(+$('panRange').value));
$('panLeft').addEventListener('click',()=>panTo(viewOffset-(viewGeometry?.span??120)/4));
$('panRight').addEventListener('click',()=>panTo(viewOffset+(viewGeometry?.span??120)/4));
function resetView(){viewFrame=frame||daylightFrame(day);viewOffset=0;viewY=null;$('zoom').value=100;requestView();}
$('resetZoom').addEventListener('click',resetView);
$('resetBearing').addEventListener('click',resetView);
let drag=null;
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||!viewGeometry)return;
 const rect=canvas.getBoundingClientRect(),g=viewGeometry;
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,offset:viewOffset,mid:g.mid,span:g.span,vertical:g.top-g.bottom,zoom:g.zoom,width:rect.width*g.plotW/canvas.width,height:rect.height*g.plotH/canvas.height};
 canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 if(drag.zoom>1)viewY=drag.mid+(e.clientY-drag.y)*drag.vertical/Math.max(1,drag.height);
 panTo(drag.offset-(e.clientX-drag.x)*drag.span/Math.max(1,drag.width));
});
function pickComparison(e){
 if(!$('compare').checked||!hitSegments.length||!viewGeometry)return;
 const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*canvas.width/r.width,y=(e.clientY-r.top)*canvas.height/r.height;
 const g=viewGeometry;if(x<48||x>48+g.plotW||y<22||y>22+g.plotH)return;
 let best=null,min=(9*canvas.width/r.width)**2;
 for(const seg of hitSegments){
  const dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],den=dx*dx+dy*dy;
  const t=den?clamp(((x-seg.a[0])*dx+(y-seg.a[1])*dy)/den,0,1):0;
  const d=(x-seg.a[0]-t*dx)**2+(y-seg.a[1]-t*dy)**2;
  if(d<min){min=d;best={date:seg.date,minute:Math.round(seg.m0+t*(seg.m1-seg.m0))};}
 }
 if(best){$('time').value=best.minute;$('comparePick').value=best.date;selectDate(best.date);}
}
function endPan(e){if(drag?.id===e.pointerId){const click=e.type==='pointerup'&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4;drag=null;canvas.classList.remove('dragging');if(viewGeometry&&viewGeometry.zoom>1)viewY=viewGeometry.mid;if(click)pickComparison(e);}}
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,endPan);
canvas.addEventListener('wheel',e=>{
 if(!viewGeometry)return;
 e.preventDefault();
 const g=viewGeometry,rect=canvas.getBoundingClientRect(),units=e.deltaMode===1?16:e.deltaMode===2?rect.width:1;
 if(e.shiftKey||(!e.ctrlKey&&Math.abs(e.deltaX)>Math.abs(e.deltaY))){
  const delta=e.shiftKey&&Math.abs(e.deltaY)>Math.abs(e.deltaX)?e.deltaY:e.deltaX;
  panTo(viewOffset+delta*units*g.span/Math.max(1,rect.width));return;
 }
 if(!e.deltaY)return;
 const u=clamp(((e.clientX-rect.left)*canvas.width/rect.width-48)/g.plotW,0,1),v=clamp(((e.clientY-rect.top)*canvas.height/rect.height-22)/g.plotH,0,1);
 const current=+$('zoom').value,amount=Math.max(25,Math.round(current*.15/25)*25);
 changeZoom(current+(e.deltaY<0?amount:-amount),{u,v});
},{passive:false});
initMap();syncHeight();scheduleUpdate(0);

import {getTile} from './terrain-store.mjs';
import {clamp,destination,tilePixel,decodeElevation,elevationStencil,interpolatedHeight,projectTerrainRay} from './core.mjs';
import {isWaterPixel,waterRanges} from './coast-surface.mjs';
import {receiverHorizon,normalFromSamples,lightDay} from './light-engine.mjs';
const step=.25,N=1440;
const pointKey=({lat,lon})=>[lat,lon].join('/');
let generation=0;
const pause=()=>new Promise(r=>setTimeout(r,0));
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

function lookup(p,loaded,source){const a=loaded.get(source+'/'+p.key);return a?decodeElevation(a[p.i],a[p.i+1],a[p.i+2]):null}
function stencil(sample,source){
 return source.smooth?elevationStencil(sample.lat,sample.lon,source.z):[{...tilePixel(sample.lat,sample.lon,source.z),w:1}];
}
async function resolveSamples(samples,ground,source,stats,isCurrent,requests){
 const candidates=samples.filter(p=>p.h==null&&source.groups.includes(p.group)&&p.d>=source.minD);
 if(!candidates.length&&ground.h!=null)return;
 if(!candidates.length&&!source.smooth)return;
 const keys=new Set();
 for(const p of candidates)for(const q of stencil(p,source))keys.add(source.id+'/'+q.key);
 if(source.smooth)for(const q of stencil(ground,source))keys.add(source.id+'/'+q.key);
 const loaded=new Map(),queue=[...keys];let done=0;
 await Promise.all(Array.from({length:6},async()=>{
  while(queue.length&&isCurrent()){const key=queue.pop();loaded.set(key,await getTile(key,requests));done++;
   if(isCurrent())postMessage({type:'progress',id:generation,message:'標高取得 '+source.name+' '+done+'/'+keys.size+' タイル',done,total:keys.size});
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
// Near sea-level observer only; map colour is a display hint, not DEM.
async function resolveWater(rays,ground,distances,isCurrent,requests){
 const empty=()=>rays.map(()=>[]);
 if(ground.h>10||ground.h< -5)return empty();
 const candidates=[];
 for(const row of rays)for(const p of row)if(p.d<=8000&&(p.h==null||Math.abs(p.h)<=.25))candidates.push(p);
 const keys=[...new Set(candidates.map(p=>'pale/'+tilePixel(p.lat,p.lon,14).key))],loaded=new Map(),total=keys.length;
 let done=0;await Promise.all(Array.from({length:6},async()=>{
  while(keys.length&&isCurrent()){
   const key=keys.pop();loaded.set(key,await getTile(key,requests));done++;
   if(isCurrent())postMessage({type:'progress',id:generation,message:'水面表示用の地図 '+done+'/'+total+' タイル',done,total});
  }
 }));
 if(!isCurrent())return empty();
 for(const p of candidates){
  const q=tilePixel(p.lat,p.lon,14);
  p.water=isWaterPixel(loaded.get('pale/'+q.key),q.i);
 }
 return rays.map(row=>waterRanges(distances,row.map(p=>p.water===true)));
}
async function loadTerrain(target,isCurrent,rayCount=N,includeWater=true){
 const rays=[],samples=[],ground={lat:target.lat,lon:target.lon,h:null};let failedTiles=0,firstTileError=null;const requests={onFailure:e=>{failedTiles++;if(!firstTileError)firstTileError=e?.message??'原因不明'},onRetry:e=>{if(isCurrent())postMessage({type:'progress',id:generation,phase:'retry',message:'通信不安定・再試行 '+e.attempt+'/'+e.max,attempt:e.attempt,max:e.max})}};
 const distances=Float64Array.from(bands.flatMap(b=>Array.from({length:Math.floor((b.end-b.start)/b.inc)+1},(_,i)=>b.start+i*b.inc)));
 for(let i=0;i<rayCount;i++){
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
 for(const source of sourcePlan){if(!isCurrent())return null;await resolveSamples(samples,ground,source,stats,isCurrent,requests);}
 if(!isCurrent())return null;
 if(ground.h==null)throw Error(firstTileError?'観測地点の標高が取得できません：'+firstTileError:'観測地点の標高が取得できません。DEM収録範囲外または欠損です。');
 const water=includeWater?await resolveWater(rays,ground,distances,isCurrent,requests):null;
 if(!isCurrent())return null;
 const heights=[],complete=[];let valid=0,count=0;
 for(const row of rays){
  let rv=0,rc=0;
  heights.push(Float64Array.from(row,p=>p.h??NaN));
  for(const p of row){if(p.d<10&&p.h==null)continue;count++;rc++;if(p.h!=null){valid++;rv++;}}
  complete.push(rc>0&&rv===rc);
 }
 const detail=Object.entries(stats).filter(([k,v])=>v>0&&['1m','5m A','5m B','5m C','10m'].includes(k)).map(([k])=>k).join(' / ');
 return {key:pointKey(target),distances,heights,complete,water,ground:ground.h,source:ground.source,detail,coverage:count?valid/count:0,failedTiles,firstTileError};
}

let retained=null,lightRetained=null;
async function makeLightProfile(data,id){
 const total=[];
 for(let i=0;i<data.heights.length;i++){
  total.push(receiverHorizon(data.distances,data.heights[i],data.ground));
  if(i%120===119){await pause();if(id!==generation)return null;}
 }
 const k=data.distances.indexOf(20),at=i=>data.heights[i]?.[k];
 const normal=normalFromSamples(at(360),at(1080),at(0),at(720),20);
 return {key:data.key,step,total,complete:data.complete,normal,ground:data.ground,
  source:data.source,coverage:data.coverage,failedTiles:data.failedTiles??0,firstTileError:data.firstTileError??null,rangeM:70000,normalBaselineM:40};
}
async function handleLight({id,lat,lon,date,force},rayCount){
 const key=pointKey({lat,lon});
 if(force||lightRetained?.key!==key||lightRetained.total.length!==rayCount){
  const data=await loadTerrain({lat,lon},()=>id===generation,rayCount,false);
  if(!data||id!==generation)return;
  const p=await makeLightProfile(data,id);
  if(!p||id!==generation)return;
  lightRetained=p;
 }
 const analysis=lightDay(lightRetained,date,lat,lon);
 if(id===generation)postMessage({type:'light',id,profile:lightRetained,analysis,date});
}
async function project(data,height,id){
 const surfaces=[];
 for(let i=0;i<data.heights.length;i++){
  const s=projectTerrainRay(data.distances,data.heights[i],data.ground,height,true);
  const peak=s.segments.at(-1);
  s.water=data.water?.[i]??[];
  s.peak=peak?{distance:peak.d,altitude:s.angle,elevation:data.heights[i][data.distances.indexOf(peak.d)]}:null;
  surfaces.push(s);
  if(i%120===119){await pause();if(id!==generation)return;}
 }
 if(id!==generation)return;
 postMessage({type:'profile',id,ground:data.ground,source:data.source,coverage:data.coverage,failedTiles:data.failedTiles??0,firstTileError:data.firstTileError??null,complete:data.complete,waterDirections:surfaces.filter(s=>s.water.length).length,surfaces,total:surfaces.map(s=>s.angle),height});
}
// rayCount is injectable for small offline regression fixtures only.
export async function handleTerrainRequest(e,rayCount=N){
 const {id,lat,lon,height,mode,force,cancel}=e.data;
 generation=id;if(cancel)return;
 try{
  if(mode==='light'){await handleLight(e.data,rayCount);return;}
  const key=pointKey({lat,lon});
  if(force||retained?.key!==key||retained.heights.length!==rayCount){const data=await loadTerrain({lat,lon},()=>id===generation,rayCount);if(!data||id!==generation)return;retained=data;}
  if(id===generation)postMessage({type:'progress',id,message:'稜線を計算中'});
 await project(retained,height,id);
 }catch(e){if(id===generation)postMessage({type:'error',id,message:String(e.message||e)});}
}
if(typeof self!=='undefined')self.onmessage=e=>handleTerrainRequest(e);

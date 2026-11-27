import {tilePixel,elevationStencil,interpolatedHeight,decodeElevation} from './core.mjs';
const tiles=new Map(),MAX_TILES=256;
export function getTile(key){
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
  const c=new OffscreenCanvas(256,256);
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(bmp,0,0);bmp.close();
  return g.getImageData(0,0,256,256).data;
 })();
 const entry={task:null,retryAt:0};
 entry.task=task.then(data=>{if(data==null)entry.retryAt=Date.now()+300000;return data;}).catch(()=>{if(tiles.get(key)===entry)tiles.delete(key);return null;});
 tiles.set(key,entry);
 while(tiles.size>MAX_TILES)tiles.delete(tiles.keys().next().value);
 return entry.task;
}

// Bounded tile requests, batch by source and tile. No missing sample is zero-filled.
export async function sampleElevationBatch(points,{isCurrent=()=>true,onProgress=()=>{},fetchTile=getTile}={}){
 const values=new Float64Array(points.length);values.fill(NaN);
 const plans=[
  {id:'dem5a_png',z:15,accept:p=>p.detail==='near'},
  {id:'dem5b_png',z:15,accept:p=>p.detail==='near'},
  {id:'dem5c_png',z:15,accept:p=>p.detail==='near'},
  {id:'dem_png',z:14,accept:p=>p.detail==='near'},
  {id:'dem_png',z:12,accept:p=>p.detail==='mid'||p.detail==='near'},
  {id:'dem_png',z:10,accept:()=>true}
 ];
 for(const plan of plans){
  if(!isCurrent())return null;
  const items=[],keys=new Set();
  for(let i=0;i<points.length;i++){
   if(Number.isFinite(values[i])||!plan.accept(points[i]))continue;
   const p=points[i],st=plan.z>=14?elevationStencil(p.lat,p.lon,plan.z):[{...tilePixel(p.lat,p.lon,plan.z),w:1}];
   items.push({i,st});for(const q of st)keys.add(plan.id+'/'+q.key);
  }
  if(!items.length)continue;
  const queue=[...keys],loaded=new Map();let done=0;
  await Promise.all(Array.from({length:6},async()=>{
   while(queue.length&&isCurrent()){
    const key=queue.pop();loaded.set(key,await fetchTile(key));done++;
    if(done===keys.size||done%8===0)onProgress(plan.id+' z'+plan.z+' '+done+'/'+keys.size);
   }
  }));
  if(!isCurrent())return null;
  const read=q=>{const a=loaded.get(plan.id+'/'+q.key);return a?decodeElevation(a[q.i],a[q.i+1],a[q.i+2]):null};
  for(const {i,st} of items){const h=interpolatedHeight(st,read);if(h!==null)values[i]=h;}
 }
 return values;
}

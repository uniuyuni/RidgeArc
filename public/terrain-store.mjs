import {tilePixel,elevationStencil,interpolatedHeight,decodeElevation} from './core.mjs';
const tiles=new Map(),MAX_TILES=256;
// Bounded automatic retry; a missing GSI tile is a source fallback, not a network error.
// Keep the same timeout on browsers without AbortSignal.timeout (older WebKit).
function requestTimeout(ms){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
 return {signal:controller.signal,clear:()=>clearTimeout(timer)};
}
export async function fetchWithRetry(url,{fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),onRetry=()=>{},timeout=15000,delays=[1000,3000,10000]}={}){
 for(let attempt=0;;attempt++){
  let response,delay=delays[attempt];
  try{
   const deadline=requestTimeout(timeout);try{response=await fetcher(url,{signal:deadline.signal})}finally{deadline.clear()}
   if(response.ok||response.status===404)return response;
   if(![408,425,429,500,502,503,504].includes(response.status)){const e=Error('HTTP '+response.status);e.permanent=true;throw e}
   const header=response.headers.get('Retry-After');
   if(header!==null){const parsed=/^\d+$/.test(header)?Number(header)*1000:Date.parse(header)-Date.now();if(Number.isFinite(parsed))delay=Math.max(delay??0,parsed)}
   throw Error('HTTP '+response.status);
  }catch(e){
   if(e.permanent||attempt>=delays.length||delay>60000)throw e;
   onRetry({attempt:attempt+1,max:delays.length,delay,message:e.message});
   await wait(delay);
  }
 }
}
export function getTile(key,{onRetry=()=>{},onFailure=()=>{}}={}){
 let entry=tiles.get(key);
 if(entry&&entry.retryAt&&Date.now()>=entry.retryAt){tiles.delete(key);entry=null}
 if(entry){
  tiles.delete(key);tiles.set(key,entry);
  if(entry.pending){entry.listeners.add(onRetry);return entry.task.then(v=>{if(entry.failed)onFailure({key,message:entry.error});return v}).finally(()=>entry.listeners.delete(onRetry))}
  return entry.task;
 }
 entry={task:null,retryAt:0,pending:true,failed:false,error:null,listeners:new Set([onRetry])};
 const task=(async()=>{
  const response=await fetchWithRetry('https://cyberjapandata.gsi.go.jp/xyz/'+key+'.png',{onRetry:event=>{for(const cb of entry.listeners)cb(event)}});
  if(response.status===404)return null;
  const blob=await response.blob();if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function')throw Error('このブラウザはWorker内のPNGデコードに未対応');const bmp=await createImageBitmap(blob,{colorSpaceConversion:'none'});
  const c=new OffscreenCanvas(256,256);
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(bmp,0,0);bmp.close();
  return g.getImageData(0,0,256,256).data;
 })();
 entry.task=task.then(data=>{if(data==null)entry.retryAt=Date.now()+300000;return data;}).catch(e=>{entry.failed=true;entry.error=e?.message||String(e);if(tiles.get(key)===entry)tiles.delete(key);return null;}).finally(()=>{entry.pending=false;entry.listeners.clear()});
 tiles.set(key,entry);
 while(tiles.size>MAX_TILES){const victim=[...tiles].find(([,v])=>!v.pending);if(!victim)break;tiles.delete(victim[0])}
 return entry.task.then(v=>{if(entry.failed)onFailure({key,message:entry.error});return v});
}

// Bounded tile requests, batch by source and tile. No missing sample is zero-filled.
export async function sampleElevationBatch(points,{isCurrent=()=>true,onProgress=()=>{},fetchTile=getTile,strictNear=false}={}){
 const values=new Float64Array(points.length);values.fill(NaN);
 const plans=[
  {id:'dem5a_png',z:15,accept:p=>p.detail==='near'},
  {id:'dem5b_png',z:15,accept:p=>p.detail==='near'},
  {id:'dem5c_png',z:15,accept:p=>p.detail==='near'},
  {id:'dem_png',z:14,accept:p=>p.detail==='near'},
  {id:'dem_png',z:12,accept:p=>p.detail==='mid'||(!strictNear&&p.detail==='near')},
  {id:'dem_png',z:10,accept:p=>!strictNear||p.detail!=='near'}
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

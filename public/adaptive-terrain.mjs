import {R,DEG,destination,tilePixel,decodeElevation} from './core.mjs';

// Two-stage horizon sampling. Coarse observations select windows; they are
// not upper bounds and cannot certify that an unsampled summit does not exist.
export const RIDGE_POLICY=Object.freeze({minDistance:2000,marginDegrees:.35,maxWindows:3,stepM:15,maxTiles:192,zoom:14});
const slope=(d,h,eye)=>(h-eye-d*d/(2*R))/d;
export function selectRidgeWindows(distances,heights,eye,policy=RIDGE_POLICY){
 let best=-Infinity;const angles=Array.from(heights,(h,i)=>Number.isFinite(h)?Math.atan(slope(distances[i],h,eye))/DEG:-Infinity);
 for(const a of angles)best=Math.max(best,a);
 if(!Number.isFinite(best))return [];
 const candidates=[];
 for(let i=0;i<angles.length;i++){
  if(distances[i]<policy.minDistance||angles[i]<best-policy.marginDegrees||!Number.isFinite(angles[i]))continue;
  if(angles[i]<(angles[i-1]??-Infinity)||angles[i]<(angles[i+1]??-Infinity))continue;
  const d=distances[i],half=Math.max(60,d-(distances[i-1]??d), (distances[i+1]??d)-d);
  candidates.push({start:Math.max(policy.minDistance,d-half),end:Math.min(distances.at(-1),d+half),angle:angles[i]});
 }
 const chosen=[];
 for(const c of candidates.sort((a,b)=>b.angle-a.angle||a.start-b.start)){
  if(chosen.some(q=>c.start<=q.end&&q.start<=c.end))continue;
  chosen.push(c);if(chosen.length>=policy.maxWindows)break;
 }
 return chosen.sort((a,b)=>a.start-b.start);
}
// Retain coarse data when fine tiles are unavailable. New missing samples
// remain explicit gaps; never bridge them by inventing elevations.
export function mergeRaySamples(distances,heights,extra){
 if(!extra?.length)return {distances,heights};
 const values=new Map(Array.from(distances,(d,i)=>[d,heights[i]]));
 for(const p of extra)if(Number.isFinite(p.h)||!values.has(p.d))values.set(p.d,p.h);
 const ds=[...values.keys()].sort((a,b)=>a-b);
 return {distances:Float64Array.from(ds),heights:Float64Array.from(ds,d=>values.get(d))};
}
// Group native DEM requests by tile. Give tiles serving more directions
// priority, with a stable key tie-break. Bound network and memory use.
export async function refineRidges({target,distances,heights,ground,step,eyeHeight=1.6,fetchTile,isCurrent=()=>true,onProgress=()=>{},policy=RIDGE_POLICY}){
 const rows=heights.map(()=>[]),tiles=new Map(),eye=ground+eyeHeight;
 for(let i=0;i<heights.length;i++){
  if(!isCurrent())return null;
  const windows=selectRidgeWindows(distances,heights[i],eye,policy),seen=new Set();
  for(const window of windows){
   const positions=new Set();
   for(let d=window.start;d<=window.end;d+=policy.stepM)positions.add(d);
   positions.add(window.end);
   // Replace original coarse elevations at the same distances if the
   // native sample exists; otherwise a coarse false summit could survive.
   for(const d of distances)if(d>=window.start&&d<=window.end)positions.add(d);
   for(const d of positions){
   if(seen.has(d))continue;seen.add(d);
   const [lat,lon]=destination(target.lat,target.lon,i*step,d),p=tilePixel(lat,lon,policy.zoom),key='dem_png/'+p.key;
   let tile=tiles.get(key);if(!tile){tile={key,points:[],rays:new Set()};tiles.set(key,tile)}
   const sample={d,h:NaN};tile.points.push({sample,i,offset:p.i});tile.rays.add(i);
   }
  }
  if(i%120===119)await new Promise(r=>setTimeout(r,0));
 }
 const ordered=[...tiles.values()].sort((a,b)=>b.rays.size-a.rays.size||a.key.localeCompare(b.key));
 const selected=ordered.slice(0,policy.maxTiles),queue=[...selected];let done=0,valid=0,requested=0;
 await Promise.all(Array.from({length:6},async()=>{
  while(queue.length&&isCurrent()){
   const tile=queue.shift(),rgba=await fetchTile(tile.key);
   for(const {sample,i,offset} of tile.points){
    requested++;if(rgba){const h=decodeElevation(rgba[offset],rgba[offset+1],rgba[offset+2]);if(h!=null){sample.h=h;valid++}}
    // If the native tile is unavailable, retain the base interval intact.
    // A present tile with a no-data pixel is instead an explicit gap.
    if(rgba)rows[i].push(sample);
   }
   done++;if(isCurrent())onProgress(done,selected.length);
  }
 }));
 if(!isCurrent())return null;
 return {rows,stats:{candidateTiles:ordered.length,selectedTiles:selected.length,validSamples:valid,requestedSamples:requested,limited:ordered.length>selected.length}};
}

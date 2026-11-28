import {targetDirection} from './location-geometry.mjs';
import {DEG,wrap,angleDelta} from './core.mjs';
import {firstSurface} from './coast-surface.mjs';

export const MOUNTAIN_SOURCE='国土地理院「日本の主な山岳標高一覧（1003山）」2026年3月31日版を加工';
export function visiblePeaks(catalog,profile,observer){
 if(!profile||!Number.isFinite(observer.height))return [];
 const out=[],count=profile.surfaces.length,step=360/count;
 for(const [name,height,lat,lon] of catalog){
  const to={lat,lon,height},direction=targetDirection(observer,to);
  if(direction.distance<30||direction.distance>70000)continue;
  const f=wrap(direction.az)/step,i=Math.floor(f),j=(i+1)%count;
  const epsilon=Math.max(40,Math.min(450,direction.distance*Math.tan(step*DEG)));
  // A catalog summit may be narrower than the measured ray spacing. Verify
  // that a nearby sampled visible surface is consistent with its depth.
  // A nearer surface on both rays excludes the candidate; unresolved cases
  // are not labeled as identified summits.
  const hits=[i,j].map(k=>firstSurface(profile.surfaces[k],Math.tan(direction.alt*DEG)));
  const near=hits.every(d=>d!==null&&d<direction.distance-epsilon);
  if(near)continue;
  const matches=[i,j].some((k,n)=>{
   const d=hits[n],p=profile.surfaces[k].peak;
   return d!==null&&Math.abs(d-direction.distance)<=epsilon||
    p&&Math.abs(p.distance-direction.distance)<=epsilon&&Math.abs((profile.total[k]??-100)-direction.alt)<=Math.max(.04,step*.6);
  });
  if(!matches)continue;
  out.push({name,height,lat,lon,...direction,provisional:true});
 }
 return out;
}
export function layoutPeakLabels(peaks,project,w,h,measure){
 const result=[],occupied=[];
 // Prefer the higher angular summit if several labels compete in a small frame.
 const sorted=[...peaks].sort((a,b)=>b.alt-a.alt||a.distance-b.distance);
 for(const p of sorted){
  const [x,y]=project(p.az,p.alt);if(x<4||x>w-4||y<20||y>h-28)continue;
  const label=p.name+' '+p.height+'m',distance=(p.distance/1000).toFixed(1)+'km',width=Math.max(measure(label),measure(distance))+8;
  for(const side of [1,-1]){
   const length=width+12,angle=side===1?-Math.PI/3:Math.PI/3;
   const ux=side*.5,uy=-Math.sqrt(3)/2,lx=x+ux*length,ly=y+uy*length;
   // Two lines are rotated along the approved leader. Bound their rotated
   // rectangles as well as the leader so labels do not collide.
   const tx=side===1?x:lx,ty=side===1?y:ly,c=Math.cos(angle),s=Math.sin(angle);
   const corners=[[0,-25],[length,-25],[0,3],[length,3]].map(([a,b])=>[tx+a*c-b*s,ty+a*s+b*c]);
   const minX=Math.min(x,lx,...corners.map(p=>p[0])),maxX=Math.max(x,lx,...corners.map(p=>p[0])),minY=Math.min(y,ly,...corners.map(p=>p[1])),maxY=Math.max(y,ly,...corners.map(p=>p[1]));
   const box={x:minX,y:minY,w:maxX-minX,h:maxY-minY};
   if(box.x<3||box.x+box.w>w-3||box.y<24||box.y+box.h>h-28||occupied.some(o=>o.x<box.x+box.w&&o.x+o.w>box.x&&o.y<box.y+box.h&&o.y+o.h>box.y))continue;
   occupied.push(box);result.push({...p,x,y,tx,ty,angle,label,distanceLabel:distance,box,side,leaderX:lx,leaderY:ly});break;
  }
 }
 return result;
}
// Resolver uses official locality results, not invented landmark names.
// Debounce on the caller; bounded in-memory cache avoids repeated requests.
export function localityResolver({fetcher=fetch,timeout=6000}={}){
 const cache=new Map();
 return async function resolve(lat,lon){
  const key=lat.toFixed(4)+','+lon.toFixed(4);
  if(cache.has(key))return cache.get(key);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
   const url='https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon);
   const response=await fetcher(url,{signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const {results}=await response.json(),name=typeof results?.lv01Nm==='string'?results.lv01Nm.trim().slice(0,100):null;
   if(cache.size>=128)cache.delete(cache.keys().next().value);
   cache.set(key,name);return name;
  }finally{clearTimeout(timer)}
 }
}

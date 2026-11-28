import {sunPosition,angleDelta,wrap,panoramaY,panoramaAltitude,horizonAt,visibilityEstimate,diskBoundary,contactEvents,DEG,clamp} from './core.mjs';

import {vectorTerrainTexture} from './vector-terrain.mjs';
import {rayTerrainTexture} from './ray-terrain.mjs';

// Field preview adapter. Real DEM samples and the existing solar model are used;
// unknown terrain is never converted to a positive visibility assertion.
export const STEP=.25;
export function project(a,alt,view,w,h){
 const k=w/view.fov;
 return [w/2+angleDelta(a,view.az)*k,h/2+(panoramaY(view.pitch)-panoramaY(alt))*k];
}
// Keep the direction under a viewport point fixed as the horizontal FOV changes.
// Vertical coordinates are linear in panoramaY, not in altitude.
export function zoomAtPoint(view, requestedFov, x, y, w, h){
 const fov=clamp(requestedFov,5,180);
 if(!(w>0&&h>0)||fov===view.fov)return {az:view.az,pitch:view.pitch,fov:view.fov};
 const delta=(view.fov-fov)/w;
 return {
  az:wrap(view.az+(x-w/2)*delta),
  pitch:clamp(panoramaAltitude(panoramaY(view.pitch)+(h/2-y)*delta),-65,75),
  fov
 };
}
export function horizon(profile,az){return profile?horizonAt(profile.total,az,STEP):null}
export function directionComplete(profile,az){
 if(!profile)return false;
 const f=wrap(az)/STEP,i=Math.floor(f),q=f-i;
 return !!profile.complete[i]&&(q<1e-10||!!profile.complete[(i+1)%profile.complete.length]);
}
export function visibility(profile,s){
 if(!profile)return {estimate:null,uncertain:true,missingHorizon:true};
 const eye=Math.max(0,profile.ground+profile.height),dip=Math.acos(6371000/(6371000+eye))/DEG;
 if(s.alt+s.radius< -dip)return {estimate:0,lower:0,upper:0,uncertain:false,missingHorizon:false};
 return visibilityEstimate(s,a=>horizon(profile,a),a=>directionComplete(profile,a));
}
export function solarAt(date,t,lat,lon){return sunPosition(date,t*60,lat,lon)}
export function dayAnalysis(profile,date,lat,lon){
 const evaluate=m=>{
  const s=sunPosition(date,m,lat,lon);
  // A body below the astronomical horizon may still be seen from a high
  // viewpoint; only reject below the spherical reference horizon of that eye.
  const v=visibility(profile,s);
  return {state:v.estimate==null?null:v.estimate===0?0:v.estimate===1?2:1,uncertain:v.uncertain};
 };
 const contacts=contactEvents(evaluate);
 // A run records each interval independently, including short reappearances.
 // An unknown interval is not joined to a known visible one.
 const runs=[];let begin=0,p=evaluate(0),last=p;
 const kind=v=>v.state==null?'unknown':v.state===0?'hidden':v.uncertain?'provisional':'visible';
 for(let t=.25;t<=1440;t+=.25){
  const q=evaluate(t);
  if(kind(q)!==kind(last)){
   let lo=t-.25,hi=t;while(hi-lo>1/60){const mid=(lo+hi)/2;if(kind(evaluate(mid))===kind(last))lo=mid;else hi=mid}
   runs.push({start:begin/60,end:hi/60,kind:kind(last)});begin=hi;last=q;
  }
 }
 if(begin<1440)runs.push({start:begin/60,end:24,kind:kind(last)});
 return {runs,contacts:contacts.map(c=>({t:c.minute/60,name:(c.to===0?'完全遮蔽':c.from===0?'出現開始':c.to===2?'全円盤出現':'部分遮蔽')+(c.uncertain?'（暫定）':'')}))};
}
export function makeTerrainTexture(profile,view,w,h,distanceColor=true,shade=null,pixelRatio=1){
 if(view.renderer==='ray')return rayTerrainTexture(profile,view,w,h,distanceColor,shade,pixelRatio);
 return vectorTerrainTexture(profile,view,w,h,distanceColor,shade,pixelRatio,STEP);
}
export {diskBoundary,panoramaY,panoramaAltitude,wrap,angleDelta,clamp};

import {sunPosition,angleDelta,wrap,panoramaY,panoramaAltitude,horizonAt,visibilityEstimate,diskBoundary,contactEvents,DEG,clamp} from './core.mjs';

import {surfaceAt,blendSurface,surfaceColor} from './coast-surface.mjs';
import {shadeColor} from './scene-light-engine.mjs';
import {textureSize,columnSubsamples,resolveCoverage} from './terrain-render-policy.mjs';

// Field preview adapter. Real DEM samples and the existing solar model are used;
// unknown terrain is never converted to a positive visibility assertion.
export const STEP=.25;
export function project(a,alt,view,w,h){
 const k=w/view.fov;
 return [w/2+angleDelta(a,view.az)*k,h/2+(panoramaY(view.pitch)-panoramaY(alt))*k];
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
 const {width:rw,height:rh}=textureSize(w,h,pixelRatio);
 const cvs=document.createElement('canvas');cvs.width=rw;cvs.height=rh;
 const ctx=cvs.getContext('2d'),image=ctx.createImageData(rw,rh),data=image.data,k=w/view.fov;
 const slopes=Float64Array.from({length:rh},(_,y)=>Math.tan(panoramaAltitude(panoramaY(view.pitch)+(h/2-(y+.5)*h/rh)/k)*DEG));
 const rowY=alt=>h/2+(panoramaY(view.pitch)-panoramaY(alt))*k;
 const eye=profile.ground+profile.height,samples=columnSubsamples(view.fov,rw,STEP),accum=new Float32Array(rh*4);
 const seaEdge=eye>0?rowY(-Math.sqrt(2*eye/6371000)/DEG)*rh/h:rh;
 for(let x=0;x<rw;x++){
  accum.fill(0);
  let firstRow=rh;
  for(let sub=0;sub<samples;sub++){
   const az=wrap(view.az+((x+(sub+.5)/samples)*w/rw-w/2)/k),a=az/STEP,i=Math.floor(a),j=(i+1)%profile.total.length,f=a-i,horizonAngle=horizon(profile,az);
   const edge=horizonAngle==null?rh:rowY(horizonAngle)*rh/h;
   const hasWater=profile.surfaces[i].water?.length||profile.surfaces[j].water?.length;
   const waterEdge=hasWater?seaEdge:rh;
   const start=Math.max(0,Math.floor(Math.min(edge,waterEdge)));firstRow=Math.min(firstRow,start);
   for(let y=start;y<rh;y++){
    const hit=blendSurface(surfaceAt(profile.surfaces[i],slopes[y],eye),surfaceAt(profile.surfaces[j],slopes[y],eye),f);
    if(!hit&&y+1<=edge)continue;
    const alpha=hit?.kind==='water'?1:clamp(y+1-edge,0,1);
    if(alpha===0)continue;
    const rgb=shadeColor(surfaceColor(hit,distanceColor),shade,x,y,rw,rh,hit),q=y*4;
    accum[q]+=rgb[0]*alpha;accum[q+1]+=rgb[1]*alpha;accum[q+2]+=rgb[2]*alpha;accum[q+3]+=alpha;
   }
  }
  // Integrate coverage/color, never blend two unrelated depths into a fake surface.
  for(let y=firstRow;y<rh;y++){const q=y*4,out=(y*rw+x)*4;data.set(resolveCoverage(accum[q],accum[q+1],accum[q+2],accum[q+3],samples),out)}
 }
 ctx.putImageData(image,0,0);
 return cvs;
}
export {diskBoundary,panoramaY,panoramaAltitude,wrap,angleDelta,clamp};

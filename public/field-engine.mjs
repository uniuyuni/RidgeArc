import {sunPosition,angleDelta,wrap,panoramaY,panoramaAltitude,horizonAt,visibilityEstimate,diskBoundary,surfaceDistance,contactEvents,DEG,clamp} from './core.mjs';

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
export function makeTerrainTexture(profile,view,w,h,distanceColor=true){
 const rw=Math.max(1,Math.min(720,Math.ceil(w))),rh=Math.max(1,Math.min(360,Math.ceil(h)));
 const cvs=document.createElement('canvas');cvs.width=rw;cvs.height=rh;
 const ctx=cvs.getContext('2d'),image=ctx.createImageData(rw,rh),data=image.data,k=w/view.fov;
 const slopes=Float64Array.from({length:rh},(_,y)=>Math.tan(panoramaAltitude(panoramaY(view.pitch)+(h/2-(y+.5)*h/rh)/k)*DEG));
 const rowY=alt=>h/2+(panoramaY(view.pitch)-panoramaY(alt))*k;
 for(let x=0;x<rw;x++){
  const az=wrap(view.az+((x+.5)*w/rw-w/2)/k),a=az/STEP,i=Math.floor(a),j=(i+1)%profile.total.length,f=a-i,horizonAngle=horizon(profile,az);
  if(horizonAngle==null)continue;
  const edge=rowY(horizonAngle)*rh/h;
  for(let y=Math.max(0,Math.floor(edge));y<rh;y++){
   let d0=surfaceDistance(profile.surfaces[i],slopes[y]),d1=surfaceDistance(profile.surfaces[j],slopes[y]);
   if(d0==null&&d1==null)continue;
   let d=d0==null?d1:d1==null?d0:d0*(1-f)+d1*f;
   const t=distanceColor?clamp(Math.log1p(d/30)/Math.log1p(70000/30),0,1):.4,q=(y*rw+x)*4;
   data[q]=Math.round(25+107*t);data[q+1]=Math.round(43+108*t);data[q+2]=Math.round(56+112*t);data[q+3]=Math.round(255*clamp(y+1-edge,0,1));
  }
 }
 ctx.putImageData(image,0,0);
 return cvs;
}
export {diskBoundary,panoramaY,panoramaAltitude,wrap,angleDelta,clamp};

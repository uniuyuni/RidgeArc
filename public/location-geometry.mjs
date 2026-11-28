import {R,DEG,wrap,clamp,destination,sunPosition,angleDelta} from './core.mjs';

// Sphere geometry at the same mean radius used by the existing field engine.
// Heights above the DEM reference surface; no refraction in terrain LOS.
export function targetDirection(from,to){
 const p=from.lat*DEG,q=to.lat*DEG,l=(to.lon-from.lon)*DEG;
 const a=Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(l/2)**2;
 const central=2*Math.asin(Math.sqrt(clamp(a,0,1))),d=central*R;
 const az=wrap(Math.atan2(Math.sin(l)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(l))/DEG);
 const horizontal=(R+to.height)*Math.sin(central),vertical=(to.height-from.height)-2*(R+to.height)*Math.sin(central/2)**2;
 return {az,alt:Math.atan2(vertical,horizontal)/DEG,distance:d};
}
// Height of the straight chord at a specified arc distance from the start.
export function chordHeight(fromHeight,toHeight,distance,along){
 if(along<=0)return fromHeight;if(along>=distance)return toHeight;
 const t=distance/R,a=along/R,b=t-a;
 const r1=R+fromHeight,r2=R+toHeight;
 // Interpolation along a spherical radial direction, not a flat plane.
 // Stable small-angle form avoids subtracting nearly equal Earth radii.
 const w1=Math.sin(b)/Math.sin(t),w2=Math.sin(a)/Math.sin(t);
 return (r1*r2)/(r2*w1+r1*w2)-R;
}
export function finiteLOS(from,to,samples,{margin=.25}={}){
 const direction=targetDirection(from,to);
 if(![from.height,to.height,direction.distance].every(Number.isFinite)||direction.distance<=0)return {status:'unknown',direction,clearance:null,missing:0};
 let minimum=Infinity,obstruction=null,missing=0;
 for(const s of samples){
  if(!(s.distance>0&&s.distance<direction.distance))continue;
  if(!Number.isFinite(s.height)){missing++;continue}
  const clearance=chordHeight(from.height,to.height,direction.distance,s.distance)-s.height;
  if(clearance<minimum){minimum=clearance;obstruction=s.distance}
 }
 return {status:minimum< -margin?'blocked':missing||minimum<=margin||!Number.isFinite(minimum)?'unknown':'sample-clear',direction,clearance:Number.isFinite(minimum)?minimum:null,obstruction,missing};
}
export function angularSeparation(a,b){
 const da=(a.alt-b.alt)*DEG,db=angleDelta(a.az,b.az)*DEG;
 const h=Math.sin(da/2)**2+Math.cos(a.alt*DEG)*Math.cos(b.alt*DEG)*Math.sin(db/2)**2;
 return 2*Math.asin(Math.sqrt(clamp(h,0,1)))/DEG;
}
// G5 candidate generator: trace back from a fixed subject along the sun's
// local azimuth at the specified time. Recompute topocentric geometry at
// each candidate instead of claiming the reverse bearing is an exact match.
export function reverseCandidates(subject,date,minute,{minM=100,maxM=10000,radialStep=100,offsets=[-1,-.5,0,.5,1]}={}){
 if(!(minM>0&&maxM>=minM&&radialStep>0&&maxM<=70000))throw Error('Invalid search range');
 const sun=sunPosition(date,minute,subject.lat,subject.lon),points=[];
 for(let d=minM;d<=maxM+1e-8;d+=radialStep)for(const offset of offsets){
  const [lat,lon]=destination(subject.lat,subject.lon,sun.az+180+offset,d);
  if(lat<20||lat>46||lon<122||lon>154)continue;
  points.push({lat,lon,distance:d,offset});
 }
 return points;
}
export function evaluateAlignment(observer,subject,date,minute,{tolerance=.27,verticalOffset=0}={}){
 const target=targetDirection(observer,subject),sun=sunPosition(date,minute,observer.lat,observer.lon);
 const separation=angularSeparation({...target,alt:target.alt+verticalOffset},sun);
 return {target,sun,separation,matched:separation<=tolerance+sun.radius};
}
// G4: assess a sampled horizon against the geometric sea-level dip. Any
// known foreground obstruction is decisive; absent data is never "clear".
export function horizonCorridor({angles,complete,eye,az,radius=.27,step=.25,tolerance=.05}){
 const dip=-Math.acos(R/(R+Math.max(0,eye)))/DEG;
 let max=-Infinity,unknown=false,checked=0;
 const first=Math.floor((az-radius)/step),last=Math.ceil((az+radius)/step);
 for(let j=first;j<=last;j++){
  const i=((j%angles.length)+angles.length)%angles.length,v=angles[i];
  if(!Number.isFinite(v)){unknown=true;continue}
  checked++;max=Math.max(max,v);if(!complete[i])unknown=true;
 }
 return {status:max>dip+tolerance?'blocked':unknown||!checked?'unknown':'sample-clear',dip,max:Number.isFinite(max)?max:null,checked};
}

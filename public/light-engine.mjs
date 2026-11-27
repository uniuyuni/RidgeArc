import {DEG,R,wrap,clamp,sunPosition} from './core.mjs';

// Visibility-Light: receiver-centered geometric rays and sampled bare-earth
// horizon. Bounds are conditional on this model, not real-world guarantees.
export const LIGHT_MODEL='bare-earth-geometric-v1';
export const LIGHT_THRESHOLD=.001;
const strips=Array.from({length:96},(_,i)=>{
 const x=-1+(i+.5)*2/96;return {x,y:Math.sqrt(1-x*x)};
});
const stripArea=strips.reduce((a,p)=>a+2*p.y,0);
export function horizonSample(profile,az){
 const n=profile.total.length,step=profile.step??360/n,f=wrap(az)/step,i=Math.floor(f)%n,j=(i+1)%n,q=f-Math.floor(f);
 const a=profile.total[i],b=profile.total[j];
 if(!Number.isFinite(a))return {angle:null,complete:false};
 if(q<1e-9)return {angle:a,complete:!!profile.complete[i]};
 if(!Number.isFinite(b))return {angle:null,complete:false};
 return {angle:a+(b-a)*q,complete:!!profile.complete[i]&&!!profile.complete[j]};
}
export function normalFromSamples(east,west,north,south,d){
 if(![east,west,north,south,d].every(Number.isFinite)||d<=0)return null;
 const x=-(east-west)/(2*d),y=-(north-south)/(2*d),l=Math.hypot(x,y,1);
 return [x/l,y/l,1/l];
}
export function direction(az,alt){
 const a=az*DEG,e=alt*DEG,c=Math.cos(e);return [c*Math.sin(a),c*Math.cos(a),Math.sin(e)];
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function receiverLight(profile,s,normal=profile.normal,readHorizon=a=>horizonSample(profile,a)){
 const altitude=s.geo??s.alt,az=s.az,radius=s.radius;
 if(![altitude,az,radius].every(Number.isFinite)||radius<=0)throw Error('Invalid solar direction');
 const a=az*DEG,e=altitude*DEG,r=radius*DEG,center=direction(az,altitude);
 const right=[Math.cos(a),-Math.sin(a),0],up=[-Math.sin(e)*Math.sin(a),-Math.sin(e)*Math.cos(a),Math.cos(e)];
 const c=normal?dot(normal,center):null,rx=normal?dot(normal,right)*r:0,ry=normal?dot(normal,up)*r:0;
 let vlo=0,vhi=0,vest=0,ilo=0,ihi=0,iest=0,unknown=false,missing=false;
 // Integrate positive projected incidence over each visible vertical chord.
 // Direction is linearized over the small solar disk.
 const integral=(x,lo,hi)=>{
  if(hi<=lo)return 0;
  const k=c+rx*x;
  if(Math.abs(ry)<1e-14)return Math.max(0,k)*(hi-lo);
  const root=-k/ry;
  if(ry>0)lo=Math.max(lo,root);else hi=Math.min(hi,root);
  return hi>lo?Math.max(0,(hi-lo)*(k+ry*(lo+hi)/2)):0;
 };
 for(const {x,y} of strips){
  const h=readHorizon(az+x*radius/Math.max(.05,Math.cos(e)));
  const lo=h.angle==null?-y:clamp((h.angle-altitude)/radius,-y,y);
  const area=y-lo,energy=normal?integral(x,lo,y):0;
  vhi+=area;ihi+=energy;
  if(h.angle==null){missing=true;unknown=true;continue;}
  vest+=area;iest+=energy;
  if(h.complete){vlo+=area;ilo+=energy;}
  else if(area>0)unknown=true;
 }
 const norm=v=>clamp(v/stripArea,0,1);
 return {model:LIGHT_MODEL,disk:{lower:norm(vlo),upper:norm(vhi),estimate:missing?null:norm(vest)},
  direct:normal?{lower:norm(ilo),upper:norm(ihi),estimate:missing?null:norm(iest)}:null,
  incidence:normal?c:null,uncertain:unknown,missing,normal};
}
export function lightAt(profile,date,minute,lat,lon){
 return receiverLight(profile,sunPosition(date,minute,lat,lon));
}
export function lightDay(profile,date,lat,lon,stepMinutes=.25){
 if(!Number.isFinite(stepMinutes)||stepMinutes<=0)throw Error('Invalid scan interval');
 const kind=v=>!v.direct?'unknown':v.direct.upper<=LIGHT_THRESHOLD?'shadow':v.direct.lower>LIGHT_THRESHOLD?'lit':'unknown';
 const sample=t=>kind(lightAt(profile,date,t,lat,lon));
 const runs=[];let start=0,previous=sample(0);
 for(let t=Math.min(stepMinutes,1440),last=0;t>last;t=Math.min(t+stepMinutes,1440)){
  const q=sample(t);
  if(q!==previous){
   let lo=last,hi=t;
   while(hi-lo>1/60){const mid=(lo+hi)/2;if(sample(mid)===previous)lo=mid;else hi=mid;}
   runs.push({start,end:hi,kind:previous});start=hi;previous=q;
  }
  last=t;if(t===1440)break;
 }
 runs.push({start,end:1440,kind:previous});
 const lit=runs.filter(x=>x.kind==='lit'),possible=runs.filter(x=>x.kind!=='shadow');
 return {runs,first:lit[0]?.start??null,last:lit.at(-1)?.end??null,
  possibleFirst:possible[0]?.start??null,possibleLast:possible.at(-1)?.end??null,
  threshold:LIGHT_THRESHOLD,scanMinutes:stepMinutes,model:LIGHT_MODEL};
}
// Same sampled spherical-curvature model as terrain drawing, without refraction.
export function receiverHorizon(distances,heights,ground,bias=.05){
 let max=-Infinity;
 for(let i=0;i<distances.length;i++){
  const h=heights[i],d=distances[i];
  if(Number.isFinite(h)&&d>0)max=Math.max(max,Math.atan2(h-ground-bias-d*d/(2*R),d)/DEG);
 }
 return Number.isFinite(max)?max:null;
}

import {R,DEG,clamp,panoramaY,panoramaAltitude} from './core.mjs';

// Clear standard-atmosphere, single-scattering reference. Wavelength bands
// are approximate RGB proxies; no weather, aerosol forecast or exposure auto
// compensation. Linear radiance is kept separate from display conversion.
const TOP=80000,HR=8000,HM=1200;
const BETA_R=[5.8e-6,13.5e-6,33.1e-6],BETA_M=3e-6,ASYMMETRY=.76;
const VIEW_STEPS=18,SUN_STEPS=10;
const rad=v=>v*DEG;
function exitDistance(radius,mu){
 const t=R+TOP;return Math.max(0,-radius*mu+Math.sqrt(Math.max(0,t*t-radius*radius*(1-mu*mu))));
}
function altitudeAt(radius,mu,d){return Math.max(0,Math.sqrt(radius*radius+2*radius*mu*d+d*d)-R)}
function density(height){return [Math.exp(-height/HR),Math.exp(-height/HM)]}
function integrateDepth(radius,mu,distance,steps){
 let r=0,m=0;for(let i=0;i<steps;i++){
  const a=distance*(i/steps)**2,b=distance*((i+1)/steps)**2;
  const [dr,dm]=density(altitudeAt(radius,mu,(a+b)/2));r+=dr*(b-a);m+=dm*(b-a);
 }return [r,m];
}
export function skyRadiance({az,alt,sunAz,sunAlt,height=0}){
 const eye=R+clamp(height,0,TOP-1),e=rad(clamp(alt,0,89.9)),a=rad(az-sunAz),se=rad(sunAlt);
 const mu=Math.sin(e),sunMu=Math.sin(se),cos=Math.cos(e)*Math.cos(se)*Math.cos(a)+mu*sunMu;
 const pr=3/(16*Math.PI)*(1+cos*cos),g=ASYMMETRY,pm=(1-g*g)/(4*Math.PI*(1+g*g-2*g*cos)**1.5);
 const far=exitDistance(eye,mu),out=[0,0,0];let viewR=0,viewM=0;
 for(let i=0;i<VIEW_STEPS;i++){
  const lo=far*(i/VIEW_STEPS)**2,hi=far*((i+1)/VIEW_STEPS)**2,d=(lo+hi)/2,ds=hi-lo;
  const radius=R+altitudeAt(eye,mu,d),[dr,dm]=density(radius-R);
  const localSun=(eye*sunMu+d*cos)/radius;
  // Earth shadow: the path toward the sun hits the solid Earth.
  if(localSun>=0||radius*radius*(1-localSun*localSun)>R*R){
   const [sr,sm]=integrateDepth(radius,localSun,exitDistance(radius,localSun),SUN_STEPS);
   for(let k=0;k<3;k++){
    const optical=BETA_R[k]*(viewR+dr*ds*.5+sr)+BETA_M*(viewM+dm*ds*.5+sm);
    out[k]+=Math.exp(-optical)*(BETA_R[k]*dr*pr+BETA_M*dm*pm*.9)*ds;
   }
  }
  viewR+=dr*ds;viewM+=dm*ds;
 }
 // A dim, explicitly nonphysical display floor makes the UI navigable at
 // night. Stars, moonlight and multiple scattering are separate features.
 return out.map((v,k)=>v+[.000001,.0000015,.000003][k]);
}
export function linearToDisplay(v,exposure=20){
 const t=1-Math.exp(-Math.max(0,v)*exposure);
 return Math.round(255*(t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055));
}
export function skyRGB(args){return skyRadiance(args).map(v=>linearToDisplay(v))}
export function surfaceIrradiance({sunAz,sunAlt,height=0,normal,direct}){
 const radius=R+clamp(height,0,TOP-1),mu=Math.sin(rad(sunAlt)),blocked=mu<0&&radius*radius*(1-mu*mu)<=R*R;
 const depth=blocked?null:integrateDepth(radius,mu,exitDistance(radius,mu),SUN_STEPS);
 const beam=BETA_R.map(beta=>depth?Math.exp(-beta*depth[0]-BETA_M*depth[1])*Math.max(0,direct):0);
 // Two Gauss nodes in sin(alt), four azimuths: coarse hemispheric sky
 // integral with cosine incidence. No measured sky-view mask yet.
 const diffuse=[0,0,0];
 for(const u of [.2113248654,.7886751346])for(const az of [0,90,180,270]){
  const alt=Math.asin(u)/DEG,a=rad(az),c=Math.sqrt(1-u*u),inc=Math.max(0,normal[0]*c*Math.sin(a)+normal[1]*c*Math.cos(a)+normal[2]*u);
  const sky=skyRadiance({az,alt,sunAz,sunAlt,height});
  for(let k=0;k<3;k++)diffuse[k]+=sky[k]*inc*Math.PI/4;
 }
 return {direct:beam,diffuse};
}
export function lightDirection(observer,subject,sun){
 const p=subject.lat*DEG,q=observer.lat*DEG,l=(observer.lon-subject.lon)*DEG;
 const az=Math.atan2(Math.sin(l)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(l))/DEG;
 const angle=Math.acos(clamp(Math.cos(rad(sun.az-az)),-1,1))/DEG;
 return {angle,kind:angle<=45?'順光':angle>=135?'逆光':'斜光'};
}
export function twilight(sunAltitude){
 return sunAltitude>=0?'昼間':sunAltitude>=-6?'市民薄明':sunAltitude>=-12?'航海薄明':sunAltitude>=-18?'天文薄明':'夜間';
}
const skyCache=new Map();
export function drawClearSky(ctx,w,h,view,sun,height){
 const cols=Math.min(64,Math.max(16,Math.ceil(w/24))),rows=Math.min(40,Math.max(12,Math.ceil(h/24))),key=[cols,rows,w/h,view.az,view.pitch,view.fov,sun.az,sun.geo,height].join('/');
 let cached=skyCache.get(key);
 if(!cached){
  const canvas=document.createElement('canvas');canvas.width=cols;canvas.height=rows;const c=canvas.getContext('2d'),im=c.createImageData(cols,rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const az=view.az+((x+.5)/cols-.5)*view.fov,alt=panoramaAltitude(panoramaY(view.pitch)+(.5-(y+.5)/rows)*h/w*view.fov);
   const rgb=skyRGB({az,alt,sunAz:sun.az,sunAlt:sun.geo,height:Math.max(0,height||0)});im.data.set([...rgb,255],(y*cols+x)*4);
  }
  c.putImageData(im,0,0);cached={canvas};skyCache.set(key,cached);if(skyCache.size>2)skyCache.delete(skyCache.keys().next().value);
 }
 ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(cached.canvas,0,0,w,h);ctx.restore();
}

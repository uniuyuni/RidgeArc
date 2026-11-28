import {project,diskBoundary} from './field-engine.mjs';

export const LOUPE_FOV=2;
export const SUN_MIN_DIAMETER=6;
export const SUN_MARKER_RADIUS=7.5;
export const SUN_MARKER_COLOR='#ff625f';
export const SUN_OPTION_DEFAULTS=Object.freeze({minimum:true,marker:false,glow:true});

export function loadSunOptions(storage,key){
 const result={...SUN_OPTION_DEFAULTS};
 try{const saved=JSON.parse(storage.getItem(key)||'{}');for(const name of Object.keys(result))if(typeof saved?.[name]==='boolean')result[name]=saved[name]}catch{}
 return result;
}
export function sunDiskPath(c,s,view,w,h,minimum=false){
 const center=project(s.az,s.alt,view,w,h);
 const points=diskBoundary(s,48).map(([az,alt])=>project(az,alt,view,w,h));
 if(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))>w/2)return false;
 const diameter=s.radius*2*w/view.fov;
 const scale=minimum?Math.max(1,SUN_MIN_DIAMETER/diameter):1;
 c.beginPath();points.forEach(([x,y],i)=>{const px=center[0]+(x-center[0])*scale,py=center[1]+(y-center[1])*scale;if(i)c.lineTo(px,py);else c.moveTo(px,py)});c.closePath();
 return true;
}
export function solarDisplayRadius(s,view,w,options){
 const r=s.radius*w/view.fov;
 return options.minimum?Math.max(SUN_MIN_DIAMETER/2,r):r;
}
export function showSunMarker(s,view,w,options){return options.marker&&solarDisplayRadius(s,view,w,options)<SUN_MARKER_RADIUS}
// Visual aid opacity follows the physical visible fraction, not a binary switch.
export function solarGlowOpacity(visibility){return visibility.estimate==null?1:Math.max(0,Math.min(1,visibility.estimate))}
export function drawSolarGlow(c,x,y,r,opacity=1){
 if(opacity<=0)return;
 const extent=Math.max(18,r*.8),outer=r+extent;
 const gradient=c.createRadialGradient(x,y,r,x,y,outer);
 gradient.addColorStop(0,'rgba(255,255,235,0.95)');
 gradient.addColorStop(.3,'rgba(255,231,159,0.72)');
 gradient.addColorStop(.65,'rgba(255,208,120,0.32)');
 gradient.addColorStop(1,'rgba(255,208,120,0)');
 c.save();c.globalAlpha*=opacity;c.fillStyle=gradient;c.fillRect(x-outer,y-outer,outer*2,outer*2);c.restore();
}
export function drawSunMarker(c,x,y,hidden){
 c.save();c.strokeStyle=SUN_MARKER_COLOR;c.lineWidth=1.2;if(hidden)c.setLineDash([2,2]);c.beginPath();c.arc(x,y,SUN_MARKER_RADIUS,0,Math.PI*2);c.stroke();c.restore();
}

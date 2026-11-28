import {DEG,wrap,panoramaY,panoramaAltitude,horizonAt} from './core.mjs';
import {surfaceAt,blendSurface} from './coast-surface.mjs';

// Experimental screen-ray sampling of the existing radial DEM profile.
// This is not a new DEM or an exact 3D mesh ray cast.
export function surfaceColumn(profile,az,step=.25){
 const f=wrap(az)/step,i=Math.floor(f),j=(i+1)%profile.surfaces.length;
 const angle=horizonAt(profile.total,az,step);
 return {left:profile.surfaces[i],right:profile.surfaces[j],fraction:f-i,
  skyline:angle==null?null:Math.tan(angle*DEG),eye:profile.ground+profile.height};
}
export function sampleColumn(column,slope){
 const {left,right,fraction,skyline,eye}=column;
 if(skyline!==null&&slope>skyline)return null;
 const a=surfaceAt(left,slope,eye);
 const hit=fraction===0?a:blendSurface(a,surfaceAt(right,slope,eye),fraction);
 if(hit)return hit;
 // A known skyline can hide the sky even when the particular intersection
 // is missing. Do not assign a fictitious distance or sunlit land.
 return skyline!==null?{kind:'unknown',distance:null}:null;
}
export function viewAzimuth(view,x,w){return wrap(view.az+(x-w/2)*view.fov/w)}
export function viewSlope(view,y,w,h){
 return Math.tan(panoramaAltitude(panoramaY(view.pitch)+(h/2-y)*view.fov/w)*DEG);
}

import {R,DEG,clamp} from './core.mjs';

// Display-only land/water material. GSI pale map fill sampled in Toyama Bay.
// Unknown/antialiased pixels never acquire a water label. Palette is not
// a hydrographic polygon, and rivers/lakes may share it.
export function isWaterPixel(rgba,i){
 return rgba?.[i]===190&&rgba[i+1]===210&&rgba[i+2]===255&&rgba[i+3]===255;
}
export function waterRanges(distances,mask){
 const ranges=[];let start=null,last=null;
 for(let i=0;i<distances.length;i++){
  if(mask[i]){if(start===null)start=distances[i];last=distances[i];}
  else if(start!==null){if(last>start)ranges.push([start,last]);start=null;last=null;}
 }
 if(start!==null&&last>start)ranges.push([start,last]);
 return ranges;
}
// Near intersection with a sea-level sphere in the shared quadratic
// curvature approximation. Returns null above the sea horizon.
export function seaDistance(slope,eye){
 if(!(eye>0)||slope>=0)return null;
 const discriminant=slope*slope-2*eye/R;
 if(discriminant<0)return null;
 return 2*eye/(-slope+Math.sqrt(discriminant));
}
export function firstSurface(surface,slope){
 const a=surface.segments;if(!a.length||slope>a[a.length-1].hi)return null;
 let lo=0,hi=a.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(a[mid].hi>=slope)hi=mid;else lo=mid+1;}
 const p=a[lo];
 // The old gap sentinel was a fabricated constant distance across an
 // entire angular interval. Only use a genuine continuous segment.
 if(p.near===p.d||Math.abs(slope-p.m)<1e-12||p.b===0)return null;
 const d=p.b/(slope-p.m);
 return d>=p.near-1e-6&&d<=p.d+1e-6?clamp(d,p.near,p.d):null;
}
export function surfaceAt(surface,slope,eye){
 const land=firstSurface(surface,slope);
 const sea=seaDistance(slope,eye);
 if(sea!==null&&surface.water?.some(([a,b])=>sea>=a&&sea<=b)&&(land===null||sea<land))return {kind:'water',distance:sea};
 return land===null?null:{kind:'land',distance:land};
}
// Do not interpolate distances/materials across unrelated surfaces.
export function blendSurface(a,b,f){
 if(!a||!b||a.kind!==b.kind||Math.max(a.distance,b.distance)>2*Math.min(a.distance,b.distance))return f<.5?a:b;
 return {kind:a.kind,distance:a.distance+(b.distance-a.distance)*f};
}
export function surfaceColor(hit,distanceColor=true){
 if(!hit)return [76,87,95];
 const d=hit.distance,t=distanceColor?clamp(Math.log1p(d/30)/Math.log1p(70000/30),0,1):.4;
 if(hit.kind==='water'){
  const q=clamp(Math.log1p(d/15)/Math.log1p(8000/15),0,1);
  return [Math.round(47+64*q),Math.round(75+57*q),Math.round(90+52*q)];
 }
 // Warm near-ground tint, progressively replaced by atmospheric blue.
 const ground=distanceColor?Math.exp(-d/250):0;
 return [Math.round(25+107*t+26*ground),Math.round(43+108*t+19*ground),Math.round(56+112*t-10*ground)];
}

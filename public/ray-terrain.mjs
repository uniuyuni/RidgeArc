import {surfaceColumn,sampleColumn,viewAzimuth,viewSlope} from './surface-sampling.mjs';
import {surfaceColor} from './coast-surface.mjs';
import {shadeColor} from './scene-light-engine.mjs';
import {textureSize} from './terrain-render-policy.mjs';

// Bounded CPU reference path for comparing topology and illumination.
// Never replace the production renderer without image and latency validation.
export const RAY_RENDER_PIXELS=350000;
export function rayTerrainTexture(profile,view,w,h,distanceColor=true,shade=null,pixelRatio=1){
 const start=performance.now();
 const {width:rw,height:rh}=textureSize(w,h,pixelRatio,RAY_RENDER_PIXELS);
 const canvas=document.createElement('canvas');canvas.width=rw;canvas.height=rh;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(rw,rh),pixels=image.data;
 const columns=Array.from({length:rw},(_,x)=>surfaceColumn(profile,viewAzimuth(view,(x+.5)*w/rw,w)));
 const slopes=Array.from({length:rh},(_,y)=>viewSlope(view,(y+.5)*h/rh,w,h));
 const neutral=shadeColor(surfaceColor(null),shade,0,0,w,h,null);
 const water=surfaceColor({kind:'water',distance:600},distanceColor);
 for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){
  const hit=sampleColumn(columns[x],slopes[y]);if(!hit)continue;
  const rgb=hit.kind==='unknown'?neutral:hit.kind==='water'?water:
   shadeColor(surfaceColor(hit,distanceColor),shade,(x+.5)*w/rw,(y+.5)*h/rh,w,h,hit);
  const i=4*(y*rw+x);pixels[i]=rgb[0];pixels[i+1]=rgb[1];pixels[i+2]=rgb[2];pixels[i+3]=255;
 }
 ctx.putImageData(image,0,0);
 canvas.dataset.renderMs=(performance.now()-start).toFixed(1);
 return canvas;
}

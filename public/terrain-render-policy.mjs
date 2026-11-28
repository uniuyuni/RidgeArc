// Render sampling is deliberately separate from the measured elevation model.
// Keep screen aspect ratio and bound pixel cost rather than cap both axes independently.
export const MAX_TERRAIN_PIXELS=1200000;
export function textureSize(width,height,pixelRatio=1,budget=MAX_TERRAIN_PIXELS){
 const w=Math.max(1,width),h=Math.max(1,height);
 const scale=Math.min(Math.max(1,pixelRatio),Math.sqrt(budget/(w*h)));
 return {width:Math.max(1,Math.floor(w*scale)),height:Math.max(1,Math.floor(h*scale))};
}
// Integrate narrow objects over a pixel's angular footprint, rather than
// rely on a single center hit. This adds coverage, not invented geometry.
export function columnSubsamples(fov,width,rayStep){
 return Math.max(2,Math.min(4,Math.ceil(fov/width/rayStep)*2));
}
export function resolveCoverage(red,green,blue,alpha,sampleCount){
 if(alpha<=0)return [0,0,0,0];
 return [Math.round(red/alpha),Math.round(green/alpha),Math.round(blue/alpha),Math.round(255*alpha/sampleCount)];
}

// Interpolate only displayed radiance/coverage between angular samples.
// Depth and analytical horizon remain measured; no interpolated hit is
// supplied to the lighting or visibility engine.
export function mixDisplaySamples(a,b,f){
 const wa=a.alpha*(1-f),wb=b.alpha*f,alpha=wa+wb;
 if(alpha<=0)return {rgb:[0,0,0],alpha:0};
 return {rgb:a.rgb.map((v,i)=>(v*wa+b.rgb[i]*wb)/alpha),alpha};
}

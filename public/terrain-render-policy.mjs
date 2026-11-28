// Render sampling is deliberately separate from the measured elevation model.
// Keep screen aspect ratio and bound pixel cost rather than cap both axes independently.
export const MAX_TERRAIN_PIXELS=1200000;
export function textureSize(width,height,pixelRatio=1,budget=MAX_TERRAIN_PIXELS){
 const w=Math.max(1,width),h=Math.max(1,height);
 const scale=Math.min(Math.max(1,pixelRatio),Math.sqrt(budget/(w*h)));
 return {width:Math.max(1,Math.floor(w*scale)),height:Math.max(1,Math.floor(h*scale))};
}

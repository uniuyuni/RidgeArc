import {R,DEG,wrap,clamp,angleDelta,panoramaY,panoramaAltitude,destination,sunPosition} from './core.mjs';
import {surfaceAt,blendSurface} from './coast-surface.mjs';
import {normalFromSamples,receiverLight,receiverHorizon} from './light-engine.mjs';
import {surfaceIrradiance} from './clear-sky.mjs';
import {sampleElevationBatch} from './terrain-store.mjs';

// Bounded receiver grid derived from visible land, not from camera-facing
// normals. No rendering shadow is fed back into visibility/precise analysis.
export const SCENE_COLS=32,SCENE_ROWS=20;
export const SCENE_MODEL='sampled-receiver-scene-v1';
const distances=Float64Array.from([
 10,20,30,40,50,70,100,150,200,300,450,600,800,1000,1500,2000,
 ...Array.from({length:28},(_,i)=>2250+i*250),
 ...Array.from({length:61},(_,i)=>10000+i*1000)
]);
export function sceneReceivers(profile,view,w,h,cols=SCENE_COLS,rows=SCENE_ROWS){
 const points=[],index=new Int16Array(cols*rows);index.fill(-1);
 const depth=new Float32Array(cols*rows),k=w/view.fov,eye=profile.ground+profile.height;
 const seen=new Map();
 for(let y=0;y<rows;y++){
  const alt=panoramaAltitude(panoramaY(view.pitch)+(h/2-(y+.5)*h/rows)/k),slope=Math.tan(alt*DEG);
  for(let x=0;x<cols;x++){
   const az=wrap(view.az+((x+.5)*w/cols-w/2)/k),a=az/.25,i=Math.floor(a),j=(i+1)%profile.surfaces.length;
   const hit=blendSurface(surfaceAt(profile.surfaces[i],slope,eye),surfaceAt(profile.surfaces[j],slope,eye),a-i);
   if(!hit||hit.kind!=='land')continue;
   const d=hit.distance;
   if(d<25)continue; // sub-baseline local geometry is not shadeable by this model
   const [lat,lon]=destination(view.lat,view.lon,az,d);
   const h=eye+slope*d+d*d/(2*R),key=[Math.round(lat*1e5),Math.round(lon*1e5)].join('/');
   let idx=seen.get(key);
   if(idx===undefined){idx=points.length;seen.set(key,idx);points.push({lat,lon,h,d});}
   index[y*cols+x]=idx;depth[y*cols+x]=d;
  }
 }
 return {cols,rows,index,depth,points};
}
function at(p,az,d,detail){const [lat,lon]=destination(p.lat,p.lon,az,d);return {lat,lon,detail};}
export async function prepareReceivers(points,options={}){
 const samples=points.flatMap(p=>[{lat:p.lat,lon:p.lon,detail:'near'},...([90,270,0,180].map(a=>at(p,a,20,'near')))]);
 const values=await sampleElevationBatch(samples,{...options,strictNear:true});
 if(!values)return null;
 return points.map((p,i)=>{
  const z=values[i*5],normal=normalFromSamples(...values.slice(i*5+1,i*5+5),20);
  // A coarse camera surface may not identify the same fine DEM patch.
  const tolerance=clamp(p.d*Math.tan(.25*DEG),5,80);
  return {...p,z,normal:Math.abs(z-p.h)<=tolerance?normal:null};
 });
}
export function directionalHorizon(s,angles,az){
 const span=s.radius/Math.max(.05,Math.cos(s.geo*DEG)),q=clamp(angleDelta(az,s.az)/span,-1,1);
 const i=q<0?0:1,f=q<0?q+1:q;
 const a=angles[i],b=angles[i+1];
 if(a.angle==null||b.angle==null)return {angle:null,complete:false};
 return {angle:a.angle+(b.angle-a.angle)*f,complete:a.complete&&b.complete};
}
export async function shadeReceivers(points,date,minute,options={}){
 const samples=[],jobs=[];
 for(let i=0;i<points.length;i++){
  const p=points[i];if(!p.normal||!Number.isFinite(p.z))continue;
  const s=sunPosition(date,minute,p.lat,p.lon);
  const span=s.radius/Math.max(.05,Math.cos(s.geo*DEG)),start=samples.length;
  for(const az of [s.az-span,s.az,s.az+span]){
   for(const d of distances)samples.push(at(p,az,d,d<=600?'near':d<=10000?'mid':'far'));
  }
  jobs.push({i,p,s,start});
 }
 const out=points.map(()=>({kind:'unknown',value:null}));
 if(!jobs.length)return out;
 const heights=await sampleElevationBatch(samples,options);if(!heights)return null;
 for(const {i,p,s,start} of jobs){
  const horizons=[];
  for(let j=0;j<3;j++){
   const row=heights.subarray(start+j*distances.length,start+(j+1)*distances.length);
   horizons.push({angle:receiverHorizon(distances,row,p.z),complete:row.every(Number.isFinite)});
  }
  const v=receiverLight({},s,p.normal,a=>directionalHorizon(s,horizons,a));
  // Even complete sampled profiles are provisional, not real-world bounds.
  const value=v.direct.upper<=.001?0:v.direct.estimate;
  if(value!==null){const kind=value===0?'shadow':v.uncertain?'provisional':'lit';out[i]={kind,value,illumination:surfaceIrradiance({sunAz:s.az,sunAlt:s.geo,height:p.z,normal:p.normal,direct:value})}}
 }
 return out;
}
export function shadeColor(rgb,grid,x,y,w,h,hit){
 if(!grid||hit?.kind!=='land')return rgb;
 const i=Math.min(grid.rows-1,Math.floor(y/h*grid.rows))*grid.cols+Math.min(grid.cols-1,Math.floor(x/w*grid.cols));
 const d=grid.depth[i],v=grid.values[grid.index[i]];
 if(!v||v.value===null||!d||Math.max(d,hit.distance)>1.6*Math.min(d,hit.distance))return rgb;
 if(!v.illumination)return rgb;
 const weight=v.kind==='provisional'?.55:1;
 return rgb.map((c,j)=>{
  const x=c/255,linear=x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
  const energy=1.4*(v.illumination.direct[j]+v.illumination.diffuse[j]),y=clamp(linear*energy,0,1);
  const display=255*(y<=.0031308?12.92*y:1.055*y**(1/2.4)-.055);
  return Math.round(c+(display-c)*weight);
 });
}

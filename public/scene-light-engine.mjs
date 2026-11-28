import {R,DEG,wrap,clamp,angleDelta,panoramaY,panoramaAltitude,destination,sunPosition} from './core.mjs';
import {surfaceAt,blendSurface} from './coast-surface.mjs';
import {normalFromSamples,receiverLight,receiverHorizon} from './light-engine.mjs';
import {surfaceIrradiance,linearToDisplay} from './clear-sky.mjs';
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
// A missing receiver has only a standard-sky ambient reference, not a
// fabricated sunlit surface. Never substitute full-strength distance color.
export function ambientReference(s,height=0){
 return surfaceIrradiance({sunAz:s.az,sunAlt:s.geo,height,normal:[0,0,1],direct:0}).diffuse;
}
function receiverEnergy(grid,i,distance){
 const depth=grid.depth?.[i],v=grid.values?.[grid.index?.[i]],ambient=grid.ambient;
 if(!depth||!v?.illumination||v.value==null)return ambient;
 const ratio=Math.max(depth,distance)/Math.min(depth,distance);
 const weight=clamp((1.85-ratio)/.60,0,1)*(v.kind==='provisional'?.55:1);
 return ambient.map((a,k)=>a+(v.illumination.direct[k]+v.illumination.diffuse[k]-a)*weight);
}
export function shadeColor(rgb,grid,x,y,w,h,hit){
 if(!grid||hit?.kind==='water')return rgb;
 const ambient=grid.ambient??[.08,.08,.08];
 const g=grid.ambient?grid:{...grid,ambient};
 let energy=ambient;
 if(hit?.kind==='land'&&g.cols&&g.rows&&Number.isFinite(hit.distance)){
  const u=clamp(x/w*g.cols-.5,0,g.cols-1),v=clamp(y/h*g.rows-.5,0,g.rows-1),a=Math.floor(u),b=Math.floor(v),c=Math.min(a+1,g.cols-1),d=Math.min(b+1,g.rows-1),fx=u-a,fy=v-b;
  const e00=receiverEnergy(g,b*g.cols+a,hit.distance),e10=receiverEnergy(g,b*g.cols+c,hit.distance),e01=receiverEnergy(g,d*g.cols+a,hit.distance),e11=receiverEnergy(g,d*g.cols+c,hit.distance);
  energy=ambient.map((_,k)=>(e00[k]*(1-fx)+e10[k]*fx)*(1-fy)+(e01[k]*(1-fx)+e11[k]*fx)*fy);
 }
 // Match the sky's fixed exposure and use Lambertian radiance E*rho/pi.
 // The original palette remains an uncalibrated reflectance proxy.
 return rgb.map((c,j)=>{
  const x=c/255,linear=x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
  return linearToDisplay(linear*Math.max(0,energy[j])/Math.PI);
 });
}

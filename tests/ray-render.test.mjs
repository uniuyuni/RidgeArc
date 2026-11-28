import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceColumn,sampleColumn,viewAzimuth,viewSlope} from '../public/surface-sampling.mjs';
import {surfaceAt} from '../public/coast-surface.mjs';
import {sceneReceivers} from '../public/scene-light-engine.mjs';
import {projectTerrainRay,DEG} from '../public/core.mjs';

const profile=(height,make)=>{const surfaces=Array.from({length:1440},(_,i)=>make(i));return {ground:0,height,surfaces,total:surfaces.map(s=>s.angle)}};
const rock={segments:[{hi:.02,m:.12,b:-55,d:550,near:500},{hi:.08,m:.2,b:-960,d:8000,near:4800}],angle:Math.atan(.08)/DEG,water:[[10,5000]]};
const far={segments:[rock.segments[1]],angle:rock.angle,water:[[10,3000]]};

test('reference rays preserve actual foreground, background and sky at native ray',()=>{
 const p=profile(1.6,i=>i===1?rock:far);
 assert.equal(sampleColumn(surfaceColumn(p,.25),.015).distance,55/.105);
 assert.equal(sampleColumn(surfaceColumn(p,0),.015).distance,960/.185);
 assert.equal(sampleColumn(surfaceColumn(p,.125),.1),null);
 assert.equal(sampleColumn(surfaceColumn(p,.1),.015).distance,960/.185);
 assert.equal(sampleColumn(surfaceColumn(p,.2),.015).distance,55/.105);
});
test('common sea remains water across azimuth boundaries and eye heights',()=>{
 for(const h of [1.6,5.4,10,30]){
  const p=profile(h,i=>({segments:[],angle:0,water:[[10,i%2?5000:3000]]}));
  for(let i=0;i<=100;i++){
   const hit=sampleColumn(surfaceColumn(p,359.75+i*.005),-.02);
   assert.equal(hit.kind,'water');
   assert.ok(hit.distance>=10&&hit.distance<=3000);
  }
 }
});
test('missing intersections under known skyline stay unknown, not invented terrain',()=>{
 const p=profile(1.6,()=>({segments:[{hi:.1,m:0,b:0,d:550,near:550}],angle:Math.atan(.1)/DEG,water:[]}));
 assert.deepEqual(sampleColumn(surfaceColumn(p,0),.03),{kind:'unknown',distance:null});
 assert.equal(sampleColumn(surfaceColumn(p,0),.2),null);
 const missing=profile(1.6,()=>({segments:[],angle:null,water:[]}));
 assert.equal(sampleColumn(surfaceColumn(missing,0),-.03),null);
});
test('experimental light receivers use same land hit and distance as the reference raster',()=>{
 const p=profile(1.6,i=>i===1?rock:far),view={renderer:'ray',lat:36.8,lon:137,az:.25,pitch:.85,fov:.75};
 const w=300,h=160,g=sceneReceivers(p,view,w,h,32,20);
 let checked=0;
 for(let y=0;y<g.rows;y++)for(let x=0;x<g.cols;x++){
  const i=y*g.cols+x,hit=sampleColumn(surfaceColumn(p,viewAzimuth(view,(x+.5)*w/g.cols,w)),viewSlope(view,(y+.5)*h/g.rows,w,h));
  if(hit?.kind==='land'&&hit.distance>=25){assert.ok(g.index[i]>=0);assert.ok(Math.abs(g.depth[i]-hit.distance)<.001);checked++}
  else assert.equal(g.index[i],-1);
 }
 assert.ok(checked>0);
});

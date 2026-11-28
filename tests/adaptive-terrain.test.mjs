import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRidgeWindows,mergeRaySamples,refineRidges,RIDGE_POLICY} from '../public/adaptive-terrain.mjs';
import {textureSize,columnSubsamples,resolveCoverage,MAX_TERRAIN_PIXELS} from '../public/terrain-render-policy.mjs';
import {projectTerrainRay} from '../public/core.mjs';

test('ridge selection prioritizes angular height, not absolute elevation',()=>{
 const d=[1000,3000,3180,3360,10000,10180,10360];
 const h=[0,80,220,80,200,300,200];
 const windows=selectRidgeWindows(d,h,1.6);
 assert.equal(windows.length,1);
 assert.ok(windows[0].start<=3180&&windows[0].end>=3180);
});
test('native observations replace coarse ridge nodes and preserve gaps',()=>{
 const ds=Float64Array.of(2000,2180,2360),hs=Float64Array.of(15,400,20);
 const out=mergeRaySamples(ds,hs,[{d:2180,h:70},{d:2195,h:NaN},{d:2210,h:90}]);
 assert.deepEqual([...out.distances],[2000,2180,2195,2210,2360]);
 assert.equal(out.heights[1],70);assert.ok(Number.isNaN(out.heights[2]));
 assert.equal(hs[1],400);
 assert.ok(projectTerrainRay(out.distances,out.heights,0,1.6,true).angle<projectTerrainRay(ds,hs,0,1.6,true).angle);
});
test('ridge refinement keeps source samples at original coarse distances and limits tile requests',async()=>{
 const distances=Float64Array.of(2000,2180,2360,2540),heights=[Float64Array.of(5,200,5,5)];
 const tile=new Uint8Array(256*256*4);for(let i=0;i<tile.length;i+=4){tile[i]=0;tile[i+1]=39;tile[i+2]=16;tile[i+3]=255}
 const requested=[];
 const result=await refineRidges({target:{lat:36.8,lon:137},distances,heights,ground:0,step:.25,policy:{...RIDGE_POLICY,maxTiles:1},fetchTile:async key=>{requested.push(key);return tile}});
 assert.ok(requested.length<=1);
 assert.ok(result.rows[0].some(p=>p.d===2180&&p.h===100));
 assert.equal(result.stats.validSamples,result.rows[0].length);
});
test('missing fine tiles do not manufacture elevations',async()=>{
 const distances=Float64Array.of(2000,2180,2360),heights=[Float64Array.of(0,100,0)];
 const result=await refineRidges({target:{lat:36.8,lon:137},distances,heights,ground:0,step:.25,fetchTile:async()=>null});
 assert.equal(result.stats.validSamples,0);
 assert.deepEqual(result.rows,[[]]);
 assert.equal(mergeRaySamples(distances,heights[0],result.rows[0]).heights,heights[0]);
});
test('texture respects device scale, aspect and total pixel budget',()=>{
 assert.deepEqual(textureSize(400,200,2),{width:800,height:400});
 const size=textureSize(1920,1080,2);
 assert.ok(size.width*size.height<=MAX_TERRAIN_PIXELS);
 assert.ok(Math.abs(size.width/size.height-1920/1080)<.01);
 assert.ok(size.width>720&&size.height>360);
});
test('fractional feature coverage survives pixel averaging without invented depth',()=>{
 assert.equal(columnSubsamples(180,180,.25),4);
 assert.equal(columnSubsamples(5,800,.25),2);
 assert.deepEqual(resolveCoverage(80,100,120,1,4),[80,100,120,64]);
 assert.deepEqual(resolveCoverage(80,100,120,0,4),[0,0,0,0]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareReceivers,shadeReceivers,shadeColor,directionalHorizon,sceneReceivers} from '../public/scene-light-engine.mjs';
import {projectTerrainRay} from '../public/core.mjs';
const rgba=new Uint8ClampedArray(256*256*4);
for(let i=0;i<rgba.length;i+=4)rgba[i+3]=255;
const tile=async()=>rgba;
test('receiver grid skips water, sky and geometry inside normal baseline',()=>{
 const p=projectTerrainRay([20,100,500,1000],[0,0,0,0],0,2,true);
 const profile={ground:0,height:2,surfaces:Array(1440).fill(p)};
 const g=sceneReceivers(profile,{lat:36.7,lon:137.18,az:180,pitch:-1,fov:8},320,200,12,8);
 assert.ok(g.points.length>0);assert.ok(g.points.every(q=>q.d>=25&&Number.isFinite(q.h)));
 const empty={segments:[],water:[[1,8000]]};
 assert.equal(sceneReceivers({...profile,surfaces:Array(1440).fill(empty)},{lat:36.7,lon:137.18,az:180,pitch:-1,fov:8},320,200).points.length,0);
});
test('scene receiver DEM preparation and shading on a synthetic flat surface',async()=>{
 const points=[{lat:36.7,lon:137.18,h:0,d:1000},{lat:36.7,lon:137.19,h:1000,d:1000}];
 const p=await prepareReceivers(points,{fetchTile:tile});
 assert.equal(p[0].normal[2],1);assert.equal(p[1].normal,null);
 const day=await shadeReceivers(p,'2026-11-30',720,{fetchTile:tile});
 assert.equal(day[0].kind,'lit');assert.ok(day[0].value>.4);assert.equal(day[1].kind,'unknown');
 const night=await shadeReceivers(p,'2026-11-30',0,{fetchTile:tile});
 assert.equal(night[0].kind,'shadow');
 const missing=await shadeReceivers(p,'2026-11-30',720,{fetchTile:async()=>null});
 assert.equal(missing[0].kind,'unknown');
});
test('solar disk horizon handles north wrap and missing directions',()=>{
 const s={az:359.9,geo:0,radius:.3},h=[{angle:1,complete:true},{angle:3,complete:true},{angle:5,complete:false}];
 assert.ok(Math.abs(directionalHorizon(s,h,.05).angle-4)<1e-9);
 assert.equal(directionalHorizon(s,h,.05).complete,false);
 assert.equal(directionalHorizon(s,[h[0],{angle:null},h[2]],.05).angle,null);
});
test('scene color does not bleed across depth boundaries or onto water',()=>{
 const g={rows:1,cols:1,depth:[100],index:[0],values:[{kind:'shadow',value:0}]};
 const rgb=[100,100,100];
 assert.deepEqual(shadeColor(rgb,g,0,0,1,1,{kind:'land',distance:100}),[63,63,63]);
 assert.equal(shadeColor(rgb,g,0,0,1,1,{kind:'land',distance:1000}),rgb);
 assert.equal(shadeColor(rgb,g,0,0,1,1,{kind:'water',distance:100}),rgb);
});

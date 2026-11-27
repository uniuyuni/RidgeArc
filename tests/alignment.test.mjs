import test from 'node:test';
import assert from 'node:assert/strict';
import {angularSeparation,searchDay,searchAlignment} from '../public/alignment-search.mjs';
import {sunPosition} from '../public/core.mjs';

test('angular separation uses spherical geometry including north wrap',()=>{
 assert.ok(Math.abs(angularSeparation({az:359,alt:0},{az:1,alt:0})-2)<1e-10);
 assert.ok(angularSeparation({az:0,alt:90},{az:180,alt:90})<1e-10);
});
test('search recovers a planted off-grid solar alignment',()=>{
 const date='2026-11-30',lat=36.7,lon=137.18,minute=427.123;
 const s=sunPosition(date,minute,lat,lon);
 const found=searchDay(date,lat,lon,s,.01);
 assert.ok(found.length===1);
 assert.ok(Math.abs(found[0].minute-minute)<1/60);
 assert.ok(found[0].error<.004);
 assert.equal(found[0].status,'unknown');
});
test('alignment retains hidden and uncertain candidates',()=>{
 const date='2026-11-30',lat=36.7,lon=137.18,minute=450;
 const s=sunPosition(date,minute,lat,lon);
 const p={total:Array(1440).fill(50),complete:Array(1440).fill(true),ground:0,height:2};
 assert.equal(searchDay(date,lat,lon,s,.02,p)[0].status,'hidden');
 p.total.fill(-2);p.complete.fill(false);
 assert.equal(searchDay(date,lat,lon,s,.02,p)[0].status,'provisional');
 p.complete.fill(true);
 assert.equal(searchDay(date,lat,lon,s,.02,p)[0].status,'visible');
});
test('bounded multiday search can be cancelled',async()=>{
 const params={start:'2026-11-30',end:'2026-12-02',lat:36.7,lon:137.18,az:180,alt:30,tolerance:10};
 const results=await searchAlignment(params);
 assert.ok(results.length===3);
 assert.equal(await searchAlignment(params,{isCurrent:()=>false}),null);
 await assert.rejects(()=>searchAlignment({...params,end:'2028-01-01'}));
});

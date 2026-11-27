import test from 'node:test';
import assert from 'node:assert/strict';
import {receiverLight,lightDay,normalFromSamples,receiverHorizon,horizonSample} from '../public/light-engine.mjs';
const profile=(angle,complete=true,normal=[0,0,1])=>({total:Array(1440).fill(angle),complete:Array(1440).fill(complete),normal});
const solar=(geo,az=180)=>({geo,az,radius:.266});
test('receiver disk and incidence are independent',()=>{
 const v=receiverLight(profile(0),solar(0));
 assert.ok(Math.abs(v.disk.estimate-.5)<.002);
 assert.ok(Math.abs(v.direct.estimate-.000985184)<.00001);
 const vertical=receiverLight(profile(0,true,[0,1,0]),solar(30));
 assert.equal(vertical.disk.estimate,1);assert.equal(vertical.direct.estimate,0);
});
test('disk fraction matches analytic straight skyline within one percentage point',()=>{
 for(let i=0;i<=200;i++){
  const u=-1+2*i/200,ref=(Math.acos(-u)+u*Math.sqrt(Math.max(0,1-u*u)))/Math.PI;
  assert.ok(Math.abs(receiverLight(profile(0),solar(u*.266)).disk.estimate-ref)<.01);
 }
});
test('missing terrain stays unknown and known blockers block',()=>{
 const miss=receiverLight(profile(null),solar(20));assert.equal(miss.disk.estimate,null);assert.equal(miss.disk.lower,0);assert.equal(miss.disk.upper,1);
 const incomplete=receiverLight(profile(0,false),solar(20));assert.equal(incomplete.direct.lower,0);assert.ok(incomplete.direct.upper>.3);assert.equal(incomplete.uncertain,true);
 const blocked=receiverLight(profile(40,false),solar(20));assert.equal(blocked.direct.upper,0);assert.equal(blocked.disk.upper,0);
});
test('normal, curvature and missing slope',()=>{
 assert.deepEqual(normalFromSamples(10,10,10,10,20),[-0,-0,1]);
 const n=normalFromSamples(20,0,10,10,10);assert.ok(Math.abs(n[0]+Math.SQRT1_2)<1e-12);
 assert.equal(normalFromSamples(20,null,10,10,10),null);
 assert.equal(receiverLight(profile(0,true,null),solar(30)).direct,null);
 assert.ok(receiverHorizon([50000],[250],0)<.1);
});
test('cyclic horizon and exact known sample beside missing direction',()=>{
 const p={total:[2,4,6,null],complete:[true,true,true,false],step:90};
 assert.deepEqual(horizonSample(p,0),{angle:2,complete:true});
 assert.deepEqual(horizonSample(p,135),{angle:5,complete:true});
 assert.equal(horizonSample(p,315).angle,null);assert.equal(horizonSample(p,180).angle,6);
});
test('daylight interval partition and incomplete data',()=>{
 const d=lightDay(profile(0),'2026-11-30',36.7,137.18);
 assert.ok(d.first>390&&d.first<450);assert.ok(d.last>960&&d.last<1020);
 assert.equal(d.runs[0].start,0);assert.equal(d.runs.at(-1).end,1440);
 for(let i=1;i<d.runs.length;i++)assert.equal(d.runs[i-1].end,d.runs[i].start);
 const missing=lightDay(profile(0,false),'2026-11-30',36.7,137.18,2);
 assert.equal(missing.first,null);assert.ok(missing.possibleFirst!=null);
 const noNormal=lightDay(profile(0,true,null),'2026-11-30',36.7,137.18,2);
 assert.equal(noNormal.first,null);assert.equal(noNormal.possibleFirst,0);
});

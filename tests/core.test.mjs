import test from 'node:test';
import assert from 'node:assert/strict';
import {sunPosition,decodeElevation,elevationAngle,diskVisibility,horizonAt,destination,tilePixel} from '../public/core.mjs';
test('GSI elevation encoding',()=>{assert.equal(decodeElevation(0,0,100),1);assert.equal(decodeElevation(128,0,0),null);assert.equal(decodeElevation(255,255,156),-1)});
test('Tanzawa solar direction at 15:27 JST',()=>{const s=sunPosition('2026-11-22',927,35.416459,139.048985);assert.ok(s.az>234&&s.az<237);assert.ok(s.alt>10&&s.alt<12)});
test('disk visibility and missing data',()=>{const s={az:235,alt:10,radius:.266};assert.equal(diskVisibility(s,()=>9),1);assert.equal(diskVisibility(s,()=>11),0);assert.equal(diskVisibility(s,()=>null),null);assert.ok(Math.abs(diskVisibility(s,()=>10)-.5)<.05)});
test('horizon wrapping and missing samples',()=>{assert.equal(horizonAt([2,4,6,8],315,90),5);assert.equal(horizonAt([2,null,6,8],45,90),null)});
test('destination, pixel and curvature',()=>{const [a,b]=destination(35,139,0,1000);assert.ok(a>35&&Math.abs(b-139)<1e-8);assert.ok(tilePixel(a,b,14).i>=0);assert.ok(elevationAngle(100,100,10000)<0)});

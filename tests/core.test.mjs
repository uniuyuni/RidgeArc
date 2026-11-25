import test from 'node:test';
import assert from 'node:assert/strict';
import {sunPosition,decodeElevation,elevationAngle,diskVisibility,horizonAt,destination,tilePixel} from '../public/core.mjs';
test('GSI elevation encoding',()=>{assert.equal(decodeElevation(0,0,100),1);assert.equal(decodeElevation(128,0,0),null);assert.equal(decodeElevation(255,255,156),-1)});
test('Tanzawa solar direction at 15:27 JST',()=>{const s=sunPosition('2026-11-22',927,35.416459,139.048985);assert.ok(s.az>234&&s.az<237);assert.ok(s.alt>10&&s.alt<12)});
test('disk visibility and missing data',()=>{const s={az:235,alt:10,radius:.266};assert.equal(diskVisibility(s,()=>9),1);assert.equal(diskVisibility(s,()=>11),0);assert.equal(diskVisibility(s,()=>null),null);assert.ok(Math.abs(diskVisibility(s,()=>10)-.5)<.05)});
test('horizon wrapping and missing samples',()=>{assert.equal(horizonAt([2,4,6,8],315,90),5);assert.equal(horizonAt([2,null,6,8],45,90),null)});
test('destination, pixel and curvature',()=>{const [a,b]=destination(35,139,0,1000);assert.ok(a>35&&Math.abs(b-139)<1e-8);assert.ok(tilePixel(a,b,14).i>=0);assert.ok(elevationAngle(100,100,10000)<0)});

import {cameraProject,diskBoundary} from '../public/core.mjs';
test('camera center and horizontal field of view',()=>{const f=600/Math.tan(65*Math.PI/360);const p=cameraProject(240,3,240,3,f,600,400);assert.ok(Math.abs(p[0]-600)<1e-8&&Math.abs(p[1]-400)<1e-8);assert.equal(cameraProject(60,0,240,0,f,600,400),null);assert.ok(Math.abs(cameraProject(272.5,0,240,0,f,600,400)[0]-1200)<1e-8)});
test('solar circle angular radius at zenith-safe location',()=>{const pts=diskBoundary({az:240,alt:10,radius:.266},36);assert.equal(pts.length,36);assert.ok(Math.abs(pts[9][1]-10.266)<1e-7)});

import {panoramaY,panoramaAltitude,daylightFrame} from '../public/core.mjs';
test('natural panorama is invertible and locally conformal',()=>{for(const h of [-18,0,15,60,80])assert.ok(Math.abs(panoramaAltitude(panoramaY(h))-h)<1e-9);assert.ok(Math.abs((panoramaY(.001)-panoramaY(-.001))/.002-1)<1e-8)});
test('auto sunrise to sunset frame and north crossing',()=>{const f=daylightFrame([{az:110,alt:0,radius:.26},{az:180,alt:35,radius:.26},{az:250,alt:0,radius:.26}]);assert.equal(f.center,180);assert.equal(f.span,164);const n=daylightFrame([{az:60,alt:0,radius:.26},{az:0,alt:75,radius:.26},{az:300,alt:0,radius:.26}]);assert.equal(n.center,0);assert.equal(n.span,144)});

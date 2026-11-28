import test from 'node:test';
import assert from 'node:assert/strict';
import {mapSolarPath} from '../public/map-solar-geometry.mjs';
import {sunPosition,angleDelta} from '../public/core.mjs';
import {targetDirection} from '../public/location-geometry.mjs';

const observer={lat:36.81668,lon:137.03949,height:0};
test('map arc is the actual JST solar bearing, not a ground path',()=>{
 const a=mapSolarPath('2026-11-30',observer,1000,423);
 assert.ok(a.segments.length>=1&&a.hours.length>0);
 const sun=sunPosition('2026-11-30',423,observer.lat,observer.lon);
 assert.equal(a.current.az,sun.az);assert.equal(a.current.alt,sun.alt);
 for(const p of [a.current,...a.hours,...a.segments.flat().filter((_,i)=>i%60===0)]){
  const dir=targetDirection(observer,{lat:p.point[0],lon:p.point[1],height:0});
  assert.ok(Math.abs(angleDelta(dir.az,p.az))<1e-7);
  assert.ok(Math.abs(dir.distance-1000)<1e-5);
 }
 assert.ok(a.segments.flat().every(p=>p.aboveReference));
 const night=mapSolarPath('2026-11-30',observer,1000,0);
 assert.equal(night.current.aboveReference,false);
});
test('radius changes only the symbolic map distance; day and minute change the direction',()=>{
 const a=mapSolarPath('2026-11-30',observer,100,423);
 const b=mapSolarPath('2026-11-30',observer,5000,423);
 assert.equal(a.current.az,b.current.az);assert.notDeepEqual(a.current.point,b.current.point);
 const later=mapSolarPath('2026-11-30',observer,100,540);
 assert.notEqual(a.current.az,later.current.az);
 const summer=mapSolarPath('2026-06-21',observer,100,423);
 assert.notEqual(a.current.az,summer.current.az);
});

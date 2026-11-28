import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSky,skyDomePath,domeRadius,seasonalDates} from '../public/map-solar-geometry.mjs';
import {sunPosition,DEG} from '../public/core.mjs';
const observer={lat:36.81668,lon:137.03949};
test('orthographic hemisphere has north up, horizon unit radius and a unique zenith',()=>{
 for(const az of [0,90,180,270,359.99]){
  const h=projectSky(az,0),z=projectSky(az,90),m=projectSky(az,60);
  assert.ok(Math.abs(Math.hypot(h.x,h.y)-1)<1e-12);
  assert.ok(Math.hypot(z.x,z.y)<1e-12);
  assert.ok(Math.abs(Math.hypot(m.x,m.y)-.5)<1e-12);
 }
 assert.ok(projectSky(0,0).y<0&&projectSky(90,0).x>0);
});
test('sun path uses physical solar altitude and azimuth and crosses horizon without gaps',()=>{
 const date='2026-11-30',path=skyDomePath(date,observer,423);
 const s=sunPosition(date,423,observer.lat,observer.lon);
 assert.equal(path.current.az,s.az);assert.equal(path.current.alt,s.alt);
 assert.ok(path.segments.length>0&&path.hours.length>0);
 for(const p of path.segments.flat())assert.ok(p.alt>=0&&Math.hypot(p.x,p.y)<=1+1e-12);
 for(const segment of path.segments)for(const p of [segment[0],segment.at(-1)])assert.ok(Math.abs(Math.hypot(p.x,p.y)-1)<1e-9);
 assert.ok(skyDomePath(date,observer,0).current.alt<0);
 const summer=skyDomePath('2026-06-21',observer,720);
 assert.ok(Math.hypot(summer.current.x,summer.current.y)<Math.hypot(path.current.x,path.current.y));
});
test('polar summer is a near-circular path, zenith projection never jumps by azimuth',()=>{
 const p=skyDomePath('2026-06-21',{lat:89.999,lon:0},720);
 assert.equal(p.segments.length,1);
 assert.ok(p.segments[0].length===1441);
 const rs=p.segments[0].map(p=>Math.hypot(p.x,p.y));assert.ok(Math.max(...rs)-Math.min(...rs)<.005);
 const a=projectSky(0,89.999),b=projectSky(180,89.999);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.00004);
});
test('dome fills shortest map dimension with a label margin; seasonal dates are representative',()=>{
 assert.equal(domeRadius(900,600),282);assert.equal(domeRadius(600,900),282);
 assert.equal(seasonalDates('2027-02-02')[0].date,'2027-06-21');
});

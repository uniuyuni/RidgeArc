import test from 'node:test';
import assert from 'node:assert/strict';
import {handleTerrainRequest} from '../public/field-terrain-worker.mjs';
import {sunPosition} from '../public/core.mjs';

test('FIELD worker returns a profile, reuses retained DEM, and rejects missing ground', async t=>{
 const original=Object.fromEntries(['fetch','createImageBitmap','OffscreenCanvas','postMessage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 t.after(()=>{for(const [k,d] of Object.entries(original)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}});
 const messages=[];let requests=0,missing=false;
 const pixels=new Uint8ClampedArray(256*256*4);
 for(let i=0;i<pixels.length;i+=4){pixels[i+2]=100;pixels[i+3]=255}
 globalThis.fetch=async()=>{requests++;return missing?{ok:false,status:404}:{ok:true,status:200,blob:async()=>({})}};
 globalThis.createImageBitmap=async()=>({close(){}});
 globalThis.OffscreenCanvas=class{getContext(){return {drawImage(){},getImageData(){return {data:pixels}}}}};
 globalThis.postMessage=m=>messages.push(m);
 const request=(id,lat,lon,height)=>handleTerrainRequest({data:{id,lat,lon,height}},8);
 await request(1,36.7,137.18,1.6);
 const first=messages.at(-1);
 assert.equal(first.type,'profile');assert.equal(first.id,1);
 assert.equal(first.ground,1);assert.equal(first.coverage,1);assert.equal(first.total.length,8);
 assert.ok(first.complete.every(Boolean));assert.ok(first.total.every(Number.isFinite));
 const count=requests;messages.length=0;
 await request(2,36.7,137.18,3);
 const second=messages.at(-1);
 assert.equal(second.type,'profile');assert.equal(second.id,2);assert.equal(second.height,3);
 assert.ok(second.total[0]<first.total[0]);assert.equal(requests,count);assert.equal(messages.length,1);
 missing=true;await request(3,43,142,1.6);
 assert.equal(messages.at(-1).type,'error');assert.equal(messages.at(-1).id,3);
 assert.match(messages.at(-1).message,/標高が取得できません/);
});

// Swiss Ephemeris Moshier, topocentric, geometric altitude, JST.
// Coordinates are test inputs, not surveyed photography locations.
// Observer elevations 10 m and 3000 m; solar radius 695700 km, AU 149597870.7 km.
const fixtures=[
 [36.7,137.18,420,119.08314572,2.0578878,.27013835],
 [36.7,137.18,540,140.39401989,20.57912029,.27014572],
 [36.7,137.18,720,185.51050045,31.47727462,.27015322],
 [36.7,137.18,840,215.42311972,22.93724701,.27015533],
 [36.7,137.18,900,227.51612702,14.9580916,.27015562],
 [36.7,137.18,960,237.81885161,5.38903507,.27015553],
 [36.7,137.18,990,242.4471772,.17357338,.27015537],
 [36.7,137.18,1020,246.81535818,-5.26015289,.27015518],
 [36.575,137.62,420,119.34819534,2.42705225,.27013843],
 [36.575,137.62,540,140.7297841,20.89994668,.27014579],
 [36.575,137.62,720,185.99623004,31.56625172,.27015324],
 [36.575,137.62,840,215.83757989,22.83316109,.27015532],
 [36.575,137.62,900,227.86635851,14.78112432,.27015559],
 [36.575,137.62,960,238.10849798,5.15603909,.27015548],
 [36.575,137.62,990,242.7099783,-.08226073,.27015532],
 [36.575,137.62,1020,247.05400203,-5.53602461,.27015512]
];
test('Toyama and Tateyama-area solar geometry on 2026-11-30',()=>{
 for(const [lat,lon,m,az,alt,radius] of fixtures){
  const s=sunPosition('2026-11-30',m,lat,lon);
  assert.ok(Math.abs((s.az-az+540)%360-180)<.02);
  assert.ok(Math.abs(s.geo-alt)<.02);
  assert.ok(Math.abs(s.radius-radius)<.001);
 }
});

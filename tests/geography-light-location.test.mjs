import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {R,DEG,destination,sunPosition,projectTerrainRay} from '../public/core.mjs';
import {targetDirection,chordHeight,finiteLOS,angularSeparation,horizonCorridor} from '../public/location-geometry.mjs';
import {searchSubjectLocations,searchHorizonLocations} from '../public/location-search-engine.mjs';
import {skyRadiance,skyRGB,surfaceIrradiance,lightDirection,twilight} from '../public/clear-sky.mjs';
import {visiblePeaks,layoutPeakLabels,localityResolver} from '../public/geographic-labels.mjs';
const origin={lat:36.81668,lon:137.03949,height:1.6},[lat,lon]=destination(origin.lat,origin.lon,120,5000),target={lat,lon,height:100};
test('spherical target direction and chord are reciprocal and curvature is physical',()=>{
 const q=targetDirection(origin,target);assert.ok(Math.abs(q.distance-5000)<1e-6);assert.ok(Math.abs(q.az-120)<1e-6);
 const x=chordHeight(origin.height,target.height,5000,2500),y=chordHeight(target.height,origin.height,5000,2500);
 assert.ok(Math.abs(x-y)<1e-6);assert.ok(x<50.8&&x>50.2);
 assert.equal(finiteLOS(origin,target,[{distance:2500,height:0}]).status,'sample-clear');
 assert.equal(finiteLOS(origin,target,[{distance:2500,height:200}]).status,'blocked');
 assert.equal(finiteLOS(origin,target,[{distance:2500,height:NaN}]).status,'unknown');
 assert.equal(finiteLOS(origin,target,[]).status,'unknown');
 assert.ok(angularSeparation({az:359.9,alt:0},{az:.1,alt:0})<.21);
});
test('horizon corridor never calls missing samples clear',()=>{
 const a=Array(1440).fill(-.1),c=Array(1440).fill(true);
 assert.equal(horizonCorridor({angles:a,complete:c,eye:1.6,az:359.9}).status,'sample-clear');
 c[0]=false;assert.equal(horizonCorridor({angles:a,complete:c,eye:1.6,az:359.9}).status,'unknown');
 a[0]=1;assert.equal(horizonCorridor({angles:a,complete:c,eye:1.6,az:359.9}).status,'blocked');
});
test('national catalogue contains actual official peaks and excludes false nearer summit',()=>{
 const c=JSON.parse(readFileSync(new URL('../public/data/gsi-mountains.json',import.meta.url)));
 assert.equal(c.peaks.length,1059);assert.ok(c.peaks.some(p=>p[0].includes('富士山')&&p[1]===3776));
 const q=targetDirection(origin,target),i=Math.floor(q.az/.25),j=(i+1)%1440;
 const p={surfaces:Array.from({length:1440},()=>({segments:[]})),total:Array(1440).fill(null)};
 for(const k of [i,j]){p.surfaces[k].peak={distance:q.distance,elevation:target.height};p.total[k]=q.alt}
 const rows=[['確認用山頂',target.height,lat,lon]];
 assert.equal(visiblePeaks(rows,p,origin).length,1);
 for(const k of [i,j])p.surfaces[k]=projectTerrainRay([100,500],[200,200],0,1.6,true);
 assert.equal(visiblePeaks(rows,p,origin).length,0);
 const labels=layoutPeakLabels([{name:'山',height:123,alt:2,az:5,distance:1000}],()=>[100,150],400,300,s=>s.length*6);
 assert.equal(labels.length,1);assert.ok(labels[0].leaderY<labels[0].y&&labels[0].leaderX>labels[0].x);assert.equal(labels[0].angle,-Math.PI/3);
 const suppressed=layoutPeakLabels([{name:'山',height:123,alt:2,az:5,distance:1000}],()=>[100,150],400,300,s=>s.length*6,[labels[0].box]);assert.equal(suppressed.length,0);
});
test('GSI locality resolver uses safe text and memoizes repeated point',async()=>{
 let calls=0;const resolve=localityResolver({fetcher:async()=>{calls++;return {ok:true,json:async()=>({results:{lv01Nm:'雨晴'}})}}});
 assert.equal(await resolve(36.8,137),'雨晴');assert.equal(await resolve(36.8,137),'雨晴');assert.equal(calls,1);
});
test('single-scattering standard sky: daytime and twilight change without auto exposure',()=>{
 const args={az:0,alt:45,sunAz:180,height:0};
 const day=skyRadiance({...args,sunAlt:45}),night=skyRadiance({...args,sunAlt:-25});
 assert.ok(day[2]>day[0]&&day[2]>night[2]*100);
 assert.ok(skyRGB({...args,sunAlt:45}).every(v=>Number.isFinite(v)&&v>=0&&v<=255));
 const shadow=surfaceIrradiance({sunAz:180,sunAlt:45,normal:[0,0,1],direct:0});
 assert.ok(shadow.direct.every(v=>v===0)&&shadow.diffuse.every(v=>v>0));
 const lit=surfaceIrradiance({sunAz:180,sunAlt:45,normal:[0,0,1],direct:.7});
 assert.ok(lit.direct.every(v=>v>0));assert.deepEqual(lit.diffuse,shadow.diffuse);
 assert.equal(twilight(-8),'航海薄明');
 assert.equal(lightDirection({lat:36.8,lon:137},{lat:36.7,lon:137},{az:0}).kind,'順光');
});
const base={subject:{lat:36.81457,lon:137.04533},center:{lat:36.81668,lon:137.03949},date:'2026-11-30',minute:423,eyeHeight:1.6,subjectHeight:0};
const sampleFlat=async points=>new Float64Array(points.length);
test('G5 actual candidate generation + finite sightline + independent sun disk estimate on synthetic DEM',async()=>{
 const s=sunPosition(base.date,base.minute,base.subject.lat,base.subject.lon),d=500;
 const height=Math.max(0,1.6+Math.tan(s.alt*DEG)*d+d*d/(2*R));
 const result=await searchSubjectLocations({...base,subjectHeight:height,minM:d,maxM:d,radialStep:100,tolerance:.27},{sample:sampleFlat});
 assert.equal(result.sampled,5);assert.ok(result.matched>0);assert.ok(result.results.some(p=>p.los.status==='sample-clear'&&p.sunVisibility?.estimate!==null));
 assert.ok(result.results.every(p=>p.align.matched));
 const unknown=await searchSubjectLocations({...base,minM:d,maxM:d,radialStep:100},{sample:async p=>Float64Array.from(p,()=>NaN)});
 assert.equal(unknown.status,'unknown');
});
test('G4 evaluates sampled sunset paths and rejects known ridges; missing DEM is not a clear result',async()=>{
 const req={...base,radiusM:100,gridStep:100};
 const flat=await searchHorizonLocations(req,{sample:sampleFlat});
 assert.equal(flat.sampled,5);assert.ok(flat.results.every(p=>p.status==='sample-clear'&&Number.isFinite(p.minute)));
 let calls=0;const hill=await searchHorizonLocations(req,{sample:async p=>{calls++;return Float64Array.from(p,()=>calls===1?0:1000)}});
 assert.ok(hill.results.every(p=>p.status==='blocked'));
 calls=0;const missing=await searchHorizonLocations(req,{sample:async p=>{calls++;return Float64Array.from(p,()=>calls===1?0:NaN)}});
 assert.ok(missing.results.every(p=>p.status==='unknown'));
});

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

import {elevationStencil,interpolatedHeight,terrainBounds} from '../public/core.mjs';
test('bilinear elevation preserves constant surface and missing data',()=>{const s=elevationStencil(35.4,139.04,15);assert.ok(Math.abs(s.reduce((a,p)=>a+p.w,0)-1)<1e-10);assert.ok(Math.abs(interpolatedHeight(s,()=>123)-123)<1e-9);assert.equal(interpolatedHeight(s,()=>null),null)});
test('near terrain expands visible lower bound without including rear directions',()=>{const a=Array(8).fill(null);a[4]=-27;a[0]=-80;a[3]=15;assert.deepEqual(terrainBounds({center:180,span:100},[a],45),{low:-30,high:18});a[4]=-80;assert.equal(terrainBounds({center:180,span:100},[a],45).low,-45)});

import {visibleSurface,surfaceDistance} from '../public/core.mjs';
test('flat terrain has continuous first-hit distance without artificial range boundaries',()=>{const s=visibleSurface([10,20,50,100,200].map(d=>({d,h:0})),2,2);assert.ok(Math.abs(surfaceDistance(s,-.1)-20)<.01);assert.ok(Math.abs(surfaceDistance(s,-.2)-10)<.01)});
test('a farther slope behind a hill is hidden until it rises above the nearer skyline',()=>{const s=visibleSurface([{d:10,h:2},{d:20,h:12},{d:30,h:0},{d:100,h:40},{d:150,h:100}],2,2);assert.ok(surfaceDistance(s,.4)<=20);assert.ok(surfaceDistance(s,.55)>100);assert.equal(s.segments.length,3)});

// Independent linear segment intersection, with no skyline preprocessing.
function bruteIntersection(samples,eye,height,slope){
 let prevD=0,prevDiff=-height;
 for(const p of samples){
  const diff=p.h-eye-p.d*p.d/(2*6371000)-slope*p.d;
  if(diff>=0)return prevD+(p.d-prevD)*(-prevDiff)/(diff-prevDiff);
  prevD=p.d;prevDiff=diff;
 }
 return null;
}
test('first hit matches direct segment search including rays above skyline',()=>{for(let j=0;j<24;j++){const samples=Array.from({length:150},(_,i)=>({d:5*(i+1),h:100+Math.sin(i*.11+j)*28+Math.cos(i*.037+j*.5)*38}));const eye=102+Math.cos(j*.5)*38+Math.sin(j)*28;const s=visibleSurface(samples,eye,2);for(let i=-100;i<=100;i++){const slope=i/50,d=surfaceDistance(s,slope),ref=bruteIntersection(samples,eye,2,slope);if(ref==null)assert.equal(d,null);else assert.ok(d!=null&&Math.abs(d-ref)<1e-6);}}});
// Swiss Ephemeris Moshier, topocentric geometric altitude, height 374.04m, JST.
const solarFixtures=[["2026-11-22",420,119.38136342,5.43882862],["2026-11-22",720,188.55296768,34.01272638],["2026-11-22",930,235.81800567,10.52013887],["2026-06-21",420,79.93503975,27.98809596],["2026-06-21",720,195.65092206,77.61678547],["2026-06-21",930,272.07979179,40.3489353],["2026-03-20",420,100.36562052,13.735153],["2026-03-20",720,183.71004269,54.33126854],["2026-03-20",930,247.55434323,28.02350202]];
test('solar direction compared with independent ephemeris',()=>{for(const [date,m,az,alt] of solarFixtures){const s=sunPosition(date,m,35.416459,139.048985);assert.ok(Math.abs((s.az-az+540)%360-180)<.02);assert.ok(Math.abs(s.geo-alt)<.02)}});

import {visibilityEstimate,contactEvents} from '../public/core.mjs';
test('missing terrain does not turn an estimated visible disk into a confirmed visible disk',()=>{const s={az:0,alt:10,radius:.266};const v=visibilityEstimate(s,()=>9,()=>false);assert.equal(v.estimate,1);assert.equal(v.lower,0);assert.equal(v.upper,1);assert.equal(v.uncertain,true);const b=visibilityEstimate(s,()=>11,()=>false);assert.equal(b.upper,0);assert.equal(b.uncertain,false);assert.equal(visibilityEstimate(s,()=>null,()=>false).estimate,null)});
test('contact search resolves both transitions in a single interval',()=>{const e=contactEvents(t=>({state:t<.1?0:t<.2?1:2,uncertain:false}),0,1,.25);assert.equal(e.length,2);assert.ok(Math.abs(e[0].minute-.1)<=1/60);assert.ok(Math.abs(e[1].minute-.2)<=1/60);assert.equal(e[0].to,1);assert.equal(e[1].to,2)});

import {projectTerrainRay} from '../public/core.mjs';
test('compact retained ray matches original visible surface for multiple eye heights',()=>{const samples=[{d:2,h:100},{d:10,h:105},{d:20,h:null},{d:30,h:120},{d:100,h:110}];const ds=Float64Array.from(samples,p=>p.d),hs=Float64Array.from(samples,p=>p.h??NaN);for(const height of [0,1.6,10,30,300])assert.deepEqual(projectTerrainRay(ds,hs,100,height),visibleSurface(samples,100+height,height))});

import {panoramaSlices} from '../public/core.mjs';
test('cyclic panorama crops continuously across north',()=>{assert.deepEqual(panoramaSlices(300,120,3600),[{x:3000,width:600,fraction:.5},{x:0,width:600,fraction:.5}]);for(const [a,s] of [[100,140],[-45,150],[360,180],[0,360]]){const p=panoramaSlices(a,s,3600);assert.ok(Math.abs(p.reduce((n,x)=>n+x.fraction,0)-1)<1e-10);assert.ok(p.every(x=>x.x>=0&&x.x+x.width<=3600+1e-8));}});

import {zoomWindow,zoomAnchor} from '../public/core.mjs';
test('zoom preserves aspect and stays within vertical panorama',()=>{for(const z of [1,2,4,8]){const w=zoomWindow(45,-20,z,3);assert.ok(Math.abs(w.top-w.bottom-65/z)<1e-9);assert.ok(w.top<=45&&w.bottom>=-20)}});
test('zoom anchor retains selected angular point',()=>{const a=zoomAnchor(250,10,120,60,4,2,.8,.2);assert.ok(Math.abs(a.center+.3*60-(250+.3*120))<1e-9);assert.ok(Math.abs(a.mid+.3*30-(10+.3*60))<1e-9)});

import {shiftDate,dateRange} from '../public/core.mjs';
test('calendar shifts across leap day and year boundary',()=>{assert.equal(shiftDate('2028-02-28',1),'2028-02-29');assert.equal(shiftDate('2026-12-31',1),'2027-01-01');assert.equal(shiftDate('2027-01-01',-1),'2026-12-31')});
test('date range is inclusive, bounded, and honors step',()=>{assert.deepEqual(dateRange('2027-03-01','2027-03-07',4),['2027-03-01','2027-03-05','2027-03-07']);assert.equal(dateRange('2027-03-07','2027-03-01'),null);assert.equal(dateRange('2027-01-01','2028-01-02'),null);assert.equal(dateRange('2028-01-01','2028-12-31').length,366)});

import test from 'node:test';
import assert from 'node:assert/strict';
import {isWaterPixel,waterRanges,seaDistance,firstSurface,surfaceAt,blendSurface,surfaceColor} from '../public/coast-surface.mjs';
import {projectTerrainRay,R} from '../public/core.mjs';
test('water needs a positive map-color match, not missing DEM',()=>{
 assert.equal(isWaterPixel([190,210,255,255],0),true);
 for(const p of [null,[128,0,0,255],[255,255,255,255],[190,210,255,0]])assert.equal(isWaterPixel(p,0),false);
 assert.deepEqual(waterRanges([10,20,30,40,50,60],[true,true,false,true,false,true]),[[10,20]]);
});
test('curved sea intersection stops at the geometric horizon',()=>{
 const eye=2,d=seaDistance(-.01,eye);
 assert.ok(Math.abs(d-200)<1);
 assert.equal(seaDistance(0,eye),null);
 assert.equal(seaDistance(-.0001,eye),null);
 const tangent=Math.sqrt(2*eye/R);
 assert.ok(Math.abs(seaDistance(-tangent*1.000001,eye)-Math.sqrt(2*eye*R))<10);
});
test('initial and internal DEM gaps do not invent continuous surfaces',()=>{
 const p=projectTerrainRay([10,20,30,40],[NaN,0,NaN,20],0,2,true);
 assert.equal(firstSurface(p,-.2),null);
 assert.equal(firstSurface(p,0),null);
 assert.ok(p.angle>20);
});
test('water render uses a mapped interval and nearer known land wins',()=>{
 const empty={segments:[],water:[[50,1000]]};
 assert.equal(surfaceAt(empty,-.01,2).kind,'water');
 assert.equal(surfaceAt(empty,-.1,2),null);
 const land=projectTerrainRay([10,20,30],[0,0,0],0,2,true);
 land.water=[[50,1000]];
 assert.equal(surfaceAt(land,-.1,2).kind,'land');
});
test('disjoint near and far surfaces are never averaged',()=>{
 const a={kind:'land',distance:300},b={kind:'land',distance:50000};
 assert.equal(blendSurface(a,b,.25),a);assert.equal(blendSurface(a,b,.75),b);
 assert.equal(blendSurface(a,null,.75),null);
 assert.notDeepEqual(surfaceColor(a),surfaceColor({kind:'water',distance:300}));
});

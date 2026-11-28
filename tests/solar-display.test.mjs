import test from 'node:test';
import assert from 'node:assert/strict';
import {solarAt} from '../public/field-engine.mjs';
import {LOUPE_FOV,loadSunOptions,solarDisplayRadius,showSunMarker,sunDiskPath,solarGlowOpacity} from '../public/solar-display.mjs';
test('solar aids do not modify physical angular radius or one another',()=>{
 const sun=solarAt('2026-12-01',8,36.816525,137.0373667),view={az:sun.az,pitch:sun.alt,fov:95},radius=sun.radius;
 for(let flags=0;flags<8;flags++){
  const opts={minimum:!!(flags&1),marker:!!(flags&2),glow:!!(flags&4)};
  const r=solarDisplayRadius(sun,view,400,opts);
  assert.equal(r,opts.minimum?3:radius*400/95);
  assert.equal(showSunMarker(sun,view,400,opts),opts.marker);
 }
 assert.equal(sun.radius,radius);
 const edge={...view,fov:radius*400/7.5};
 assert.equal(showSunMarker(sun,edge,400,{minimum:true,marker:true}),false);
});
test('loupe uses actual projected disk, not source canvas scale',()=>{
 const sun=solarAt('2026-12-01',8,36.816525,137.0373667),view={az:sun.az,pitch:sun.alt,fov:LOUPE_FOV};
 const pts=[],ctx={beginPath(){},moveTo(x,y){pts.push([x,y])},lineTo(x,y){pts.push([x,y])},closePath(){}};
 assert.equal(sunDiskPath(ctx,sun,view,100,70),true);
 const width=Math.max(...pts.map(p=>p[0]))-Math.min(...pts.map(p=>p[0]));
 assert.ok(width>24&&width<35);
 assert.ok(Math.abs((Math.max(...pts.map(p=>p[0]))+Math.min(...pts.map(p=>p[0])))/2-50)<.1);
});
test('preference defaults and saved booleans',()=>{
 assert.deepEqual(loadSunOptions({getItem:()=>null},'x'),{minimum:true,marker:false,glow:true});
 assert.deepEqual(loadSunOptions({getItem:()=>JSON.stringify({minimum:false,marker:true,glow:'invalid'})},'x'),{minimum:false,marker:true,glow:true});
});

test('glow fades with partial visibility rather than switching on at first contact',()=>{
 assert.deepEqual([0,.01,.25,.5,.75,1].map(estimate=>solarGlowOpacity({estimate})),[0,.01,.25,.5,.75,1]);
 assert.equal(solarGlowOpacity({estimate:null}),1);
});

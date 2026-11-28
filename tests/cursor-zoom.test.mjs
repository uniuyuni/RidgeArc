import test from 'node:test';
import assert from 'node:assert/strict';
import {project,zoomAtPoint,panoramaY,panoramaAltitude,wrap} from '../public/field-engine.mjs';

function direction(view,x,y,w,h){
 return [wrap(view.az+(x-w/2)*view.fov/w),
  panoramaAltitude(panoramaY(view.pitch)+(h/2-y)*view.fov/w)];
}
function close(actual,expected){assert.ok(Math.abs(actual-expected)<1e-8,actual+' != '+expected)}

test('cursor-anchored zoom preserves horizontal and vertical projected position',()=>{
 for(const view of [{az:359,pitch:10,fov:40},{az:1,pitch:-20,fov:20},{az:110,pitch:60,fov:15}]){
  for(const [w,h] of [[800,600],[420,700]])for(const [fx,fy] of [[.2,.3],[.8,.7],[.5,.5]]){
   const x=w*fx,y=h*fy,point=direction(view,x,y,w,h);
   for(const fov of [view.fov/2,view.fov*1.2,5]){
    const next=zoomAtPoint(view,fov,x,y,w,h);
    const [px,py]=project(...point,next,w,h);
    close(px,x);close(py,y);
   }
  }
 }
});
test('cursor zoom respects FOV and pitch limits and does not pan at saturated FOV',()=>{
 const view={az:359,pitch:0,fov:5};
 assert.deepEqual(zoomAtPoint(view,1,700,10,800,600),view);
 const wide=zoomAtPoint({az:0,pitch:0,fov:120},300,400,300,800,600);
 assert.equal(wide.fov,180);assert.equal(wide.az,0);close(wide.pitch,0);
 const top=zoomAtPoint({az:0,pitch:74,fov:180},5,400,0,400,800);
 assert.equal(top.pitch,75);
 const bottom=zoomAtPoint({az:0,pitch:-64,fov:180},5,400,800,400,800);
 assert.equal(bottom.pitch,-65);
});

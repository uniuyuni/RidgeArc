import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const live=false;
const root=resolve('public');
const server=createServer(async(req,res)=>{
 try{
  let p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(p!==root&&!p.startsWith(root+sep)){res.writeHead(403).end();return;}
  if(p.endsWith(sep)||!extname(p))p=resolve(p,'index.html');
  const b=await readFile(p);
  res.setHeader('Content-Type',extname(p)==='.mjs'?'text/javascript':extname(p)==='.html'?'text/html; charset=utf-8':'application/octet-stream');res.end(b);
 }catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:412,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 const pixels=new PNG({width:256,height:256});
 for(let i=0;i<pixels.data.length;i+=4){pixels.data[i+2]=100;pixels.data[i+3]=255;}
 const tile=PNG.sync.write(pixels);
 await context.route('https://unpkg.com/leaflet@1.9.4/dist/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/dist/')[1];
  try{await route.fulfill({path:resolve('node_modules/leaflet/dist',name)});}catch{await route.abort()}
 });
 await context.route('https://cyberjapandata.gsi.go.jp/xyz/**',async route=>{
  if(live&&!route.request().url().includes('/std/'))return route.continue();
  await route.fulfill({status:200,contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:tile});
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const origin=()=>page.evaluate(()=>({lat:state.lat,lon:state.lon}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/ui-lab/');
 await page.locator('.subjectLockButton').waitFor({state:'visible'});
 const before=await origin();
 await page.locator('.subjectLockButton').tap();
 assert.equal(await page.locator('.subjectLockButton').getAttribute('aria-pressed'),'true');
 assert.deepEqual(await origin(),before,'locking must not move camera');
 await page.locator('.subjectLockButton').tap();
 assert.equal(await page.locator('.subjectLockButton').getAttribute('aria-pressed'),'false');
 assert.deepEqual(await origin(),before,'unlocking must not move camera');
 const view=()=>page.evaluate(()=>{const w=document.querySelector('#ridge').clientWidth,h=document.querySelector('#ridge').clientHeight;return {w,h,ratio:(labY(.7,w,h)-labY(.3,w,h))/w}});
 const split=await view();
 await page.evaluate(()=>setPage('ridge'));
 await page.waitForFunction(()=>!document.querySelector('#stage').classList.contains('switching'));
 const full=await view();
 assert.ok(full.h>split.h);
 assert.ok(Math.abs(split.ratio-full.ratio)<1e-12,'aspect invariant');
 const snap=await page.evaluate(()=>({az:state.az,fov:state.fov,lat:state.lat,lon:state.lon,date:document.querySelector('#date').value,time:state.time}));
 await page.locator('[data-sheet=search]').tap();
 assert.equal(await page.locator('#labSearchbar').isVisible(),true);
 assert.equal(await page.locator('#labNormalTimebar').isVisible(),false);
 assert.equal(await page.locator('[data-sheet=search]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#app').evaluate(el=>el.classList.contains('labSearchActive')),true);
 assert.equal(await page.locator('#labRunSearch').isDisabled(),true);
 assert.equal(await page.evaluate(()=>labSearch.target),null);
 const rect=await page.locator('#ridge').boundingBox();
 const x=rect.x+rect.width*.6,y=rect.y+rect.height*.4;
 await page.locator('#ridge').tap({position:{x:rect.width*.6,y:rect.height*.4}});
 assert.equal(await page.evaluate(()=>labSearch.target),null,'short tap is not placement');
 const hold=async()=>{await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(680);await page.mouse.up()};
 await hold();
 assert.ok(await page.evaluate(()=>labSearch.target));
 await page.locator('#labBodyMoon').tap();
 assert.equal(await page.evaluate(()=>labSearch.body),'moon');
 assert.equal(await page.evaluate(()=>labSearch.target),null);
 await hold();
 const fixed=await page.evaluate(()=>({...labSearch.target}));
 await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.7);
 await page.mouse.down();
 await page.mouse.move(rect.x+rect.width*.35,rect.y+rect.height*.7,{steps:5});
 await page.mouse.up();
 assert.notEqual(await page.evaluate(()=>state.az),snap.az);
 assert.deepEqual(await page.evaluate(()=>labSearch.target),fixed,'pan must preserve angular target');
 await page.evaluate(a=>{state.az=a;draw()},snap.az);
 await page.locator('#labRunSearch').tap();
 assert.match(await page.locator('#labCandidates').innerText(),/候補 [1-9]\d*件/);
 const results=await page.evaluate(()=>labSearch.results.map(r=>r.value));
 await page.locator('[data-sheet=search]').tap();
 assert.equal(await page.locator('#labNormalTimebar').isVisible(),true);
 assert.equal(await page.locator('#app').evaluate(el=>el.classList.contains('labSearchActive')),false);
 assert.deepEqual(await page.evaluate(()=>({az:state.az,fov:state.fov,lat:state.lat,lon:state.lon,date:document.querySelector('#date').value,time:state.time})),snap);
 await page.locator('[data-sheet=search]').tap();
 assert.deepEqual(await page.evaluate(()=>labSearch.results.map(r=>r.value)),results);
 await page.locator('#labCandidates').tap();
 await page.locator('#sheetBody .eventRow button').first().tap();
 assert.equal(await page.locator('#labNormalTimebar').isVisible(),true);
 assert.ok(await page.evaluate(()=>Math.abs(selected()-labSearch.results[0].value)<1e-7));
 assert.deepEqual(errors,[]);
 console.log('UI Lab: touch lock isolation, fixed panorama ratio, search mode toggle, results retention and selection passed');
}finally{await browser?.close();await new Promise(r=>server.close(r))}

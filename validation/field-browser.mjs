import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const live=process.argv.includes('--live');
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
 const context=await browser.newContext({viewport:{width:1280,height:900}});
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
 const start=Date.now();
 await page.goto('http://127.0.0.1:'+server.address().port+'/field/');
 await page.waitForFunction(()=>/^DEM /.test(document.querySelector('#fieldAcquisition')?.dataset.detail),null,{timeout:live?180000:90000});
 console.log('observer:',await page.locator('#fieldAcquisition').getAttribute('data-detail'),Date.now()-start+'ms');
 await page.locator('[data-sheet=info]').click();
 await page.locator('[data-preset]').click();
 await page.waitForFunction(()=>/^裸地DEM /.test(document.querySelector('[data-status]')?.textContent),null,{timeout:live?180000:90000});
 assert.equal(await page.locator('[data-result]').isVisible(),true);
 const values=await page.locator('[data-values]').innerText();
 assert.ok(values.includes('相対直射光量')&&values.includes('最後の日照'));
 assert.equal(await page.locator('[data-bar]').count(),0);
 if(live){
  const h=Number(values.match(/対象標高\s*([\d.]+) m/)?.[1]);
  assert.ok(h>2500&&h<3300,'unexpected Oyama ground: '+h);
 }else{assert.ok(values.includes('1.0 m'))}
 console.log('subject:',await page.locator('[data-status]').innerText(),'\n'+values);
 await page.locator('#detailReturn').click();
 await page.locator('#detailPage').waitFor({state:'hidden'});
 await page.locator('#tracks').click();assert.equal(await page.locator('[data-track="被写体の日照"]').isChecked(),true);await page.locator('#close').click();
 await page.locator('#date').fill('2026-12-01');
 await page.locator('#date').dispatchEvent('change');
 await page.locator('[data-sheet=info]').click();
 await page.waitForFunction(()=>/^裸地DEM /.test(document.querySelector('[data-status]')?.textContent),null,{timeout:30000});
 assert.equal(await page.locator('[data-result]').isVisible(),true);
 // Exercise coastal viewpoint at rain/sea boundary with actual FIELD UI.
 await page.locator('#detailReturn').click();
 await page.locator('#detailPage').waitFor({state:'hidden'});
 await page.locator('[data-sheet=settings]').click();
 if(!await page.locator('#locSettings').isVisible())await page.locator('[data-settings-tab=general]').click();
 await page.locator('#locSettings').click();
 await page.locator('#locLat').fill('36.816525');
 await page.locator('#locLon').fill('137.0373667');
 await page.locator('#locGo').click();
 await page.waitForFunction(()=>/^DEM /.test(document.querySelector('#fieldAcquisition')?.dataset.detail),null,{timeout:live?180000:90000});
 assert.ok(await page.locator('#ridgeDepth').isVisible());
 {
  await page.locator('[data-sheet=settings]').click();
  const layer=page.locator('[data-layer="日照・陰影"]');
  if(!await layer.isVisible())await page.locator('[data-settings-tab=layers]').click();
  if(!await layer.isVisible())await page.locator('details').filter({has:layer}).locator('summary').click();
  await layer.check();await page.locator('#close').click();
  await page.waitForFunction(()=>/^日照概算 \d+\//.test(document.querySelector('#sceneStatus')?.textContent),null,{timeout:90000});
  console.log('scene:',await page.locator('#sceneStatus').innerText());
  if(!live)assert.match(await page.locator('#sceneStatus').innerText(),/日照概算 [1-9]\d*\//);
  await page.locator('[data-sheet=settings]').click();if(!await layer.isVisible())await page.locator('details').filter({has:layer}).locator('summary').click();await layer.uncheck();await page.locator('#close').click();
 }
 console.log('coastal:',await page.locator('#fieldAcquisition').getAttribute('data-detail'),await page.locator('#ridgeDepth').innerText());
 // Check independent option controls and actual rendered halo pixels.
 await page.locator('[data-sheet=settings]').click();
 if(!await page.locator('[data-sun-option="glow"]').isVisible())await page.locator('[data-settings-tab=general]').click();
 assert.equal(await page.locator('[data-sun-option="minimum"]').isChecked(),true);
 assert.equal(await page.locator('[data-sun-option="glow"]').isChecked(),true);
 assert.equal(await page.locator('[data-sun-option="marker"]').isChecked(),false);
 await page.locator('[data-sun-option="marker"]').check();
 assert.equal(await page.locator('[data-sun-option="minimum"]').isChecked(),true);
 assert.equal(await page.locator('[data-sun-option="glow"]').isChecked(),true);
 await page.locator('[data-sun-option="marker"]').uncheck();
 await page.locator('#close').click();
 const glow=await page.evaluate(async()=>{
  const {drawSolarGlow}=await import('/solar-display.mjs');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=80;
  const ctx=canvas.getContext('2d'),values=[];
  for(const color of ['#627e94','#b4c5cc','#293d55']){
   ctx.fillStyle=color;ctx.fillRect(0,0,80,80);
   const before=[...ctx.getImageData(50,40,1,1).data];
   drawSolarGlow(ctx,40,40,3);
   const after=[...ctx.getImageData(50,40,1,1).data];
   values.push(after.slice(0,3).reduce((n,v,i)=>n+Math.abs(v-before[i]),0));
  }
  return values;
 });
 assert.ok(glow.every(v=>v>25),'visible halo outside locator radius on all sky backgrounds');
 // Actual loupe opens with the same real solar position used for target selection.
 const currentRidge=page.locator('#ridge'),currentRect=await currentRidge.boundingBox();
 // Directly selecting a known trajectory point avoids changing the camera.
 const morning=await page.evaluate(async({w,h})=>{const {solarAt,project}=await import('/field-engine.mjs');const sun=solarAt('2026-12-01',8,36.816525,137.0373667);return project(sun.az,sun.alt,{az:100,pitch:8,fov:95},w,h)},{w:currentRect.width,h:currentRect.height});
 await currentRidge.click({position:{x:morning[0],y:morning[1]}});
 await currentRidge.dblclick({position:{x:morning[0],y:morning[1]}});
 await page.locator('#solarLoupe').waitFor({state:'visible',timeout:5000});
 assert.match(await page.locator('#loupeTitle').innerText(),/4°/);
 await page.locator('#closeLoupe').click();

 // Verify the approved timeline workflow using a real solar direction.
 const lock=page.locator('.subjectLockButton');
 // Receiver preset has already selected and locked Oyama.
 assert.equal(await lock.getAttribute('aria-pressed'),'true');
 if(await page.locator('#subjectEdge').isVisible()){await page.locator('#subjectEdge').click();await page.waitForTimeout(500)}
 const beforeObserver=await page.locator('.ridge-marker').getAttribute('style');
 await lock.click();assert.equal(await lock.getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('.ridge-marker').getAttribute('style'),beforeObserver);
 // The unlocked marker can now be offscreen; subsequent search is independent.
 const before=await page.locator('#stage').boundingBox();
 await page.locator('[data-sheet=search]').click();
 await page.waitForFunction(()=>!document.querySelector('.labTimelineGhost'));
 assert.equal(await page.locator('#labSearchbar').isVisible(),true);
 assert.deepEqual(await page.locator('#stage').boundingBox(),before);
 assert.ok(await page.locator('#labBodyMoon').isDisabled());
 assert.ok(await page.locator('#labRunSearch').isDisabled());
 const ridge=page.locator('#ridge'),rect=await ridge.boundingBox();
 const target=await page.evaluate(async({w,h})=>{const {solarAt,project}=await import('/field-engine.mjs');const sun=solarAt('2026-12-01',8,36.816525,137.0373667);return project(sun.az,sun.alt,{az:100,pitch:8,fov:95},w,h)},{w:rect.width,h:rect.height});
 assert.ok(target[0]>0&&target[0]<rect.width&&target[1]>0&&target[1]<rect.height);
 await page.mouse.move(rect.x+target[0],rect.y+target[1]);await page.mouse.down();await page.waitForTimeout(680);await page.mouse.up();
 await page.locator('#labSearchPeriod').selectOption('f31');
 await page.locator('#labSearchDate').fill('2026-12-01');await page.locator('#labSearchDate').dispatchEvent('change');
 await page.locator('#labRunSearch').click();
 await page.waitForFunction(()=>document.querySelector('#labRunSearch').getAttribute('aria-label')==='探索済み',null,{timeout:60000});
 assert.match(await page.locator('#labCandidates').getAttribute('aria-label'),/候補 [1-9]\d*件/);
 await page.locator('#labCandidates').click();
 const candidates=page.locator('#sheetBody .eventRow button');
 const labels=await candidates.allInnerTexts();
 const initial=await page.locator('#date').inputValue();
 const index=labels.findIndex(l=>l.slice(0,10)!==initial);
 assert.ok(index>=0,'fixture must contain a different date');
 const result=candidates.nth(index);
 assert.ok(await result.isVisible());const label=await result.innerText();await result.click();
 assert.equal(await page.locator('#sheet').isHidden(),true);
 assert.equal(await page.locator('#date').inputValue(),label.slice(0,10));
 assert.equal((await page.locator('#clock').innerText()).trim(),label.slice(11,16));
 await page.waitForFunction(()=>!document.querySelector('.labTimelineGhost'));
 await page.locator('[data-sheet=search]').click();
 await page.waitForFunction(()=>!document.querySelector('.labTimelineGhost'));
 assert.equal(await page.locator('#labRunSearch').getAttribute('aria-label'),'探索済み');
 // The one shared overlay is inside the stage and never participates in layout.
 assert.equal(await page.locator('#acquisitionOverlay').evaluate(el=>el.parentElement.id),'stage');
 assert.equal(await page.locator('#acquisitionOverlay').evaluate(el=>getComputedStyle(el).position),'absolute');
 assert.equal(await page.locator('#stage #acquisitionOverlay .acquisitionTask').count(),3);
 assert.match(await page.locator('header .demo').innerText(),/0\.7/);
 await page.waitForFunction(()=>document.querySelector('#fieldAcquisition').hidden||['partial','failed'].includes(document.querySelector('#fieldAcquisition').dataset.phase),null,{timeout:5000});
 // Exercise a different actual result through the canvas (not just the list).
 const otherLabel=labels.find(l=>l.slice(0,10)!==label.slice(0,10));
 assert.ok(otherLabel,'fixture must contain two distinct dates');
 await page.setViewportSize({width:412,height:844});
 await page.waitForTimeout(250);
 const cv=page.locator('#timeCanvas'),box=await cv.boundingBox();
 const base=Date.parse('2026-12-01T00:00:00Z')/86400000;
 const endDay=Date.parse('2027-01-02T00:00:00Z')/86400000;
 const days=endDay-base,center=(base+endDay)/2;
 const day=Date.parse(otherLabel.slice(0,10)+'T00:00:00Z')/86400000;
 const [hours,minutes]=otherLabel.slice(11,16).split(':').map(Number);
 const value=day+(hours*60+minutes)/1440;
 // Drag the desired candidate into the centre, then zoom to a single day.
 const dx=(center-value)*box.width/days;
 const startX=box.x+box.width/2-dx/2;
 const y=box.y+40;
 await page.mouse.move(startX,y);await page.mouse.down();
 await page.mouse.move(startX+dx,y,{steps:10});await page.mouse.up();
 await page.mouse.move(box.x+box.width/2,y);
 await page.evaluate(()=>{const c=document.querySelector('#timeCanvas').getContext('2d'),fill=c.fillText,move=c.moveTo,clear=c.fillRect;window.rulerTrace={labels:[],lines:[]};c.fillRect=function(...a){if(a[0]===0&&a[1]===0&&a[3]>23)window.rulerTrace={labels:[],lines:[]};return clear.apply(this,a)};c.fillText=function(t,x,y,...rest){if(y===12&&/^\d{2,4}\/\d{2}(\/\d{2})?$/.test(t))window.rulerTrace.labels.push(x);return fill.call(this,t,x,y,...rest)};c.moveTo=function(x,y){if(y===16)window.rulerTrace.lines.push(x);return move.call(this,x,y)}});
 await page.mouse.wheel(0,Math.log(1/days)/.002);
 await page.waitForTimeout(150);
 const trace=await page.evaluate(()=>window.rulerTrace);
 assert.ok(trace.labels.length>0,'visible date labels');
 assert.ok(trace.labels.every(x=>trace.lines.some(y=>Math.abs(x-y)<1e-6)),'each date label shares its vertical tick coordinate');
 await cv.click({position:{x:box.width/2,y:40}});
 await page.waitForFunction(()=>!document.querySelector('.labTimelineGhost'));
 assert.equal(await page.locator('#labNormalTimebar').isVisible(),true);
 assert.equal(await page.locator('#date').inputValue(),otherLabel.slice(0,10));
 assert.equal((await page.locator('#clock').innerText()).trim(),otherLabel.slice(11,16));
 // Range must include the chosen day even when it started outside the initial interval.
 await page.locator('#tracks').click();
 const lo=await page.locator('#rangeStart').inputValue(),hi=await page.locator('#rangeEnd').inputValue();
 assert.ok(lo<=otherLabel.slice(0,10)&&otherLabel.slice(0,10)<=hi);
 await page.locator('#close').click();
 assert.deepEqual(errors,[]);
 console.log(live?'LIVE GSI smoke passed; not an accuracy reference':'Chromium synthetic DEM integration passed');
}finally{await browser?.close();await new Promise(r=>server.close(r))}

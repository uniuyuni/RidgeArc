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
 await page.waitForFunction(()=>/^DEM /.test(document.querySelector('#fieldStatus')?.textContent),null,{timeout:live?180000:90000});
 console.log('observer:',await page.locator('#fieldStatus').innerText(),Date.now()-start+'ms');
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
 await page.locator('[data-sheet=search]').click();
 await page.locator('#locLat').fill('36.816525');
 await page.locator('#locLon').fill('137.0373667');
 await page.locator('#locGo').click();
 await page.waitForFunction(()=>/^DEM /.test(document.querySelector('#fieldStatus')?.textContent),null,{timeout:live?180000:90000});
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
 console.log('coastal:',await page.locator('#fieldStatus').innerText(),await page.locator('#ridgeDepth').innerText());
 await page.locator('[data-sheet=search]').click();
 await page.locator('#startComposition').click();assert.equal(await page.locator('#compositionHint').isVisible(),true);
 // Choose the displayed current Sun direction through the actual panorama, not angle fields.
 const ridge=page.locator('#ridge');const rect=await ridge.boundingBox();
 // A visible target near the southeast horizon is suitable for a wide tolerance search.
 const x=rect.width/2+20*rect.width/95,y=rect.height/2+(8-3)*rect.width/95;
 await ridge.click({position:{x,y}});
 const align=page.locator('#alignmentSearch');assert.equal(await align.isVisible(),true);
 await align.locator('summary').click();await align.locator('[data-tolerance]').fill('5');await align.locator('[data-end]').fill('2026-12-01');
 await align.locator('[data-run]').click();
 await page.waitForFunction(()=>/件の候補/.test(document.querySelector('#alignmentSearch [data-status]')?.textContent),null,{timeout:30000});
 const result=align.locator('[data-results] button').first();assert.ok(await result.isVisible());await result.click();
 assert.equal(await page.locator('#sheet').isHidden(),true);
 assert.deepEqual(errors,[]);
 console.log(live?'LIVE GSI smoke passed; not an accuracy reference':'Chromium synthetic DEM integration passed');
}finally{await browser?.close();await new Promise(r=>server.close(r))}

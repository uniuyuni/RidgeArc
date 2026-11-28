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
  res.setHeader('Content-Type',extname(p)==='.mjs'?'text/javascript':extname(p)==='.html'?'text/html; charset=utf-8':extname(p)==='.css'?'text/css':'application/octet-stream');res.end(b);
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
 await context.route('https://mreversegeocoder.gsi.go.jp/reverse-geocoder/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({results:{lv01Nm:'検証用地名'}})}));
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const start=Date.now();
 if(live)await page.addInitScript(()=>{
  const RealWorker=window.Worker;
  window.Worker=class extends RealWorker{
   constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.type==='profile')window.__terrainProfile=e.data})}
  };
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/field/');
 await page.waitForFunction(()=>/^DEM /.test(document.querySelector('#fieldAcquisition')?.dataset.detail),null,{timeout:live?180000:90000});
 console.log('observer:',await page.locator('#fieldAcquisition').getAttribute('data-detail'),Date.now()-start+'ms');
 // Verify the shipped initial coastal observer and small-island subject, not just a synthetic inland fixture.
 assert.match(await page.locator('.observerLabLabel').innerText(),/雨晴海岸/);
 assert.match(await page.locator('.subjectLabLabel').innerText(),/女岩/);
 assert.equal((await page.locator('#clock').innerText()).trim(),'07:03');
 assert.equal(await page.locator('#date').inputValue(),'2026-11-30');
 if(!live){
  const dome=page.locator('#map .sky-dome-overlay'),track=dome.locator('.sky-track');
  assert.equal(await dome.locator('.sky-current').count(),1);
  assert.equal((await dome.locator('.map-solar-time.current').textContent()).trim(),'07:03');
  assert.equal(await dome.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  const size=await dome.evaluate(e=>({r:+e.dataset.radius,w:e.clientWidth,h:e.clientHeight}));
  assert.ok(Math.abs(size.r-(Math.min(size.w,size.h)/2-18))<1);
  const path=await track.first().getAttribute('points');
  await page.locator('#date').fill('2026-06-21');await page.locator('#date').dispatchEvent('change');
  assert.notEqual(await track.first().getAttribute('points'),path);
  await page.locator('#date').fill('2026-11-30');await page.locator('#date').dispatchEvent('change');
  await page.locator('[data-sheet=settings]').click();
  const layer=name=>page.locator('[data-layer="'+name+'"]');
  if(!await layer('天球ドーム').isVisible())await page.locator('[data-settings-tab=layers]').click();
  if(!await layer('天球ドーム').isVisible())await page.locator('[data-layer-group="天体"] summary').click();
  await layer('天球の季節軌跡').check();assert.ok(await dome.locator('.sky-season').count()>=3);
  await layer('天球の季節軌跡').uncheck();
  await layer('天球の高度ガイド').uncheck();assert.equal(await dome.locator('.sky-horizon').count(),0);
  await layer('天球の高度ガイド').check();
  await layer('天球の時刻ラベル').uncheck();assert.equal(await dome.locator('.map-solar-time').count(),0);
  await layer('天球の時刻ラベル').check();
  await layer('天球ドーム').uncheck();assert.equal(await dome.locator('g').count(),0);
  await layer('太陽方位線').check();assert.ok(await dome.locator('.sky-bearing-track').count()>0);
  await layer('太陽方位線').uncheck();
  await layer('天球ドーム').check();
  await layer('太陽の軌跡').uncheck();assert.equal(await track.count(),0);
  await layer('太陽の軌跡').check();await page.locator('#close').click();
  await page.locator('button[data-page="map"]').click();
  const full=await dome.evaluate(e=>({r:+e.dataset.radius,w:e.clientWidth,h:e.clientHeight}));
  assert.ok(full.r>=size.r);
  await page.locator('button[data-page="both"]').click();
 }

 assert.match(await page.locator('#ridgeStats').innerText(),/119\.5°/);
 assert.equal(await page.locator('.subjectLockButton').getAttribute('aria-pressed'),'true');
 const initialGround=await page.locator('#fieldAcquisition').getAttribute('data-detail');
 if(!initialGround.includes('通信失敗'))assert.equal(await page.locator('#fieldAcquisition').getAttribute('data-phase'),'done','expected DEM no-data must not require retry');
 await page.waitForFunction(()=>/^(裸地DEM |日照計算失敗)/.test(document.querySelector('[data-status]')?.textContent),null,{timeout:live?180000:90000});
 const initialSubject=await page.locator('[data-status]').textContent();
 console.log('initial Onna-iwa:',initialSubject);
 if(live){
  const debug=await page.evaluate(async()=>{
   const {surfaceAt}=await import('/coast-surface.mjs');
   const p=window.__terrainProfile;
   if(!p)return null;
   const rows=[];
   for(let az=108;az<=120;az+=.25){
    const i=Math.round(az/.25),surface=p.surfaces[i];
    const hits=surface.segments.filter(s=>s.d>450&&s.d<650);
    if(hits.length||az%1===0)rows.push({az,peak:surface.peak,hits,probe:[-.3,0,.3,.6,1,1.5,2].map(a=>({a,hit:surfaceAt(surface,Math.tan(a*Math.PI/180),p.ground+p.height)}))});
   }
   const {makeTerrainTexture,project}=await import('/field-engine.mjs');
   const {surfaceColor}=await import('/coast-surface.mjs');
   const candidate=rows.find(r=>r.az>=113&&r.az<=117&&r.probe.some(p=>p.a===.6&&p.hit?.kind==='land'&&p.hit.distance>500&&p.hit.distance<600));
   if(!candidate)return {ground:p.ground,height:p.height,refinement:p.refinement,rows,render:null};
   const view={az:candidate.az,pitch:.3,fov:20},w=400,h=200;
   const canvas=makeTerrainTexture(p,view,w,h,true);
   const [x,y]=project(candidate.az,.5,view,w,h);
   const actual=[...canvas.getContext('2d').getImageData(Math.floor(x),Math.floor(y),1,1).data];
   const expected=surfaceColor({kind:'land',distance:550},true);
   const error=actual.slice(0,3).reduce((sum,v,i)=>sum+Math.abs(v-expected[i]),0);
   return {ground:p.ground,height:p.height,refinement:p.refinement,rows,render:{actual,expected,error}};
  });
  console.log('ISLAND FIELD',JSON.stringify(debug));
  const named=await page.evaluate(async()=>{
   const {visiblePeaks}=await import('/geographic-labels.mjs');
   const {peaks}=await fetch('/data/gsi-mountains.json').then(r=>r.json()),p=window.__terrainProfile;
   return visiblePeaks(peaks,p,{lat:36.81668,lon:137.03949,height:p.ground+p.height}).map(x=>({name:x.name,az:x.az,alt:x.alt,distance:x.distance}));
  });
  console.log('Official named peaks in actual coastal DEM:',JSON.stringify(named));
  assert.ok(named.length>0,'actual DEM must match some official summit positions');

  assert.ok(debug?.refinement?.validSamples>0,'native ridge refinement must produce measured samples');
  assert.ok(debug.refinement.selectedTiles<=192,'bounded native tile workload');
  assert.ok(debug?.rows.some(r=>r.az>=113&&r.az<=117&&r.probe.some(p=>p.a===.6&&p.hit?.kind==='land'&&p.hit.distance>500&&p.hit.distance<600)),'real Onna-iwa must retain elevated foreground surface');
  assert.ok(debug.render?.actual[3]>200&&debug.render.error<20,'rendered island must use foreground terrain material rather than distant mountains');
 }

 assert.match(initialSubject,/^裸地DEM /,'initial island ground must resolve');
 if(!initialSubject.includes('通信失敗'))assert.equal(await page.locator('[data-retry]').isHidden(),true,'expected DEM gaps must not trigger retry');

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
  // The flat synthetic DEM is below a narrow upward-looking morning frame.
  // Widen for the existing scene-light receiver regression, then restore the frame.
  await page.locator('#ridge').dispatchEvent('wheel',{deltaY:Math.log(95/9)/.002});
  await page.locator('[data-sheet=settings]').click();
  const layer=page.locator('[data-layer="日照・陰影"]');
  if(!await layer.isVisible())await page.locator('[data-settings-tab=layers]').click();
  if(!await layer.isVisible())await page.locator('details').filter({has:layer}).locator('summary').click();
  await layer.check();await page.locator('#close').click();
  await page.waitForFunction(()=>/^日照概算 \d+\//.test(document.querySelector('#sceneStatus')?.textContent),null,{timeout:90000});
  console.log('scene:',await page.locator('#sceneStatus').innerText());
  if(!live)assert.match(await page.locator('#sceneStatus').innerText(),/日照概算 [1-9]\d*\//);
  await page.locator('[data-sheet=settings]').click();if(!await layer.isVisible())await page.locator('details').filter({has:layer}).locator('summary').click();await layer.uncheck();await page.locator('#close').click();
  await page.locator('#ridge').dispatchEvent('wheel',{deltaY:Math.log(9/95)/.002});
 }
 console.log('coastal:',await page.locator('#fieldAcquisition').getAttribute('data-detail'),await page.locator('#ridgeDepth').innerText());
 // Check independent option controls and actual rendered halo pixels.
 await page.locator('[data-sheet=settings]').click();
 if(!await page.locator('[data-sun-option="glow"]').isVisible())await page.locator('[data-settings-tab=general]').click();
 assert.equal(await page.locator('[data-sun-option="minimum"]').isChecked(),true);
 assert.equal(await page.locator('[data-sun-option="glow"]').isChecked(),true);
 assert.equal(await page.locator('[data-sun-option="marker"]').isChecked(),false);
 // Verify the actual red wordmark, not merely the outlined class.
 await page.locator('[data-settings-tab=layers]').click();
 const outline=page.locator('[data-layer="稜線輪郭"]'),word=page.locator('#ridgeWord');
 if(!await outline.isVisible())await page.locator('details').filter({has:outline}).locator('summary').click();
 await outline.uncheck();
 const countRed=async()=>{const png=PNG.sync.read(await word.screenshot());let n=0;for(let i=0;i<png.data.length;i+=4){const [r,g,b]=png.data.subarray(i,i+3);if(r>150&&r-g>45&&r-b>35)n++}return n};
 const off=await countRed();
 await outline.check();
 assert.equal(await word.evaluate(e=>getComputedStyle(e).webkitTextStrokeWidth),'2px');
 assert.equal(await word.evaluate(e=>getComputedStyle(e).webkitTextStrokeColor),'rgb(255, 0, 0)');
 const on=await countRed();
 console.log('Ridge outline pixels:',{off,on});
 assert.ok(on>30&&on>off+30,'red outline must be visibly rendered');
 await outline.uncheck();
 assert.equal(await countRed(),off);
 const peakLayer=page.locator('[data-layer="山名・標高"]');
 if(!await peakLayer.isVisible())await page.locator('details').filter({has:peakLayer}).locator('summary').click();
 assert.equal(await peakLayer.isEnabled(),true);const peaksLoaded=page.waitForResponse(r=>r.url().endsWith('/data/gsi-mountains.json'),{timeout:10000});await peakLayer.check();
 assert.equal((await peaksLoaded).ok(),true);
 await peakLayer.uncheck();
 const skyLayer=page.locator('[data-layer="薄明・空色"]');
 if(!await skyLayer.isVisible())await page.locator('details').filter({has:skyLayer}).locator('summary').click();
 assert.equal(await skyLayer.isEnabled(),true);
 const beforeSky=await page.locator('#ridge').evaluate(c=>Array.from(c.getContext('2d').getImageData(20,20,1,1).data));
 await skyLayer.check();
 const afterSky=await page.locator('#ridge').evaluate(c=>Array.from(c.getContext('2d').getImageData(20,20,1,1).data));
 assert.notDeepEqual(afterSky,beforeSky,'clear sky layer changes actual rendered sky');
 await skyLayer.uncheck();
 const groups=await page.locator('[data-layer-group][open]').evaluateAll(es=>es.map(e=>e.dataset.layerGroup));
 assert.ok(groups.includes('地形')&&groups.includes('光・大気'));
 await page.locator('[data-settings-tab=general]').click();await page.locator('[data-settings-tab=layers]').click();
 assert.deepEqual(await page.locator('[data-layer-group][open]').evaluateAll(es=>es.map(e=>e.dataset.layerGroup)),groups);
 await page.locator('#close').click();await page.locator('[data-sheet=settings]').click();
 assert.deepEqual(await page.locator('[data-layer-group][open]').evaluateAll(es=>es.map(e=>e.dataset.layerGroup)),groups);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ridgearc.field.openLayerGroups')).sort()),[...groups].sort());
 await page.locator('[data-settings-tab=general]').click();

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
 const fades=await page.evaluate(async()=>{
  const {drawSolarGlow}=await import('/solar-display.mjs');
  const cv=document.createElement('canvas');cv.width=cv.height=80;const c=cv.getContext('2d');
  return [0,.25,.5,.75,1].map(opacity=>{c.fillStyle='#293d55';c.fillRect(0,0,80,80);drawSolarGlow(c,40,40,3,opacity);return c.getImageData(50,40,1,1).data[0]});
 });
 assert.ok(fades.every((v,i)=>i===0||v>fades[i-1]),'actual halo pixel changes continuously with visibility');
 const vector=await page.evaluate(async()=>{
  const {makeTerrainTexture}=await import('/field-engine.mjs');
  const far={hi:.08,m:.2,b:-960,d:8000,near:4800};
  const rock={hi:.02,m:.12,b:-55,d:550,near:500};
  const profile={ground:0,height:1.6,total:Array(1440).fill(Math.atan(.08)*180/Math.PI),surfaces:Array.from({length:1440},(_,i)=>({segments:i===1?[rock,far]:[far],water:[]}))};
  const view={az:.25,pitch:.85,fov:.75},w=300,h=160;
  const c=makeTerrainTexture(profile,view,w,h).getContext('2d');
  const center=[...c.getImageData(150,80,1,1).data],left=[...c.getImageData(45,80,1,1).data],right=[...c.getImageData(255,80,1,1).data];
  const pixels=c.getImageData(0,80,w,1).data,distinct=new Set(Array.from({length:w},(_,i)=>Array.from(pixels.slice(i*4,i*4+3)).join(',')));
  return {center,left,right,colors:distinct.size};
 });
 console.log('Vector terrain:',JSON.stringify(vector));
 assert.ok(vector.center[0]<vector.left[0]-15&&vector.center[0]<vector.right[0]-15,'foreground polygon survives in front of distant terrain');
 assert.ok(vector.colors<15,'polygons must not smear colors across angular samples');
 // A planar sea shared by adjacent rays must not have holes when the
 // verified range ends differ. Exercise the actual canvas, not just keys.
 const seaContinuity=await page.evaluate(async()=>{
  const {makeTerrainTexture,project}=await import('/field-engine.mjs');
  const p={ground:0,height:1.6,total:Array(1440).fill(1),surfaces:Array.from({length:1440},(_,i)=>({segments:[],water:[[10,i%2?5000:3000]]}))};
  const view={az:116.6,pitch:-.3,fov:5},w=400,h=240,c=makeTerrainTexture(p,view,w,h).getContext('2d');
  const y=Math.floor(project(view.az,Math.atan(-.005)*180/Math.PI,view,w,h)[1]),pixels=c.getImageData(0,y,w,1).data;
  const expected=[...pixels.slice(4,7)];let holes=0,distinct=new Set();
  for(let x=2;x<w-2;x++){const rgb=[...pixels.slice(x*4,x*4+3)];distinct.add(rgb.join(','));if(rgb.some((v,k)=>Math.abs(v-expected[k])>3))holes++}
  return {expected,holes,colors:distinct.size};
 });
 console.log('Shared sea continuity:',JSON.stringify(seaContinuity));
 assert.ok(seaContinuity.expected[2]>110&&seaContinuity.holes===0,'same measured sea must not be broken into triangles');
 const smooth=await page.evaluate(async()=>{
  const {makeTerrainTexture}=await import('/field-engine.mjs');
  const far={hi:.08,m:.2,b:-960,d:8000,near:4800};
  const profile={ground:0,height:1.6,total:Array(1440).fill(Math.atan(.08)*180/Math.PI),surfaces:Array.from({length:1440},()=>({segments:[far],water:[]}))};
  const view={az:.25,pitch:.85,fov:.75},w=300,h=160;
  const shade={rows:1,cols:2,depth:[6600,6600],index:[0,1],ambient:[.08,.08,.08],values:[{kind:'shadow',value:0,illumination:{direct:[0,0,0],diffuse:[.05,.05,.05]}},{kind:'lit',value:.5,illumination:{direct:[.5,.5,.5],diffuse:[.05,.05,.05]}}]};
  const c=makeTerrainTexture(profile,view,w,h,true,shade).getContext('2d');
  const row=Array.from({length:241},(_,i)=>c.getImageData(i+30,80,1,1).data[0]);
  return {first:row[0],last:row.at(-1),colors:new Set(row).size,maxJump:Math.max(...row.slice(1).map((v,i)=>Math.abs(v-row[i])))};
 });
 console.log('Continuous shading:',JSON.stringify(smooth));
 assert.ok(smooth.last>smooth.first+15&&smooth.colors>12&&smooth.maxJump<=5,'lighting must vary continuously within one terrain band');
 // Actual loupe opens with the same real solar position used for target selection.
 const currentRidge=page.locator('#ridge'),currentRect=await currentRidge.boundingBox();
 // Directly selecting a known trajectory point avoids changing the camera.
 const morning=await page.evaluate(async({w,h})=>{const {solarAt,project}=await import('/field-engine.mjs');const sun=solarAt('2026-12-01',7+3/60,36.816525,137.0373667);return project(sun.az,sun.alt,{az:116.6,pitch:4.5,fov:9},w,h)},{w:currentRect.width,h:currentRect.height});
 await currentRidge.click({position:{x:morning[0],y:morning[1]}});
 await currentRidge.dblclick({position:{x:morning[0],y:morning[1]}});
 await page.locator('#solarLoupe').waitFor({state:'visible',timeout:5000});
 assert.match(await page.locator('#loupeTitle').innerText(),/2°/);
 assert.ok((await page.locator('#solarLoupe').boundingBox()).width>=120,'larger desktop loupe');
 await page.locator('#closeLoupe').click();
 const dragTargets=await page.evaluate(async({w,h})=>{const {solarAt,project}=await import('/field-engine.mjs');return [4,5,6,7,8].map(m=>{const sun=solarAt('2026-12-01',7+m/60,36.816525,137.0373667);return project(sun.az,sun.alt,{az:116.6,pitch:4.5,fov:9},w,h)})},{w:currentRect.width,h:currentRect.height});
 await page.mouse.move(currentRect.x+morning[0],currentRect.y+morning[1]);
 await page.mouse.down();const dragged=[];
 for(const [x,y] of dragTargets){await page.mouse.move(currentRect.x+x,currentRect.y+y);dragged.push((await page.locator('#clock').innerText()).trim())}
 await page.mouse.up();
 assert.ok(dragged.some(t=>/^07:(04|05|07|08)$/.test(t)),'solar drag must select a non-three-minute timestamp: '+dragged.join(','));
 
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
 const target=await page.evaluate(async({w,h})=>{const {solarAt,project}=await import('/field-engine.mjs');const sun=solarAt('2026-12-01',7+3/60,36.816525,137.0373667);return project(sun.az,sun.alt,{az:116.6,pitch:4.5,fov:9},w,h)},{w:rect.width,h:rect.height});
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
 assert.match(await page.locator('header .demo').innerText(),/0\.10\.2/);
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
 if(!live){
  await page.locator('[data-sheet=share]').click();
  await page.locator('#snapshotName').fill('女岩の朝');
  await page.locator('#snapshotSave').click();
  assert.equal(await page.locator('#snapshotList .snapshotEntry').count(),1);
  assert.match(await page.locator('#snapshotStatus').innerText(),/保存しました/);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ridgearc.field.snapshots.v1'))[0]);
  assert.ok(saved.thumbnail?.startsWith('data:image/jpeg;base64,'));
  await page.locator('#snapshotShare').click();
  const link=await page.locator('#snapshotLink').inputValue();
  assert.ok(link.includes('#snapshot='));
  await page.locator('#close').click();
  await page.locator('#clock').press('ArrowRight');
  assert.notEqual((await page.locator('#clock').innerText()).trim(),String(Math.floor(saved.state.minute/60)).padStart(2,'0')+':'+String(saved.state.minute%60).padStart(2,'0'));
  await page.locator('[data-sheet=share]').click();
  await page.locator('[data-snapshot-action=restore]').click();
  await page.locator('#sheet').waitFor({state:'hidden'});
  await page.locator('[data-sheet=share]').click();
  await page.locator('#snapshotShare').click();
  const restored=await page.evaluate(async()=>{const {decodeSnapshot}=await import('/field-snapshot.mjs');return decodeSnapshot(new URL(document.querySelector('#snapshotLink').value).hash.slice(10))});
  assert.deepEqual(restored,saved.state,'all composition settings must round trip');
  await page.locator('#close').click();
  const shared=await context.newPage();await shared.goto(link);
  await shared.locator('[data-sheet=share]').click();await shared.locator('#snapshotShare').click();
  const reopened=await shared.evaluate(async()=>{const {decodeSnapshot}=await import('/field-snapshot.mjs');return decodeSnapshot(new URL(document.querySelector('#snapshotLink').value).hash.slice(10))});
  assert.deepEqual(reopened,saved.state,'share URL restores composition on new page');
  await shared.close();
  const mapLab=await context.newPage();
  const mapErrors=[];mapLab.on('pageerror',e=>mapErrors.push(e.message));
  await mapLab.goto('http://127.0.0.1:'+server.address().port+'/ui-lab/map-sun.html');
  await mapLab.locator('.map-solar-time.current').waitFor();
  assert.equal((await mapLab.locator('.map-solar-time.current').textContent()).trim(),'07:03');
  assert.ok(await mapLab.locator('.map-solar-time:not(.current)').count()>0);
  const dome=await mapLab.locator('.sky-dome-overlay').evaluate(e=>({radius:+e.dataset.radius,w:e.clientWidth,h:e.clientHeight,cx:+e.dataset.centerX,cy:+e.dataset.centerY}));
  assert.ok(dome.radius*2/Math.min(dome.w,dome.h)>.85,'dome uses nearly the full map dimension');
  assert.ok(Math.abs(dome.cx-dome.w/2)<2&&Math.abs(dome.cy-dome.h/2)<2);
  assert.ok(await mapLab.locator('.sky-track').count()>0);
  await mapLab.locator('#seasons').check();assert.ok(await mapLab.locator('.sky-season').count()>=3);
  await mapLab.locator('#seasons').uncheck();
  await mapLab.locator('#guides').uncheck();assert.equal(await mapLab.locator('.sky-horizon').count(),0);
  await mapLab.locator('#guides').check();assert.equal(await mapLab.locator('.sky-horizon').count(),1);
  await mapLab.locator('#labels').uncheck();assert.equal(await mapLab.locator('.map-solar-time').count(),0);
  await mapLab.locator('#labels').check();
  const before=await mapLab.locator('#readout').textContent();
  await mapLab.locator('#minute').fill('540');await mapLab.locator('#minute').dispatchEvent('input');
  assert.equal((await mapLab.locator('.map-solar-time.current').textContent()).trim(),'09:00');
  assert.notEqual(await mapLab.locator('#readout').textContent(),before);
  await mapLab.locator('#trajectory').uncheck();
  assert.equal(await mapLab.locator('.map-solar-time:not(.current)').count(),0);
  await mapLab.locator('#sun').uncheck();assert.equal(await mapLab.locator('.map-solar-time').count(),0);
  assert.deepEqual(mapErrors,[]);await mapLab.close();
  const lab=await context.newPage();
  await lab.goto('http://127.0.0.1:'+server.address().port+'/ui-lab/location-search.html');
  await lab.locator('#kind').selectOption('G4');
  await lab.locator('#radius').fill('100');await lab.locator('#gridStep').fill('100');
  await lab.locator('#run').click();
  await lab.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('探索完了'),null,{timeout:90000});
  assert.equal(await lab.locator('#results article').count(),5);
  assert.equal(await lab.locator('#run').isEnabled(),true);
  await lab.locator('#kind').selectOption('G5');
  const targetHeight=await lab.evaluate(async()=>{const {sunPosition,R,DEG}=await import('/core.mjs');const s=sunPosition('2026-11-30',423,36.81457,137.04533),d=500;return Math.max(0,1.6+Math.tan(s.alt*DEG)*d+d*d/(2*R))});
  await lab.locator('#subjectHeight').fill(String(targetHeight));await lab.locator('#minM').fill('500');await lab.locator('#maxM').fill('500');
  await lab.locator('#run').click();await lab.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('探索完了'),null,{timeout:90000});
  assert.ok(await lab.locator('#results article').count()>0,'synthetic G5 must return geometry-matched candidates');
  const popupPromise=context.waitForEvent('page');await lab.locator('#results article').first().getByText('FIELDで確認').click();const fromLab=await popupPromise;
  await fromLab.locator('#date').waitFor();assert.equal(await fromLab.locator('#date').inputValue(),'2026-11-30');
  assert.ok(fromLab.url().includes('#snapshot='));
  await fromLab.close();await lab.close();
  const failure=await context.newPage();
  await failure.addInitScript(()=>{
   const NativeWorker=window.Worker;
   window.Worker=class extends NativeWorker{
    constructor(url,options){
     if(String(url).includes('field-terrain-worker.mjs')){
      super(URL.createObjectURL(new Blob([`self.onmessage=e=>{if(!e.data.cancel)self.postMessage({type:'error',id:e.data.id,message:'dem_png/14/14400/6380：HTTP 503'})}`],{type:'text/javascript'})));
     }else super(url,options);
    }
   };
  });
  await failure.goto('http://127.0.0.1:'+server.address().port+'/field/');
  await failure.locator('#fieldAcqDetail').waitFor({state:'visible'});
  await failure.locator('#subjectAcqDetail').waitFor({state:'visible'});
  assert.match(await failure.locator('#fieldAcqDetail').innerText(),/dem_png.*HTTP 503/);
  assert.match(await failure.locator('#subjectAcqDetail').innerText(),/HTTP 503/);
  assert.equal(await failure.locator('#fieldRetry').isVisible(),true);
  await failure.waitForTimeout(2700);
  assert.equal(await failure.locator('#fieldAcqDetail').isVisible(),true,'failure must persist beyond success auto-hide');
  await failure.locator('#fieldRetry').click();
  await failure.locator('#fieldAcqDetail').waitFor({state:'visible'});
  assert.match(await failure.locator('#fieldAcqDetail').innerText(),/HTTP 503/);
  await failure.close();
 }
 if(live){
  const lab=await context.newPage();
  await lab.goto('http://127.0.0.1:'+server.address().port+'/ui-lab/location-search.html');
  await lab.locator('#minM').fill('500');await lab.locator('#maxM').fill('500');await lab.locator('#tolerance').fill('2');
  await lab.locator('#run').click();await lab.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('探索完了'),null,{timeout:180000});
  const subjectStatus=await lab.locator('#status').innerText();console.log('LIVE G5:',subjectStatus,await lab.locator('#results').innerText());
  assert.match(subjectStatus,/候補 5点/);
  // Inland fixture: a deliberately elevated target, not a real named structure.
  await lab.locator('#subjectLat').fill('35.68');await lab.locator('#subjectLon').fill('139.75');
  await lab.locator('#subjectHeight').fill('35');
  await lab.locator('#run').click();await lab.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('探索完了'),null,{timeout:180000});
  console.log('LIVE inland G5:',await lab.locator('#status').innerText(),await lab.locator('#results').innerText());
  assert.ok(await lab.locator('#results article').count()>0,'real inland candidate elevations must reach the verification path');
  await lab.locator('#kind').selectOption('G4');await lab.locator('#radius').fill('100');await lab.locator('#gridStep').fill('250');
  await lab.locator('#run').click();await lab.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('探索完了'),null,{timeout:180000});
  console.log('LIVE G4:',await lab.locator('#status').innerText(),await lab.locator('#results').innerText());
  assert.equal(await lab.locator('#results article').count(),1);
  await lab.close();
 }
 assert.deepEqual(errors,[]);
 console.log(live?'LIVE GSI smoke passed; not an accuracy reference':'Chromium synthetic DEM integration passed');
}finally{await browser?.close();await new Promise(r=>server.close(r))}

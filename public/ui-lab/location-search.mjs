import {encodeSnapshot} from '../field-snapshot.mjs';
import {targetDirection} from '../location-geometry.mjs';
const $=id=>document.getElementById(id),number=id=>$(id).valueAsNumber;
const point=prefix=>({lat:number(prefix+'Lat'),lon:number(prefix+'Lon')});
const valid=p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=20&&p.lat<=46&&p.lon>=122&&p.lon<=154;
const date=$('date'),status=$('status'),results=$('results');
const map=L.map('map').setView([36.81668,137.03949],14);
L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',{maxZoom:18,attribution:'地理院タイル'}).addTo(map);
const markers={subject:L.marker([36.81457,137.04533],{draggable:true}).bindTooltip('被写体',{permanent:true}).addTo(map),center:L.marker([36.81668,137.03949],{draggable:true}).bindTooltip('探索中心',{permanent:true}).addTo(map)};
const layer=L.layerGroup().addTo(map);
let worker=null,job=0,watchdog=0;
function putPoint(prefix,p){
 if(!valid(p))return;
 $(prefix+'Lat').value=p.lat.toFixed(7);$(prefix+'Lon').value=p.lon.toFixed(7);markers[prefix].setLatLng([p.lat,p.lon]);
}
for(const prefix of ['subject','center']){
 markers[prefix].on('dragend',()=>{const p=markers[prefix].getLatLng();putPoint(prefix,{lat:p.lat,lon:p.lng})});
 for(const suffix of ['Lat','Lon'])$(prefix+suffix).onchange=()=>{const p=point(prefix);if(valid(p))markers[prefix].setLatLng([p.lat,p.lon])};
}
map.on('click',e=>putPoint($('pick').value,{lat:e.latlng.lat,lon:e.latlng.lng}));
function mode(){
 const g5=$('kind').value==='G5';
 $('g5').hidden=!g5;$('subjectFields').hidden=!g5;$('centerFields').hidden=g5;$('pick').value=g5?'subject':'center';
 for(const [key,marker] of Object.entries(markers))if(key===(g5?'subject':'center'))marker.addTo(map);else marker.remove();
}
$('kind').onchange=mode;mode();
const hh=m=>{m=Math.max(0,Math.min(1439,Math.round(m)));return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
function element(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e}
function openField(p,req,kind){
 const subject=p.target??{...req.subject,height:0},observer=p.observer??{...p,height:p.eye??req.eyeHeight};
 const direction=p.align?.target??targetDirection(observer,subject),day=p.date??req.date,minute=Math.round(p.minute??req.minute);
 const snapshot={version:1,observer:{lat:p.lat,lon:p.lon,height:req.eyeHeight},subject:{lat:subject.lat,lon:subject.lon,locked:true,distance:direction.distance},date:day,minute:Math.max(0,Math.min(1439,minute)),view:{az:p.align?.sun.az??p.az??270,pitch:p.align?.sun.alt??0,fov:20},map:{lat:p.lat,lon:p.lon,zoom:15},ui:{page:'both',split:.4,layers:['太陽','太陽の軌跡','距離色','地平線'],tracks:['太陽可視','被写体の日照'],compass:'scale',coordinates:true,loupe:false,splitLoupe:true,sun:{minimum:true,marker:false,glow:true}},timeline:{start:day,end:day,days:1,expanded:false,lockTime:true},search:{active:false,body:'sun',start:null,span:366,direction:'both',days:733,center:0,target:null}};
 const url=new URL('../field/',location.href);url.hash='snapshot='+encodeSnapshot(snapshot);window.open(url.href,'_blank','noopener');
}
function render(data,req){
 layer.clearLayers();results.replaceChildren();
 const list=data.results??[];
 status.textContent='探索完了：候補 '+data.sampled+'点'+(data.matched!==undefined?' / 構図一致 '+data.matched+'点 / 検証 '+data.checked+'点':'')+(data.limited?' / 検証上限あり':'')+(data.reason?' / '+data.reason:'')+'。サンプル外を含む解の存在は保証しません。';
 const rank=p=>p.status==='blocked'||(data.kind==='G5'&&p.sunVisibility?.upper===0)?2:p.status==='unknown'||p.sunVisibility?.uncertain||p.sunVisibility?.estimate==null&&data.kind==='G5'?1:0;
 const sorted=[...list].sort((a,b)=>rank(a)-rank(b)||(a.align?.separation??0)-(b.align?.separation??0));
 if(!sorted.length)results.append(element('p','検出された候補なし。探索条件・間隔・DEM欠損を確認してください。'));
 for(const p of sorted){
  const uncertain=rank(p)===1,blocked=rank(p)===2,color=blocked?'#f16b70':uncertain?'#bba27a':'#7ca98e',label=blocked?'遮蔽':uncertain?'不明・暫定':'サンプル上可視';
  const text=[label,p.lat.toFixed(5)+', '+p.lon.toFixed(5),p.date??req.date,p.minute!=null?hh(p.minute):'',p.align?'離角 '+p.align.separation.toFixed(2)+'°':'',p.los?'被写体LOS '+p.los.status:'',p.sunVisibility?.estimate!=null?'太陽可視 '+Math.round(p.sunVisibility.estimate*100)+'%（概算）':'',p.reason??''].filter(Boolean).join(' · ');
  const article=element('article');article.dataset.resultStatus=p.status;article.append(element('strong',label),element('p',text));
  const locate=element('button','地図へ');locate.onclick=()=>{map.setView([p.lat,p.lon],Math.max(14,map.getZoom()));pin.openPopup()};
  const open=element('button','FIELDで確認');open.onclick=()=>{try{openField(p,req,data.kind)}catch(e){status.textContent=e.message}};
  article.append(locate,open);results.append(article);
  const pin=L.circleMarker([p.lat,p.lon],{radius:6,color,weight:2,fillColor:color,fillOpacity:.85}).addTo(layer);
  const popup=element('div',text);const more=element('button','FIELDで確認');more.onclick=open.onclick;popup.append(document.createElement('br'),more);pin.bindPopup(popup);
 }
 if(sorted.length)map.fitBounds(L.latLngBounds(sorted.map(p=>[p.lat,p.lon])),{padding:[30,30],maxZoom:15});
}
function done(){clearTimeout(watchdog);worker?.terminate();worker=null;$('run').disabled=false;$('stop').disabled=true}
function resetWatchdog(){clearTimeout(watchdog);watchdog=setTimeout(()=>{done();status.textContent='90秒間進捗がありません。通信状態を確認して再試行してください。'},90000)}
$('stop').onclick=()=>{job++;done();status.textContent='停止しました'};
$('run').onclick=()=>{
 try{
  const [h,m]=$('time').value.split(':').map(Number),req={subject:point('subject'),center:point('center'),date:date.value,minute:h*60+m,subjectHeight:number('subjectHeight'),eyeHeight:number('eyeHeight'),radiusM:number('radius'),gridStep:number('gridStep'),days:number('days'),windowMinutes:number('window'),minM:number('minM'),maxM:number('maxM'),radialStep:number('radialStep'),verticalOffset:number('verticalOffset'),tolerance:number('tolerance')};
  if(!valid(req.subject)||!valid(req.center)||!date.value||!Number.isFinite(req.minute))throw Error('有効な地点と日時を指定してください');
  done();const id=++job,kind=$('kind').value;worker=new Worker('../location-search-worker.mjs',{type:'module'});$('run').disabled=true;$('stop').disabled=false;results.replaceChildren();layer.clearLayers();status.textContent='探索準備中';resetWatchdog();
  worker.onmessage=e=>{const v=e.data;if(id!==job||v.id!==id)return;resetWatchdog();if(v.type==='progress')status.textContent=v.message;else if(v.type==='error'){done();status.textContent=v.message}else if(v.type==='result'){done();render(v.result,req)}};
  worker.onerror=e=>{if(id!==job)return;done();status.textContent='探索Workerエラー：'+e.message};
  worker.onmessageerror=()=>{if(id!==job)return;done();status.textContent='探索結果の復号失敗'};
  worker.postMessage({id,kind,request:req});
 }catch(e){done();status.textContent=e.message||String(e)}
};

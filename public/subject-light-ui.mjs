import {lightAt,LIGHT_THRESHOLD} from './light-engine.mjs';

const fmt=m=>m==null?'未判定':String(Math.floor(Math.round(m)/60)).padStart(2,'0')+':'+String(Math.round(m)%60).padStart(2,'0');
const labels={lit:'日照（モデル内）',shadow:'閾値以下（モデル内）',unknown:'未判定'};
const colors={lit:'#d9b779',shadow:'#394651',unknown:'#947c6e'};

export function mountSubjectLight(root,{onPick,onTarget,onTime,onTimeline=()=>{},getObserver,workerFactory=()=>new Worker(new URL('./field-terrain-worker.mjs',import.meta.url),{type:'module'})}){
 root.innerHTML=`<h3>被写体の日照（計算詳細）</h3>
 <p class="muted">撮影位置とは別の地点の、裸地DEMと幾何太陽による直射光の概算です。気象・大気差・樹木・建物・観測者からの可視性は未考慮。70km・0.25°刻み、斜面法線は40m基線、10m未満の未取得サンプルは取得率対象外。実地形精度は未検証。</p>
 <div class="fieldLocation">
 <label>被写体 緯度<input data-lat type="number" step="any" value="36.5725646"></label>
 <label>被写体 経度<input data-lon type="number" step="any" value="137.6175013"></label>
 <button data-calc>日照を計算</button><button data-pick>地図で被写体を指定</button>
 <button data-current>現在の観測点を被写体にする</button>
 <button data-preset>立山・雄山（参考座標）</button>
 <small class="muted">雄山の座標出典：<a href="https://tatekuro.jp/enjoy/pointDetail.php?id=21" target="_blank" rel="noopener">立山黒部ジオパーク</a>。測量点の保証なし。</small>
 </div><p data-status class="fieldMessage" aria-live="polite">被写体を指定してください。</p><button data-retry hidden>再試行</button>
 <div data-result hidden>
 <div data-values class="dataGrid"></div>
 <p class="muted">日照時間帯はメインのタイムラインに表示します。</p></div>`;
 const $=q=>root.querySelector('[data-'+q+']');
 let worker=null,requestId=0,target=null,profile=null,analysis=null,desiredDate=null,minute=900,pending=false,resultDate=null,lastRender='',failed=false;
 const status=s=>{$('status').textContent=s;$('retry').hidden=!failed;onTimeline()};
 const clear=()=>{profile=null;analysis=null;resultDate=null;lastRender='';$('result').hidden=true};
 function fail(message){pending=false;failed=true;clear();status('日照計算失敗：'+message)}
 function request(force=false){
  if(!target||!desiredDate)return;
  try{
   if(!worker){worker=workerFactory();worker.onmessage=e=>{
    const m=e.data;if(m.id!==requestId)return;
    if(m.type==='progress'){status('被写体 '+m.message);return;}
    pending=false;
    if(m.type==='error'){fail(m.message);return;}
    if(m.type==='light'){
     profile=m.profile;analysis=m.analysis;resultDate=m.date;
     if(resultDate!==desiredDate){request();return;}
     failed=profile.failedTiles>0||profile.coverage<.999;status('裸地DEM '+profile.source+' · 取得率 '+(profile.coverage*100).toFixed(1)+'% · モデル概算'+(profile.failedTiles>0?' · 通信失敗 '+profile.failedTiles+' 件':failed?' · 欠損あり':''));
     render();
    }
   };worker.onerror=e=>{worker?.terminate();worker=null;fail(e.message||'Workerエラー')};}
   pending=true;failed=false;clear();status('被写体の地形・日照計算中…');
   worker.postMessage({mode:'light',id:++requestId,lat:target.lat,lon:target.lon,date:desiredDate,force});
  }catch(e){fail(e.message||String(e))}
 }
 function select(lat,lon){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>46||lon<122||lon>154){status('日本周辺の有効な座標を入力してください。');return;}
  $('lat').value=lat;$('lon').value=lon;target={lat,lon};onTarget?.(target);request();
 }
 function addValue(key,value){const div=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');small.textContent=key;strong.textContent=value;div.append(small,strong);$('values').append(div)}
 function fraction(v){
  if(!v)return '未判定（法線不足）';
  const percent=x=>(100*x).toFixed(1)+'%';
  return v.estimate==null||v.upper-v.lower>1e-6?percent(v.lower)+' ～ '+percent(v.upper)+'（モデル内）':percent(v.estimate)+'（概算）';
 }
 function render(){
  if(!profile||!analysis||resultDate!==desiredDate)return;
  const key=[requestId,minute].join('/');if(lastRender===key)return;lastRender=key;
  $('result').hidden=false;const v=lightAt(profile,desiredDate,minute,target.lat,target.lon);
  $('values').replaceChildren();
  addValue('対象標高',profile.ground.toFixed(1)+' m');
  addValue('選択時刻',fmt(minute)+' JST');
  addValue('円盤可視率',fraction(v.disk));
  addValue('相対直射光量',fraction(v.direct));
  addValue('最初の日照（モデル内）',fmt(analysis.first));
  addValue('最後の日照（モデル内）',fmt(analysis.last));
  if(analysis.possibleFirst!==analysis.first||analysis.possibleLast!==analysis.last)
   addValue('未判定を含む可能範囲',fmt(analysis.possibleFirst)+' ～ '+fmt(analysis.possibleLast));
  addValue('斜面法線',profile.normal?'40m基線の概算':'取得不足');

 }
 $('calc').onclick=()=>select($('lat').valueAsNumber,$('lon').valueAsNumber);
 $('pick').onclick=()=>onPick?.();
 $('current').onclick=()=>{const p=getObserver();select(p.lat,p.lon)};
 $('preset').onclick=()=>select(36.5725646,137.6175013);
 $('retry').onclick=()=>request(true);
 return {select,retry(){request(true)},acquisition(){return {pending,failed,message:$('status').textContent}},invalidate(){failed=false;requestId++;worker?.terminate();worker=null;target=null;pending=false;clear();status('被写体位置更新中…')},track(date){return {target,analysis:resultDate===date?analysis:null,pending:pending||!!target&&resultDate!==date&&!$('status').textContent.startsWith('日照計算失敗'),error:$('status').textContent.startsWith('日照計算失敗')}} ,sync(date,m){
  const changed=date!==desiredDate;desiredDate=date;minute=m;
  if(changed&&target&&!pending)request();
  else if(changed&&pending){$('result').hidden=true;onTimeline()}
  else render();
 }};
}

import {shiftDate} from './core.mjs';
const time=m=>{const n=Math.min(1439,Math.round(m));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const labels={unknown:'地形未判定',hidden:'遮蔽（モデル内）',provisional:'暫定可視',visible:'可視（モデル内）'};
export function mountAlignment(root,{view,profile,date,select,target,onRepick}){
 root.innerHTML=`<div class="fieldLocation">
 <p class="muted">風景画面で指定した位置に太陽が来る日を探します。</p><button data-repick>太陽の位置を選び直す</button><details><summary>角度・許容範囲（詳細設定）</summary>
 <label>方位 °<input data-az type="number" step=".01" min="0" max="360" value="${target.az.toFixed(2)}"></label>
 <label>高度 °<input data-alt type="number" step=".01" min="-90" max="90" value="${target.alt.toFixed(2)}"></label>
 <button data-ridge>中央稜線の高度を使う</button>
 <label>許容角度 °<input data-tolerance type="number" min=".01" max="10" step=".01" value=".27"></label>
 </details><label>開始日<input data-start type="date"></label>
 <label>終了日<input data-end type="date"></label>
 <button data-run>日時を探索</button><button data-stop disabled>停止</button>
 <p data-status class="fieldMessage" aria-live="polite"></p><div data-results></div>
 </div>`;
 const $=q=>root.querySelector('[data-'+q+']');
 $('start').value=date;$('end').value=shiftDate(date,365);
 let worker=null,id=0;
 const stop=()=>{if(worker){worker.terminate();worker=null;}$('run').disabled=false;$('stop').disabled=true;};
 $('ridge').onclick=()=>{
  const a=$('az').valueAsNumber;
  if(!profile||!Number.isFinite(a)){$('status').textContent='地形未取得';return;}
  const f=((a%360+360)%360)/.25,i=Math.floor(f),u=profile.total[i],v=profile.total[(i+1)%profile.total.length];
  if(!Number.isFinite(u)||!Number.isFinite(v)){$('status').textContent='この方向の稜線は未取得';return;}
  $('alt').value=(u+(v-u)*(f-i)).toFixed(2);
  $('status').textContent='DEMの最高稜線を設定（近景を含む）';
 };
 $('repick').onclick=()=>{stop();onRepick()};
 $('stop').onclick=()=>{stop();$('status').textContent='探索を停止しました。'};
 $('run').onclick=()=>{
  stop();$('results').replaceChildren();$('run').disabled=true;$('stop').disabled=false;$('status').textContent='探索中…';
  try{
   const p=profile?{total:profile.total,complete:profile.complete,ground:profile.ground,height:profile.height}:null;
   const req={id:++id,lat:view.lat,lon:view.lon,start:$('start').value,end:$('end').value,az:$('az').valueAsNumber,alt:$('alt').valueAsNumber,tolerance:$('tolerance').valueAsNumber,profile:p};
   worker=new Worker(new URL('./alignment-worker.mjs',import.meta.url),{type:'module'});
   worker.onmessage=e=>{
    const m=e.data;if(m.id!==id)return;
    if(!root.isConnected){stop();return;}
    if(m.type==='progress'){$('status').textContent='探索 '+m.done+'/'+m.total+' 日';return;}
    stop();
    if(m.type==='error'){$('status').textContent=m.message;return;}
    $('status').textContent=m.results.length+' 件の候補（天候未考慮）';
    for(const item of m.results){
     const row=document.createElement('div'),label=document.createElement('span'),button=document.createElement('button');
     row.className='eventRow';label.textContent=item.date+' '+time(item.minute);
     button.textContent='風景を見る · '+labels[item.status];button.title='指定位置から '+item.error.toFixed(2)+'°';button.onclick=()=>select(item);
     row.append(label,button);$('results').append(row);
    }
   };
   worker.onerror=e=>{stop();$('status').textContent='探索エラー：'+e.message};
   worker.postMessage(req);
  }catch(e){stop();$('status').textContent=e.message;}
 };
 return {stop};
}

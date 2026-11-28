import {readSnapshots,writeSnapshots,encodeSnapshot,validateSnapshot} from './field-snapshot.mjs';

const element=(tag,content)=>{const e=document.createElement(tag);if(content!=null)e.textContent=content;return e};
export function captureThumbnail(canvas){
 try{
  if(!canvas?.width||!canvas.height||!canvas.clientWidth||!canvas.clientHeight)return null;
  const c=document.createElement('canvas'),scale=Math.min(1,320/canvas.width,180/canvas.height);
  c.width=Math.max(1,Math.round(canvas.width*scale));c.height=Math.max(1,Math.round(canvas.height*scale));
  c.getContext('2d').drawImage(canvas,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.75);
 }catch{return null}
}
export function mountSnapshotMenu(root,{capture,restore,thumbnail,storage=localStorage}){
 root.replaceChildren(element('h2','共有・保存'));
 const help=element('p','構図・日時・表示設定を端末に保存します。地形は復元時に再計算されます。');help.className='muted';
 const name=element('input');name.type='text';name.maxLength=100;name.id='snapshotName';name.setAttribute('aria-label','スナップショット名');
 const initial=capture();name.value=initial.date+' '+String(Math.floor(initial.minute/60)).padStart(2,'0')+':'+String(initial.minute%60).padStart(2,'0');
 const save=element('button','スナップショット保存');save.id='snapshotSave';
 const share=element('button','現在の構図の共有リンク');share.id='snapshotShare';
 const url=element('textarea');url.readOnly=true;url.hidden=true;url.id='snapshotLink';url.setAttribute('aria-label','共有リンク');
 const status=element('p');status.id='snapshotStatus';status.setAttribute('role','status');status.className='muted';
 const list=element('div');list.id='snapshotList';const actions=element('div');actions.className='exportMenu';actions.append(name,save,share,url,status);
 root.append(help,actions,element('h3','保存した構図'),list);
 let entries=[];let readable=true;
 const report=e=>{status.textContent=e?.message||String(e)};
 function render(){
  list.replaceChildren();
  if(!entries.length){list.append(element('p','保存済みの構図はありません。'));return}
  for(const entry of entries){
   const row=element('div');row.className='snapshotEntry';row.dataset.snapshotId=entry.id;
   if(entry.thumbnail){const img=element('img');img.src=entry.thumbnail;img.alt='風景プレビュー';row.append(img)}
   const info=element('div');info.append(element('strong',entry.name),element('small',entry.state.date+' · '+entry.createdAt.slice(0,10)));
   const buttons=element('div');buttons.className='snapshotButtons';
   const open=element('button','復元');open.dataset.snapshotAction='restore';open.onclick=()=>{try{restore(entry.state)}catch(e){report(e)}};
   const link=element('button','共有');link.dataset.snapshotAction='share';link.onclick=()=>showLink(entry.state);
   const remove=element('button','削除');remove.dataset.snapshotAction='delete';remove.onclick=()=>{if(!confirm('「'+entry.name+'」を削除しますか？'))return;try{const next=entries.filter(e=>e.id!==entry.id);writeSnapshots(storage,next);entries=next;render();status.textContent='削除しました'}catch(e){report(e)}};
   buttons.append(open,link,remove);info.append(buttons);row.append(info);list.append(row);
  }
 }
 async function showLink(s){try{
  const base=new URL(location.href);base.hash='snapshot='+encodeSnapshot(s);url.value=base.href;url.hidden=false;url.select();
  try{await navigator.clipboard.writeText(url.value);status.textContent='リンクをコピーしました（撮影地点・被写体座標を含みます）'}catch{status.textContent='リンクを選択しました。コピーしてください（座標を含みます）'}
 }catch(e){report(e)}}
 try{entries=readSnapshots(storage)}catch(e){readable=false;save.disabled=true;report(e)}
 render();
 save.onclick=()=>{try{
  if(!readable)return;
  const state=validateSnapshot(capture()),entry={id:crypto.randomUUID?.()??String(Date.now()),name:name.value.trim().slice(0,100)||state.date,createdAt:new Date().toISOString(),thumbnail:thumbnail(),state};
  const next=[entry,...entries];writeSnapshots(storage,next);entries=next;render();status.textContent='保存しました';
 }catch(e){report(e)}};
 share.onclick=()=>showLink(capture());
}

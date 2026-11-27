import {sceneReceivers} from './scene-light-engine.mjs';
export function createSceneLight(onChange,workerFactory=()=>new Worker(new URL('./scene-light-worker.mjs',import.meta.url),{type:'module'})){
 let worker=null,timer=0,id=0,key='',geometry=null,result=null,status='',pending=false;
 function stop(){
  clearTimeout(timer);if(pending){worker?.postMessage({id:++id,cancel:true});pending=false;}
 }
 function sync(profile,revision,view,w,h,date,enabled){
  if(!enabled||!profile||!w||!h){
   if(key){stop();key='';geometry=null;result=null;status='';}
   return null;
  }
  const gkey=[revision,view.lat,view.lon,view.az,view.pitch,view.fov,w,h].join('/');
  const minute=Math.floor(view.time*60),next=[gkey,date,minute].join('/');
  if(next!==key){
   stop();key=next;result=null;status='日照概算：計算準備中';pending=true;
   const v={...view},p=profile,request=++id;
   timer=setTimeout(()=>{
    if(request!==id)return;
    try{
     if(!worker){
      worker=workerFactory();
      worker.onmessage=e=>{
       const m=e.data;if(m.id!==id)return;
       if(m.type==='progress'){status='日照概算：'+m.message;onChange();return;}
       pending=false;
       if(m.type==='error'){status='日照計算失敗：'+m.message;onChange();return;}
       if(m.type==='scene'){
        result={...geometry.grid,values:m.values,key};
        const known=m.values.filter(v=>v.value!==null).length;
        const provisional=m.values.filter(v=>v.kind==='provisional').length;
        status='日照概算 '+known+'/'+m.values.length+' 点'+(provisional?'（暫定 '+provisional+'）':'')+' · 不明は元の色';
        onChange();
       }
      };
      worker.onerror=e=>{pending=false;status='日照Workerエラー';worker.terminate();worker=null;onChange();};
     }
     if(geometry?.key!==gkey)geometry={key:gkey,grid:sceneReceivers(p,v,w,h)};
     worker.postMessage({id:request,key:gkey,points:geometry.grid.points,date,minute});
    }catch(e){pending=false;status='日照計算失敗：'+e.message;onChange();}
   },400);
  }
  return result;
 }
 return {sync,status:()=>status};
}

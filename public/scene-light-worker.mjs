import {prepareReceivers,shadeReceivers} from './scene-light-engine.mjs';
let generation=0,retained=null;
self.onmessage=async({data:m})=>{
 const {id,key,points,date,minute}=m;generation=id;
 if(m.cancel)return;
 const options={isCurrent:()=>id===generation,onProgress:message=>{if(id===generation)postMessage({id,type:'progress',message})}};
 try{
  if(retained?.key!==key){
   const prepared=await prepareReceivers(points,options);
   if(!prepared||id!==generation)return;
   retained={key,points:prepared};
  }
  const values=await shadeReceivers(retained.points,date,minute,options);
  if(values&&id===generation)postMessage({id,type:'scene',values});
 }catch(e){if(id===generation)postMessage({id,type:'error',message:String(e.message||e)})}
};

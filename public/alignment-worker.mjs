import {searchAlignment} from './alignment-search.mjs';
let generation=0;
self.onmessage=async({data:m})=>{
 generation=m.id;if(m.cancel)return;
 const current=()=>m.id===generation;
 try{
  const results=await searchAlignment(m,{isCurrent:current,onProgress:(done,total)=>{if(current())postMessage({id:m.id,type:'progress',done,total})}});
  if(results&&current())postMessage({id:m.id,type:'results',results});
 }catch(e){if(current())postMessage({id:m.id,type:'error',message:String(e.message||e)})}
};

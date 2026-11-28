import {searchSubjectLocations,searchHorizonLocations} from './location-search-engine.mjs';
let generation=0;
self.onmessage=async({data})=>{
 const id=++generation;if(data.cancel)return;
 try{
  const search=data.kind==='G4'?searchHorizonLocations:data.kind==='G5'?searchSubjectLocations:null;
  if(!search)throw Error('探索種別が不正です');
  const result=await search(data.request,{isCurrent:()=>id===generation,onProgress:message=>{if(id===generation)self.postMessage({type:'progress',id:data.id,message})}});
  if(id===generation)self.postMessage({type:'result',id:data.id,result});
 }catch(e){if(id===generation)self.postMessage({type:'error',id:data.id,message:e.message||String(e)})}
};

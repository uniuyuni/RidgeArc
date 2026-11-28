import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithRetry} from '../public/terrain-store.mjs';

test('DEM response body timeout is retried and reported',async()=>{
 const events=[];let attempts=0;
 const fetcher=async(_url,{signal})=>{
  attempts++;
  return {ok:true,status:200,blob:()=>new Promise((resolve,reject)=>{
   signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
  })};
 };
 await assert.rejects(fetchWithRetry('https://example.invalid/dem.png',{fetcher,timeout:10,delays:[0],wait:async()=>{},consume:r=>r.blob(),onRetry:e=>events.push(e)}),/タイムアウト/);
 assert.equal(attempts,2);assert.match(events[0].message,/タイムアウト/);
});
test('missing source tile remains a normal fallback',async()=>{
 const result=await fetchWithRetry('https://example.invalid/dem.png',{fetcher:async()=>({ok:false,status:404}),consume:r=>r.status===404?null:1,onRetry:()=>assert.fail('404 must not retry')});
 assert.equal(result,null);
});
test('HTTP status survives as a diagnostic',async()=>{
 await assert.rejects(fetchWithRetry('https://example.invalid/dem.png',{fetcher:async()=>({ok:false,status:503,headers:new Headers()}),delays:[]}),/HTTP 503/);
});

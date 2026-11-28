import test from 'node:test';
import assert from 'node:assert/strict';
import {rayBands,connectBands} from '../public/vector-terrain.mjs';
import {validateSnapshot,encodeSnapshot,decodeSnapshot,readSnapshots,writeSnapshots,SNAPSHOT_KEY} from '../public/field-snapshot.mjs';
const snapshot=()=>({version:1,observer:{lat:36.81668,lon:137.03949,height:1.6},subject:{lat:36.81457,lon:137.04533,locked:true,distance:570},date:'2027-02-02',minute:423,view:{az:116.6,pitch:4.5,fov:9},map:{lat:36.815,lon:137.042,zoom:16},ui:{page:'both',split:.66,layers:['太陽','距離色'],tracks:['太陽可視'],compass:'scale',coordinates:true,loupe:true,splitLoupe:true,sun:{minimum:true,marker:false,glow:true}},timeline:{start:'2027-02-01',end:'2027-02-03',days:1,expanded:false,lockTime:true},search:{active:true,body:'sun',start:'2027-02-02',span:31,direction:'both',days:62,center:20851,target:{az:116,alt:2.8}}});
test('snapshot link and storage round-trip all composition settings',()=>{
 const state=snapshot(),storage=new Map(),adapter={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 assert.deepEqual(decodeSnapshot(encodeSnapshot(state)),state);
 writeSnapshots(adapter,[{id:'1',name:'女岩',createdAt:'2026-11-28T00:00:00Z',thumbnail:null,state}]);
 assert.deepEqual(readSnapshots(adapter)[0].state,state);
 assert.ok(storage.has(SNAPSHOT_KEY));
});
test('invalid snapshot cannot modify state; arbitrary fields are not restored',()=>{
 const s=snapshot();assert.deepEqual(validateSnapshot({...s,extra:'<script>'}),s);
 assert.throws(()=>validateSnapshot({...s,observer:{...s.observer,lat:100}}));
 assert.throws(()=>validateSnapshot({...s,version:99}));
 assert.throws(()=>decodeSnapshot('%not-valid'));
 assert.throws(()=>validateSnapshot({...s,timeline:{...s.timeline,start:'2027-02-04'}}));
});
test('known foreground intervals produce triangles at boundaries, not fake depth or blurred colors',()=>{
 const rock={segments:[{hi:.02,m:.12,b:-55,d:550,near:500}],water:[]};
 const bands=rayBands(rock,1.6);assert.ok(bands.size>0);
 const triangles=connectBands(bands,new Map(),0,1);
 assert.ok(triangles.length>0&&triangles.every(p=>p.points.length===3));
 assert.ok(triangles.every(p=>p.points.every(([x])=>x>=0&&x<=.5)));
 const quads=connectBands(bands,bands,0,1);
 assert.ok(quads.every(p=>p.points.length===4));
});
test('missing data sentinel is not turned into a land polygon',()=>{
 assert.equal(rayBands({segments:[{hi:.1,m:0,b:0,d:550,near:550}],water:[]},1.6).size,0);
});
test('water polygon intervals are bounded by known ranges and sea horizon',()=>{
 const bands=rayBands({segments:[],water:[[100,10000]]},1.6);
 assert.ok(bands.size>0);
 assert.ok([...bands.values()].flat().every(p=>p.kind==='water'&&p.hi<0));
});

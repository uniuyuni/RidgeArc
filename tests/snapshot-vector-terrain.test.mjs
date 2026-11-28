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

test('water stays a continuous plane when adjacent measured ranges have different far endpoints',()=>{
 const a=rayBands({segments:[],water:[[10,5000]]},1.6);
 const b=rayBands({segments:[],water:[[10,3000]]},1.6);
 const polys=connectBands(a,b,0,1);
 assert.ok(polys.length>0);
 assert.ok(polys.every(p=>p.kind==='water'&&p.points.length===4),'no triangular water caps');
 const slope=-.005;
 const cover=(x,s)=>polys.some(p=>{
  const xs=p.points.map(q=>q[0]),min=Math.min(...xs),max=Math.max(...xs);
  if(x<min||x>max)return false;
  const hi=p.points[0][1]+(p.points[1][1]-p.points[0][1])*(x-min)/(max-min);
  const lo=p.points[3][1]+(p.points[2][1]-p.points[3][1])*(x-min)/(max-min);
  return s>=lo&&s<=hi;
 });
 for(let i=0;i<=100;i++)assert.ok(cover(i/100,slope),'confirmed common sea surface must not develop holes');
});
test('same land surface crossing a logarithmic depth bin is connected instead of tapered twice',()=>{
 const a=new Map([['land:1',[{kind:'land',distance:100,lo:.01,hi:.02}]]]);
 const b=new Map([['land:2',[{kind:'land',distance:105,lo:.011,hi:.021}]]]);
 const p=connectBands(a,b,0,1);
 assert.equal(p.length,1);assert.equal(p[0].points.length,4);
});
test('separate measured water ranges do not acquire a fabricated connecting interval',()=>{
 const a=rayBands({segments:[],water:[[20,50],[200,300]]},1.6);
 const b=rayBands({segments:[],water:[[20,50],[200,300]]},1.6);
 const polys=connectBands(a,b,0,1);
 assert.ok(polys.every(p=>p.points.every(q=>q[1]<-.02||q[1]>-.01)));
});

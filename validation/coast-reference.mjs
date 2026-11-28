import {PNG} from 'pngjs';
import {destination,tilePixel,decodeElevation,elevationAngle} from '../public/core.mjs';
// Reference points, not the exact screenshot pin.
const points=[{name:'station',lat:36.816525,lon:137.0373667},{name:'roadside',lat:36.815156,lon:137.041674}];
const cache=new Map();
async function tile(id,key){
 const k=id+'/'+key;
 if(!cache.has(k))cache.set(k,(async()=>{try{const r=await fetch('https://cyberjapandata.gsi.go.jp/xyz/'+k+'.png',{signal:AbortSignal.timeout(15000)});return r.ok?PNG.sync.read(Buffer.from(await r.arrayBuffer())).data:null}catch{return null}})());
 return cache.get(k);
}
async function sample(lat,lon,z,id='dem_png'){
 const p=tilePixel(lat,lon,z),a=await tile(id,p.key);return a?decodeElevation(a[p.i],a[p.i+1],a[p.i+2]):null;
}
for(const p of points){
 const g=await sample(p.lat,p.lon,14),eye=(g??.4)+1.6;
 for(const az of [105,115,120,125,130,135,140,145,150,155]){
  const distances=Array.from({length:Math.ceil(8000/10)},(_,i)=>(i+1)*10).concat(Array.from({length:620},(_,i)=>8100+i*100));
  const rows=await Promise.all(distances.map(async d=>{const [lat,lon]=destination(p.lat,p.lon,az,d);return {d,lat,lon,h:await sample(lat,lon,d<=8000?14:12)}}));
  const hits=rows.filter(x=>x.h!=null).map(x=>({...x,alt:elevationAngle(x.h,eye,x.d)})).sort((a,b)=>b.alt-a.alt);
  const q=hits[0],far=hits.find(x=>x.d>20000);
  console.log(JSON.stringify({point:p.name,ground:g,az,nearOrFar:q,far,valid:hits.length}));
 }
}
// Sample map raster palettes; not an analytical coastline source.
for(const [lat,lon] of [[36.84,137.10],[36.85,137.15],[36.805,137.03],[36.815,137.04]]){
 const p=tilePixel(lat,lon,14),a=await tile('pale',p.key);
 console.log('pale',lat,lon,a?Array.from(a.slice(p.i,p.i+4)):null);
}


 // Independent dense native-pixel sampling of the initial island and sightline.
 const observer={lat:36.816493,lon:137.039471},island={lat:36.8145056,lon:137.0452028};
 const rad=Math.PI/180,dlat=(island.lat-observer.lat)*rad,dlon=(island.lon-observer.lon)*rad;
 const d=6371000*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(observer.lat*rad)*Math.cos(island.lat*rad)*Math.sin(dlon/2)**2));
 const az=(Math.atan2(Math.sin(dlon)*Math.cos(island.lat*rad),Math.cos(observer.lat*rad)*Math.sin(island.lat*rad)-Math.sin(observer.lat*rad)*Math.cos(island.lat*rad)*Math.cos(dlon))/rad+360)%360;
 console.log('ISLAND geometry',JSON.stringify({d,az}));
 for(const [id,z] of [['dem1a_png',17],['dem5a_png',15],['dem5b_png',15],['dem5c_png',15],['dem_png',14]]){
  const eye=await sample(observer.lat,observer.lon,z,id);
  const center=await sample(island.lat,island.lon,z,id);
  const points=[];
  for(let offset=-40;offset<=40;offset+=2)for(let cross=-40;cross<=40;cross+=2){
   const [lat,lon]=destination(island.lat,island.lon,0,offset);
   const [la,lo]=destination(lat,lon,90,cross);
   points.push({offset,cross,h:await sample(la,lo,z,id)});
  }
  const valid=points.filter(p=>p.h!=null).sort((a,b)=>b.h-a.h);
  const ray=[];for(let offset=-45;offset<=45;offset+=2){const [lat,lon]=destination(observer.lat,observer.lon,az,d+offset);ray.push({offset,h:await sample(lat,lon,z,id)})}
  console.log('ISLAND source',JSON.stringify({id,z,eye,center,valid:valid.length,peak:valid[0]??null,ray}));
 }

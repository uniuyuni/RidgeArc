// Versioned, validated, portable composition state. No DEM, search result cache
// or personal identity is stored; every restored calculation is recomputed.
export const SNAPSHOT_KEY='ridgearc.field.snapshots.v1';
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const bool=v=>typeof v==='boolean';
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1900-01-01'&&v<='2099-12-31'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const point=p=>p&&finite(p.lat,20,46)&&finite(p.lon,122,154);
const list=(v,allowed)=>Array.isArray(v)&&v.every(x=>allowed.includes(x));
const layers=['太陽','太陽の軌跡','遮蔽中の太陽・軌跡','距離色','稜線輪郭','地平線','日照・陰影','山名・標高','薄明・空色','天球ドーム','天球の高度ガイド','天球の時刻ラベル','天球の季節軌跡','太陽方位線'];
const tracks=['太陽可視','被写体の日照'];
export function validateSnapshot(s){
 if(!s||s.version!==1||!point(s.observer)||!finite(s.observer.height,0,300)||!point(s.subject)||!bool(s.subject.locked)||!finite(s.subject.distance,0,4000000)||!day(s.date)||!finite(s.minute,0,1439)||!Number.isInteger(s.minute))throw Error('スナップショットの地点・日時が不正です');
 const v=s.view,u=s.ui,t=s.timeline,m=s.map,q=s.search;
 if(!v||!finite(v.az,0,360)||!finite(v.pitch,-65,75)||!finite(v.fov,5,180)||!u||!['map','both','ridge'].includes(u.page)||!finite(u.split,.2,.8)||!list(u.layers,layers)||!list(u.tracks,tracks)||!['scale','off'].includes(u.compass)||!bool(u.coordinates)||!bool(u.loupe)||!bool(u.splitLoupe)||!u.sun||!['minimum','marker','glow'].every(k=>bool(u.sun[k])))throw Error('スナップショットの表示設定が不正です');
 if(m&&(!finite(m.lat,-85,85)||!finite(m.lon,-540,540)||!finite(m.zoom,0,18)))throw Error('地図設定が不正です');
 if(!t||!day(t.start)||!day(t.end)||t.start>t.end||s.date<t.start||s.date>t.end||Date.parse(t.end)-Date.parse(t.start)>732*86400000||!finite(t.days,1/1440,733)||!bool(t.expanded)||!bool(t.lockTime))throw Error('タイムライン設定が不正です');
 if(!q||!bool(q.active)||!['sun'].includes(q.body)||!(q.start===null||day(q.start))||![31,92,183,366].includes(q.span)||!['future','both'].includes(q.direction)||!finite(q.days,1/24,733)||!finite(q.center,-30000,60000)||!(q.target===null||(finite(q.target?.az,0,360)&&finite(q.target?.alt,-90,90))))throw Error('探索設定が不正です');
 // Copy only recognized fields. Never restore markup, arbitrary keys or caches.
 return {version:1,observer:{lat:s.observer.lat,lon:s.observer.lon,height:s.observer.height},subject:{lat:s.subject.lat,lon:s.subject.lon,locked:s.subject.locked,distance:s.subject.distance},date:s.date,minute:s.minute,view:{az:v.az,pitch:v.pitch,fov:v.fov},map:m?{lat:m.lat,lon:m.lon,zoom:m.zoom}:null,ui:{page:u.page,split:u.split,layers:[...new Set(u.layers)],tracks:[...new Set(u.tracks)],compass:u.compass,coordinates:u.coordinates,loupe:u.loupe,splitLoupe:u.splitLoupe,sun:{minimum:u.sun.minimum,marker:u.sun.marker,glow:u.sun.glow}},timeline:{start:t.start,end:t.end,days:t.days,expanded:t.expanded,lockTime:t.lockTime},search:{active:q.active,body:q.body,start:q.start,span:q.span,direction:q.direction,days:q.days,center:q.center,target:q.target?{az:q.target.az,alt:q.target.alt}:null}};
}
export function encodeSnapshot(s){return encodeURIComponent(JSON.stringify(validateSnapshot(s)))}
export function decodeSnapshot(s){if(typeof s!=='string'||s.length>24000)throw Error('共有リンクの設定が不正です');return validateSnapshot(JSON.parse(decodeURIComponent(s)))}
export function readSnapshots(storage){
 const raw=storage.getItem(SNAPSHOT_KEY);if(!raw)return [];
 const entries=JSON.parse(raw);if(!Array.isArray(entries))throw Error('保存済みデータの形式が不正です');
 return entries.map(e=>({id:String(e.id),name:String(e.name).slice(0,100),createdAt:String(e.createdAt),thumbnail:typeof e.thumbnail==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(e.thumbnail)&&e.thumbnail.length<=100000?e.thumbnail:null,state:validateSnapshot(e.state)}));
}
export function writeSnapshots(storage,entries){storage.setItem(SNAPSHOT_KEY,JSON.stringify(entries));}

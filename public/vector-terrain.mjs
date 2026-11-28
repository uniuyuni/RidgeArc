import {R,DEG,wrap,clamp,panoramaY} from './core.mjs';
import {surfaceColor} from './coast-surface.mjs';
import {shadeColor} from './scene-light-engine.mjs';
import {textureSize} from './terrain-render-policy.mjs';

// Geometry is reconstructed only for display. No new terrain elevations or
// visibility claims are returned to the analytical engine.
const angle=s=>Math.atan(s)/DEG;
const bucket=d=>Math.floor(Math.log(Math.max(2,d)/2)/Math.log(1.65));
const representative=k=>2*1.65**(k+.5);
const slopeAt=(d,m,b)=>d>0?m+b/d:b<0?-Infinity:Infinity;
function addInterval(out,kind,d,lo,hi){
 if(!(hi>lo)||!Number.isFinite(d)||d<=0)return;
 const key=kind+':'+bucket(d),row=out.get(key)??[];
 const last=row.at(-1);
 if(last&&lo<=last.hi+1e-9){last.hi=Math.max(hi,last.hi);last.distance=Math.min(d,last.distance)}
 else row.push({kind,distance:d,lo,hi});
 out.set(key,row);
}
export function rayBands(surface,eye){
 const out=new Map();let previous=-Infinity;
 for(const p of surface.segments){
  const lower=Math.max(previous,slopeAt(p.near,p.m,p.b));
  if(p.near<p.d&&p.b!==0&&p.hi>lower){
   // Split at logarithmic distance boundaries; neighboring radial samples
   // within the same depth group form one connected display interval.
   const near=Math.max(2,p.near),far=p.d;
   for(let k=bucket(near);k<=bucket(far);k++){
    const a=Math.max(near,2*1.65**k),b=Math.min(far,2*1.65**(k+1));
    if(b<=a)continue;
    const lo=Math.max(lower,slopeAt(a,p.m,p.b)),hi=Math.min(p.hi,slopeAt(b,p.m,p.b));
    addInterval(out,'land',Math.sqrt(a*b),lo,hi);
   }
  }
  previous=Math.max(previous,p.hi);
 }
 if(eye>0){
  const horizonDistance=Math.sqrt(2*R*eye),s=d=>-eye/d-d/(2*R);
  for(const [start,end] of surface.water??[]){
   const a=Math.max(2,start),b=Math.min(horizonDistance,end);
   if(b>a)addInterval(out,'water',Math.sqrt(a*b),s(a),s(b));
  }
 }
 return out;
}
// Connect overlapping angular intervals of comparable depth; an unmatched
// measured interval closes at the midpoint as a triangle, not a color smear.
// Vertical bounds are still the observed angular extents on the sampled ray.
export function connectBands(a,b,x0,x1){
 const result=[],mid=(x0+x1)/2;
 for(const key of new Set([...a.keys(),...b.keys()])){
  const left=a.get(key)??[],right=b.get(key)??[],used=new Set();
  const emit=(l,r)=>{const q=l??r;const d=q.distance;
   const points=l&&r?[[x0,l.hi],[x1,r.hi],[x1,r.lo],[x0,l.lo]]:l?[[x0,l.hi],[mid,l.lo],[x0,l.lo]]:[[mid,r.lo],[x1,r.hi],[x1,r.lo]];
   result.push({key,kind:q.kind,distance:d,points});
  };
  for(const l of left){
   let best=-1,overlap=-Infinity;
   for(let i=0;i<right.length;i++){if(used.has(i))continue;const r=right[i],v=Math.min(l.hi,r.hi)-Math.max(l.lo,r.lo);if(v>=0&&v>overlap){best=i;overlap=v}}
   if(best>=0){used.add(best);emit(l,right[best])}else emit(l,null);
  }
  right.forEach((r,i)=>{if(!used.has(i))emit(null,r)});
 }
 return result;
}
export function vectorTerrainTexture(profile,view,w,h,distanceColor=true,shade=null,pixelRatio=1,step=.25){
 const {width:rw,height:rh}=textureSize(w,h,pixelRatio),canvas=document.createElement('canvas');canvas.width=rw;canvas.height=rh;
 const c=canvas.getContext('2d'),scale=w/view.fov,eye=profile.ground+profile.height;
 c.setTransform(rw/w,0,0,rh/h,0,0);
 const x=a=>w/2+(a-view.az)*scale,y=s=>h/2+(panoramaY(view.pitch)-panoramaY(angle(s)))*scale;
 const start=Math.floor((view.az-view.fov/2)/step),end=Math.ceil((view.az+view.fov/2)/step),N=profile.surfaces.length;
 const idx=i=>((i%N)+N)%N;
 // Unresolved spans beneath the analytical skyline are a neutral background.
 // Draw the continuous measured skyline as a polygon, never nearest-ray columns.
 const neutral=shadeColor([76,87,95],shade,0,0,w,h,null);c.fillStyle='rgb('+neutral.join(',')+')';let run=[];
 function flush(){if(run.length>=2){c.beginPath();c.moveTo(run[0][0],h);for(const p of run)c.lineTo(...p);c.lineTo(run.at(-1)[0],h);c.closePath();c.fill()}run=[]}
 for(let i=start;i<=end;i++){const a=profile.total[idx(i)];if(a==null){flush();continue}run.push([x(i*step),h/2+(panoramaY(view.pitch)-panoramaY(a))*scale])}flush();
 // Build only visible angular strips. All polygons at a given depth/material
 // are batched; far surfaces are painted before near surfaces. No cross-depth
 // color interpolation. Canvas supplies edge antialiasing.
 let left=rayBands(profile.surfaces[idx(start)],eye);const groups=new Map();
 for(let i=start;i<end;i++){
  const right=rayBands(profile.surfaces[idx(i+1)],eye);
  for(const poly of connectBands(left,right,x(i*step),x((i+1)*step))){
   const pts=poly.points.map(([px,s])=>[px,y(s)]);
   if(pts.every(p=>p[1]<0)||pts.every(p=>p[1]>h))continue;
   const k=Number(poly.key.split(':')[1]),d=representative(k);
   // Geometry and illumination are independent: batch entire depth bands,
   // then clip a continuous depth-specific illumination raster to their path.
   const rgb=surfaceColor({kind:poly.kind,distance:poly.kind==='water'?600:d},distanceColor);
   const key=poly.key,group=groups.get(key)??{depth:d,kind:poly.kind,rgb,polygons:[]};
   group.polygons.push(pts);groups.set(key,group);
  }
  left=right;
 }
 for(const group of [...groups.values()].sort((a,b)=>b.depth-a.depth)){
  c.fillStyle='rgb('+group.rgb.join(',')+')';c.beginPath();
  for(const p of group.polygons){c.moveTo(...p[0]);for(let i=1;i<p.length;i++)c.lineTo(...p[i]);c.closePath()}
  if(!shade||group.kind==='water'){c.fill();continue}
  const cols=shade.cols??1,rows=shade.rows??1,texture=document.createElement('canvas');texture.width=cols;texture.height=rows;
  const tc=texture.getContext('2d'),image=tc.createImageData(cols,rows),hit={kind:'land',distance:group.depth};
  for(let iy=0;iy<rows;iy++)for(let ix=0;ix<cols;ix++){
   const color=shadeColor(group.rgb,shade,(ix+.5)*w/cols,(iy+.5)*h/rows,w,h,hit);
   image.data.set([...color,255],(iy*cols+ix)*4);
  }
  tc.putImageData(image,0,0);c.save();c.clip();c.imageSmoothingEnabled=true;c.drawImage(texture,0,0,w,h);c.restore();
 }
 return canvas;
}

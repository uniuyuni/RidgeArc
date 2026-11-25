export const DEG=Math.PI/180, R=6371000;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const wrap=x=>((x%360)+360)%360;
export const angleDelta=(a,b)=>wrap(a-b+180)-180;
export const clock=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
// Approximate solar ephemeris: mean longitude/anomaly, ecliptic obliquity, sidereal time.
export function sunPosition(date,minute,lat,lon){
 const ms=Date.parse(date+'T00:00:00+09:00')+minute*60000;
 const jd=ms/86400000+2440587.5,n=jd-2451545;
 const g=wrap(357.529+0.98560028*n)*DEG;
 const L=wrap(280.459+0.98564736*n+1.915*Math.sin(g)+0.020*Math.sin(2*g))*DEG;
 const ob=(23.439-0.00000036*n)*DEG;
 const ra=Math.atan2(Math.cos(ob)*Math.sin(L),Math.cos(L));
 const dec=Math.asin(Math.sin(ob)*Math.sin(L));
 const H=angleDelta(wrap(280.46061837+360.98564736629*n+lon),ra/DEG)*DEG,p=lat*DEG;
 const geo=Math.asin(Math.sin(p)*Math.sin(dec)+Math.cos(p)*Math.cos(dec)*Math.cos(H))/DEG;
 const az=wrap(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(p)-Math.tan(dec)*Math.cos(p))/DEG+180);
 // Bennett refraction, tapered below the horizon. Standard atmosphere only.
 const refr=geo>-1&&geo<89.9?1.02/Math.tan((geo+10.3/(geo+5.11))*DEG)/60:0;
 const radius=0.2666/(1.00014-0.01671*Math.cos(g)-0.00014*Math.cos(2*g));
 return {az,alt:geo+Math.max(0,refr),geo,radius};
}
export function destination(lat,lon,az,d){
 const p=lat*DEG,l=lon*DEG,b=az*DEG,t=d/R;
 const q=Math.asin(Math.sin(p)*Math.cos(t)+Math.cos(p)*Math.sin(t)*Math.cos(b));
 return [q/DEG, (l+Math.atan2(Math.sin(b)*Math.sin(t)*Math.cos(p),Math.cos(t)-Math.sin(p)*Math.sin(q)))/DEG];
}
export function tilePixel(lat,lon,z){
 const n=256*2**z, x=(lon+180)/360*n, y=(1-Math.asinh(Math.tan(lat*DEG))/Math.PI)/2*n;
 const ix=Math.floor(x),iy=Math.floor(y);
 return {key:z+'/'+Math.floor(ix/256)+'/'+Math.floor(iy/256),i:((iy%256)*256+ix%256)*4};
}
export function decodeElevation(r,g,b){const x=r*65536+g*256+b;return x===8388608?null:(x>8388608?x-16777216:x)*.01}
export function elevationAngle(h,eye,d){return Math.atan2(h-eye-d*d/(2*R),d)/DEG}
export function horizonAt(values,az,step=.25){
 const f=wrap(az)/step,i=Math.floor(f),a=values[i],b=values[(i+1)%values.length];
 return a==null||b==null?null:a+(b-a)*(f-i);
}
// Equal-area sampling of the solar disk (small-angle approximation).
export function diskVisibility(s,horizon){
 let total=0,visible=0;
 const c=Math.max(.05,Math.cos(s.alt*DEG));
 for(let y=-9;y<=9;y++)for(let x=-9;x<=9;x++){
  if(x*x+y*y>81)continue;
  const h=horizon(s.az+x*s.radius/(9*c));if(h==null)return null;
  total++;if(s.alt+y*s.radius/9>h)visible++;
 }
 return visible/total;
}

// Camera basis: forward at bearing/pitch, right in local horizontal plane,
// up perpendicular to both. Rectilinear projection (ideal pinhole).
export function cameraProject(az,alt,bearing,pitch,focal,cx,cy){
 const a=angleDelta(az,bearing)*DEG,e=alt*DEG,p=pitch*DEG;
 const forward=Math.cos(e)*Math.cos(a)*Math.cos(p)+Math.sin(e)*Math.sin(p);
 if(forward<=1e-6)return null;
 const right=Math.cos(e)*Math.sin(a),up=Math.sin(e)*Math.cos(p)-Math.cos(e)*Math.cos(a)*Math.sin(p);
 return [cx+focal*right/forward,cy-focal*up/forward];
}
// Points of a true angular circle on the unit sphere.
export function diskBoundary(s,n=36){
 const a=s.az*DEG,e=s.alt*DEG,r=s.radius*DEG;
 const center=[Math.cos(e)*Math.sin(a),Math.cos(e)*Math.cos(a),Math.sin(e)];
 const right=[Math.cos(a),-Math.sin(a),0],up=[-Math.sin(e)*Math.sin(a),-Math.sin(e)*Math.cos(a),Math.cos(e)];
 return Array.from({length:n},(_,i)=>{
  const t=i*2*Math.PI/n;
  const v=center.map((c,j)=>c*Math.cos(r)+(right[j]*Math.cos(t)+up[j]*Math.sin(t))*Math.sin(r));
  return [wrap(Math.atan2(v[0],v[1])/DEG),Math.asin(clamp(v[2],-1,1))/DEG];
 });
}

// Conformal cylindrical projection: locally equal horizontal and vertical angular scale.
export function panoramaY(alt){return Math.asinh(Math.tan(clamp(alt,-89.8,89.8)*DEG))/DEG}
export function panoramaAltitude(y){return Math.atan(Math.sinh(y*DEG))/DEG}
export function daylightFrame(day,margin=12){
 const active=day.filter(p=>p.alt>=-2);
 if(!active.length)return {center:180,span:180,top:panoramaY(35),bottom:panoramaY(-18)};
 let a=active[0].az,low=a,high=a,peak=-2;
 for(const p of active){a+=angleDelta(p.az,a);low=Math.min(low,a);high=Math.max(high,a);peak=Math.max(peak,p.alt+p.radius)}
 return {center:wrap((low+high)/2),span:clamp(high-low+2*margin,40,350),top:Math.min(panoramaY(89.8),Math.max(panoramaY(20),panoramaY(peak)+7)),bottom:panoramaY(-18)};
}

// Bilinear samples at pixel centers, including tile boundaries. Missing neighbors stay missing.
export function elevationStencil(lat,lon,z){
 const n=256*2**z,x=(lon+180)/360*n-.5,y=(1-Math.asinh(Math.tan(lat*DEG))/Math.PI)/2*n-.5;
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 return [[ix,iy,(1-fx)*(1-fy)],[ix+1,iy,fx*(1-fy)],[ix,iy+1,(1-fx)*fy],[ix+1,iy+1,fx*fy]].filter(p=>p[2]>1e-12).map(([px,py,w])=>({key:z+'/'+Math.floor(px/256)+'/'+Math.floor(py/256),i:((py%256)*256+px%256)*4,w}));
}
export function interpolatedHeight(stencil,read){
 let sum=0,w=0;
 for(const p of stencil){const h=read(p);if(h==null)return null;sum+=h*p.w;w+=p.w}
 return w>0?sum/w:null;
}
export function terrainBounds(frame,out,step=.25){
 let low=0,high=-90;
 for(const band of out)for(let i=0;i<band.length;i++){
  const delta=((i*step-frame.center+540)%360)-180;
  if(Math.abs(delta)>frame.span/2)continue;
  const h=band[i];if(h==null||!Number.isFinite(h))continue;
  low=Math.min(low,h);high=Math.max(high,h);
 }
 return {low:Math.max(-45,low-3),high:Math.min(89.8,high+3)};
}

// Visible angular intervals from the continuous radial terrain profile.
// A farther segment is visible only when it exceeds every nearer elevation slope.
export function visibleSurface(samples,eye,eyeHeight){
 const segments=[];let max=-Infinity,prev={d:0,h:-Math.max(eyeHeight,.001)},gap=false;
 for(const p of samples){
  if(p.h==null||!Number.isFinite(p.h)){if(prev.d>0)gap=true;continue;}
  const h=p.h-eye-p.d*p.d/(2*6371000),s=h/p.d;
  if(s>max){
   if(!gap&&p.d>prev.d){
    const m=(h-prev.h)/(p.d-prev.d),b=h-m*p.d;
    segments.push({hi:s,m,b,d:p.d,near:prev.d});
   }else segments.push({hi:s,m:0,b:0,d:p.d,near:p.d});
   max=s;
  }
  prev={d:p.d,h};gap=false;
 }
 return {segments,angle:segments.length?Math.atan(max)*180/Math.PI:null};
}
export function surfaceDistance(surface,slope){
 const a=surface.segments;if(!a.length||slope>a[a.length-1].hi)return null;
 let lo=0,hi=a.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(a[mid].hi>=slope)hi=mid;else lo=mid+1}
 const p=a[lo];
 if(Math.abs(slope-p.m)<1e-12||p.b===0)return p.d;
 return Math.max(p.near,Math.min(p.d,p.b/(slope-p.m)));
}

// Bounds conditioned on the sampled terrain model; unsampled terrain may hide visible points.
export function visibilityEstimate(s,horizon,quality){
 let visible=0,knownVisible=0,total=0,unknown=0,missingHorizon=0;
 const c=Math.max(.05,Math.cos(s.alt*Math.PI/180));
 for(let y=-9;y<=9;y++)for(let x=-9;x<=9;x++){
  if(x*x+y*y>81)continue;
  const az=s.az+x*s.radius/(9*c),alt=s.alt+y*s.radius/9,h=horizon(az);total++;
  if(h==null){unknown++;missingHorizon++;continue;}
  if(alt>h){
   visible++;
   if(quality(az))knownVisible++;else unknown++;
  }
 }
 return {estimate:missingHorizon?null:visible/total,lower:knownVisible/total,upper:(knownVisible+unknown)/total,uncertain:unknown>0,missingHorizon:missingHorizon>0};
}
// Contact search with 15-second scan and one-second numerical refinement.
export function contactEvents(evaluate,start=0,end=1440,interval=.25){
 const out=[];let t0=start,p=evaluate(t0);
 for(let t=Math.min(start+interval,end);t<=end&&t>t0;t=Math.min(t+interval,end)){
  const q=evaluate(t);
  if(p.state!=null&&q.state!=null&&p.state!==q.state){
   // Resolve both transitions separately if the coarse interval crosses the full disk.
   const from=p.state,to=q.state,direction=Math.sign(to-from);
   for(let target=from+direction;direction*(target-to)<=0;target+=direction){
    let lo=t0,hi=t,valid=true,uncertain=p.uncertain||q.uncertain;
    while(hi-lo>1/60){
     const mid=(hi+lo)/2,r=evaluate(mid);uncertain||=r.uncertain;
     if(r.state==null){valid=false;break;}
     if(direction*(r.state-target)>=0)hi=mid;else lo=mid;
    }
    if(valid)out.push({minute:hi,from:target-direction,to:target,uncertain});
   }
  }
  t0=t;p=q;if(t===end)break;
 }
 return out;
}

// Retained DEM samples: changing eye height must not trigger network requests.
export function projectTerrainRay(distances,heights,ground,height){
 const eye=ground+height,segments=[];let max=-Infinity,prevD=0,prevH=-Math.max(height,.001),gap=false;
 for(let i=0;i<distances.length;i++){
  const d=distances[i],e=heights[i];
  if(!Number.isFinite(e)){if(prevD>0)gap=true;continue;}
  const h=e-eye-d*d/(2*6371000),s=h/d;
  if(s>max){
   if(!gap&&d>prevD){const m=(h-prevH)/(d-prevD);segments.push({hi:s,m,b:h-m*d,d,near:prevD})}
   else segments.push({hi:s,m:0,b:0,d,near:d});
   max=s;
  }
  prevD=d;prevH=h;gap=false;
 }
 return {segments,angle:segments.length?Math.atan(max)*180/Math.PI:null};
}

// Crop a cyclic north-origin panorama without an artificial seam at 0/360 degrees.
export function panoramaSlices(left,span,width){
 const start=((left%360)+360)%360/360*width,length=span/360*width,first=Math.min(length,width-start);
 const out=[{x:start,width:first,fraction:first/length}];
 if(length-first>1e-8)out.push({x:0,width:length-first,fraction:(length-first)/length});
 return out;
}

// Crop both angular axes with equal magnification, inside the full panorama.
export function zoomWindow(top,bottom,zoom,focus){
 const half=(top-bottom)/(2*zoom),mid=Math.max(bottom+half,Math.min(top-half,focus??(top+bottom)/2));
 return {top:mid+half,bottom:mid-half,mid};
}
export function zoomAnchor(center,mid,span,verticalSpan,newZoom,oldZoom,u,v){
 const ratio=oldZoom/newZoom;
 return {center:center+(u-.5)*span*(1-ratio),mid:mid+(.5-v)*verticalSpan*(1-ratio)};
}

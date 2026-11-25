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

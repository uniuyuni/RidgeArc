import {DEG,clamp,dateRange,sunPosition} from './core.mjs';
import {visibility} from './field-engine.mjs';
import {direction} from './light-engine.mjs';

export function angularSeparation(a,b){
 const u=direction(a.az,a.alt),v=direction(b.az,b.alt);
 return Math.atan2(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]),u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/DEG;
}
// Candidate generator, not proof of absence. Five-minute seeds, numerical
// refinement of local minima to one second, geometric model as in FIELD.
export function searchDay(date,lat,lon,target,tolerance,profile=null){
 const evalAt=t=>{const s=sunPosition(date,t,lat,lon);return {s,error:angularSeparation(s,target)}};
 const times=Array.from({length:289},(_,i)=>Math.min(i*5,1439.999));
 const values=times.map(t=>evalAt(t).error),out=[];
 for(let i=0;i<times.length;i++){
  if((i>0&&values[i]>values[i-1])||(i<times.length-1&&values[i]>values[i+1]))continue;
  let lo=times[Math.max(0,i-1)],hi=times[Math.min(times.length-1,i+1)];
  while(hi-lo>1/60){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(evalAt(a).error<evalAt(b).error)hi=b;else lo=a;}
  const minute=(lo+hi)/2,{s,error}=evalAt(minute);
  if(error>tolerance||s.alt+s.radius< -3)continue;
  const v=visibility(profile,s);
  const status=v.estimate==null?'unknown':v.upper===0?'hidden':v.uncertain?'provisional':'visible';
  out.push({date,minute,error,az:s.az,alt:s.alt,radius:s.radius,status,visibility:v.estimate});
 }
 return out;
}
export async function searchAlignment({start,end,lat,lon,az,alt,tolerance,profile},opts={}){
 const dates=dateRange(start,end,1,366);
 if(!dates||![lat,lon,az,alt,tolerance].every(Number.isFinite)||Math.abs(alt)>90||tolerance<=0||tolerance>10)throw Error('日時・角度・探索範囲を確認してください（最大366日）');
 const results=[];
 for(let i=0;i<dates.length;i++){
  if(opts.isCurrent&&!opts.isCurrent())return null;
  results.push(...searchDay(dates[i],lat,lon,{az,alt},tolerance,profile));
  if(i%8===7){opts.onProgress?.(i+1,dates.length);await new Promise(r=>setTimeout(r,0));}
 }
 return results.sort((a,b)=>a.date.localeCompare(b.date)||a.minute-b.minute);
}

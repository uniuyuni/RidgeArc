import {DEG,sunPosition} from './core.mjs';

// Orthographic projection of the unit upper celestial hemisphere, north up.
// x points east, y points south. The radius is symbolic screen space, not km.
export function projectSky(az,alt){
 const h=Math.cos(alt*DEG);
 return {x:h*Math.sin(az*DEG),y:-h*Math.cos(az*DEG)};
}
export function skyDomePath(date,observer,selectedMinute){
 const at=minute=>{
  const s=sunPosition(date,minute,observer.lat,observer.lon);
  return {...s,minute,...projectSky(s.az,s.alt)};
 };
 const segments=[],hours=[];let segment=[],previous=null;
 for(let m=0;m<=1440;m++){
  const p=at(m);
  // Locate horizon crossings within the one-minute sampling interval.
  if(previous&&(p.alt>=0)!==(previous.alt>=0)){
   let a=previous.minute,b=p.minute;
   for(let j=0;j<12;j++){const mid=(a+b)/2;if((at(mid).alt>=0)===(previous.alt>=0))a=mid;else b=mid}
   const edge=at((a+b)/2);
   segment.push({...edge,alt:0,...projectSky(edge.az,0)});
  }
  if(p.alt>=0){segment.push(p);if(m<1440&&m%60===0)hours.push(p)}
  else if(segment.length){if(segment.length>1)segments.push(segment);segment=[]}
  previous=p;
 }
 if(segment.length>1)segments.push(segment);
 return {segments,hours,current:at(selectedMinute)};
}
export function domeRadius(w,h){return Math.max(0,Math.min(w,h)/2-18)}
export function seasonalDates(date){
 const year=date.slice(0,4);
 return [{date:year+'-06-21',label:'夏至頃',dash:'5 5'},{date:year+'-03-20',label:'春分頃',dash:'2 5'},{date:year+'-12-21',label:'冬至頃',dash:'9 5'}];
}

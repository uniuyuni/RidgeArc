import {destination,sunPosition,angleDelta} from './core.mjs';

// This is a direction diagram, not a projected position of the Sun on Earth.
// The radius is supplied by the map presentation; only the azimuth is physical.
export function mapSolarPath(date,observer,radius,selectedMinute){
 if(!Number.isFinite(radius)||radius<=0||!Number.isFinite(selectedMinute))throw Error('Invalid solar map geometry');
 const at=minute=>{
  const s=sunPosition(date,minute,observer.lat,observer.lon);
  return {...s,minute,point:destination(observer.lat,observer.lon,s.az,radius),aboveReference:s.alt+s.radius>=0};
 };
 const segments=[],hours=[];
 let segment=[],previous=null;
 for(let m=0;m<1440;m++){
  const p=at(m);
  if(!p.aboveReference||previous&&Math.abs(angleDelta(p.az,previous.az))>45){
   if(segment.length>1)segments.push(segment);segment=[];
  }
  if(p.aboveReference){
   segment.push(p);
   if(m%60===0)hours.push(p);
  }
  previous=p;
 }
 if(segment.length>1)segments.push(segment);
 return {segments,hours,current:at(selectedMinute)};
}

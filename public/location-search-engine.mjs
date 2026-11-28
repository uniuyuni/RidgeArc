import {R,DEG,destination,sunPosition,wrap,visibilityEstimate,clamp,angleDelta} from './core.mjs';
import {targetDirection,finiteLOS,reverseCandidates,evaluateAlignment} from './location-geometry.mjs';
import {sampleElevationBatch} from './terrain-store.mjs';

const LIMIT=2400,MAX_VERIFY=64;
const near=(lat,lon)=>({lat,lon,detail:'near'});
const isNum=Number.isFinite;
const validPoint=p=>p&&isNum(p.lat)&&isNum(p.lon)&&p.lat>=20&&p.lat<=46&&p.lon>=122&&p.lon<=154;
function at(p,az,d,detail){const [lat,lon]=destination(p.lat,p.lon,az,d);return {lat,lon,detail}}
function requireRequest(req){
 if(!validPoint(req.subject)||!validPoint(req.center)||!/^\d{4}-\d{2}-\d{2}$/.test(req.date)||!Number.isFinite(Date.parse(req.date))||!isNum(req.minute)||req.minute<0||req.minute>=1440||!isNum(req.eyeHeight)||req.eyeHeight<0||req.eyeHeight>300||!isNum(req.subjectHeight)||req.subjectHeight<0||req.subjectHeight>300)throw Error('探索条件が不正です');
}
function check(ctx){if(!ctx.isCurrent())throw Error('探索を中断しました')}
function session(options){
 const sample=options.sample??sampleElevationBatch,isCurrent=options.isCurrent??(()=>true),onProgress=options.onProgress??(()=>{});
 return {isCurrent,onProgress,async sample(points,strictNear=true){check(this);const values=await sample(points,{isCurrent,onProgress,strictNear});check(this);if(!values)throw Error('探索を中断しました');return values}};
}
function lineSampleDistances(d){
 const values=[];let x=0;
 while(x<d){const step=Math.min(x<500?10:x<2000?25:x<8000?80:180,Math.max(5,d/12));x+=step;if(x>=d)break;values.push(x)}
 return values;
}
function validDateList(date,days){
 const base=Date.parse(date+'T00:00:00Z');return Array.from({length:days},(_,i)=>new Date(base+i*86400000).toISOString().slice(0,10))
}
// Fixed subject, sampled dates and times. Candidate generation is bounded;
// the final geometry check and finite sampled LOS are separate.
export async function searchSubjectLocations(req,options={}){
 requireRequest(req);
 const ctx=session(options),days=req.days??1,minutes=req.windowMinutes??0,minM=req.minM??100,maxM=req.maxM??10000,radialStep=req.radialStep??250;
 if(!isNum(req.tolerance??.27)||(req.tolerance??.27)<0||(req.tolerance??.27)>2||!isNum(req.verticalOffset??0)||Math.abs(req.verticalOffset??0)>10||!Number.isInteger(days)||days<1||days>7||!Number.isInteger(minutes)||minutes<0||minutes>30||minM<50||maxM>30000||minM>maxM||radialStep<50)throw Error('探索範囲が上限外です');
 const dates=validDateList(req.date,days),times=[...new Set([req.minute,...Array.from({length:Math.floor(minutes*2/5)+1},(_,i)=>req.minute-minutes+i*5)])].filter(m=>m>=0&&m<1440).sort((a,b)=>a-b);
 const count=(Math.floor((maxM-minM)/radialStep)+1)*5*dates.length*times.length;
 if(count>LIMIT)throw Error('候補点数が多すぎます。日数・時間幅・距離を縮めてください（最大'+LIMIT+'点）');
 const raw=dates.flatMap(date=>times.flatMap(minute=>reverseCandidates(req.subject,date,minute,{minM,maxM,radialStep}).map(p=>({...p,date,minute}))));
 ctx.onProgress('撮影候補の標高取得 '+raw.length+'点');
 const heights=await ctx.sample([near(req.subject.lat,req.subject.lon),...raw.map(p=>near(p.lat,p.lon))]);
 if(!isNum(heights[0]))return {kind:'G5',status:'unknown',reason:'被写体標高未取得',sampled:raw.length,results:[],missing:raw.length};
 const target={...req.subject,height:heights[0]+req.subjectHeight};
 let missing=0;const candidates=[];
 for(let i=0;i<raw.length;i++){if(!isNum(heights[i+1])){missing++;continue}
  const p=raw[i],observer={lat:p.lat,lon:p.lon,height:heights[i+1]+req.eyeHeight},align=evaluateAlignment(observer,target,p.date,p.minute,{tolerance:req.tolerance??.27,verticalOffset:req.verticalOffset??0});
  if(align.matched)candidates.push({...p,observer,target,align});
 }
 candidates.sort((a,b)=>a.align.separation-b.align.separation||a.distance-b.distance);
 const chosen=candidates.slice(0,MAX_VERIFY),points=[],jobs=[];
 for(const c of chosen){
  const ds=lineSampleDistances(c.align.target.distance),start=points.length;
  for(const d of ds)points.push(at(c.observer,c.align.target.az,d,d<2000||c.align.target.distance-d<500?'near':'mid'));
  jobs.push({c,ds,start});
 }
 ctx.onProgress('被写体への有限視線を検証 '+chosen.length+'点');
 const hs=points.length?await ctx.sample(points):[];
 const results=jobs.map(({c,ds,start})=>{const los=finiteLOS(c.observer,target,ds.map((distance,i)=>({distance,height:hs[start+i]})));
  return {...c,los,status:los.status==='blocked'?'blocked':los.status==='unknown'?'unknown':'subject-sample-clear',sunVisibility:null};
 });
 const solarPoints=[],solarJobs=[];
 for(const result of results.filter(r=>r.los.status!=='blocked')){
  const sun=result.align.sun,span=sun.radius/Math.max(.05,Math.cos(sun.alt*DEG)),start=solarPoints.length;
  for(const az of [sun.az-span,sun.az,sun.az+span]){
   for(const d of horizonDistances)solarPoints.push(at(result.observer,az,d,d<=2000?'near':d<=14000?'mid':'far'));
  }
  solarJobs.push({result,sun,span,start});
 }
 ctx.onProgress('天体円盤の遮蔽概算 '+solarJobs.length+'点');
 const solarHeights=solarPoints.length?await ctx.sample(solarPoints):[];
 for(const {result,sun,span,start} of solarJobs){
  const rows=[];
  for(let j=0;j<3;j++){
   let max=-Infinity,complete=true;
   for(let k=0;k<horizonDistances.length;k++){
    const d=horizonDistances[k],z=solarHeights[start+j*horizonDistances.length+k];
    if(!isNum(z)){complete=false;continue}
    max=Math.max(max,Math.atan2(z-result.observer.height-d*d/(2*R),d)/DEG);
   }
   rows.push({angle:Number.isFinite(max)?max:null,complete});
  }
  const interpolate=az=>{const q=clamp(angleDelta(az,sun.az)/span,-1,1),i=q<0?0:1,t=q<0?q+1:q,a=rows[i],b=rows[i+1];return a.angle==null||b.angle==null?null:a.angle+(b.angle-a.angle)*t};
  result.sunVisibility=visibilityEstimate(sun,interpolate,()=>rows.every(r=>r.complete));
 }
 return {kind:'G5',status:'sampled',sampled:raw.length,matched:candidates.length,checked:chosen.length,limited:candidates.length>chosen.length,missing,results,policy:{radialStep,minutes:5,days,tolerance:req.tolerance??.27,offsets:[-1,-.5,0,.5,1]}};
}
function lastContact(date,p,eye){
 const dip=-Math.acos(R/(R+Math.max(0,eye)))/DEG;
 const f=m=>{const s=sunPosition(date,m,p.lat,p.lon);return s.alt+s.radius-dip};
 let prior=720;
 for(let m=725;m<=1439;m+=5){if(f(prior)>=0&&f(m)<0){let a=prior,b=m;while(b-a>1/60){const c=(a+b)/2;if(f(c)>=0)a=c;else b=c}return {minute:(a+b)/2,dip}}prior=m}
 return null;
}
const horizonDistances=[10,20,40,80,150,250,400,600,800,1000,1500,2000,...Array.from({length:24},(_,i)=>2500+500*i),...Array.from({length:28},(_,i)=>15000+2000*i)];
// G4: coarse regional grid, last 20 min of sunset at each site. The known
// bare-ground sample can reject a candidate, never certify unsampled terrain.
export async function searchHorizonLocations(req,options={}){
 requireRequest(req);const ctx=session(options),radius=req.radiusM??1500,step=req.gridStep??500;
 if(!isNum(radius)||radius<100||radius>5000||!isNum(step)||step<100||Math.floor(radius*2/step+1)**2>81)throw Error('G4は最大81候補点です。探索半径・間隔を変更してください');
 const raw=[];
 for(let n=-Math.floor(radius/step)*step;n<=radius+1e-8;n+=step)for(let e=-Math.floor(radius/step)*step;e<=radius+1e-8;e+=step){const d=Math.hypot(n,e);if(d>radius)continue;const [lat,lon]=destination(req.center.lat,req.center.lon,Math.atan2(e,n)/DEG,d);if(validPoint({lat,lon}))raw.push({lat,lon})}
 ctx.onProgress('候補の標高取得 '+raw.length+'点');
 const ground=await ctx.sample(raw.map(p=>near(p.lat,p.lon))),points=[],jobs=[],results=[];
 for(let i=0;i<raw.length;i++){
  const p=raw[i],eye=ground[i]+req.eyeHeight;
  if(!isNum(eye)){results.push({...p,status:'unknown',reason:'地表標高未取得'});continue}
  const contact=lastContact(req.date,p,eye);
  if(!contact){results.push({...p,status:'unknown',reason:'日没を検出できない'});continue}
  const rays=[];
  for(const before of [20,15,10,5,.05]){
   const minute=Math.max(0,contact.minute-before),sun=sunPosition(req.date,minute,p.lat,p.lon);
   for(const off of [-sun.radius,0,sun.radius]){
    const az=wrap(sun.az+off/Math.max(.1,Math.cos(sun.alt*DEG))),start=points.length;
    for(const d of horizonDistances)points.push(at(p,az,d,d<=2000?'near':d<=14000?'mid':'far'));
    rays.push({start,sun,az,before});
   }
  }
  jobs.push({p,eye,contact,rays});
 }
 ctx.onProgress('日没経路のDEM検証 '+jobs.length+'点');
 const heights=points.length?await ctx.sample(points):[];
 for(const {p,eye,contact,rays} of jobs){
  let blocked=false,missing=0,max=-Infinity;
  for(const ray of rays){
   let angle=-Infinity;
   for(let j=0;j<horizonDistances.length;j++){
    const z=heights[ray.start+j],d=horizonDistances[j];
    if(!isNum(z)){missing++;continue}
    angle=Math.max(angle,Math.atan2(z-eye-d*d/(2*R),d)/DEG)
   }
   max=Math.max(max,angle);
   // Near last contact, a ridge above the sea-level dip blocks the desired
   // horizon. Earlier, reject known total-disk obstruction.
   if(ray.before===.05?angle>contact.dip+.05:angle>ray.sun.alt+ray.sun.radius)blocked=true;
  }
  results.push({...p,eye,az:sunPosition(req.date,contact.minute,p.lat,p.lon).az,minute:contact.minute,dip:contact.dip,horizon:Number.isFinite(max)?max:null,missing,status:blocked?'blocked':missing||!Number.isFinite(max)?'unknown':'sample-clear'});
 }
 return {kind:'G4',status:'sampled',sampled:raw.length,results,policy:{radius,step,radialSamples:horizonDistances.length,sunsetMinutes:20,azimuthSamples:3}};
}

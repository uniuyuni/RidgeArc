import {skyDomePath,domeRadius,seasonalDates} from './map-solar-geometry.mjs';

const NS='http://www.w3.org/2000/svg';
const el=(name,attrs={},value)=>{const node=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(value!==undefined)node.textContent=value;return node};
const clock=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
export function mountMapSolarOverlay(map,L,readState){
 const svg=el('svg',{'class':'sky-dome-overlay','aria-label':'天球の正射影',role:'img'});
 map.getContainer().append(svg);
 let cached=null;
 function render(){
  const {date,lat,lon,minute,trajectory=true,sun=true,labels=true,guides=true,seasons=false}=readState();
  const {x:w,y:h}=map.getSize(),center=map.latLngToContainerPoint([lat,lon]),r=domeRadius(w,h);
  svg.setAttribute('viewBox','0 0 '+w+' '+h);
  svg.dataset.radius=r;svg.dataset.centerX=center.x;svg.dataset.centerY=center.y;
  const key=[date,lat,lon,minute,seasons].join('/');
  if(cached?.key!==key)cached={key,path:skyDomePath(date,{lat,lon},minute),seasonal:seasons?seasonalDates(date).map(v=>({...v,path:skyDomePath(v.date,{lat,lon},minute)})):[]};
  const {path,seasonal}=cached;
  svg.replaceChildren();if(!r)return;
  const dome=el('g',{transform:'translate('+center.x+' '+center.y+')'});svg.append(dome);
  const xy=p=>[p.x*r,p.y*r];
  const line=(x1,y1,x2,y2,attrs={})=>el('line',{x1,y1,x2,y2,...attrs});
  const circle=(x,y,radius,attrs={})=>el('circle',{cx:x,cy:y,r:radius,...attrs});
  const label=(x,y,value,cls='sky-guide')=>el('text',{x,y,class:cls,'text-anchor':'middle','dominant-baseline':'central'},value);
  if(guides){
   dome.append(circle(0,0,r,{fill:'#243843','fill-opacity':.06,stroke:'#fff','stroke-opacity':.8,'stroke-width':1.2,class:'sky-horizon'}));
   for(const alt of [30,60]){
    const d=r*Math.cos(alt*Math.PI/180);
    dome.append(circle(0,0,d,{fill:'none',stroke:'#fff','stroke-opacity':.6,'stroke-dasharray':'3 5'}),label(0,-d+10,alt+'°'));
   }
   for(const angle of [0,45,90,135]){
    const a=angle*Math.PI/180,x=r*Math.sin(a),y=r*Math.cos(a);
    dome.append(line(-x,-y,x,y,{stroke:'#fff','stroke-opacity':.35,'stroke-width':1}));
   }
   for(const [x,y,t] of [[0,-r-9,'N'],[r+9,0,'E'],[0,r+9,'S'],[-r-9,0,'W']])dome.append(label(x,y,t));
   dome.append(label(14,-12,'90°'),label(0,r-12,'0°'));
  }
  function drawPath(value,attrs){for(const segment of value.segments)dome.append(el('polyline',{points:segment.map(p=>xy(p).join(',')).join(' '),fill:'none','stroke-linejoin':'round','stroke-linecap':'round',...attrs}))}
  if(seasons)for(const v of seasonal){
   drawPath(v.path,{stroke:'#8e7753','stroke-width':1.5,'stroke-dasharray':v.dash,class:'sky-season'});
   if(labels&&v.path.hours.length){const peak=v.path.hours.reduce((a,b)=>a.alt>b.alt?a:b),[x,y]=xy(peak);dome.append(label(x,y-15,v.label))}
  }
  if(trajectory)drawPath(path,{stroke:'#694e25','stroke-width':4,opacity:.7,class:'sky-track-under'});
  if(trajectory)drawPath(path,{stroke:'#ffcf72','stroke-width':2,class:'sky-track'});
  const visible=sun&&path.current.alt>=0,[sx,sy]=xy(path.current),reserved=visible?[[sx,sy-16]]:[];
  if(trajectory&&labels)for(const p of path.hours){
   const [x,y]=xy(p);
   if(reserved.some(([a,b])=>Math.abs(a-x)<44&&Math.abs(b-(y+13))<18))continue;
   reserved.push([x,y+13]);dome.append(circle(x,y,2.5,{fill:'#ffcf72',stroke:'#694e25','stroke-width':.7}),label(x,y+13,clock(p.minute),'map-solar-time'));
  }
  if(visible){
   dome.append(line(0,0,sx,sy,{stroke:'#b88b3d','stroke-width':1,'stroke-dasharray':'3 4'}));
   dome.append(circle(sx,sy,8,{fill:'#ffd16e','fill-opacity':.28}),circle(sx,sy,5,{fill:'#fff3ce',stroke:'#b88b3d','stroke-width':1.5,class:'sky-current'}));
   if(labels)dome.append(label(sx,sy-16,clock(minute),'map-solar-time current'));
  }
 }
 map.on('move zoom resize',render);render();
 return {render,remove(){map.off('move zoom resize',render);svg.remove()}};
}

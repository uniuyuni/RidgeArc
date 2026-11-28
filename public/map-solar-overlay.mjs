import {mapSolarPath} from './map-solar-geometry.mjs';

// Leaflet preview; no changes to FIELD state or interaction handlers.
export function mountMapSolarOverlay(map,L,readState){
 const pane=map.createPane('mapSolarDirections');
 pane.style.zIndex='440';pane.style.pointerEvents='none';
 const group=L.layerGroup().addTo(map),options={pane:'mapSolarDirections',interactive:false,bubblingMouseEvents:false};
 const caption=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 const textIcon=(text,current)=>L.divIcon({className:'map-solar-time'+(current?' current':''),html:text,iconSize:[48,18],iconAnchor:[24,9]});
 let key='';
 function render(){
  const {date,lat,lon,minute,trajectory=true,sun=true}=readState();
  const size=map.getSize(),p=map.latLngToContainerPoint([lat,lon]),radiusPx=Math.max(64,Math.min(150,Math.min(size.x,size.y)*.31));
  const radius=map.distance([lat,lon],map.containerPointToLatLng(p.add([radiusPx,0])));
  if(!Number.isFinite(radius)||radius<=0)return;
  const next=[date,lat,lon,minute,trajectory,sun,map.getZoom(),size.x,size.y,radius.toFixed(2)].join('/');
  if(next===key)return;key=next;group.clearLayers();
  if(!trajectory&&!sun)return;
  const path=mapSolarPath(date,{lat,lon},radius,minute);
  const currentPoint=map.latLngToContainerPoint(path.current.point);
  const reserved=sun?[currentPoint]:[];
  if(trajectory){
   for(const arc of path.segments)L.polyline(arc.map(p=>p.point),{...options,color:'#d9a94e',weight:2,opacity:.9}).addTo(group);
   for(const h of path.hours){
    const pt=map.latLngToContainerPoint(h.point);
    if(reserved.some(q=>Math.abs(q.x-pt.x)<48&&Math.abs(q.y-pt.y)<20))continue;
    reserved.push(pt);
    L.circleMarker(h.point,{...options,radius:2.5,color:'#fff1d0',weight:1,fillColor:'#d9a94e',fillOpacity:1}).addTo(group);
    L.marker(h.point,{...options,icon:textIcon(caption(h.minute),false),zIndexOffset:1000}).addTo(group);
   }
  }
  if(sun){
   const s=path.current;
   L.polyline([[lat,lon],s.point],{...options,color:'#e7aa38',weight:2.5,opacity:.95,dashArray:s.aboveReference?null:'5 5'}).addTo(group);
   L.circleMarker(s.point,{...options,radius:6,color:'#fff2ce',weight:2,fillColor:'#e7aa38',fillOpacity:1}).addTo(group);
   L.marker(s.point,{...options,icon:textIcon(caption(s.minute),true),zIndexOffset:2000}).addTo(group);
  }
 }
 map.on('zoomend moveend resize',render);
 render();
 return {render,remove(){map.off('zoomend moveend resize',render);group.remove();pane.remove()}};
}

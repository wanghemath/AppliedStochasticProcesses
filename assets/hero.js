'use strict';
(() => {
  const svg=document.getElementById('hero-paths'); if(!svg)return;
  const NS='http://www.w3.org/2000/svg';
  const add=(tag,attrs,text)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.appendChild(e);return e;};
  const x=t=>40+t*13.3,y=n=>255-n*10;
  for(let v=0;v<=20;v+=5){add('line',{x1:40,x2:440,y1:y(v),y2:y(v),stroke:'#345363'});add('text',{x:28,y:y(v)+4,'text-anchor':'end',class:'plot-label'},String(v));}
  let seed=6231;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  ['#9edac9','#52a7ae','#cfce91','#9cb5dc','#e7a887','#8fd0bf'].forEach(color=>{let s=0;let pts=[[x(0),y(0)]];for(let t=1;t<=30;t++){s+=rng()<.45?1:0;pts.push([x(t),y(s)]);}add('polyline',{points:pts.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':2,opacity:.85});});
  add('line',{x1:x(0),y1:y(0),x2:x(30),y2:y(13.5),stroke:'#fff','stroke-width':2,'stroke-dasharray':'6 5'});
  [0,10,20,30].forEach(t=>add('text',{x:x(t),y:278,'text-anchor':'middle',class:'plot-label'},String(t)));
  add('text',{x:40,y:17,class:'plot-label'},'Cumulative high-demand days');add('text',{x:440,y:297,'text-anchor':'end',class:'plot-label'},'Day');
})();

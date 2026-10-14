/* Seeded, browser-only teaching experiments. All data are bundled locally. */
'use strict';
const CourseLab = (() => {
  const NS='http://www.w3.org/2000/svg';
  const colors=['#006d77','#4d8891','#527b62','#827346','#627aaf','#8b5874'];
  function rng32(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function simulate(p,n,R,seed){
    if(!(p>=0&&p<=1)||!Number.isInteger(n)||n<1||!Number.isInteger(R)||R<2)throw Error('Invalid simulation parameters.');
    const random=rng32(seed),totals=[],paths=[],counts=Array(n+1).fill(0);
    for(let r=0;r<R;r++){let s=0;const path=[0];for(let t=0;t<n;t++){s+=random()<p?1:0;if(r<6)path.push(s);}totals.push(s);counts[s]++;if(r<6)paths.push(path);}
    const mean=totals.reduce((a,b)=>a+b,0)/R;
    const variance=totals.reduce((a,b)=>a+(b-mean)**2,0)/(R-1);
    return{mean,variance,paths,counts,totals};
  }
  function binomial(n,p){
    if(p===0)return Array.from({length:n+1},(_,k)=>k===0?1:0);
    if(p===1)return Array.from({length:n+1},(_,k)=>k===n?1:0);
    const pmf=[];let logChoose=0;
    for(let k=0;k<=n;k++){if(k>0)logChoose+=Math.log(n-k+1)-Math.log(k);pmf.push(Math.exp(logChoose+k*Math.log(p)+(n-k)*Math.log1p(-p)));}
    return pmf;
  }
  function add(parent,tag,attrs,text){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!==undefined)e.textContent=text;parent.appendChild(e);return e;}
  function chart(id,{width=470,height=290,xmax=30,ymax=30,xlabel='Day',ylabel='Total',xticks=null,yticks=null}={}){
    const svg=document.getElementById(id);svg.replaceChildren();
    const m={l:49,r:18,t:27,b:42};const w=width-m.l-m.r,h=height-m.t-m.b;
    const x=v=>m.l+w*v/xmax,y=v=>height-m.b-h*v/ymax;
    const yt=yticks||Array.from({length:5},(_,i)=>ymax*i/4);
    yt.forEach(v=>{add(svg,'line',{x1:m.l,x2:width-m.r,y1:y(v),y2:y(v),class:'gridline'});add(svg,'text',{x:m.l-9,y:y(v)+4,'text-anchor':'end',class:'tick'},Number.isInteger(v)?v:v.toFixed(ymax<=1?2:1));});
    const xt=xticks||Array.from({length:4},(_,i)=>({value:xmax*i/3,label:String(Math.round(xmax*i/3))}));
    xt.forEach(t=>add(svg,'text',{x:x(t.value),y:height-23,'text-anchor':'middle',class:'tick'},t.label));
    add(svg,'line',{x1:m.l,x2:width-m.r,y1:y(0),y2:y(0),class:'axis'});
    add(svg,'text',{x:m.l,y:14},ylabel);add(svg,'text',{x:width-m.r,y:height-3,'text-anchor':'end'},xlabel);
    return {svg,x,y,w,h,m};
  }
  function line(c,values,color,dash='',width=2){add(c.svg,'polyline',{points:values.map(([a,b])=>`${c.x(a)},${c.y(b)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash});}
  function row(label,a,b){const tr=document.createElement('tr');[label,a,b].forEach((v,i)=>{const e=document.createElement(i===0?'th':'td');if(i===0)e.scope='row';e.textContent=v;tr.appendChild(e);});return tr;}
  const f=(n,d=3)=>Number(n).toFixed(d);
  let fittedP=null;
  function run(){
    const seedInput=document.getElementById('seed');
    if(!seedInput.checkValidity()||seedInput.value===''){document.getElementById('simulation-status').textContent='Enter an integer seed between 0 and 4,294,967,295.';seedInput.reportValidity();return;}
    const p=Number(document.getElementById('probability').value),n=Number(document.getElementById('horizon').value),R=Number(document.getElementById('replications').value),seed=Number(seedInput.value);
    const result=simulate(p,n,R,seed),pmf=binomial(n,p);
    const c=chart('paths-chart',{xmax:n,ymax:n,ylabel:'Cumulative flagged days'});
    result.paths.forEach((path,i)=>line(c,path.map((v,t)=>[t,v]),colors[i],i>2?'3 2':'',1.8));
    line(c,[[0,0],[n,n*p]],'#142e3c','7 4',2.7);
    const ymax=Math.max(...pmf,...result.counts.map(x=>x/R))*1.12;
    const b=chart('histogram-chart',{xmax:n+1,ymax,xlabel:'Flagged days in period',ylabel:'Probability / relative frequency',xticks:[0,Math.round(n/3),Math.round(2*n/3),n].map(v=>({value:v+.5,label:String(v)}))});
    result.counts.forEach((count,k)=>{add(b.svg,'rect',{x:b.x(k+.14),y:b.y(count/R),width:b.w/(n+1)*.72,height:b.y(0)-b.y(count/R),fill:'#006d77',opacity:.8});});
    line(b,pmf.map((v,k)=>[k+.5,v]),'#a84520','',1.7);
    pmf.forEach((v,k)=>add(b.svg,'circle',{cx:b.x(k+.5),cy:b.y(v),r:n>30?1.5:2.5,fill:'#a84520'}));
    const mean=n*p,variance=n*p*(1-p),se=Math.sqrt(variance/R);
    document.getElementById('sim-mean').textContent=f(result.mean);
    document.getElementById('theory-mean').textContent=f(mean);
    document.getElementById('mcse').textContent=f(se,4);
    const tbody=document.getElementById('simulation-table');tbody.replaceChildren(row('Mean total',f(result.mean),f(mean)),row('Variance of total',f(result.variance),f(variance)),row('Probability of zero flagged days',f(result.counts[0]/R,4),f(pmf[0],4)));
    document.getElementById('simulation-status').textContent=`Seed ${seed} · p = ${f(p,4)} · ${R.toLocaleString()} paths of ${n} days. ${se>0?`Mean error = ${f(result.mean-mean)} (${f((result.mean-mean)/se,2)} Monte Carlo SE).`:'Deterministic endpoint: every path matches the formula exactly.'}`;
  }
  function auditData(rows,c){
    const train=rows.filter(d=>d.dteday<'2011-09-01'),test=rows.filter(d=>d.dteday>='2011-09-01');
    const p=train.filter(d=>d.cnt>c).length/train.length,ys=test.map(d=>Number(d.cnt>c));
    return {train,test,p,ys,q:ys.reduce((a,b)=>a+b,0)/ys.length,switches:ys.slice(1).reduce((sum,y,i)=>sum+Number(y!==ys[i]),0),expectedSwitches:2*(ys.length-1)*p*(1-p),brier:ys.reduce((sum,y)=>sum+(p-y)**2,0)/ys.length};
  }
  function updateData(){
    const rows=window.COURSE_BIKE_DATA;
    if(!Array.isArray(rows)||rows.length!==365){document.getElementById('data-status').textContent='The local data file is missing or incomplete. Keep data/bike_daily_2011.js with the course folder.';document.getElementById('use-fit').disabled=true;return;}
    const threshold=Number(document.getElementById('threshold').value),d=auditData(rows,threshold);fittedP=d.p;
    const c=chart('observed-chart',{width:800,height:260,xmax:364,ymax:7000,xlabel:'2011 calendar date',ylabel:'Completed rentals / day',xticks:[{value:0,label:'Jan 1'},{value:90,label:'Apr 1'},{value:181,label:'Jul 1'},{value:243,label:'Sep 1'},{value:364,label:'Dec 31'}],yticks:[0,2000,4000,6000]});
    const shade=add(c.svg,'rect',{x:c.x(243),y:c.m.t,width:c.x(364)-c.x(243),height:c.h,fill:'#e4f1ee',opacity:.65});c.svg.insertBefore(shade,c.svg.firstChild);
    line(c,rows.map((r,i)=>[i,r.cnt]),'#006d77','',1.4);
    line(c,[[0,threshold],[364,threshold]],'#a84520','6 4',2);
    add(c.svg,'line',{x1:c.x(243),x2:c.x(243),y1:c.m.t,y2:c.y(0),stroke:'#6c848b','stroke-dasharray':'3 3'});
    add(c.svg,'text',{x:c.x(248),y:42},'Held out: Sep–Dec');
    const compare=chart('comparison-chart',{width:800,height:260,xmax:d.ys.length,ymax:1,xlabel:'Day in held-out period',ylabel:'Running fraction above threshold'});
    let os=0,ss=0;const rand=rng32(6231),observed=[],sim=[];
    d.ys.forEach((y,i)=>{os+=y;ss+=rand()<d.p?1:0;observed.push([i+1,os/(i+1)]);sim.push([i+1,ss/(i+1)]);});
    line(compare,[[0,d.p],[d.ys.length,d.p]],'#142e3c','6 4',2);
    line(compare,sim,'#a84520','3 2',1.7);line(compare,observed,'#006d77','',2.4);
    document.getElementById('train-rate').textContent=f(d.p,4);document.getElementById('test-rate').textContent=f(d.q,4);document.getElementById('switches').textContent=`${d.switches} / ${f(d.expectedSwitches,2)}`;
    document.getElementById('data-table').replaceChildren(row('Flagged-day fraction',f(d.q,4),f(d.p,4)),row('Number of flagged days',String(d.ys.reduce((a,b)=>a+b,0)),f(d.ys.length*d.p,2)+' expected'),row('Switches between flags',String(d.switches),f(d.expectedSwitches,2)+' expected'),row('Brier score on test outcomes','Always-unflagged baseline: '+f(d.q,4),'Constant probability forecast: '+f(d.brier,4)));
    document.getElementById('data-status').textContent=`Threshold ${threshold.toLocaleString()} rentals/day is a scenario assumption. Fit: ${d.train.length} earlier days; validation: ${d.test.length} later days. Changing thresholds explores different outcomes; it does not estimate a causal intervention.`;
  }
  function init(){
    const p=document.getElementById('probability'),label=document.getElementById('p-output');
    p.addEventListener('input',()=>{label.textContent=f(Number(p.value),2);});
    document.getElementById('run-simulation').addEventListener('click',run);
    document.getElementById('next-seed').addEventListener('click',()=>{const e=document.getElementById('seed');e.value=(Number(e.value)+1)>>>0;run();});
    document.getElementById('threshold').addEventListener('change',updateData);
    document.getElementById('use-fit').addEventListener('click',()=>{if(fittedP===null)return;p.step='any';p.value=fittedP;label.textContent=f(fittedP,4);run();document.getElementById('experiment').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});document.getElementById('run-simulation').focus({preventScroll:true});});
    run();updateData();
  }
  return{simulate,binomial,auditData,init};
})();
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',CourseLab.init);
if(typeof module!=='undefined')module.exports=CourseLab;

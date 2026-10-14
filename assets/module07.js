/* Poisson counting processes: synthetic event times and observed daily-rate checks. */
'use strict';
const PoissonLab = (() => {
 const NS='http://www.w3.org/2000/svg',teal='#006d77',rust='#a84520',ink='#142e3c';
 const breaks=[0,1,3,4],weights={flat:[1,1,1],middle:[1/3,5/3,1/3],late:[1/3,1/3,3]};
 function rng32(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
 function variance(x){const m=mean(x);return x.reduce((a,b)=>a+(b-m)**2,0)/(x.length-1);}
 function rates(average=6,profile='middle'){if(!Number.isFinite(average)||average<0||!Object.hasOwn(weights,profile))throw Error('Invalid rate or profile.');return weights[profile].map(w=>average*w);}
 function integrated(a,b,rs){if(!(a>=0&&b>=a&&b<=4)||rs.length!==3||rs.some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid interval or rates.');return rs.reduce((v,r,j)=>v+r*Math.max(0,Math.min(b,breaks[j+1])-Math.max(a,breaks[j])),0);}
 function rateAt(t,rs){if(t<0||t>4)throw Error('Time must be in [0,4].');return rs[t<1?0:t<3?1:2];}
 // Independent Poisson chunks add exactly; no normal approximation or truncation.
 function poisson(lambda,random){if(!Number.isFinite(lambda)||lambda<0)throw Error('Invalid Poisson mean.');let total=0,remaining=lambda;while(remaining>0){const rate=Math.min(20,remaining),limit=Math.exp(-rate);let product=1,k=0;do{product*=1-random();k++;}while(product>limit);total+=k-1;remaining-=rate;}return total;}
 function pmf(k,mu){if(!Number.isInteger(k)||k<0||mu<0)throw Error('Invalid Poisson argument.');if(mu===0)return k===0?1:0;let p=Math.exp(-mu);for(let j=1;j<=k;j++)p*=mu/j;return p;}
 function tail(k,mu){if(k<=0)return 1;let term=Math.exp(-mu),sum=term;for(let j=1;j<k;j++){term*=mu/j;sum+=term;}return Math.max(0,1-sum);}
 function simulate(average=6,profile='middle',R=2000,seed=6231){
  if(!Number.isInteger(R)||R<2||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('Invalid replications or seed.');
  const rs=rates(average,profile),random=rng32(seed),paths=[];
  for(let r=0;r<R;r++){const times=[];for(let j=0;j<3;j++){const n=poisson(rs[j]*(breaks[j+1]-breaks[j]),random);for(let i=0;i<n;i++)times.push(breaks[j]+(random()+2**-33)*(breaks[j+1]-breaks[j]));}times.sort((a,b)=>a-b);paths.push(times);}
  const totals=paths.map(p=>p.length),bins=Array.from({length:4},(_,j)=>paths.map(p=>p.filter(t=>t>j&&t<=j+1).length));
  return{rs,paths,totals,bins,means:bins.map(mean),variances:bins.map(variance),R,average,profile,seed};
 }
 function windowSummary(s,a=.8,h=.5){const mu=integrated(a,a+h,s.rs),p=Math.exp(-mu),empirical=mean(s.paths.map(times=>+!times.some(t=>t>a&&t<=a+h)));return{mu,p,empirical,se:Math.sqrt(p*(1-p)/s.R),estimatedSE:Math.sqrt(empirical*(1-empirical)/s.R),instantaneous:Math.exp(-rateAt(a,s.rs)*h)};}
 function waits(rate=6,n=20000,seed=6232){if(!(rate>0)||!Number.isInteger(n)||n<2)throw Error('Positive rate and sample size required.');const random=rng32(seed);return Array.from({length:n},()=>-Math.log1p(-(random()+2**-33))/rate);}
 const logFacts=[0];
 function logFactorial(n){if(!Number.isInteger(n)||n<0)throw Error('Invalid count.');for(let i=logFacts.length;i<=n;i++)logFacts.push(logFacts[i-1]+Math.log(i));return logFacts[n];}
 function score(y,mu){const residuals=y.map((v,i)=>(v-mu[i])/Math.sqrt(mu[i]));return{rmse:Math.sqrt(mean(y.map((v,i)=>(v-mu[i])**2))),nll:mean(y.map((v,i)=>mu[i]-v*Math.log(mu[i])+logFactorial(v))),pearson:mean(residuals.map(v=>v*v)),residuals};}
 function bikeAudit(rows){
  if(rows.length!==365||rows[0].dteday!=='2011-01-01'||rows[242].dteday!=='2011-08-31'||rows[243].dteday!=='2011-09-01')throw Error('Expected bundled 2011 daily data.');
  const train=rows.slice(0,243),later=rows.slice(243),counts=train.map(r=>r.cnt),constant=mean(counts),groups=[0,1].map(k=>train.filter(r=>r.workingday===k).map(r=>r.cnt)),calendar=groups.map(mean),y=later.map(r=>r.cnt),constantMu=y.map(()=>constant),calendarMu=later.map(r=>calendar[r.workingday]),previous=rows.slice(242,-1).map(r=>r.cnt);
  return{trainCount:243,trainTotal:counts.reduce((a,b)=>a+b,0),constant,calendar,groupN:groups.map(x=>x.length),groupTotals:groups.map(x=>x.reduce((a,b)=>a+b,0)),fano:variance(counts)/constant,groupFano:groups.map(x=>variance(x)/mean(x)),y,constantMu,calendarMu,previous,constantScore:score(y,constantMu),calendarScore:score(y,calendarMu),persistenceRMSE:Math.sqrt(mean(y.map((v,i)=>(v-previous[i])**2))),dates:later.map(r=>r.dteday)};
 }
 const el=id=>document.getElementById(id),fmt=(v,d=4)=>Number.isFinite(v)?(v!==0&&Math.abs(v)<1e-4?v.toExponential(2):v.toFixed(d)):'Undefined';
 function row(label,...vals){const tr=document.createElement('tr');[label,...vals].forEach((v,i)=>{const td=document.createElement(i?'td':'th');if(!i)td.scope='row';td.textContent=v;tr.appendChild(td);});return tr;}
 function add(svg,tag,attrs,text){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!==undefined)e.textContent=text;svg.appendChild(e);return e;}
 function chart(id,xmax,ymax,xlabel,ylabel,ticks=null,ymin=0){
  const unit=10**Math.floor(Math.log10(ymax||1)),fraction=ymax/unit;ymax=(fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*unit;
  const svg=el(id);svg.replaceChildren();const x=v=>58+710*v/(xmax||1),y=v=>232-198*(v-ymin)/(ymax-ymin);
  [ymin,(ymin+ymax)/2,ymax].forEach(v=>{add(svg,'line',{x1:58,x2:768,y1:y(v),y2:y(v),class:'gridline'});add(svg,'text',{x:48,y:y(v)+4,'text-anchor':'end'},fmt(v,ymax<=2?2:Number.isInteger(v)?0:1));});
  (ticks||[0,xmax/2,xmax].map(v=>({v,label:fmt(v,Number.isInteger(v)?0:2)}))).forEach(t=>add(svg,'text',{x:x(t.v),y:254,'text-anchor':'middle'},t.label));
  add(svg,'text',{x:58,y:17},ylabel);add(svg,'text',{x:768,y:278,'text-anchor':'end'},xlabel);return{svg,x,y};
 }
 function line(c,points,color,dash='',width=2,opacity=1){add(c.svg,'polyline',{points:points.map(([a,b])=>`${c.x(a)},${c.y(b)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash,opacity});}
 function sequence(c,a,color,dash=''){line(c,a.map((v,i)=>[i,v]),color,dash);}
 let current;
 function drawWindow(){if(!current)return;const a=+el('window-start').value,h=+el('window-width').value,w=windowSummary(current,a,h);el('window-summary').replaceChildren(row('Integrated rate in selected window',fmt(w.mu),'Expected count, not rate per hour'),row('Probability of no events',fmt(w.p,6),`${fmt(w.empirical,6)} simulated; estimated MCSE ${fmt(w.estimatedSE)}`),row('Instantaneous-rate shortcut',fmt(w.instantaneous,6),'Valid here only if the rate stays constant throughout the window'));el('window-status').textContent=`Window (${a}, ${fmt(a+h,2)}] hours; exact probability-based MCSE ${fmt(w.se)} at R=${current.R}. ${w.empirical===0||w.empirical===1?'An endpoint estimate and zero sample MCSE do not prove that rare outcomes are impossible. ':''}Changing this window reuses the same paths.`;}
 function run(){
  const seed=el('poisson-seed');if(seed.value===''||!seed.checkValidity()){el('process-status').textContent='Enter an integer seed between 0 and 4,294,967,295.';seed.reportValidity();return;}
  const average=+el('average-rate').value,profile=el('rate-profile').value,R=+el('replications').value,s=simulate(average,profile,R,+seed.value);current=s;
  const mu=4*average,c=chart('rate-plot',4,Math.max(...s.rs,average)*1.1,'Calendar time (hours)','Synthetic intensity (events/hour)',[0,1,2,3,4].map(v=>({v,label:String(v)})));
  line(c,[[0,average],[4,average]],ink,'6 4');line(c,[[0,s.rs[0]],[1,s.rs[0]],[1,s.rs[1]],[3,s.rs[1]],[3,s.rs[2]],[4,s.rs[2]]],teal);
  const cp=chart('paths-plot',4,Math.max(mu,...s.totals.slice(0,8))*1.05,'Calendar time (hours)','First eight synthetic counting paths and exact mean');
  s.paths.slice(0,8).forEach((times,i)=>{const pts=[[0,0]];times.forEach((t,j)=>pts.push([t,j],[t,j+1]));pts.push([4,times.length]);line(cp,pts,i%2?rust:teal,'',1.2,.55);});line(cp,breaks.map(t=>[t,integrated(0,t,s.rs)]),ink,'6 4',2.5);
  const xmax=Math.max(...s.totals,Math.ceil(mu+5*Math.sqrt(mu))),freq=Array(xmax+1).fill(0);s.totals.forEach(k=>freq[k]++);const mass=freq.map((_,k)=>pmf(k,mu));
  const ch=chart('count-plot',xmax,Math.max(...mass,...freq.map(n=>n/R))*1.2,'Events in four hours','Unconditional count law: empirical mass and Poisson theory',[0,Math.floor(xmax/2),xmax].map(v=>({v,label:String(v)})));
  freq.forEach((n,k)=>add(ch.svg,'rect',{x:ch.x(k)-2,y:ch.y(n/R),width:4,height:ch.y(0)-ch.y(n/R),fill:teal,opacity:.65}));line(ch,mass.map((p,k)=>[k,p]),ink,'6 4');
  const w=waits(average,20000,(+seed.value+1)>>>0),grid=Array.from({length:81},(_,i)=>i*5/(80*average)),cw=chart('wait-plot',5/average,1,'Gap length (hours)','Separate complete HPP waiting times: survival probability',[0,1/average,3/average,5/average].map(v=>({v,label:fmt(v,3)})));
  line(cw,grid.map(t=>[t,Math.exp(-average*t)]),ink,'6 4');line(cw,grid.map(t=>[t,mean(w.map(v=>+(v>t)))]),teal);
  const pTail=tail(30,mu),empTail=mean(s.totals.map(k=>+(k>=30))),v=variance(s.totals),pZero=Math.exp(-mu);
  el('mean-value').textContent=fmt(mean(s.totals),2);el('variance-value').textContent=fmt(v,2);el('wait-value').textContent=fmt(mean(w),4);
  el('process-summary').replaceChildren(row('Four-hour count mean',fmt(mu),`${fmt(mean(s.totals))}; MCSE ${fmt(Math.sqrt(v/R))}`),row('Four-hour count variance',fmt(mu),fmt(v)),row('At least 30 events by hour 4',fmt(pTail,6),`${fmt(empTail,6)}; exact MCSE ${fmt(Math.sqrt(pTail*(1-pTail)/R))}`),row('No events in all four hours',fmt(pZero),`${s.totals.filter(k=>k===0).length} of ${R} paths; zero observed does not mean impossible`),row('Complete HPP gap mean',fmt(1/average),`${fmt(mean(w))}; MCSE ${fmt(Math.sqrt(variance(w)/w.length))}`),row('Complete HPP gap exceeds 0.25 h',fmt(Math.exp(-average*.25)),fmt(mean(w.map(t=>+(t>.25))))));
  el('bin-summary').replaceChildren(...s.means.map((m,j)=>row(`(${j}, ${j+1}] hours`,fmt(integrated(j,j+1,s.rs),2),fmt(m),fmt(s.variances[j],2))));
  el('process-status').textContent=`${R} independent four-hour paths, seed ${seed.value}; rates ${s.rs.map(v=>fmt(v,2)).join(', ')} events/hour on (0,1], (1,3], (3,4]. Total integrated rate ${fmt(mu,2)}. Waiting-time check uses 20,000 separate complete HPP gaps at rate ${average}, seed ${(+seed.value+1)>>>0}; it does not pool gaps from the plotted paths. Python uses a different random generator.`;drawWindow();
 }
 function drawBike(){
  const b=bikeAudit(window.COURSE_BIKE_DATA),ticks=[{v:0,label:'Sep 1'},{v:61,label:'Nov 1'},{v:121,label:'Dec 31'}],c=chart('bike-plot',121,Math.max(...b.y,...b.calendarMu)*1.1,'Later target date','Observed completed rentals and frozen daily means',ticks);
  sequence(c,b.y,teal);sequence(c,b.constantMu,ink,'6 4');sequence(c,b.calendarMu,rust,'2 4');
  el('rate-summary').replaceChildren(row('Constant daily rate',`${b.trainTotal} / ${b.trainCount}`,fmt(b.constant,5)),...b.calendar.map((v,k)=>row(`Workingday = ${k}`,`${b.groupTotals[k]} / ${b.groupN[k]}`,fmt(v,5))));
  el('bike-summary').replaceChildren(row('Constant-rate Poisson',fmt(b.constantScore.rmse,2),fmt(b.constantScore.nll,2),fmt(b.constantScore.pearson,2)),row('Calendar-rate Poisson',fmt(b.calendarScore.rmse,2),fmt(b.calendarScore.nll,2),fmt(b.calendarScore.pearson,2)),row('Rolling persistence mean',fmt(b.persistenceRMSE,2),'— (point forecast only)','— (no variance model)'));
  const res=b.calendarScore.residuals,cr=chart('residual-plot',121,Math.max(1,...res)*1.1,'Later target date','Calendar-rate Pearson residuals; nominal scale near one',ticks,Math.floor(Math.min(-1,...res)/10)*10);line(cr,[[0,0],[121,0]],ink,'6 4');sequence(cr,res,teal);
  el('dispersion-note').textContent=`Training sample variance/mean: pooled ${fmt(b.fano,2)}, workingday=0 ${fmt(b.groupFano[0],2)}, workingday=1 ${fmt(b.groupFano[1],2)}. Later calendar mean squared Pearson residual = ${fmt(b.calendarScore.pearson,2)} (divisor 122). These are descriptive checks, not an iid hypothesis test.`;
 }
 function init(){el('run-poisson').addEventListener('click',run);el('window-start').addEventListener('change',drawWindow);el('window-width').addEventListener('change',drawWindow);run();drawBike();}
 return{breaks,weights,rng32,mean,variance,rates,integrated,rateAt,poisson,pmf,tail,simulate,windowSummary,waits,logFactorial,score,bikeAudit,init};
})();
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',PoissonLab.init);
if(typeof module!=='undefined')module.exports=PoissonLab;

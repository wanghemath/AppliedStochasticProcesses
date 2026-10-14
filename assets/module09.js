/* Module 9: synthetic FCFS queueing experiments; no network or external runtime. */
'use strict';
const QueueLab = (() => {
 const NS='http://www.w3.org/2000/svg',teal='#006d77',rust='#a84520',ink='#142e3c';
 const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
 const variance=a=>{const m=mean(a);return a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1);};
 const validSeed=s=>Number.isInteger(s)&&s>=0&&s<=4294967295;
 function rng32(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
 const expWait=(rate,rng)=>-Math.log1p(-(rng()+2**-33))/rate;
 function checkModel(lambda,mu,arrival,service){if(!Number.isFinite(lambda)||!Number.isFinite(mu)||lambda<=0||mu<=0||!['poisson','bursty'].includes(arrival)||!['exponential','fixed'].includes(service))throw Error('Positive finite rates and supported laws required.');}
 function theory(lambda=2,mu=3,arrival='poisson',service='exponential'){
  checkModel(lambda,mu,arrival,service);const rho=lambda/mu,stable=rho<1;
  if(!stable||arrival!=='poisson')return{rho,stable,Wq:null,W:null,Lq:null,L:null};
  const second=(service==='exponential'?2:1)/mu**2,Wq=lambda*second/(2*(1-rho)),W=Wq+1/mu;
  return{rho,stable,Wq,W,Lq:lambda*Wq,L:lambda*W};
 }
 function drawInputs(lambda,mu,n,arrival,service,rng){
  checkModel(lambda,mu,arrival,service);if(!Number.isInteger(n)||n<1)throw Error('Positive integer cohort required.');
  const arrivals=[],services=[];let t=0;
  for(let i=0;i<n;i++){const scale=arrival==='bursty'?(rng()<.5?.5:1.5):1;t+=scale*expWait(lambda,rng);arrivals.push(t);services.push(service==='fixed'?1/mu:expWait(mu,rng));}
  return{arrivals,services};
 }
 // Two-event calendar: departures win ties. FCFS ties in arrivals retain input order.
 // Integrate the OLD state up to the next event, then update that state.
 function eventQueue(arrivals,services,recordLimit=60){
  const n=arrivals.length;if(!n||services.length!==n||arrivals.some((t,i)=>!Number.isFinite(t)||t<0||(i>0&&t<arrivals[i-1]))||services.some(s=>!Number.isFinite(s)||s<=0))throw Error('Sorted nonnegative arrivals and positive finite services required.');
  let a=0,d=0,t=0,number=0,areaN=0,areaQ=0,busyArea=0;
  const starts=Array(n),departures=Array(n),events=[];
  while(d<n){
   const ta=a<n?arrivals[a]:Infinity,td=number?departures[d]:Infinity;
   const next=Math.min(ta,td),dt=next-t;areaN+=number*dt;areaQ+=Math.max(number-1,0)*dt;busyArea+=(number>0?dt:0);t=next;
   let kind,job;
   if(td<=ta){kind='departure';job=d++;number--;if(number){starts[d]=t;departures[d]=t+services[d];}}
   else{kind='arrival';job=a++;if(number===0){starts[job]=t;departures[job]=t+services[job];}number++;}
   if(events.length<recordLimit)events.push({time:t,kind,job,number,queue:Math.max(number-1,0)});
  }
  const waits=starts.map((s,i)=>s-arrivals[i]),system=departures.map((d,i)=>d-arrivals[i]);
  return{n,starts,departures,waits,system,areaN,areaQ,busyArea,horizon:t,events};
 }
 function lindley(arrivals,services){let last=0;const starts=[],departures=[];arrivals.forEach((a,i)=>{const s=Math.max(a,last);starts.push(s);last=s+services[i];departures.push(last);});return{starts,departures};}
 function experiment({lambda=2,mu=3,arrival='poisson',service='exponential',B=1000,N=10000,R=40,seed=6231}={}){
  checkModel(lambda,mu,arrival,service);if(!Number.isInteger(B)||B<0||!Number.isInteger(N)||N<1||!Number.isInteger(R)||R<2||!validSeed(seed))throw Error('Invalid cohort, replication count, or seed.');
  const rng=rng32(seed),wq=[],w=[];let first;
  for(let r=0;r<R;r++){const input=drawInputs(lambda,mu,B+N,arrival,service,rng),q=eventQueue(input.arrivals,input.services,r===0?60:0);wq.push(mean(q.waits.slice(B)));w.push(mean(q.system.slice(B)));if(r===0)first={...q,...input};}
  return{lambda,mu,arrival,service,B,N,R,seed,wq,w,meanWq:mean(wq),meanW:mean(w),seWq:Math.sqrt(variance(wq)/R),seW:Math.sqrt(variance(w)/R),first,theory:theory(lambda,mu,arrival,service)};
 }
 function bikeAudit(rows){if(rows.length!==365||rows[0].dteday!=='2011-01-01'||rows[242].dteday!=='2011-08-31'||rows[243].dteday!=='2011-09-01')throw Error('Expected bundled 2011 data.');const summarize=a=>({days:a.length,total:a.reduce((s,r)=>s+r.cnt,0),mean:mean(a.map(r=>r.cnt))});return{train:summarize(rows.slice(0,243)),later:summarize(rows.slice(243)),counts:rows.map(r=>r.cnt)};}
 function proxy(meanDaily,p=.005,hours=8){if(!Number.isFinite(meanDaily)||meanDaily<0||!Number.isFinite(p)||p<=0||p>1||!Number.isFinite(hours)||hours<=0)throw Error('Invalid proxy inputs.');return p*meanDaily/hours;}
 const el=id=>document.getElementById(id),fmt=(v,d=4)=>v!==null&&Number.isFinite(v)?(v!==0&&Math.abs(v)<1e-4?v.toExponential(2):v.toFixed(d)):'Not available';
 function row(label,...vals){const tr=document.createElement('tr');[label,...vals].forEach((v,i)=>{const td=document.createElement(i?'td':'th');if(!i)td.scope='row';td.textContent=v;tr.appendChild(td);});return tr;}
 function add(svg,tag,attrs,text){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!==undefined)e.textContent=text;svg.appendChild(e);return e;}
 function chart(id,xmax,ymax,xlabel,ylabel,ticks=null){const unit=10**Math.floor(Math.log10(ymax||1)),fraction=ymax/unit;ymax=(fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*unit;const svg=el(id);svg.replaceChildren();const x=v=>58+710*v/(xmax||1),y=v=>232-198*v/(ymax||1);[0,ymax/2,ymax].forEach(v=>{add(svg,'line',{x1:58,x2:768,y1:y(v),y2:y(v),class:'gridline'});add(svg,'text',{x:48,y:y(v)+4,'text-anchor':'end'},fmt(v,ymax<=2?2:Number.isInteger(v)?0:1));});(ticks||[0,xmax/2,xmax].map(v=>({v,label:fmt(v,Number.isInteger(v)?0:1)}))).forEach(t=>add(svg,'text',{x:x(t.v),y:254,'text-anchor':'middle'},t.label));add(svg,'text',{x:58,y:17},ylabel);add(svg,'text',{x:768,y:278,'text-anchor':'end'},xlabel);return{svg,x,y};}
 function line(c,points,color,dash='',width=2){add(c.svg,'polyline',{points:points.map(([a,b])=>`${c.x(a)},${c.y(b)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash});}
 function seedValue(){const e=el('queue-seed');if(e.value===''||!e.checkValidity()){el('queue-status').textContent='Enter an integer seed between 0 and 4,294,967,295.';e.reportValidity();return null;}return+e.value;}
 function run(){
  const seed=seedValue();if(seed===null)return;
  const s=experiment({lambda:+el('arrival-rate').value,mu:+el('service-rate').value,arrival:el('arrival-law').value,service:el('service-law').value,B:+el('burn').value,N:+el('cohort').value,R:+el('replicas').value,seed}),th=s.theory,q=s.first;
  const e=q.events,end=e[e.length-1].time,c=chart('queue-path',end,Math.max(2,...e.map(v=>v.number)),'Hours from empty start','First 60 events of replica 1; later events continue off chart');
  for(const [key,color,dash] of [['number',teal,''],['queue',rust,'4 3']]){const pts=[[0,0]];let previous=0;e.forEach(v=>{pts.push([v.time,previous],[v.time,v[key]]);previous=v[key];});line(c,pts,color,dash);}
  el('event-rows').replaceChildren(...e.slice(0,8).map(v=>row(`${v.kind} ${v.job+1}`,fmt(v.time),v.number,v.queue)));
  const cp=chart('replica-plot',s.R,Math.max(...s.wq,th.Wq||0)*1.15,'Independent replica','Mean waiting time of the retained customer cohort (hours)');
  s.wq.forEach((v,i)=>add(cp.svg,'circle',{cx:cp.x(i+1),cy:cp.y(v),r:3.4,fill:teal}));line(cp,[[0,s.meanWq],[s.R,s.meanWq]],rust);
  if(th.Wq!==null)line(cp,[[0,th.Wq],[s.R,th.Wq]],ink,'6 4');
  const target=th.stable?(s.arrival==='poisson'?'Exact stable '+(s.service==='fixed'?'M/D/1':'M/M/1'):'No exact mean supplied for bursty renewal arrivals'):'No finite stationary mean for this model';
  el('queue-summary').replaceChildren(row('Traffic intensity ρ',fmt(th.rho),th.stable?'Stable modeled queue':'Critical / overloaded modeled queue'),row('Mean queue wait Wq · hours',fmt(s.meanWq),`MCSE ${fmt(s.seWq)}; exact ${fmt(th.Wq)}`),row('Mean time in system W · hours',fmt(s.meanW),`MCSE ${fmt(s.seW)}; exact ${fmt(th.W)}`),row('Stationary mean number waiting Lq',fmt(th.Lq),'Analytical target only; not a finite full-path estimate'),row('Stationary mean number in system L',fmt(th.L),'Analytical target only; includes the job in service'));
  const fullWq=mean(q.waits),fullW=mean(q.system),throughput=q.n/q.horizon;
  el('little-summary').replaceChildren(row('Full cohort / drain horizon H',`${q.n} customers / ${fmt(q.horizon,2)} hours`,'Includes the discarded initialization cohort'),row('Area under Q(t) / sum of all waits',`${fmt(q.areaQ,3)} / ${fmt(q.waits.reduce((a,b)=>a+b,0),3)}`,'Customer-hours; integrates the old state between events'),row('Area under N(t) / sum of all system times',`${fmt(q.areaN,3)} / ${fmt(q.system.reduce((a,b)=>a+b,0),3)}`,'Customer-hours; includes service'),row('Full-path Lq / (n/H) × full mean Wq',`${fmt(q.areaQ/q.horizon)} / ${fmt(throughput*fullWq)}`,'Same customers and same drain horizon'),row('Full-path L / (n/H) × full mean W',`${fmt(q.areaN/q.horizon)} / ${fmt(throughput*fullW)}`,'Exact sample-path identity up to floating-point error'));
  el('queue-status').textContent=`${target}. ${s.R} independent replicas; B=${s.B} discarded, N=${s.N} retained in each, seed ${seed}. Every cohort drains. MCSE describes finite-experiment random error; it does not remove initialization bias. ${!th.stable?'These finite waits are not estimates of stationary means. ':''}Python and JavaScript use different random streams.`;
  drawCapacity(s.lambda,s.service);
 }
 function drawCapacity(lambda,service){const mus=Array.from({length:101},(_,i)=>lambda+.25+i*3.75/100),values=mus.map(mu=>theory(lambda,mu,'poisson',service).Wq),c=chart('capacity-plot',lambda+4,Math.max(...values)*1.05,'Assumed service rate μ (jobs/hour)','Mean queue wait (hours) · Poisson arrivals; μ ≥ λ + 0.25');line(c,mus.map((mu,i)=>[mu,values[i]]),teal);line(c,[[lambda,0],[lambda,Math.max(...values)*1.05]],ink,'6 4');el('capacity-status').textContent=`Poisson-arrival benchmark only; λ=${lambda}/hour, ${service} service. The dashed line marks μ=λ; the curve begins at μ=λ+0.25, not at the singular boundary. This benchmark stays labeled Poisson when bursty arrivals are selected above. Increasing μ speeds up this one server; it does not add another server.`;}
 function drawBike(){const b=bikeAudit(window.COURSE_BIKE_DATA),c=chart('bike-plot',364,Math.max(...b.counts)*1.1,'Observed 2011 date','System-wide completed rentals per day',[{v:0,label:'Jan 1'},{v:120,label:'May 1'},{v:243,label:'Sep 1'},{v:364,label:'Dec 31'}]);line(c,b.counts.map((v,i)=>[i,v]),teal);line(c,[[243,0],[243,Math.max(...b.counts)*1.1]],ink,'6 4');el('bike-summary').replaceChildren(...[['Jan–Aug',b.train],['Sep–Dec',b.later]].map(([label,v])=>row(label,v.days,v.total,fmt(v.mean,2))));drawProxy();}
 function drawProxy(){const b=bikeAudit(window.COURSE_BIKE_DATA),p=+el('referral').value,lambda=proxy(b.train.mean,p,8);el('proxy-summary').replaceChildren(...[3,4].map(mu=>{const th=theory(lambda,mu);return row(`μ = ${mu}/hour`,fmt(lambda),fmt(th.rho),th.stable?`${fmt(th.Wq)} hours`:'No finite stationary mean',th.stable?`${fmt(th.W)} hours`:'No finite stationary mean');}));el('proxy-status').textContent=`Assumed referral fraction p=${p}; eight operating hours/day. λ*=${fmt(lambda,6)} jobs/hour is a scenario conversion of the January–August observed mean, not an estimated arrival process. Both service rates and the Poisson/exponential assumptions are unmeasured. Later observed counts are not queue-delay validation.`;}
 function init(){el('run-queue').addEventListener('click',run);el('referral').addEventListener('change',drawProxy);run();drawBike();}
 return{rng32,expWait,mean,variance,theory,drawInputs,eventQueue,lindley,experiment,bikeAudit,proxy,init};
})();
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',QueueLab.init);
if(typeof module!=='undefined')module.exports=QueueLab;

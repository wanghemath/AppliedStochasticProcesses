/* Module 13: explicit recipes, independent checks, and a deliberately faulty RNG mode. */
'use strict';
const ReproLab = (() => {
  const mean = xs => xs.reduce((a,b) => a+b,0)/xs.length;
  const checksum = 'fb9790e24f07b237431b89c787a24ed8e97c365437a86f7161269df9452b2329';
  function integer(x,lo,hi,label){if(!Number.isInteger(x)||x<lo||x>hi)throw Error(`${label} must be an integer from ${lo} to ${hi}.`);}
  function validateP(P){
    if(!Array.isArray(P)||P.length!==2||P.some(r=>!Array.isArray(r)||r.length!==2||r.some(x=>!Number.isFinite(x)||x<0||x>1)||Math.abs(r[0]+r[1]-1)>1e-12))throw Error('Each transition row must contain two probabilities summing to one.');
    return P;
  }
  function fit(states){
    if(!Array.isArray(states)||states.length<2||states.some(s=>s!==0&&s!==1))throw Error('Supply at least two binary states.');
    const N=[[0,0],[0,0]];for(let t=1;t<states.length;t++)N[states[t-1]][states[t]]++;
    if(N.some(r=>r[0]+r[1]===0))throw Error('An origin state has no observed transitions; its row is not estimable without an explicit assumption.');
    return {N,P:N.map(r=>r.map(n=>n/(r[0]+r[1])))};
  }
  function multiply(A,B){return A.map(r=>B[0].map((_,j)=>r[0]*B[0][j]+r[1]*B[1][j]));}
  function power(P,h){validateP(P);integer(h,0,10000,'Horizon');let Q=[[1,0],[0,1]];for(let i=0;i<h;i++)Q=multiply(Q,P);return Q;}
  function closedHigh(P,h,start){
    validateP(P);integer(h,0,10000,'Horizon');integer(start,0,1,'Initial state');
    const a=P[0][1],b=P[1][0],s=a+b;if(s===0)return start;
    const pi=a/s;return pi+(start-pi)*Math.pow(1-s,h);
  }
  function scenario(P,factor){
    validateP(P);if(!Number.isFinite(factor)||factor<0||factor*P[0][1]>1)throw Error('Scenario factor must give a low-to-high probability in [0,1].');
    const a=factor*P[0][1];return [[1-a,a],P[1].slice()];
  }
  function rng32(seed){integer(seed,0,4294967295,'Seed');let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function simulate(P,{h=7,start=0,N=10000,seed=6231,reseed=false}={}){
    validateP(P);integer(h,0,10000,'Horizon');integer(start,0,1,'Initial state');integer(N,1,100000,'Replications');integer(seed,0,4294967295,'Seed');
    if(typeof reseed!=='boolean')throw Error('Reseed flag must be boolean.');
    let random=rng32(seed);const terminal=[],paths=[],totals=Array(h+1).fill(0);
    for(let r=0;r<N;r++){
      if(reseed)random=rng32(seed); // Deliberate fault: the same stream is copied for every path.
      let s=start;const path=[s];totals[0]+=s;
      for(let t=1;t<=h;t++){s=Number(random()<P[s][1]);totals[t]+=s;if(r<5)path.push(s);}
      terminal.push(s);if(r<5)paths.push(path);
    }
    const estimate=mean(terminal),q=closedHigh(P,h,start);
    return{terminal,paths,frequencies:totals.map(n=>n/N),estimate,mcse:Math.sqrt(estimate*(1-estimate)/N),oracleSE:Math.sqrt(q*(1-q)/N),worstSE:1/(2*Math.sqrt(N))};
  }
  function audit(rows,{threshold=4000,trainEnd=243}={}){
    if(!Array.isArray(rows)||rows.length!==365||rows.some((r,i)=>r.dteday!==new Date(Date.UTC(2011,0,i+1)).toISOString().slice(0,10)||!Number.isInteger(r.cnt)||r.cnt<0))throw Error('Expected 365 consecutive 2011 dates with nonnegative integer completed counts.');
    if(!Number.isFinite(threshold)||threshold<0)throw Error('Threshold must be finite and nonnegative.');integer(trainEnd,2,364,'Training endpoint');
    const states=rows.map(r=>Number(r.cnt>=threshold)),{N,P}=fit(states.slice(0,trainEnd));
    const indices=Array.from({length:rows.length-trainEnd},(_,i)=>i+trainEnd),targets=indices.map(t=>states[t]);
    const forecast=indices.map(t=>P[states[t-1]][1]),baselineForecast=indices.map(t=>states[t-1]);
    return{N,P,states,indices,targets,forecast,baselineForecast,brier:mean(forecast.map((p,i)=>(p-targets[i])**2)),baselineBrier:mean(baselineForecast.map((p,i)=>(p-targets[i])**2))};
  }
  function run(config={},rows){
    const defaults={threshold:4000,trainEnd:243,h:7,start:0,N:10000,seed:6231,factor:1,reseed:false};
    if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!(k in defaults)))throw Error('Use only the declared configuration fields.');
    const cfg={...defaults,...config},data=audit(rows,cfg),P=scenario(data.P,cfg.factor),simulation=simulate(P,cfg),exact=closedHigh(P,cfg.h,cfg.start);
    const recipe={data:'bike_daily_2011.csv',expected_csv_sha256:checksum,checksum_status:'Expected value; browser checks records, notebook verifies raw CSV bytes.',rows:365,units:'completed rentals/day',state_rule:`count >= ${cfg.threshold}`,train_end:rows[cfg.trainEnd-1].dteday,assessment_start:rows[cfg.trainEnd].dteday,assessment_end:rows.at(-1).dteday,origin_policy:'Frozen matrix; previous observed state at each one-day origin',simulation:'Synthetic independent paths conditional on P; reseed=true deliberately breaks independence',rng:'Mulberry32 implementation in assets/module13.js',config:cfg};
    return{config:cfg,audit:data,P,simulation,exact,recipe};
  }
  const el=id=>document.getElementById(id),fmt=(v,n=5)=>Number(v).toFixed(n),teal='#006d77',rust='#a84520',navy='#142e3c';
  function add(svg,tag,attrs,text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;svg.append(n);return n;}
  function chart(id,xmax,ymin,ymax,xlabel,ylabel,ticks,yticks){
    const svg=el(id);svg.replaceChildren();const x=v=>66+v/xmax*698,y=v=>224-(v-ymin)/(ymax-ymin)*188;
    (yticks||[ymin,(ymin+ymax)/2,ymax].map(v=>({v,label:fmt(v,ymax>2?0:2)}))).forEach(t=>{add(svg,'line',{x1:66,x2:764,y1:y(t.v),y2:y(t.v),class:'gridline'});add(svg,'text',{x:55,y:y(t.v)+4,'text-anchor':'end'},t.label);});
    (ticks||[0,xmax/2,xmax].map(v=>({v,label:String(v)}))).forEach(t=>add(svg,'text',{x:x(t.v),y:247,'text-anchor':'middle'},t.label));
    add(svg,'text',{x:66,y:17},ylabel);add(svg,'text',{x:764,y:273,'text-anchor':'end'},xlabel);return{svg,x,y};
  }
  function line(c,points,color,dash='',width=2){add(c.svg,'polyline',{points:points.map(([x,y])=>`${c.x(x)},${c.y(y)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash});}
  function row(label,...values){const tr=document.createElement('tr');[label,...values].forEach((v,i)=>{const n=document.createElement(i?'td':'th');if(!i)n.scope='row';n.textContent=v;tr.append(n);});return tr;}
  function drawObserved(rows,d){
    const c=chart('audit-data',364,0,6500,'Date in 2011','Observed completed rentals/day',[{v:0,label:'Jan 1'},{v:120,label:'May 1'},{v:243,label:'Sep 1'},{v:364,label:'Dec 31'}]);
    add(c.svg,'rect',{x:c.x(243),y:29,width:c.x(364)-c.x(243),height:195,fill:'#f0d8c6',opacity:.4});line(c,rows.map((r,i)=>[i,r.cnt]),navy,'',1.3);line(c,[[0,4000],[364,4000]],rust,'5 4');line(c,[[242,0],[242,6500]],teal,'4 4');
    el('fit-table').replaceChildren(...d.N.map((r,i)=>row(`From ${i}`,r[0],r[1],fmt(d.P[i][0]),fmt(d.P[i][1]))));
    const f=chart('audit-forecast',121,-.05,1.05,'One-day target in 2011','Probability / observed binary state',[{v:0,label:'Sep 1'},{v:30,label:'Oct 1'},{v:61,label:'Nov 1'},{v:91,label:'Dec 1'},{v:121,label:'Dec 31'}],[{v:0,label:'0'},{v:.5,label:'0.5'},{v:1,label:'1'}]);
    line(f,d.forecast.map((p,i)=>[i,p]),teal);d.targets.forEach((y,i)=>add(f.svg,'circle',{cx:f.x(i),cy:f.y(y),r:2.3,fill:rust,opacity:.6}));
    el('validation-table').replaceChildren(row('Frozen Markov probabilities',122,fmt(d.brier,8)),row('Persistence probabilities',122,fmt(d.baselineBrier,8)));
  }
  function update(){
    const seed=el('audit-seed');if(seed.value===''||!seed.checkValidity()){el('run-status').textContent='Enter an integer seed between 0 and 4,294,967,295.';seed.reportValidity();return;}
    const cfg={h:+el('audit-horizon').value,start:+el('audit-start').value,N:+el('audit-reps').value,seed:+seed.value,factor:+el('audit-factor').value,reseed:el('audit-mode').value==='reseed'};
    const r=run(cfg,window.COURSE_BIKE_DATA),s=r.simulation;
    const c=chart('audit-probability',cfg.h,0,1,'Transitions since the declared initial state','Synthetic state-1 frequencies versus exact probability',Array.from({length:cfg.h+1},(_,v)=>({v,label:String(v)})));
    line(c,Array.from({length:cfg.h+1},(_,h)=>[h,closedHigh(r.P,h,cfg.start)]),navy,'6 4',2.4);line(c,s.frequencies.map((p,h)=>[h,p]),cfg.reseed?rust:teal);
    const p=chart('audit-paths',cfg.h,-.15,5,'Transition count','First five synthetic paths, vertically separated',[{v:0,label:'0'},{v:cfg.h,label:String(cfg.h)}],Array.from({length:5},(_,i)=>({v:4-i+.32,label:`Path ${i+1}`})));
    s.paths.forEach((a,i)=>{const points=[];a.forEach((v,t)=>{if(t)points.push([t,4-i+.65*a[t-1]]);points.push([t,4-i+.65*v]);});line(p,points,i%2?rust:teal,'',1.8);});
    el('run-summary').replaceChildren(row('Exact terminal probability',fmt(r.exact,8),Math.abs(power(r.P,cfg.h)[cfg.start][1]-r.exact)<1e-12?'Matrix powers and closed form agree':'CHECK FAILED: analytical routes disagree'),row('Simulated terminal fraction',fmt(s.estimate,8),cfg.reseed?'Invalid iid experiment: copies of one path':'Independent paths within the stated simulation'),row('Plug-in iid MCSE',fmt(s.mcse,6),cfg.reseed?'INVALID: iid formula does not apply':'Estimated Monte Carlo error, conditional on fitted P'),row('Oracle iid SE',fmt(s.oracleSE,6),cfg.reseed?'Reference for a correctly independent run only':'Uses the exact probability for this model'),row('Maximum iid SE',fmt(s.worstSE,6),'1 / (2√N), not a bound on realized error'));
    el('run-status').textContent=cfg.reseed?`DELIBERATE FAULT: resetting seed ${cfg.seed} before every path repeats the same path ${cfg.N} times. Reproducible output is not independent evidence. The iid MCSE is invalid, even when it displays zero.`:`Seed ${cfg.seed} · ${cfg.N.toLocaleString()} independent paths · ${cfg.h} transitions from state ${cfg.start} · scenario factor ${cfg.factor}. Exact probability does not depend on the seed. Monte Carlo error ${fmt(s.estimate-r.exact,6)}; more draws reduce computation error, not model or parameter uncertainty.`;
    el('run-recipe').textContent=JSON.stringify(r.recipe,null,2);
    el('scenario-table').replaceChildren(...[.5,1,1.5].map(f=>row(`a × ${f}`,fmt(scenario(r.audit.P,f)[0][1]),fmt(closedHigh(scenario(r.audit.P,f),7,0),8),f===1?'Fitted reference':'Unmeasured sensitivity assumption')));
    const sc=chart('audit-scenarios',4,0,1,'Multiplier on fitted low-to-high probability','Exact probability after 7 transitions from state 0',[{v:1,label:'0.5'},{v:2,label:'1'},{v:3,label:'1.5'}]);
    [.5,1,1.5].forEach((f,i)=>{const q=closedHigh(scenario(r.audit.P,f),7,0),xx=i+1;add(sc.svg,'rect',{x:sc.x(xx)-45,y:sc.y(q),width:90,height:sc.y(0)-sc.y(q),fill:f===1?teal:'#94afb1'});add(sc.svg,'text',{x:sc.x(xx),y:sc.y(q)-10,'text-anchor':'middle'},fmt(q,4));});
    const b=chart('audit-budget',100,0,.055,'Independent paths N (log scale)','Known worst-case Bernoulli Monte Carlo SE',[{v:0,label:'100'},{v:50,label:'1,000'},{v:100,label:'10,000'}],[{v:0,label:'0.000'},{v:.025,label:'0.025'},{v:.05,label:'0.050'}]);
    const points=Array.from({length:101},(_,v)=>[v,1/(2*Math.sqrt(100*Math.pow(10,v/50)))]);line(b,points,teal);[100,1000,10000].forEach((n,i)=>add(b.svg,'circle',{cx:b.x(i*50),cy:b.y(1/(2*Math.sqrt(n))),r:4,fill:navy}));
    el('budget-summary').replaceChildren(...[100,1000,10000].map(n=>row(n.toLocaleString(),fmt(1/(2*Math.sqrt(n)),4),'Conditional on independent paths; not model uncertainty')));
    drawDiagnostics(r);
  }
  function drawDiagnostics(r){
    const N=r.audit.N,cols=[N[0][0]+N[1][0],N[0][1]+N[1][1]],bad=N.map(row=>row.map((n,j)=>n/cols[j]));
    const sums=bad.map(row=>mean(row)*2);
    const rowOK=r.audit.P.every(a=>Math.abs(a[0]+a[1]-1)<1e-12),badOK=sums.every(v=>Math.abs(v-1)<1e-12),fixture=power([[.8,.2],[.3,.7]],2)[0][1],ph=power(r.audit.P,7)[0][1];
    el('verification-table').replaceChildren(row('Fitted rows sum to 1',rowOK?'PASS':'FAIL',r.audit.P.map(a=>fmt(a[0]+a[1],6)).join(' / ')),row('Column-normalized candidate rows sum to 1',badOK?'PASSES THIS CHECK ONLY':'EXPECTED FAIL',sums.map(v=>fmt(v,6)).join(' / ')),row('Hand fixture: P²[0,1] = .3',Math.abs(fixture-.3)<1e-12?'PASS':'FAIL',fmt(fixture,8)),row('Closed form matches fitted P⁷[0,1]',Math.abs(ph-closedHigh(r.audit.P,7,0))<1e-12?'PASS':'FAIL',fmt(ph,8)),row('Simulation uses one advancing stream',r.config.reseed?'FAIL':'PASS',r.config.reseed?'Same seed reset inside each path':'Seed initialized once per complete run'),row('Evidence of real capacity or causal effect','NOT ESTABLISHED','Daily completed totals do not measure these outcomes'));
  }
  function init(){
    document.querySelectorAll('.module13 .katex-display').forEach(e=>{e.tabIndex=0;e.setAttribute('role','region');e.setAttribute('aria-label','Scrollable equation');});
    const data=audit(window.COURSE_BIKE_DATA);drawObserved(window.COURSE_BIKE_DATA,data);
    el('run-audit').addEventListener('click',update);['audit-horizon','audit-start','audit-reps','audit-factor','audit-mode'].forEach(id=>el(id).addEventListener('change',update));update();
  }
  return{validateP,fit,power,closedHigh,scenario,rng32,simulate,audit,run,init};
})();
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',ReproLab.init);
if(typeof module!=='undefined')module.exports=ReproLab;

/* Module 14: communicate existing evidence; no new process model or simulation. */
'use strict';
const PresentationLab = (() => {
  const labels=['Question & units','Data & assumptions','Model & check','Evidence & baseline','Scenarios & uncertainty','Recommendation & limits'];
  const defaults=[45,45,75,75,60,60];
  const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
  function integer(x,lo,hi,name){if(!Number.isSafeInteger(x)||x<lo||x>hi)throw Error(`${name} must be an integer from ${lo} to ${hi}.`);}
  function probability(p){if(!Number.isFinite(p)||p<0||p>1)throw Error('Probability or Brier loss must be in [0,1].');}
  function validateP(P){
    if(!Array.isArray(P)||P.length!==2||P.some(r=>!Array.isArray(r)||r.length!==2||r.some(x=>!Number.isFinite(x)||x<0||x>1)||Math.abs(r[0]+r[1]-1)>1e-12))throw Error('Each transition row must contain two probabilities summing to one.');
    return P;
  }
  function brier(y,p){
    if(!Array.isArray(y)||!Array.isArray(p)||!y.length||y.length!==p.length||y.some(v=>v!==0&&v!==1))throw Error('Use matching nonempty binary targets and probabilities.');
    p.forEach(probability);return mean(p.map((q,i)=>(q-y[i])**2));
  }
  function improvement(modelLoss,baselineLoss){probability(modelLoss);probability(baselineLoss);const absolute=baselineLoss-modelLoss;return {absolute,relativePercent:baselineLoss===0?null:100*absolute/baselineLoss};}
  function analyze(rows,{threshold=4000,trainEnd=243}={}){
    if(!Array.isArray(rows)||rows.length!==365||rows.some((r,i)=>!r||r.dteday!==new Date(Date.UTC(2011,0,i+1)).toISOString().slice(0,10)||!Number.isSafeInteger(r.cnt)||r.cnt<0))throw Error('Expected 365 consecutive 2011 dates with nonnegative integer completed counts.');
    if(!Number.isFinite(threshold)||threshold<0)throw Error('Threshold must be finite and nonnegative.');integer(trainEnd,2,364,'Training endpoint');
    const states=rows.map(r=>Number(r.cnt>=threshold)),N=[[0,0],[0,0]];
    for(let t=1;t<trainEnd;t++)N[states[t-1]][states[t]]++;
    if(N.some(r=>r[0]+r[1]===0))throw Error('Both origin states need observed training transitions.');
    const P=N.map(r=>r.map(v=>v/(r[0]+r[1]))),indices=Array.from({length:rows.length-trainEnd},(_,i)=>i+trainEnd);
    const targets=indices.map(t=>states[t]),forecast=indices.map(t=>P[states[t-1]][1]),baselineForecast=indices.map(t=>states[t-1]);
    const loss=brier(targets,forecast),baselineBrier=brier(targets,baselineForecast),delta=improvement(loss,baselineBrier);
    return {N,P,states,indices,targets,forecast,baselineForecast,brier:loss,baselineBrier,absoluteReduction:delta.absolute,relativePercent:delta.relativePercent,pairedDifference:targets.map((y,i)=>(baselineForecast[i]-y)**2-(forecast[i]-y)**2)};
  }
  function multiply(A,B){return A.map(r=>B[0].map((_,j)=>r[0]*B[0][j]+r[1]*B[1][j]));}
  function power(P,h){
    validateP(P);integer(h,0,Number.MAX_SAFE_INTEGER,'Horizon');let Q=[[1,0],[0,1]],A=P.map(r=>r.slice()),n=h;
    while(n>0){if(n%2===1)Q=multiply(Q,A);n=Math.floor(n/2);if(n>0)A=multiply(A,A);}return Q;
  }
  function scenario(P,factor,{h=7,start=0}={}){
    validateP(P);integer(start,0,1,'Initial state');
    if(!Number.isFinite(factor)||factor<0||factor*P[0][1]>1)throw Error('The scenario must give a low-to-high probability in [0,1]; no clipping.');
    const a=P[0][1]*factor,Q=[[1-a,a],P[1].slice()],reference=power(P,h)[start][1],p=power(Q,h)[start][1];
    return {P:Q,probability:p,reference,percentagePoints:100*(p-reference)};
  }
  function precision(p,N){probability(p);integer(N,1,Number.MAX_SAFE_INTEGER,'Replications');return {oracleSE:Math.sqrt(p*(1-p)/N),maxSE:1/(2*Math.sqrt(N))};}
  function trace(rows,target,config={}){
    const a=analyze(rows,config);integer(target,config.trainEnd??243,364,'Assessment target');
    const previous=target-1,state=a.states[target],previousState=a.states[previous],p=a.P[previousState][1];
    return {target,previous,date:rows[target].dteday,previousDate:rows[previous].dteday,count:rows[target].cnt,previousCount:rows[previous].cnt,state,previousState,probability:p,baselineProbability:previousState,loss:(p-state)**2,baselineLoss:(previousState-state)**2};
  }
  function budget(seconds=defaults){
    if(!Array.isArray(seconds)||seconds.length!==6)throw Error('Supply exactly six section durations.');seconds.forEach(s=>integer(s,0,360,'Section duration'));
    let total=0;const segments=seconds.map((s,i)=>{const start=total;total+=s;return {label:labels[i],seconds:s,start,end:total};});
    return {total,remaining:Math.max(0,360-total),over:Math.max(0,total-360),segments};
  }
  const el=id=>document.getElementById(id),fmt=(x,n=5)=>x.toFixed(n),teal='#006d77',rust='#a84520',navy='#142e3c';
  function add(svg,tag,attrs,text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));if(text!==undefined)node.textContent=text;svg.append(node);return node;}
  function chart(id,xmax,ymax,xlabel,ylabel,xticks,yticks){
    const svg=el(id);svg.replaceChildren();const x=v=>72+v/xmax*686,y=v=>222-v/ymax*180;
    yticks.forEach(v=>{add(svg,'line',{x1:72,x2:758,y1:y(v),y2:y(v),class:'gridline'});add(svg,'text',{x:62,y:y(v)+4,'text-anchor':'end'},v);});
    xticks.forEach(([v,s])=>add(svg,'text',{x:x(v),y:240,'text-anchor':'middle'},s));
    add(svg,'line',{x1:72,x2:758,y1:222,y2:222,class:'axis'});add(svg,'text',{x:415,y:270,'text-anchor':'middle'},xlabel);add(svg,'text',{x:72,y:22},ylabel);
    return {svg,x,y};
  }
  function path(c,values,color,dash){add(c.svg,'path',{d:values.map(([a,b],i)=>`${i?'L':'M'}${c.x(a)},${c.y(b)}`).join(' '),fill:'none',stroke:color,'stroke-width':1.5,...(dash?{'stroke-dasharray':dash}:{})});}
  function drawEvidence(rows,a){
    const c=chart('timeline-plot',364,9000,'2011 calendar date','Completed system rentals / day',[[0,'Jan 1'],[120,'May 1'],[242,'Aug 31'],[364,'Dec 31']],[0,2000,4000,6000,8000]);
    add(c.svg,'rect',{x:c.x(243),y:42,width:c.x(364)-c.x(243),height:180,fill:'#edf4f0'});
    path(c,rows.map((r,i)=>[i,r.cnt]),navy);path(c,[[0,4000],[364,4000]],rust,'5 4');path(c,[[242.5,0],[242.5,9000]],teal,'4 4');
    add(c.svg,'text',{x:c.x(70),y:56},'Fit: Jan–Aug');add(c.svg,'text',{x:c.x(270),y:56},'Reused assessment');
    const s=chart('score-plot',2,.3,'Same 122 September–December targets','Mean Brier loss · lower is better',[[.5,'Frozen Markov chain'],[1.5,'Persistence']],[0,.1,.2,.3]);
    [a.brier,a.baselineBrier].forEach((v,i)=>{add(s.svg,'rect',{x:s.x(i+.22),y:s.y(v),width:s.x(.56)-s.x(0),height:s.y(0)-s.y(v),fill:i?rust:teal});add(s.svg,'text',{x:s.x(i+.5),y:s.y(v)-9,'text-anchor':'middle'},fmt(v,5));});
    const f=chart('forecast-plot',121,1,'2011 one-day target date','High-state probability / observed state',[[0,'Sep 1'],[30,'Oct 1'],[61,'Nov 1'],[91,'Dec 1'],[121,'Dec 31']],[0,.25,.5,.75,1]);
    path(f,a.forecast.map((p,i)=>[i,p]),teal);
    a.targets.forEach((v,i)=>add(f.svg,'circle',{cx:f.x(i),cy:f.y(v),r:2.4,fill:navy}));
    el('chain-score').textContent=fmt(a.brier,5);el('baseline-score').textContent=fmt(a.baselineBrier,5);el('loss-reduction').textContent=fmt(a.relativePercent,2)+'%';
    el('score-caption').textContent=`For these ${a.targets.length} reused 2011 one-day targets, the frozen chain's mean Brier loss is ${fmt(a.brier,5)}, versus ${fmt(a.baselineBrier,5)} for persistence: an absolute reduction of ${fmt(a.absoluteReduction,5)}, or ${fmt(a.relativePercent,2)}% relative to persistence. Both use the previous observed state; the chain was fitted on January–August only. This is a descriptive loss comparison, not an accuracy, causal, shortage, or future-performance claim.`;
    el('fit-rows').innerHTML=a.N.map((r,i)=>`<tr><th scope="row">${i}</th><td>${r[0]}</td><td>${r[1]}</td><td>${fmt(a.P[i][0])}</td><td>${fmt(a.P[i][1])}</td></tr>`).join('');
  }
  function drawTrace(rows){
    const t=trace(rows,Number(el('trace-target').value));
    el('trace-summary').textContent=`${t.previousDate}: ${t.previousCount} completed rentals → state ${t.previousState} → frozen forecast ${fmt(t.probability)} for ${t.date}. After observing ${t.count} rentals, the target state is ${t.state}; chain loss = (${fmt(t.probability)} − ${t.state})² = ${fmt(t.loss)}. Persistence forecast = ${t.baselineProbability}, loss = ${t.baselineLoss}.`;
  }
  function drawScenario(a){
    const factor=Number(el('scenario-factor').value),N=Number(el('precision-n').value),r=scenario(a.P,factor),se=precision(r.probability,N);
    const c=chart('scenario-plot',3,1,'Multiplier on low-to-high transition probability a','Exact Pr(high after 7 days | low now)',[[.5,'0.5 × a'],[1.5,'1.0 × a'],[2.5,'1.5 × a']],[0,.25,.5,.75,1]);
    [.5,1,1.5].forEach((v,i)=>{const p=scenario(a.P,v).probability;add(c.svg,'rect',{x:c.x(i+.2),y:c.y(p),width:c.x(.6)-c.x(0),height:c.y(0)-c.y(p),fill:v===factor?teal:'#c6d9d5',stroke:navy,'stroke-width':v===factor?2:0});add(c.svg,'text',{x:c.x(i+.5),y:c.y(p)-10,'text-anchor':'middle'},fmt(p,4));});
    el('scenario-summary').textContent=`At factor ${factor.toFixed(1)}, exact probability = ${fmt(r.probability)} (${fmt(100*r.probability,2)}%), versus ${fmt(r.reference)} at factor 1: ${r.percentagePoints>=0?'+':''}${fmt(r.percentagePoints,2)} percentage points. The high-to-low probability stays fixed. These are conditional assumptions, not observed interventions.`;
    el('precision-summary').textContent=`If ${N.toLocaleString()} independent paths were simulated under this fixed matrix, the exact-model standard error of the simulated fraction would be ${fmt(se.oracleSE)} (${fmt(100*se.oracleSE,3)} percentage points), bounded by ${fmt(se.maxSE)}. This is a calculated precision reference; this module does not generate those paths. It excludes parameter, data, and model uncertainty.`;
  }
  function drawBudget(){
    try{
      const seconds=defaults.map((_,i)=>{const v=el('talk-'+i).value;return v.trim()===''?NaN:Number(v);}),b=budget(seconds);
      const c=chart('budget-plot',Math.max(360,b.total),6,'Cumulative speaking time / seconds','Suggested story sections',[[0,'0'],[180,'180'],[360,'360']],[]);
      const colors=[teal,navy,'#597f66',rust,'#77529b','#507d99'];
      b.segments.forEach((s,i)=>{add(c.svg,'rect',{x:c.x(s.start),y:50+i*26,width:c.x(s.end)-c.x(s.start),height:18,fill:colors[i]});add(c.svg,'text',{x:65,y:64+i*26,'text-anchor':'end'},i+1);});
      add(c.svg,'line',{x1:c.x(360),x2:c.x(360),y1:42,y2:214,stroke:rust,'stroke-dasharray':'5 4'});
      el('budget-status').classList.remove('error');el('budget-status').textContent=`Total ${b.total} seconds (${fmt(b.total/60,2)} minutes). ${b.over?`${b.over} seconds over the six-minute talk budget.`:b.remaining?`${b.remaining} seconds available for speaking.`:'Exactly six minutes allocated.'} Questions follow the talk. Timing alone does not assess explanation quality.`;
    }catch(e){el('budget-plot').replaceChildren();el('budget-status').classList.add('error');el('budget-status').textContent=e.message;}
  }
  const prompts=[
    'Define qₜ = P[Sₜ₋₁, 1]. What information is available when this one-day probability is issued? Trace the selected date, then explain why using its observed count to construct qₜ would leak the outcome.',
    'Explain (q − y)² and its average. Hand-check q = 0.30 with y = 1. Why can a method win on mean Brier loss but lose on an individual date? Explain the zero-baseline boundary for relative loss reduction.',
    'Explain μ₀P⁷ and the low-to-high scenario factor. Before running, predict what can and cannot be concluded when the factor rises. Name the fixed quantities and distinguish a conditional contrast from an intervention.',
    'Explain √[p(1−p)/N] for independent simulated terminal states under a fixed model. What happens when N quadruples? Name two uncertainties that this calculation leaves out.'
  ];
  function init(){
    if(!el('score-plot'))return;
    document.querySelectorAll('.module14 .katex-display').forEach(e=>{e.tabIndex=0;e.setAttribute('role','region');e.setAttribute('aria-label','Scrollable equation');});
    try{
      const rows=window.COURSE_BIKE_DATA,a=analyze(rows);drawEvidence(rows,a);drawTrace(rows);drawScenario(a);drawBudget();
      el('trace-target').addEventListener('change',()=>drawTrace(rows));
      ['scenario-factor','precision-n'].forEach(id=>el(id).addEventListener('change',()=>drawScenario(a)));
      defaults.forEach((_,i)=>el('talk-'+i).addEventListener('input',drawBudget));
      el('reset-budget').addEventListener('click',()=>{defaults.forEach((s,i)=>el('talk-'+i).value=s);drawBudget();});
      const prompt=()=>el('explanation-prompt').textContent=prompts[Number(el('explanation-choice').value)];prompt();el('explanation-choice').addEventListener('change',prompt);
      el('data-status').textContent='Loaded 365 ordered daily records. Fitted 242 January–August transitions; scored 122 reused September–December targets. The notebook also verifies the raw CSV checksum.';
    }catch(e){el('data-status').textContent=e.message;el('data-status').classList.add('error');}
  }
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);
  return {analyze,brier,improvement,power,scenario,precision,trace,budget,validateP};
})();
if(typeof module!=='undefined')module.exports=PresentationLab;

/* Two-state Markov-chain teaching lab. Row convention, local data, no network. */
'use strict';
const MarkovLab=(()=>{
  const NS='http://www.w3.org/2000/svg';
  function rng32(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function validate(P){
    if(!Array.isArray(P)||P.length!==2||P.some(r=>!Array.isArray(r)||r.length!==2||r.some(v=>!Number.isFinite(v)||v<0||v>1)||Math.abs(r[0]+r[1]-1)>1e-10))throw Error('P must have two nonnegative rows, each summing to one.');
    return P;
  }
  function multiply(A,B){return A.map(r=>B[0].map((_,j)=>r[0]*B[0][j]+r[1]*B[1][j]));}
  function power(P,h){validate(P);if(!Number.isInteger(h)||h<0)throw Error('Horizon must be a nonnegative integer.');let ans=[[1,0],[0,1]];for(let t=0;t<h;t++)ans=multiply(ans,P);return ans;}
  function simulate(P,initial,h,R,seed){
    validate(P);if(![0,1].includes(initial)||!Number.isInteger(h)||h<0||!Number.isInteger(R)||R<2)throw Error('Invalid simulation inputs.');
    const random=rng32(seed),frequencies=Array(h+1).fill(0),paths=[],endpoints=[];
    for(let r=0;r<R;r++){let state=initial;frequencies[0]+=state;const path=[state];for(let t=1;t<=h;t++){state=Number(random()<P[state][1]);frequencies[t]+=state;if(r<5)path.push(state);}if(r<5)paths.push(path);endpoints.push(state);}
    return{frequencies:frequencies.map(v=>v/R),paths,endpoints};
  }
  function estimate(states,eta=0){
    if(!Number.isFinite(eta)||eta<0||states.length<1||states.some(y=>y!==0&&y!==1))throw Error('Invalid states or pseudocount.');
    const N=[[0,0],[0,0]];for(let t=0;t<states.length-1;t++)N[states[t]][states[t+1]]++;
    const support=N.map(r=>r[0]+r[1]);
    const rowProbs=N.map((r,i)=>support[i]+2*eta===0?null:r.map(v=>(v+eta)/(support[i]+2*eta)));
    return{N,support,rowProbs,P:rowProbs.some(r=>r===null)?null:rowProbs};
  }
  function analyze(rows,threshold=4000,eta=0,h=1){
    if(!Number.isInteger(h)||h<1)throw Error('Validation horizon must be positive.');
    const states=rows.map(d=>Number(d.cnt>threshold));
    const split=rows.findIndex(d=>d.dteday>='2011-09-01');if(split<2)throw Error('Missing training dates.');
    const training=states.slice(0,split),fit=estimate(training,eta),p=training.reduce((a,b)=>a+b,0)/training.length;
    const forecasts=[];const Ph=fit.P?power(fit.P,h):null;
    for(let origin=split-1;origin+h<rows.length;origin++){
      const target=origin+h,y=states[target];forecasts.push({origin,target,y,state:states[origin],q:Ph?Ph[states[origin]][1]:null,iid:p,persistence:states[origin]});
    }
    const score=field=>forecasts.reduce((sum,r)=>sum+(r[field]-r.y)**2,0)/forecasts.length;
    return{...fit,states,split,p,forecasts,Ph,h,markov:fit.P?score('q'):null,iid:score('iid'),persistence:score('persistence')};
  }
  function add(parent,tag,attrs,text){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!==undefined)e.textContent=text;parent.appendChild(e);return e;}
  function chart(id,{width=800,height=280,xmax=7,ymax=1,xlabel='Steps after the starting day',ylabel='Probability of state 1',xticks=null,yticks=[0,.25,.5,.75,1]}={}){
    const svg=document.getElementById(id);svg.replaceChildren();const m={l:51,r:22,t:29,b:46},w=width-m.l-m.r,h=height-m.t-m.b;
    const x=v=>m.l+w*v/Math.max(1,xmax),y=v=>height-m.b-h*v/ymax;
    yticks.forEach(v=>{add(svg,'line',{x1:m.l,x2:width-m.r,y1:y(v),y2:y(v),class:'gridline'});add(svg,'text',{x:m.l-9,y:y(v)+4,'text-anchor':'end',class:'tick'},v.toFixed(v===0||v===1?0:2));});
    const ticks=xticks||[...new Set([0,Math.round(xmax/2),xmax])].map(t=>({value:t,label:String(t)}));
    ticks.forEach(t=>add(svg,'text',{x:x(t.value),y:height-24,'text-anchor':'middle',class:'tick'},t.label));
    add(svg,'text',{x:m.l,y:15},ylabel);add(svg,'text',{x:width-m.r,y:height-4,'text-anchor':'end'},xlabel);
    return{svg,x,y,m,w,h};
  }
  function line(c,values,color,dash='',width=2){add(c.svg,'polyline',{points:values.map(([x,y])=>`${c.x(x)},${c.y(y)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash});}
  const fmt=(v,d=4)=>Number(v).toFixed(d);
  function row(label,...values){const tr=document.createElement('tr');[label,...values].forEach((v,i)=>{const e=document.createElement(i?'td':'th');if(!i)e.scope='row';e.textContent=v;tr.appendChild(e);});return tr;}
  function renderMatrix(id,P,decimals=4){document.getElementById(id).replaceChildren(...[0,1].map(i=>row(`From ${i}`,P[i]===null?'Undefined':fmt(P[i][0],decimals),P[i]===null?'Undefined':fmt(P[i][1],decimals))));}
  function drawStates(paths,h){
    const c=chart('markov-paths',{xmax:h,height:245,ymax:5.8,xlabel:'Transition count (time 0 is initial state)',ylabel:'Five synthetic paths · 0 below / 1 above',yticks:[]});
    paths.forEach((path,k)=>{
      const base=4.7-k;
      add(c.svg,'text',{x:10,y:c.y(base+.3)+3,class:'tick'},`Path ${k+1}`);
      const points=[];path.forEach((state,t)=>{if(t>0)points.push([t,base+path[t-1]*.55]);points.push([t,base+state*.55]);});
      line(c,points,k%2?'#a84520':'#006d77','',1.7);
      path.forEach((state,t)=>add(c.svg,'circle',{cx:c.x(t),cy:c.y(base+state*.55),r:h>10?1.7:3,fill:state?'#006d77':'#a84520'}));
    });
  }
  function run(){
    const seed=document.getElementById('markov-seed');if(!seed.checkValidity()||seed.value===''){document.getElementById('markov-status').textContent='Enter an integer seed between 0 and 4,294,967,295.';seed.reportValidity();return;}
    const a=Number(document.getElementById('p01').value),b=Number(document.getElementById('p10').value),initial=Number(document.getElementById('initial-state').value),h=Number(document.getElementById('markov-horizon').value),R=Number(document.getElementById('markov-reps').value),P=[[1-a,a],[b,1-b]];
    const sim=simulate(P,initial,h,R,Number(seed.value)),exact=Array.from({length:h+1},(_,t)=>power(P,t)[initial][1]);
    renderMatrix('scenario-matrix',P);renderMatrix('power-matrix',power(P,h));
    document.getElementById('power-caption').textContent=`P to matrix power ${h}; rows = starting state, columns = destination state`;
    const c=chart('markov-probability',{xmax:h});line(c,exact.map((v,t)=>[t,v]),'#142e3c','6 4',2.5);line(c,sim.frequencies.map((v,t)=>[t,v]),'#006d77','',1.7);
    exact.forEach((v,t)=>add(c.svg,'circle',{cx:c.x(t),cy:c.y(v),r:2,fill:'#142e3c'}));
    sim.frequencies.forEach((v,t)=>add(c.svg,'circle',{cx:c.x(t),cy:c.y(v),r:2.3,fill:'#006d77'}));
    drawStates(sim.paths,h);
    const q=exact[h],observed=sim.frequencies[h],mcse=Math.sqrt(q*(1-q)/R);
    document.getElementById('exact-q').textContent=fmt(q);document.getElementById('sim-q').textContent=fmt(observed);document.getElementById('endpoint-mcse').textContent=fmt(mcse,5);
    document.getElementById('markov-summary').replaceChildren(row('Endpoint probability of state 1',fmt(observed),fmt(q)),row('Endpoint probability of state 0',fmt(1-observed),fmt(1-q)),row('Time-zero state',String(initial),String(initial)));
    document.getElementById('markov-status').textContent=`Seed ${seed.value} · ${R.toLocaleString()} independent paths · ${h} transitions from state ${initial}. ${mcse===0?'Endpoint is deterministic; simulation agrees exactly.':`Probability error ${fmt(observed-q)} (${fmt((observed-q)/mcse,2)} Monte Carlo SE).`} Within-path independence depends on the matrix.`;
  }
  let fitted=null;
  function updateData(){
    const rows=window.COURSE_BIKE_DATA;if(!Array.isArray(rows)||rows.length!==365){document.getElementById('estimation-status').textContent='Missing local bike-sharing data. Keep the data folder with the lesson.';return;}
    const threshold=Number(document.getElementById('chain-threshold').value),eta=Number(document.getElementById('pseudocount').value),h=Number(document.getElementById('forecast-horizon').value),d=analyze(rows,threshold,eta,h);fitted=d;
    renderMatrix('transition-counts',d.N,0);renderMatrix('fitted-matrix',d.rowProbs);
    document.getElementById('row-support').textContent=`Observed origin counts: state 0 → ${d.support[0]}; state 1 → ${d.support[1]}. Total: ${d.support.reduce((a,b)=>a+b)} within-training pairs. Pseudocount per cell: ${eta}.`;
    document.getElementById('load-fitted').disabled=!d.P;
    const scoreBody=document.getElementById('score-table');scoreBody.replaceChildren();
    if(!d.P){
      document.getElementById('estimation-status').textContent='Unobserved origin state: the unsmoothed transition row is undefined. No Markov forecast is reported. Choosing a positive pseudocount supplies an explicit assumption, not observed transitions.';
      for(const id of ['heldout-forecast','heldout-comparison']){const svg=document.getElementById(id);svg.replaceChildren();add(svg,'text',{x:30,y:80},'Forecast unavailable: at least one transition row is undefined.');}
      scoreBody.appendChild(row('Unavailable','—','—','—','—'));document.getElementById('forecast-dates').textContent='Restore a supported threshold or explicitly choose smoothing.';document.getElementById('fixed-origin-summary').textContent='No complete matrix: fixed-origin comparison is not displayed.';return;
    }
    for(const k of [1,7,30]){const a=analyze(rows,threshold,eta,k);scoreBody.appendChild(row(`${k} day${k>1?'s':''}`,String(a.forecasts.length),fmt(a.markov),fmt(a.iid),fmt(a.persistence)));}
    const first=d.forecasts[0],last=d.forecasts[d.forecasts.length-1];
    document.getElementById('forecast-dates').textContent=`Selected horizon ${h} day${h>1?'s':''}: ${d.forecasts.length} forecasts. Origins ${rows[first.origin].dteday}–${rows[last.origin].dteday}; targets ${rows[first.target].dteday}–${rows[last.target].dteday}. Latest observed state at each origin is used; intermediate future states are not.`;
    const ticks=[0,Math.floor((d.forecasts.length-1)/2),d.forecasts.length-1].map(i=>({value:i,label:rows[d.forecasts[i].target].dteday.slice(5)}));
    const c=chart('heldout-forecast',{xmax:d.forecasts.length-1,xlabel:'2011 target date (month-day)',ylabel:`${h}-day-ahead state-1 probability / observed outcome`,xticks:ticks});
    line(c,d.forecasts.map((r,i)=>[i,r.q]),'#006d77','',2);line(c,[[0,d.p],[d.forecasts.length-1,d.p]],'#142e3c','6 4',1.8);
    d.forecasts.forEach((r,i)=>add(c.svg,'circle',{cx:c.x(i),cy:c.y(r.y),r:2.4,fill:'#a84520',opacity:.65}));
    const future=rows.slice(d.split),initial=d.states[d.split-1];
    const fixedTicks=[0,60,121].map(i=>({value:i,label:future[i].dteday.slice(5)}));
    const comp=chart('heldout-comparison',{xmax:future.length-1,xlabel:'2011 target date (month-day)',ylabel:'From August 31: running fraction / average probability',xticks:fixedTicks});
    let obs=0,pred=0,syn=0,state=initial,q=initial;const random=rng32(6231),observed=[],expected=[],sim=[];
    future.forEach((r,i)=>{
      state=Number(random()<d.P[state][1]);q=(1-q)*d.P[0][1]+q*d.P[1][1];
      obs+=d.states[d.split+i];pred+=q;syn+=state;
      observed.push([i,obs/(i+1)]);expected.push([i,pred/(i+1)]);sim.push([i,syn/(i+1)]);
    });
    line(comp,expected,'#142e3c','6 4',2);line(comp,sim,'#a84520','3 2',1.7);line(comp,observed,'#006d77','',2.2);
    document.getElementById('fixed-origin-summary').textContent=`Over ${future.length} future days: observed fraction ${fmt(obs/future.length)}, one synthetic path fraction ${fmt(syn/future.length)}, mean exact fixed-origin probability ${fmt(pred/future.length)}.`;
    document.getElementById('estimation-status').textContent=`Training ends August 31; no later outcomes enter estimation. ${eta>0?'Smoothed rows include explicit pseudocount assumptions.':'Rows use unsmoothed empirical transition frequencies.'} Scores describe this reused development holdout, not an untouched final test.`;
  }
  function init(){
    ['p01','p10'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{document.getElementById(id+'-output').textContent=fmt(document.getElementById(id).value,3);}));
    document.getElementById('run-markov').addEventListener('click',run);document.getElementById('markov-next-seed').addEventListener('click',()=>{const s=document.getElementById('markov-seed');s.value=(Number(s.value)+1)>>>0;run();});
    document.getElementById('chain-preset').addEventListener('change',e=>{const presets={worked:[.2,.3],identity:[0,0],alternating:[1,1],iid:[.45,.55]};const values=presets[e.target.value];if(!values)return;['p01','p10'].forEach((id,i)=>{document.getElementById(id).step='.01';document.getElementById(id).value=values[i];document.getElementById(id+'-output').textContent=fmt(values[i],3);});run();});
    ['chain-threshold','pseudocount','forecast-horizon'].forEach(id=>document.getElementById(id).addEventListener('change',updateData));
    document.getElementById('load-fitted').addEventListener('click',()=>{if(!fitted?.P)return;['p01','p10'].forEach((id,i)=>{const v=i?fitted.P[1][0]:fitted.P[0][1];document.getElementById(id).step='any';document.getElementById(id).value=v;document.getElementById(id+'-output').textContent=fmt(v);});document.getElementById('chain-preset').value='custom';document.getElementById('initial-state').value=String(fitted.states[fitted.split-1]);run();document.getElementById('run-markov').focus();});
    ['p01','p10'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{document.getElementById('chain-preset').value='custom';}));
    run();updateData();
  }
  return{validate,multiply,power,simulate,estimate,analyze,init};
})();
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',MarkovLab.init);
if(typeof module!=='undefined')module.exports=MarkovLab;

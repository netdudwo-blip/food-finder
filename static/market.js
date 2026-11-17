'use strict';
(() => {
 const host=document.getElementById('market-grid');
 const colors=['#2464cc','#b77737','#32949b','#a96795','#7b91b4'];
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n};
 function plot(canvas,card,mode){
  const ctx=canvas.getContext('2d'),width=canvas.clientWidth||500,height=205,dpr=window.devicePixelRatio||1;
  canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);
  const sets=card.series.map(s=>({name:s.name,points:s[mode],color:s.color}));
  const dates=[...new Set(sets.flatMap(s=>s.points.map(p=>p[0])))].sort().slice(-12);
  const values=sets.flatMap(s=>s.points.filter(p=>dates.includes(p[0])).map(p=>p[1]));
  if(!values.length)return;
  const min=card.type==='bar'?Math.min(0,...values):Math.min(...values);
  const max=Math.max(...values),span=max-min||1;
  const lo=card.type==='bar'?min:min-span*.14,hi=max+span*.14;
  const left=55,right=15,top=16,bottom=35,w=width-left-right,h=height-top-bottom;
  const x=i=>left+w*(i+.5)/dates.length,y=v=>top+h*(hi-v)/(hi-lo);
  ctx.font='11px system-ui';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
   const v=lo+(hi-lo)*i/4,py=y(v);
   ctx.strokeStyle='#e8edf4';ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(width-right,py);ctx.stroke();
   ctx.fillStyle='#738198';ctx.textAlign='right';ctx.fillText(v.toLocaleString('ko-KR',{maximumFractionDigits:card.unit==='%'?1:0}),left-8,py+4);
  }
  dates.forEach((date,i)=>{
   if(dates.length>6&&i%2&&i!==dates.length-1)return;
   ctx.textAlign='center';ctx.fillStyle='#738198';
   ctx.fillText(mode==='annual'?date:date.slice(2),x(i),height-10);
  });
  sets.forEach((set,index)=>{
   const lookup=new Map(set.points);
   ctx.strokeStyle=set.color;ctx.fillStyle=set.color;ctx.lineWidth=2;
   ctx.beginPath();let active=false;
   dates.forEach((date,i)=>{
    const value=lookup.get(date);
    if(!Number.isFinite(value)){active=false;return}
    if(card.type==='bar'){
     const bw=Math.min(24,w/dates.length*.45);
     ctx.fillRect(x(i)-bw/2,y(value),bw,y(0)-y(value));
    }else{
     if(active)ctx.lineTo(x(i),y(value));else ctx.moveTo(x(i),y(value));active=true;
    }
   });ctx.stroke();
   if(card.type!=='bar')dates.forEach((date,i)=>{
    const v=lookup.get(date);if(!Number.isFinite(v))return;
    ctx.beginPath();ctx.arc(x(i),y(v),2.8,0,Math.PI*2);ctx.fill();
   });
  });
  const tip=canvas.parentElement.querySelector('.chart-tooltip');
  function showPoint(index){
   const date=dates[index];if(!date)return;
   tip.replaceChildren(el('strong',date));
   for(const set of sets){
    const value=new Map(set.points).get(date);
    const row=el('span',set.name+'  '+(value==null?'미제공':value.toLocaleString('ko-KR',{maximumFractionDigits:4})+' '+card.unit));
    row.style.borderColor=set.color;tip.append(row);
   }
   tip.hidden=false;
   tip.style.left=Math.min(Math.max(8,x(index)-90),Math.max(8,width-210))+'px';
   tip.style.top='8px';canvas.dataset.point=String(index);
  }
  canvas.onpointermove=event=>{
   const rect=canvas.getBoundingClientRect(),px=(event.clientX-rect.left)*width/rect.width;
   if(px<left||px>width-right){tip.hidden=true;return}
   showPoint(Math.max(0,Math.min(dates.length-1,Math.floor((px-left)/w*dates.length))));
  };
  canvas.onpointerleave=()=>{tip.hidden=true};
  canvas.onfocus=()=>showPoint(dates.length-1);
  canvas.onblur=()=>{tip.hidden=true};
  canvas.onkeydown=event=>{
   if(event.key==='Escape'){tip.hidden=true;return}
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const current=Number(canvas.dataset.point??dates.length-1);
   const target=event.key==='Home'?0:event.key==='End'?dates.length-1:current+(event.key==='ArrowRight'?1:-1);
   showPoint(Math.max(0,Math.min(dates.length-1,target)));
  };

 }
 function cardView(card){
  const article=el('article');article.className='market-card';
  const head=el('div');head.className='market-card-head';
  const title=el('h2',card.title),select=el('select');
  select.setAttribute('aria-label',card.title+' 표시 기간');
  select.append(new Option('연간 · 최근 12년','annual'),new Option('월간 · 최근 12개월','monthly'));
  const product=el('select');
  product.setAttribute('aria-label',card.title+' 종목');
  product.append(new Option(card.series.length?'전체 종목':'자료 연결 준비 중','all'));
  card.series.forEach((s,i)=>product.append(new Option(s.name,String(i))));
  product.disabled=!card.series.length;
  const controls=el('div');controls.className='market-controls';
  const productLabel=el('label','종목'),periodLabel=el('label','기간');
  productLabel.append(product);periodLabel.append(select);
  controls.append(productLabel,periodLabel);
  head.append(title);article.append(head,controls);
  const summary=el('div');summary.className='market-summary';
  const legend=el('div');legend.className='market-legend';
  const canvas=el('canvas');canvas.setAttribute('role','img');canvas.style.height='205px';
  canvas.tabIndex=0;
  const chart=el('div');chart.className='market-chart';
  const tooltip=el('div');tooltip.className='chart-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','status');
  chart.append(canvas,tooltip);
  const empty=el('div','자료 연결 준비 중');empty.className='market-empty';
  const detail=el('details'),wrap=el('div'),table=el('table');wrap.className='market-table-scroll';wrap.append(table);
  detail.append(el('summary','기간별 수치 보기'),wrap);
  const meta=el('p');meta.className='market-meta';
  const source=el('a',card.source+' ↗');source.href=card.url;source.target='_blank';source.rel='noopener noreferrer';
  const note=el('p',card.note);note.className='market-note';
  article.append(summary,legend,card.series.length?chart:empty,meta,source,detail,note);
  if(card.id==='materials')detail.hidden=true;
  if(card.id==='cpi'){
   const extra=el('a','연간 통계 원본 ↗');extra.href='https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=KR';extra.target='_blank';extra.rel='noopener noreferrer';article.append(extra);
  }
  function render(){
   tooltip.hidden=true;
   const mode=select.value;
   const selected=card.series.map((s,i)=>({...s,color:colors[i%colors.length]})).filter((s,i)=>product.value==='all'||product.value===String(i));
   summary.replaceChildren();legend.replaceChildren();table.replaceChildren();
   const dates=[...new Set(selected.flatMap(s=>s[mode].map(p=>p[0])))].sort().slice(-12);
 
   meta.textContent=dates.length?dates[0]+' ~ '+dates.at(-1)+' · '+card.unit:'연간·월간 원본 미연결';
   for(const s of selected){
    const points=s[mode],last=points.at(-1);
    const item=el('span',s.name);item.style.setProperty('--series',s.color);legend.append(item);
    if(last){const value=el('span');value.append(el('strong',last[1].toLocaleString('ko-KR',{maximumFractionDigits:2})),el('small',card.unit+' · '+last[0]));summary.append(value)}
   }
   const tr=el('tr');tr.append(el('th','기간'));selected.forEach(s=>tr.append(el('th',s.name)));table.append(tr);
   dates.forEach(date=>{
    const row=el('tr');row.append(el('th',date));selected.forEach(s=>{
     const value=new Map(s[mode]).get(date);row.append(el('td',value==null?'미제공':value.toLocaleString('ko-KR',{maximumFractionDigits:2})));
    });table.append(row);
   });
   canvas.setAttribute('aria-label',card.title+' '+selected.map(s=>s.name).join(' · ')+' '+(mode==='annual'?'연간':'월간')+' 그래프. 마우스 또는 좌우 방향키로 상세값 확인. 아래 기간별 수치에서도 확인할 수 있습니다.');
   if(selected.length)plot(canvas,{...card,series:selected},mode);
  }
  select.onchange=render;product.onchange=render;
  new ResizeObserver(()=>{if(canvas.clientWidth)render()}).observe(article);
  host.append(article);render();
 }
 fetch('/static/market-data.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
  host.replaceChildren();data.cards.forEach(cardView);
  document.getElementById('market-date').textContent='자료 확인 '+data.checkedAt+' · 각 차트의 마지막 공표 기간을 확인하세요.';
 }).catch(()=>{host.textContent='자료를 불러오지 못했습니다. 페이지를 새로고침해 주세요.'});
})();

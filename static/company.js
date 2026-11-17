'use strict';
(() => {
 const form=document.querySelector('#company-form'),status=document.querySelector('#company-status');
 const list=document.querySelector('#company-list'),sheet=document.querySelector('#company-sheet');
 const count=document.querySelector('#company-count'),submit=document.querySelector('#company-submit');
 const input=form.elements.company;
 let query='',sequence=0,selection=0,activeChoice;
 function el(tag,text,style){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(style)n.className=style;return n}
 function link(label,url){const n=el('a',label);n.href=url;n.target='_blank';n.rel='noopener noreferrer';return n}
 async function api(path,params){
  const response=await fetch(path+'?'+new URLSearchParams(params));const data=await response.json();
  if(!response.ok)throw Error(data.error||'다시 시도해 주세요.');return data;
 }
 function field(table,label,value){
  const tr=el('tr'),th=el('th',label),td=el('td');th.scope='row';
  if(value instanceof Node)td.append(value);else td.textContent=value||'미제공';
  tr.append(th,td);table.append(tr);return td;
 }
 function emptyState(title,hint,icon='⌕'){
  const box=el('div',null,'company-empty'),mark=el('div',icon,'company-empty-icon');
  mark.setAttribute('aria-hidden','true');box.append(mark,el('strong',title));
  if(hint)box.append(el('p',hint));return box;
 }
 function heading(step,title){
  const n=el('div',null,'company-section-head'),label=el('div');
  label.append(el('span',step,'sectiontag'),el('h2',title));n.append(label);return n;
 }
 function infoTable(title,companyName){
  const group=el('section',null,'company-info'),table=el('table'),body=el('tbody');
  table.className='company-table';table.setAttribute('aria-label',companyName+' '+title);
  table.append(body);group.append(el('h3',title),table);return {group,body};
 }
 function metric(label,value){
  const box=el('div',null,'company-metric'),primary=el('strong',value,'company-metric-value'),note=el('div',null,'company-metric-note');
  box.append(el('span',label,'company-metric-label'),primary,note);return {box,primary,note};
 }
 const salesUnitInWon=new Map([['원',1n],['천원',1000n],['백만원',1000000n]]);
 function summarizeSales(amount,unit){
  const scale=salesUnitInWon.get(unit);if(!scale)return '';
  const won=amount*scale,thousand=1000n,tenThousand=10000n,uk=100000000n,jo=1000000000000n,gyeong=10000000000000000n;
  if(won<thousand)return '';
  // Show at most two adjacent Korean units, rounding once after conversion to won.
  const step=won>=gyeong?jo:won>=jo?uk:won>=tenThousand?tenThousand:thousand;
  const rounded=((won+step/2n)/step)*step;
  const parts=[];let remaining=rounded;
  for(const [size,suffix] of [[gyeong,'경'],[jo,'조'],[uk,'억'],[tenThousand,'만'],[thousand,'천']]){
   const count=remaining/size;remaining%=size;if(!count)continue;
   if(count>=1000n&&count<=9000n&&count%1000n===0n)parts.push(String(count/1000n)+'천'+suffix);
   else if(suffix==='만'&&count>=100n&&count<=900n&&count%100n===0n)parts.push(String(count/100n)+'백만');
   else parts.push(count.toLocaleString('ko-KR')+suffix);
  }
  return (rounded===won?'':'약 ')+parts.join(' ')+' 원';
 }
 function showSales(cell,sales){
  cell.note.replaceChildren();
  if(!sales||!/^\d+$/.test(String(sales.amount))){cell.primary.textContent='미제공';return;}
  const amount=BigInt(sales.amount),unit=String(sales.unit??'').replace(/\s/g,'');
  cell.primary.textContent=amount.toLocaleString('ko-KR')+' '+sales.unit;
  const summary=summarizeSales(amount,unit);
  if(summary)cell.primary.append(' ',el('span','('+summary+')','company-sales-summary'));
  cell.note.append(sales.period+' 결산 · '+sales.basis+' · ',link(sales.label,sales.source));
 }
 async function openCompany(id,choice){
  const token=++selection;
  activeChoice?.setAttribute('aria-pressed','false');activeChoice=choice;choice?.setAttribute('aria-pressed','true');
  sheet.hidden=false;sheet.replaceChildren(emptyState('기업 정보를 여는 중…','공시 기본정보를 불러오고 있어요.','…'));
  let p;
  try{
   p=await api('/api/company',{id});
  }catch(e){if(token===selection)sheet.replaceChildren(emptyState('기업 정보를 열지 못했어요.',e.message,'!'));return;}
  if(token!==selection)return;
  const title=heading('03 / COMPANY PROFILE',p.name);
  if(p.stock)title.append(el('span','종목코드 '+p.stock,'smalllabel'));
  const highlights=el('div',null,'company-metrics');
  const sales=metric('최근 확인 연간 매출액','공시 확인 중…');
  const current=metric('사업자 현재 상태','확인 중…');
  const size=metric('기업형태·규모',p.size||'미제공');
  highlights.append(sales.box,current.box,size.box);
  if(p.sales)showSales(sales,p.sales);
  function applySize(facts,sale){
   if(!facts?.size||!sale)return;
   size.primary.textContent=facts.size;
   size.note.replaceChildren(sale.period+' 기준 · ',link('사업보고서',sale.source));
  }
  applySize(p.filing,p.filing?.sales);

  function basicValue(key,fallback){
   const filing=p.filing;
   if(!filing?.basics?.[key]||!filing.sales)return fallback;
   const value=el('span',filing.basics[key]);
   value.append(el('small',' · '+filing.sales.period+' 기준 '),link('감사보고서',filing.sales.source));
   return value;
  }
  const basic=infoTable('등록 및 연락처',p.name),business=infoTable('사업 및 인증',p.name);
  field(basic.body,'사업자등록번호',p.biz);field(basic.body,'법인등록번호',p.id);
  field(basic.body,'대표자명',basicValue('ceo',p.ceo));field(basic.body,'설립일자',p.founded);field(basic.body,'소재지',basicValue('address',p.address));
  field(basic.body,'전화번호',basicValue('phone',p.phone));field(basic.body,'대표 홈페이지',p.home?link(p.home,p.home):null);
  function factCell(label,base,key,suffix=''){
   const td=field(business.body,label,base);
   const apply=(facts,sale)=>{
    if(!facts?.[key]||!sale)return;
    td.replaceChildren(facts[key]+suffix+' · '+sale.period+' 기준 ',link('사업보고서',sale.source));
   };
   apply(p.filing,p.filing?.sales);return apply;
  }
  const group=factCell('그룹명',p.groups,'groups');
  field(business.body,'표준산업분류',p.ksic);field(business.body,'공시 업종명',p.industry);
  const cert=el('span','미확인 · ');cert.append(link('HACCP 인증 확인','https://www.haccp.or.kr/'));field(business.body,'인증현황',cert);
  field(business.body,'국세청 산업분류','미제공 (등록 업종코드 미확인)');
  const staff=factCell('사원수',p.employees!=null&&p.employees!==''?p.employees+'명 (2026년 5월 지정자료)':null,'employees','명');
  field(business.body,'사업내용',basicValue('business',p.business));
  const grid=el('div',null,'company-info-grid');grid.append(basic.group,business.group);
  const sources=el('p','기본정보 확인일 2026-11-16 · ','company-source-note');
  sources.append(link('금감원 기업개황','https://dart.fss.or.kr/dsae001/main.do'),' · ',link('한국거래소 주요제품','https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage'),' · ',link('공정위 2026년 5월 지정자료','https://egroup.go.kr/egps/wi/stat/kap/psitnCmpnySumryList.do'));
  sheet.replaceChildren(title,highlights,grid,sources);
  sheet.scrollIntoView({block:'start'});
  try{
   const details=await api('/api/company/figures',{id});if(token!==selection)return;
   current.primary.textContent=details.status||'미확인';
   current.note.textContent=details.status?'국세청 사업자등록 상태':'국세청 상태 확인 자료 없음';
   showSales(sales,details.sales||p.sales);
   for(const apply of [group,staff,applySize])apply(details.facts,details.sales);
   if(details.certificates?.length){
    cert.replaceChildren();
    for(const item of details.certificates)cert.append(el('div',item));
    cert.append(link('한국식품안전관리인증원','https://www.data.go.kr/data/15033311/openapi.do'));
   }
  }catch{if(token!==selection)return;current.primary.textContent='조회 지연';if(!p.sales)sales.primary.textContent='조회 지연';}
 }
 async function search(page){
  const token=++sequence;++selection;sheet.hidden=true;activeChoice=null;
  count.textContent='검색 중';status.textContent='';submit.disabled=true;submit.textContent='검색 중…';
  list.replaceChildren(emptyState('기업 정보를 검색하는 중…',null,'…'));
  try{
   const data=await api('/api/companies',{q:query,page});if(token!==sequence)return;
   count.textContent=data.total.toLocaleString('ko-KR')+'건';
   status.textContent=data.total?query+' 검색 · '+data.page+' / '+data.pages+'페이지':'';
   if(!data.rows.length){list.replaceChildren(emptyState('일치하는 기업이 없습니다.','법인명 일부나 등록번호로 다시 검색해 보세요.'));return;}
   const results=el('div',null,'company-resultlist');
   const choices=data.rows.map(p=>{
    const btn=el('button',null,'company-choice');btn.type='button';btn.setAttribute('aria-pressed','false');
    const icon=el('span','▤','company-result-icon');icon.setAttribute('aria-hidden','true');
    const detail=el('span',null,'company-result-main');
    detail.append(el('strong',p.name),el('small',[p.biz?'사업자 '+p.biz:p.id?'법인 '+p.id:'',p.ceo?'대표 '+p.ceo:'',p.address].filter(Boolean).join(' · ')));
    btn.append(icon,detail,el('span','기업정보 보기 ›','company-result-cta'));
    btn.onclick=()=>openCompany(p.id,btn);return btn;
   });
   results.append(...choices);list.replaceChildren(results);
   if(data.pages>1){
    const nav=el('nav');nav.className='pagination';
    nav.setAttribute('aria-label','기업 검색 결과 페이지');
    const controls=[['이전',data.page-1]];
    for(let i=Math.max(1,data.page-2);i<=Math.min(data.pages,data.page+2);i++)controls.push([String(i),i]);
    controls.push(['다음',data.page+1]);
    for(const [text,target] of controls){
     const btn=el('button',text);btn.type='button';btn.disabled=target<1||target>data.pages;
     if(target===data.page)btn.setAttribute('aria-current','page');
     btn.onclick=()=>{if(target!==data.page)search(target);};nav.append(btn);
    }
    list.append(nav);
   }
   if(data.total===1)openCompany(data.rows[0].id,choices[0]);
  }catch(e){if(token===sequence){count.textContent='검색 실패';list.replaceChildren(emptyState('기업 검색에 실패했어요.',e.message,'!'));}}
  finally{if(token===sequence){submit.disabled=false;submit.textContent='검색하기 ↗';}}
 }
 function start(value){query=value.trim();if(query){input.value=query;search(1);}}
 form.onsubmit=e=>{e.preventDefault();start(input.value);};
 document.querySelectorAll('[data-company-example]').forEach(button=>{
  button.onclick=()=>start(button.dataset.companyExample);
 });
})();

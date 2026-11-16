'use strict';
(() => {
 const form=document.querySelector('#company-form'),status=document.querySelector('#company-status');
 const list=document.querySelector('#company-list'),sheet=document.querySelector('#company-sheet');
 const input=form.elements.company;
 let query='',sequence=0,selection=0;
 function el(tag,text){const n=document.createElement(tag);if(text!=null)n.textContent=text;return n}
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
 function showSales(cell,sales){
  cell.replaceChildren();
  if(!sales){cell.textContent='미제공';return}
  cell.append(BigInt(sales.amount).toLocaleString('ko-KR')+' '+sales.unit+' · '+sales.period+' 결산 · '+sales.basis+'　',link(sales.label,sales.source));
 }
 async function openCompany(id){
  const token=++selection;sheet.hidden=false;sheet.textContent='기업 정보를 여는 중…';
  try{
   const p=await api('/api/company',{id});if(token!==selection)return;
   const title=el('h2',p.name),table=el('table');table.className='company-table';table.setAttribute('aria-label',p.name+' 기업 정보');
   sheet.replaceChildren(title,table);
   field(table,'사업자등록번호',p.biz);field(table,'법인등록번호',p.id);
   field(table,'대표자명',p.ceo);field(table,'설립일자',p.founded);field(table,'소재지',p.address);
   function factCell(label,base,key,suffix=''){
    const td=field(table,label,base);
    const apply=(facts,sales)=>{
     if(!facts?.[key]||!sales)return;
     td.replaceChildren(facts[key]+suffix+' · '+sales.period+' 기준　',link('사업보고서',sales.source));
    };
    apply(p.filing,p.filing?.sales);
    return apply;
   }
   const group= factCell('그룹명',p.groups,'groups');field(table,'표준산업분류',p.ksic);
   field(table,'공시 업종명',p.industry);
   const cert=el('span','미확인 · ');cert.append(link('HACCP 인증 확인','https://www.haccp.or.kr/'));field(table,'인증현황',cert);
   field(table,'국세청 산업분류','미제공 (등록 업종코드 미확인)');field(table,'전화번호',p.phone);
   const current=field(table,'사업자 현재 상태','확인 중…');const sales=field(table,'최근 확인 연간 매출액','공시 확인 중…');
   if(p.sales)showSales(sales,p.sales);
   const staff=factCell('사원수',p.employees!=null&&p.employees!==''?p.employees+'명 (2026년 5월 지정자료)':null,'employees','명');
   const size=factCell('기업형태·규모',p.size,'size');field(table,'사업내용',p.business);
   field(table,'대표 홈페이지',p.home?link(p.home,p.home):null);
   const sources=el('p','기본정보 확인일 2026-11-16 · ');
   sources.append(link('금감원 기업개황','https://dart.fss.or.kr/dsae001/main.do'),' · ',link('한국거래소 주요제품','https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage'),' · ',link('공정위 2026년 5월 지정자료','https://egroup.go.kr/egps/wi/stat/kap/psitnCmpnySumryList.do'));
   sheet.append(sources);
   sheet.scrollIntoView({block:'start'});
   const details=await api('/api/company/figures',{id});if(token!==selection)return;
   current.textContent=details.status||'미확인 (국세청 상태 확인 자료 없음)';
   showSales(sales,details.sales||p.sales);
   for(const apply of [group,staff,size])apply(details.facts,details.sales);
   if(details.certificates?.length){
    cert.replaceChildren();
    for(const item of details.certificates)cert.append(el('div',item));
    cert.append(link('한국식품안전관리인증원','https://www.data.go.kr/data/15033311/openapi.do'));
   }
  }catch(e){if(token!==selection)return;if(sheet.querySelector('table')){
    for(const td of sheet.querySelectorAll('td'))if(td.textContent.endsWith('확인 중…'))td.textContent='조회 지연';
   }else sheet.textContent=e.message}
 }
 async function search(page){
  const token=++sequence;++selection;sheet.hidden=true;list.replaceChildren();status.textContent='법인을 찾는 중…';
  try{
   const data=await api('/api/companies',{q:query,page});if(token!==sequence)return;
   status.textContent=data.total?data.total.toLocaleString()+'개 법인 · '+data.page+' / '+data.pages+'페이지':'일치하는 법인이 없습니다. 법인명 일부나 등록번호로 다시 검색하세요.';
   for(const p of data.rows){
    const btn=el('button');btn.type='button';btn.className='company-choice';
    btn.append(el('strong',p.name),el('small',[p.biz||p.id,p.ceo,p.address].filter(Boolean).join(' · ')));
    btn.onclick=()=>openCompany(p.id);list.append(btn);
   }
   if(data.pages>1){
    const nav=el('nav');nav.className='pagination';
    for(const [text,target] of [['이전',data.page-1],['다음',data.page+1]]){
     const btn=el('button',text);btn.disabled=target<1||target>data.pages;btn.onclick=()=>search(target);nav.append(btn);
    }
    list.append(nav);
   }
   if(data.total===1)openCompany(data.rows[0].id);
  }catch(e){if(token===sequence)status.textContent=e.message}
 }
 form.onsubmit=e=>{e.preventDefault();query=input.value.trim();if(query)search(1)};
})();

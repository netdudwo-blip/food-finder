'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const company=require('./lib/company');
const finance=require('./lib/company-revenue');
test('corporate directory resolves normalized names and matching registration numbers',async()=>{
 const found=await company.search('109-81-14886',1);
 const p=await company.profile(found.rows[0].id);
 assert.equal(p.id,'1101110327125');
 assert.equal(p.filing.size,'중견기업');
 assert.equal(p.sales.amount,'3528856015820');
 assert.match(p.sales.source,/rcpNo=/);
 const hits=await company.search('대상',1);
 assert.ok(hits.total>1);assert.equal(hits.page,1);
 assert.equal((await company.search(p.id,1)).total,1);
 await assert.rejects(company.search('(주)',1));
 assert.equal(company.homepage('javascript:alert(1)'),'');
});
test('disclosed sales retain statement basis, period and reporting units',()=>{
 const caption='<table><tr><td>포괄손익계산서 제1기 2025.01.01 부터 2025.12.31 까지 (단위 : 천원)</td></tr></table>';
 const table='<table><tr><td>매출원가</td><td>99</td></tr><tr><td>매출 (주22)</td><td>0</td></tr></table>';
 assert.equal(finance.revenue(caption+table,2025,'별도·개별','123').amount,'0');
 assert.equal(finance.revenue(caption+table,2024,'별도·개별','123'),null);
 assert.equal(finance.revenue(caption+table,2025,'연결','123'),null);
});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function mountCompanyUi(request){
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.own='';this.attrs={};}
  set textContent(text){this.own=String(text);this.children=[];}
  get textContent(){return this.own+this.children.map(x=>x instanceof Element?x.textContent:String(x)).join('');}
  setAttribute(k,v){this.attrs[k]=v;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.own='';this.children=children;}
  scrollIntoView(){this.scrolled=true;}
 }
 const nodes={};
 for(const id of ['form','status','list','sheet','count','submit'])nodes[id]=new Element('div');
 nodes.form.elements={company:{value:''}};
 const example=new Element('button');example.dataset={companyExample:'대상'};
 const document={querySelector(s){return nodes[s.slice('#company-'.length)];},querySelectorAll(){return [example];},createElement:tag=>new Element(tag)};
 const fetch=async url=>{const data=await request(new URL(url,'http://test.invalid'));return {ok:!data.error,json:async()=>data};};
 const context=vm.createContext({document,fetch,URLSearchParams,Node:Element});
 vm.runInContext(fs.readFileSync(__dirname+'/static/company.js','utf8'),context);
 const collect=(root,check)=>[...(check(root)?[root]:[]),...root.children.filter(c=>c instanceof Element).flatMap(c=>collect(c,check))];
 return {nodes,example,collect};
}
const companyRow={id:'1101110327125',name:'대상 주식회사',biz:'109-81-14886',ceo:'대표 예시',address:'소재지 예시'};
const savedSales={amount:'3528856015820',unit:'원',period:'2025-12-31',basis:'별도·개별',label:'사업보고서',source:'https://dart.fss.or.kr/'};

test('company UI supports examples, page counts, and an active result with structured profile',async()=>{
 const seen=[];
 const {nodes,example,collect}=mountCompanyUi(async url=>{
  seen.push([url.pathname,url.searchParams.get('q'),url.searchParams.get('page')]);
  if(url.pathname==='/api/companies')return {total:21,page:Number(url.searchParams.get('page')),pages:2,rows:[companyRow]};
  if(url.pathname==='/api/company')return {...companyRow,sales:savedSales,size:'중견기업',phone:'02-000-0000',business:'식품 제조'};
  return {sales:savedSales,status:null,certificates:[],facts:null};
 });
 example.onclick();await tick();
 assert.equal(nodes.count.textContent,'21건');
 assert.match(nodes.status.textContent,/대상 검색 · 1 \/ 2페이지/);
 const nav=collect(nodes.list,x=>x.tag==='nav')[0];assert.equal(nav.attrs['aria-label'],'기업 검색 결과 페이지');
 nav.children.find(x=>x.textContent==='다음').onclick();await tick();
 assert.match(nodes.status.textContent,/2 \/ 2페이지/);
 const hit=collect(nodes.list,x=>x.className==='company-choice')[0];
 await hit.onclick();
 assert.equal(hit.attrs['aria-pressed'],'true');
 assert.equal(nodes.sheet.hidden,false);
 assert.equal(nodes.sheet.scrolled,true);
 assert.match(nodes.sheet.textContent,/3,528,856,015,820 원/);
 assert.match(nodes.sheet.textContent,/2025-12-31 결산 · 별도·개별/);
 assert.match(nodes.sheet.textContent,/미확인국세청 상태 확인 자료 없음/);
 assert.equal(collect(nodes.sheet,x=>x.tag==='table').length,2);
 assert.deepEqual(seen.slice(0,2),[['/api/companies','대상','1'],['/api/companies','대상','2']]);
});

test('company UI distinguishes empty results from lookup errors and keeps known sales if figures fail',async()=>{
 const {nodes}=mountCompanyUi(async url=>{
  if(url.pathname==='/api/company')return {...companyRow,sales:savedSales};
  if(url.pathname==='/api/company/figures')return {error:'외부 조회 지연'};
  if(url.searchParams.get('q')==='오류')return {error:'검색 오류'};
  if(url.searchParams.get('q')==='없는회사')return {total:0,page:1,pages:1,rows:[]};
  return {total:1,page:1,pages:1,rows:[companyRow]};
 });
 const search=async q=>{nodes.form.elements.company.value=q;nodes.form.onsubmit({preventDefault(){}});await tick();};
 await search('없는회사');assert.equal(nodes.count.textContent,'0건');assert.match(nodes.list.textContent,/일치하는 기업이 없습니다/);
 await search('오류');assert.equal(nodes.count.textContent,'검색 실패');assert.match(nodes.list.textContent,/검색 오류/);
 await search(companyRow.biz);assert.equal(nodes.count.textContent,'1건');
 assert.match(nodes.sheet.textContent,/3,528,856,015,820 원/);
 assert.match(nodes.sheet.textContent,/조회 지연/);
 assert.equal(nodes.submit.disabled,false);
});

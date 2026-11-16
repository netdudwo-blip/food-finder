'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {promisify}=require('node:util');
const unzip=promisify(require('node:zlib').gunzip);
const ftcSource='https://egroup.go.kr/egps/wi/stat/kap/psitnCmpnySumryList.do';
const digits=value=>String(value||'').replace(/\D/g,'');
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|\s/g,'');
let directory;
async function readData(name){
 const bytes=await fs.readFile(path.join(__dirname,'company-'+name+'.json.gz'));
 return JSON.parse(await unzip(bytes));
}
async function build(){
 const groups=await readData('groups'),rows=await readData('directory');
 const byId=new Map();
 for(const row of rows)if(!byId.has(row[4]))byId.set(row[4],row);
 for(const [id,g] of Object.entries(groups)){
  if(!byId.has(id))byId.set(id,[g.name,g.name,'',g.ceo,id,g.biz,'','','','',g.founded,'']);
 }
 const index=Array.from(byId.values(),row=>({row,name:normalize(row[0]),alias:normalize(row[1]),biz:digits(row[5])}));
 return {index,groups,byId};
}
function catalog(){return directory||=(build().catch(e=>{directory=null;throw e}));}
async function search(query,page){
 const q=normalize(query);
 if(!q||q.length>80||!Number.isSafeInteger(page)||page<1)throw Object.assign(new Error('법인명 또는 등록번호를 확인하세요.'),{status:400});
 const {index}=await catalog();
 const number=/^[\d-]+$/.test(q)?digits(q):'';
 const exact=[],others=[];
 for(const item of index){
  const {row,name,alias,biz}=item;
  if(name===q||alias===q||(number&&(row[4]===number||biz===number)))exact.push(row);
  else if(name.includes(q)||alias.includes(q))others.push(row);
 }
 const hits=exact.concat(others),pages=Math.max(1,Math.ceil(hits.length/20));
 page=Math.min(page,pages);
 return {page,pages,total:hits.length,rows:hits.slice((page-1)*20,page*20).map(r=>({id:r[4],name:r[0],ceo:r[3],address:r[6],biz:r[5]}))};
}
function homepage(raw){
 if(!raw)return '';
 try{
  const value=/^[a-z][\w+.-]*:/i.test(raw)?raw:'https://'+raw;
  const u=new URL(value);
  if(['http:','https:'].includes(u.protocol)&&u.hostname.includes('.')&&!u.username&&!u.password)return u.href;
 }catch{}
 return '';
}
async function profile(id){
 const {byId,groups}=await catalog(),r=byId.get(id);
 if(!r)return null;
 const g=groups[id],filing=require('./company-filings.json')[id];
 const closing=String(g?.closing||'').replaceAll('/','-');
 const sales=g && /^\d{4}-\d\d-\d\d$/.test(closing)&&closing<'2026-05-01'&&/^[\d,]+$/.test(String(g.sales))?
  {amount:String(g.sales).replaceAll(',',''),unit:'백만원',period:closing,basis:'법인 결산',source:ftcSource,label:'공정위 기업집단포털'}:null;
 return {id,name:r[0],stock:r[2],alias:r[1],ceo:r[3],biz:r[5],address:r[6],phone:r[7],home:homepage(r[8]),industry:r[9],
 founded:r[10],business:r[11],groups:g?.groups.join(' · '),employees:g?.employees,ksic:g?.code&&g?.industry?g.code+' · '+g.industry:null,
 size:g?'공시대상기업집단 소속 (2026년 지정)':null,filing, sales:filing?.sales&&(!sales||filing.sales.period>=sales.period)?filing.sales:sales};
}
async function businessStatus(biz){
 const key=process.env.NTS_BUSINESS_API_KEY;
 if(!key||!/^\d{10}$/.test(digits(biz)))return null;
 const url=new URL('https://api.odcloud.kr/api/nts-businessman/v1/status');
 url.searchParams.set('serviceKey',key);
 const response=await fetch(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({b_no:[digits(biz)]}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('국세청 조회 지연');
 const data=await response.json();
 return data.data?.find(x=>x.b_no===digits(biz))?.b_stt||null;
}
module.exports={search,profile,businessStatus,homepage};
async function certificates(p){
 const key=process.env.HACCP_COMPANY_API_KEY;
 const biz=digits(p.biz);
 if(!key||!/^\d{10}$/.test(biz))return [];
 const url=new URL('https://apis.data.go.kr/B553748/CertCompanyListService2/getCertCompanyListService2');
 url.search=new URLSearchParams({ServiceKey:key,company:p.alias||p.name,returnType:'json',pageNo:1,numOfRows:100});
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!r.ok)return [];
 const json=await r.json(),body=(json.response||json).body;
 const raw=body?.items?.item??body?.items??[];
 const rows=(Array.isArray(raw)?raw:[raw]).map(x=>x.item||x);
 return rows.filter(x=>digits(x.companyNo)===biz&&x.appointno).map(x=>[x.company,x.worksaddr,x.businessitemNm,'HACCP '+x.appointno,x.issueenddate?'종료일 '+x.issueenddate:''].filter(Boolean).join(' · '));
}
module.exports.certificates=certificates;

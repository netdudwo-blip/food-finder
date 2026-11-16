'use strict';
const base='https://dart.fss.or.kr';
const strip=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const tables=s=>[...s.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
function rows(table){return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>strip(c[1])));}
function sizes(doc){
 for(const t of tables(doc))for(const row of rows(t)){
  const label=row.at(-2)?.replaceAll(' ','');
  if(row.at(-1)==='해당'&&['중견기업해당여부','중소기업해당여부'].includes(label))return label.slice(0,4);
 }
}
function group(doc){
 for(const t of tables(doc))if(strip(t).includes('기업집단의 명칭')){
  const body=rows(t).filter(r=>r.length===4);
  if(body.length===1&&body[0][0]&&/^\d+$/.test(body[0][3]))return body[0][0];
 }
}
function staff(doc){
 for(const t of tables(doc)){
  const heading=strip(t.split(/<tbody/i)[0]).replace(/\s/g,'');
  if(!heading.includes('직원수')||!heading.includes('기간제근로자')||!heading.includes('평균근속연수'))continue;
  for(const row of rows(t)){
   if(row[0]?.replace(/\s/g,'')!=='합계')continue;
   const num=i=>/^\d[\d,]*$/.test(row[i])?Number(row[i].replaceAll(',','')):row[i]==='-'?0:NaN;
   if(num(5)>0&&num(1)+num(3)===num(5))return num(5).toLocaleString('ko-KR');
  }
 }
}
async function facts(sales){
 const receipt=sales?.source?.match(/rcpNo=(\d{14})$/)?.[1];
 if(!receipt)return {};
 const signal=AbortSignal.timeout(9000);
 const request=async url=>{const r=await fetch(url,{redirect:'error',signal});if(!r.ok)throw Error();return r.text()};
 const main=await request(base+'/dsaf001/main.do?rcpNo='+receipt);
 const sections=[['size','1. 회사의 개요',sizes],['employees','1. 임원 및 직원 등의 현황',staff],['groups','IX. 계열회사 등에 관한 사항',group]];
 const result={};
 for(const [key,title,parse] of sections){
  const i=main.indexOf("['text'] = \""+title+"\"");
  if(i<0)continue;
  const segment=main.slice(i,i+550),params=new URLSearchParams();
  for(const field of ['rcpNo','dcmNo','eleId','offset','length','dtd']){
   const match=segment.match(new RegExp("\\['"+field+"'\\] = \"([a-zA-Z0-9.]+)\""));
   if(match)params.set(field,match[1]);
  }
  if(params.size!==6||params.get('rcpNo')!==receipt)continue;
  const value=parse(await request(base+'/report/viewer.do?'+params));
  if(value)result[key]=value;
 }
 return result;
}
const cache=new Map();
function cachedFacts(sales){
 if(!sales?.source.includes('dart.fss.or.kr'))return {};
 const prior=cache.get(sales.source);
 if(prior&&prior.until>Date.now())return prior.promise;
 if(cache.size>=300)cache.delete(cache.keys().next().value);
 const promise=facts(sales).catch(()=>({}));
 cache.set(sales.source,{promise,until:Date.now()+3600000});
 return promise;
}
module.exports={facts,cachedFacts};

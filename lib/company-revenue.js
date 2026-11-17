'use strict';
const cache=new Map();
const Op='https://opendart.fss.or.kr';
const Dart='https://dart.fss.or.kr';
function plain(html){return html.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();}
function revenue(html,year,basis,receipt){
 // DART places the reporting period and unit in the table immediately before the statement.
 const tables=[...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
 for(let i=1;i<tables.length;i++){
  const caption=plain(tables[i-1]);
  if(!/(?:포괄)?손익계산서/.test(caption)||caption.includes('연결')!==(basis==='연결'))continue;
  const unit=caption.match(/단위\s*:\s*(백만원|천원|원)\s*\)/)?.[1];
  const periods=[...caption.matchAll(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/g)];
  if(!unit||periods.length<2||Number(periods[1][1])!==year)continue;
  const period=periods[1].slice(1).map(s=>s.padStart(2,'0')).join('-');
  for(const row of tables[i].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>plain(m[1]));
   if(!/^(매출액?|수익\s*\(매출액\)|영업수익)(?:\s*\(주[^)]*\))?$/.test(cells[0]||'')||!/^\d[\d,]*$/.test(cells[1]||''))continue;
   return {amount:cells[1].replaceAll(',',''),unit,period,basis,source:Dart+'/dsaf001/main.do?rcpNo='+receipt,label:'금감원 DART 사업보고서'};
  }
 }
 return null;
}
function auditRevenue(html,year,receipt){
 const tables=[...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
 for(let i=1;i<tables.length;i++){
  const before=plain(html.slice(Math.max(0,tables[i-1].index-250),tables[i].index)).replace(/\s/g,'');
  if(!before.includes('손익계산서')||before.includes('연결'))continue;
  const dates=[...before.matchAll(/(\d{4})(?:년|[.\-/])(\d{1,2})(?:월|[.\-/])(\d{1,2})/g)];
  const unit=before.match(/단위[:：](백만원|천원|원)\)/)?.[1];
  if(!unit||dates.length<2||Number(dates[1][1])!==year)continue;
  const period=dates[1].slice(1).map(v=>v.padStart(2,'0')).join('-');
  for(const row of tables[i][0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>plain(m[1]));
   const label=(cells[0]||'').replace(/\s/g,'').replace(/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX0-9]+[.．]/,'');
   if(!/^(매출액?|영업수익)(?:\(주석?[^)]*\))?$/.test(label))continue;
   const amount=cells.length===5&&cells[1]===''?cells[2]:cells.length===3?cells[1]:null;
   if(!/^[0-9][0-9,]*$/.test(amount||''))continue;
   return {amount:amount.replaceAll(',',''),unit,period,basis:'개별',source:Dart+'/dsaf001/main.do?rcpNo='+receipt,label:'금감원 DART 감사보고서'};
  }
 }
 return null;
}
async function get(path,params,signal){
 const url=new URL(path);url.search=new URLSearchParams(params);
 const r=await fetch(url,{signal,redirect:'error'});
 if(!r.ok)throw Error('공시 조회 지연');
 return r.text();
}
async function disclosureId(p,signal){
 const listed=/^\d{6}$/.test(p.stock);
 const terms={textCrpNm:listed?p.stock:(p.alias||p.name),currentPage:'1',searchType:'1'};
 const result=await get(Dart+'/dsae001/search.ax',terms,signal);
 const candidates=[];
 for(const row of result.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)){
  const id=row[0].match(/javascript:select\('(\d{8})'\)/)?.[1];
  if(!id)continue;
  if(listed&&plain(row[0]).split(' ').at(-1)===p.stock)return id;
  if(!listed)candidates.push(id);
 }
 for(const id of candidates.slice(0,4)){
  const page=await get(Dart+'/dsae001/select.ax',{selectKey:id},signal);
  const reg=page.match(/법인등록번호<\/label>\s*<\/th>\s*<td[^>]*>([0-9-]+)<\/td>/i)?.[1];
  if(reg?.replaceAll('-','')===p.id)return id;
 }
}
async function latest(p){
 const signal=AbortSignal.timeout(12000);
 const cik=await disclosureId(p,signal);
 if(!cik)return p.sales;
 const year=new Date().getUTCFullYear();
 for(let y=year;y>=year-3;y--){
  if(p.sales&&Number(p.sales.period.slice(0,4))>y)break;
  for(const [toc,basis] of [['5','별도·개별'],['0','연결']]){
   const html=await get(Op+'/disclosureinfo/fnltt/singl/list.do',{textCrpCik:cik,textCrpNm:p.alias||p.name,selectYear:String(y),reportCode:'11011',selectToc:toc},signal);
   const src=html.match(/<iframe\b[^>]*?\bsrc="([^"]+)"/i)?.[1];
   if(!src)continue;
   const url=new URL(src.replaceAll('&amp;','&'),Dart);
   const receipt=url.searchParams.get('rcpNo');
   if(url.origin!==Dart||url.pathname.replace(/^\/+/, '/')!=='/report/viewer.do'||!/^\d{14}$/.test(receipt))continue;
   const result=revenue(await get(Dart+'/report/viewer.do',url.searchParams,signal),y,basis,receipt);
   if(result)return p.sales&&p.sales.period>result.period?p.sales:result;
  }
 }
 return p.sales;
}
function cachedRevenue(p){
 const entry=cache.get(p.id);
 if(entry&&entry.until>Date.now())return entry.value;
 if(cache.size>=500)cache.delete(cache.keys().next().value);
 const value=latest(p).catch(()=>{cache.delete(p.id);return p.sales});
 cache.set(p.id,{value,until:Date.now()+3600000});
 return value;
}
module.exports={revenue,auditRevenue,cachedRevenue};

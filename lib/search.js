'use strict';
const FIELDS=['PRDLST_NM','PRDLST_REPORT_NO','LCNS_NO','PRDLST_DCNM','BSSH_NM'];
const error=(message,status=400)=>Object.assign(new Error(message),{status});
function options(params){
 const q=(params.get('q')||'').trim(),field=params.get('field')||'all';
 const page=Number(params.get('page')||1),size=Number(params.get('size')||10),sort=params.get('sort')||'all';
 if(q.length<2||q.length>80)throw error('검색어는 2~80자로 입력해 주세요.');
 if(!['all',...FIELDS].includes(field)||!['all','manufacturer','date','type'].includes(sort))throw error('검색 조건이 올바르지 않습니다.');
 if(!Number.isSafeInteger(page)||page<1||![10,30,50].includes(size))throw error('페이지 또는 표시 건수가 올바르지 않습니다.');
 return {q,field,page,size,sort,manufacturer:params.get('manufacturer')||'',type:params.get('type')||''};
}
// Read a complete bounded snapshot before global filtering/sorting. Never label a truncated set as complete.
async function collect(fetchPage,q,field,max=5000){
 const unique=new Map();let read=0;
 const candidates=field==='all'?FIELDS:[field];
 for(const f of candidates){
  if(field==='all' && /[^0-9A-Za-z-]/.test(q) && ['PRDLST_REPORT_NO','LCNS_NO'].includes(f))continue;
  for(let start=1,total=1;start<=total;){
   const data=await fetchPage('I1250',f,q,Math.min(1000,max-read+1),start);
   total=data.total;
   if(total>max||read+data.rows.length>max)throw error('검색 범위가 넓습니다. 검색 대상을 선택하거나 더 구체적인 검색어를 입력해 주세요. 전체 결과를 확보하지 못해 일부 결과는 표시하지 않습니다.',422);
   if(start<=total&&!data.rows.length)throw error('공식 API의 전체 건수와 수신 결과가 다릅니다. 다시 검색해 주세요.',502);
   for(const p of data.rows){const id=JSON.stringify([p.PRDLST_REPORT_NO,p.LCNS_NO,p.PRDLST_NM]);unique.set(id,p);}
   read+=data.rows.length;start+=data.rows.length||1000;
  }
 }
 return [...unique.values()];
}
const select=require('../static/result-page');
module.exports={FIELDS,options,collect,select};

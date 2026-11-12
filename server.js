'use strict';
// Zero-dependency Node.js web server (Node 20+)
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const PORT=Number(process.env.PORT||3000);
const DEMO=[
 {PRDLST_NM:'빨간어묵탕소스B',BSSH_NM:'매일식품주식회사',PRDLST_REPORT_NO:'19550509001604',PRMS_DT:'20230315',PRDLST_DCNM:'소스',POG_DAYCNT:'제조일로부터 12개월',PRODUCTION:'아니오',LCNS_NO:'19550509001'},
 {PRDLST_NM:'매일맛있는밥상 야채용맛간장소스',BSSH_NM:'매일식품주식회사',PRDLST_REPORT_NO:'19550509001398',PRMS_DT:'20170818',PRDLST_DCNM:'소스',POG_DAYCNT:'24개월',PRODUCTION:'아니오',LCNS_NO:'19550509001'},
 {PRDLST_NM:'매일맛있는진간장',BSSH_NM:'매일식품주식회사',PRDLST_REPORT_NO:'195505090014',PRMS_DT:'19700413',PRDLST_DCNM:'혼합간장',POG_DAYCNT:'실온보관 2년',PRODUCTION:'아니오',LCNS_NO:'19550509001'},
 {PRDLST_NM:'흰쌀사각한과',BSSH_NM:'성덕전통식품',PRDLST_REPORT_NO:'177203860016',PRMS_DT:'20090724',PRDLST_DCNM:'과자',LCNS_NO:'17720386001'}
];
const ING={'177203860016':['찹쌀','흰쌀튀밥','식용유','조청']};
const key=()=>process.env.FOODSAFETY_API_KEY?.trim()||'';
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
function validReport(v){return /^[0-9A-Za-z-]{4,40}$/.test(v)}
async function fetchAPI(service,field,term,limit){
 const k=key();if(!k)throw Object.assign(new Error('서버에 FOODSAFETY_API_KEY가 설정되지 않았습니다.'),{status:503});
 if(!/^[a-zA-Z0-9_-]+$/.test(k))throw Object.assign(new Error('API 키 형식이 올바르지 않습니다.'),{status:503});
 if(!['I1250','C002'].includes(service)||!['PRDLST_NM','PRDLST_REPORT_NO'].includes(field))throw new Error('허용되지 않은 조회 조건');
 const url=`https://openapi.foodsafetykorea.go.kr/api/${k}/${service}/json/1/${limit}/${field+'='+encodeURIComponent(term)}`;
 let response, data;
 try {response=await fetch(url,{signal:AbortSignal.timeout(16000),headers:{'User-Agent':'FoodFinderWeb/0.1'}});if(!response.ok)throw new Error('HTTP '+response.status);data=await response.json()}
 catch(e){throw Object.assign(new Error('식품안전나라 연결 실패 또는 시간 초과'),{status:502})}
 const section=data?.[service]||{},result=section.RESULT||data.RESULT||{},code=result.CODE||'INFO-000';
 if(['INFO-200','INFO-300'].includes(code))return {rows:[],total:0};
 if(code!=='INFO-000')throw Object.assign(new Error(`식품안전나라 API 응답: ${code} / ${result.MSG||'확인 필요'}`),{status:502});
 return {rows:section.row||[],total:Number(section.total_count||0)};
}
async function route(req,res){
 const u=new URL(req.url,'http://localhost');
 if(req.method!=='GET')return send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(u.pathname==='/health')return send(res,200,{status:'ok',api_configured:!!key()});
 if(u.pathname==='/api/search'){
  const q=(u.searchParams.get('q')||'').trim(), mode=u.searchParams.get('mode')||'live';
  if(q.length<2||q.length>80)return send(res,400,{error:'검색어는 2~80자로 입력해 주세요.'});
  if(!['demo','live'].includes(mode))return send(res,400,{error:'검색 모드가 올바르지 않습니다.'});
  if(mode==='demo'){
   const rows=DEMO.filter(x=>(x.PRDLST_NM+' '+x.BSSH_NM).toLowerCase().includes(q.toLowerCase()));
   return send(res,200,{rows,total:rows.length,mode,notice:'공식 문서 샘플을 바탕으로 구성한 예시 데이터이며 실시간 조회 결과가 아닙니다.'});
  }
  const result=await fetchAPI('I1250','PRDLST_NM',q,50);
  return send(res,200,{...result,mode,notice:'식품안전나라 품목제조보고 API 결과'});
 }
 if(u.pathname==='/api/detail'){
  const no=(u.searchParams.get('report_no')||'').trim(),mode=u.searchParams.get('mode')||'live';
  if(!validReport(no))return send(res,400,{error:'품목제조보고번호가 올바르지 않습니다.'});
  if(!['demo','live'].includes(mode))return send(res,400,{error:'검색 모드가 올바르지 않습니다.'});
  if(mode==='demo'){
   const product=DEMO.find(x=>x.PRDLST_REPORT_NO===no);if(!product)return send(res,404,{error:'예시 제품을 찾을 수 없습니다.'});
   const ingredients=ING[no]||[];
   return send(res,200,{product,ingredients,mode,ingredients_status:ingredients.length?'example':'not_available'});
  }
  const result=await fetchAPI('I1250','PRDLST_REPORT_NO',no,10);
  const product=result.rows.find(x=>String(x.PRDLST_REPORT_NO)===no);
  if(!product)return send(res,404,{error:'해당 품목제조보고번호를 찾지 못했습니다.'});
  let ingredients=[],ingredients_status='loaded';
  try {
   const ing=await fetchAPI('C002','PRDLST_REPORT_NO',no,30);
   ingredients=[...new Set(ing.rows.filter(x=>String(x.PRDLST_REPORT_NO)===no).flatMap(x=>String(x.RAWMTRL_NM||'').split(',').map(y=>y.trim()).filter(Boolean)))];
   if(!ingredients.length)ingredients_status='not_available';
  }catch{ingredients_status='api_error'}
  return send(res,200,{product,ingredients,mode,ingredients_status});
 }
 const assets={'/':'index.html','/static/app.js':'static/app.js','/static/style.css':'static/style.css'};
 if(!assets[u.pathname])return send(res,404,{error:'페이지를 찾을 수 없습니다.'});
 const file=path.join(root,assets[u.pathname]);
 let body=fs.readFileSync(file);
 if(u.pathname==='/'){
  const enabled=!!key();
  body=Buffer.from(body.toString().replace('__API_STATUS__',enabled?'실시간 API 설정됨':'체험 모드 이용 가능').replace('__LIVE_DISABLED__',enabled?'':'disabled').replace('__HINT__',enabled?'실시간 조회는 상단에서 선택하세요. 체험 데이터는 공식 문서 예시를 바탕으로 재구성했습니다.':'실시간 API 연결에는 서버 환경변수 FOODSAFETY_API_KEY가 필요합니다. 체험 데이터는 바로 사용 가능합니다.'));
 }
 res.writeHead(200,{'Content-Type':u.pathname.endsWith('.js')?'text/javascript; charset=utf-8':u.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(body);
}
const server=http.createServer((req,res)=>route(req,res).catch(e=>{console.error('Request error:',e.message);send(res,e.status||500,{error:e.status?e.message:'서버 오류가 발생했습니다.'})}));
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`FOOD FINDER listening on ${PORT}`));
module.exports={server,DEMO};

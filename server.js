'use strict';
// Zero-dependency Node.js web server (Node 20+)
const http=require('node:http');
const https=require('node:https');
const dns=require('node:dns').promises;
const net=require('node:net');
const tls=require('node:tls');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const search=require('./lib/search');
const enrich=require('./lib/nutrition').createEnricher();
const snapshots=new Map();
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
// Core HTTP(S) client uses family:4 to avoid broken IPv6 routes on some hosts.
// Upstream destination is fixed in production; never log request paths containing the key.
const HOST='openapi.foodsafetykorea.go.kr';
function remoteRequest({protocol,relativePath,timeoutMs=12000,host=HOST,port}){
 return new Promise((resolve,reject)=>{
  let req,stage='DNS',socketAddress='',finished=false;
  const began=Date.now();
  const fail=(code,phase)=>{
   if(finished)return;
   finished=true;clearTimeout(deadline);
   const error=new Error(`${phase}: ${code}`);
   error.code=code;error.stage=phase;error.elapsed_ms=Date.now()-began;
   reject(error);
  };
  const deadline=setTimeout(()=>{
   const oldStage=stage;
   req?.destroy();fail('TIMEOUT',oldStage);
  },timeoutMs);
  const proto=protocol==='https'?https:http;
  try{
   req=proto.request({
    protocol:protocol+':',hostname:host,port:port||(protocol==='https'?443:80),
    path:relativePath,method:'GET',family:4,servername:protocol==='https'?host:undefined,
    headers:{'Accept':'application/json','User-Agent':'FoodFinderWeb/0.3'}
   },res=>{
    stage='response_body';
    const chunks=[];let size=0;
    res.on('data',chunk=>{
     size+=chunk.length;
     if(size>3*1024*1024){req.destroy();fail('RESPONSE_TOO_LARGE',stage);return;}
     chunks.push(chunk);
    });
    res.on('error',e=>fail(e.code||'RESPONSE_ERROR',stage));
    res.on('end',()=>{
     if(finished)return;
     finished=true;clearTimeout(deadline);
     const elapsed_ms=Date.now()-began;
     const raw=Buffer.concat(chunks).toString('utf8');
     if(res.statusCode!==200){
      const e=new Error(`HTTP_${res.statusCode}`);e.code=`HTTP_${res.statusCode}`;e.stage='HTTP';
      e.elapsed_ms=elapsed_ms;reject(e);return;
     }
     try{resolve({data:JSON.parse(raw),meta:{protocol,elapsed_ms,remote_ipv4:socketAddress}});}
     catch{const e=new Error('INVALID_JSON');e.code='INVALID_JSON';e.stage='response_body';reject(e);}
    });
   });
   req.on('socket',socket=>{
    socket.on('lookup',(err,address)=>{if(!err){socketAddress=address;stage='TCP';}});
    socket.on('connect',()=>{stage=protocol==='https'?'TLS':'waiting_response';});
    socket.on('secureConnect',()=>{stage='waiting_response';});
   });
   req.on('error',e=>fail(e.code||'NETWORK_ERROR',stage));
   req.end();
  }catch(e){fail(e.code||'REQUEST_ERROR',stage);}
 });
}
function interpretApiData(data,service){
 const section=data?.[service]||{},result=section.RESULT||data.RESULT||{};
 const code=result.CODE||((section.row||[]).length?'INFO-000':'UNKNOWN');
 if(code==='INFO-200')return {rows:[],total:0};
 if(code!=='INFO-000')throw Object.assign(new Error(`식품안전나라 API 응답: ${code} / ${result.MSG||'확인 필요'}`),{status:502});
 return {rows:Array.isArray(section.row)?section.row:[],total:Number(section.total_count||0)};
}
async function fetchAPI(service,field,term,limit,start=1){
 const k=key();if(!k)throw Object.assign(new Error('서버에 FOODSAFETY_API_KEY가 설정되지 않았습니다.'),{status:503});
 if(!/^[a-zA-Z0-9_-]+$/.test(k))throw Object.assign(new Error('API 키 형식이 올바르지 않습니다.'),{status:503});
 if(!['I1250','C002'].includes(service)||!(service==='I1250'?search.FIELDS:['PRDLST_REPORT_NO']).includes(field))throw new Error('허용되지 않은 조회 조건');
 const suffix=`/api/${k}/${service}/json/${start}/${start+limit-1}/${field}=${encodeURIComponent(term)}`;
 const bridge=(process.env.FOOD_FINDER_BRIDGE_URL||'').trim();
 if(bridge){
  let endpoint;
  try{endpoint=new URL(bridge);}catch{throw Object.assign(new Error('FOOD_FINDER_BRIDGE_URL 설정 오류'),{status:503});}
  if(endpoint.protocol!=='https:' || endpoint.username || endpoint.password || endpoint.pathname!=='/api/bridge')
    throw Object.assign(new Error('중계 서버 주소는 https://.../api/bridge 형식이어야 합니다.'),{status:503});
  const timestamp=Date.now().toString();
  const payload={service,field,term,limit,start};
  const signing=[timestamp,service,field,term,String(limit),String(start)].join('\n');
  const signature=crypto.createHmac('sha256',k).update(signing).digest('hex');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),35000);
  try{
   const response=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json','X-Food-Finder-Timestamp':timestamp,'X-Food-Finder-Signature':signature},body:JSON.stringify(payload),signal:controller.signal});
   const data=await response.json();
   if(!response.ok)throw Object.assign(new Error('서울 중계: '+(data.error||'HTTP '+response.status)),{status:502});
   if(!Array.isArray(data.rows))throw Object.assign(new Error('서울 중계 응답 형식 오류'),{status:502});
   return {rows:data.rows,total:Number(data.total||0)};
  }catch(e){
   if(e.status)throw e;
   throw Object.assign(new Error('서울 중계 연결 오류: '+(e.name==='AbortError'?'요청 시간 초과':e.message)),{status:502});
  }finally{clearTimeout(timer);}
 }
 const failures=[];
 // Secure HTTPS first. API official documentation also offers HTTP, used only as fallback.
 for(const protocol of ['https','http']){
  try{
   const {data}=await remoteRequest({protocol,relativePath:suffix,timeoutMs:14000});
   return interpretApiData(data,service);
  }catch(e){
   if(e.status)throw e;  // Valid API JSON with an authentication/permission error: don't retry.
   const reason=`${protocol.toUpperCase()} ${e.stage||'network'} ${e.code||'UNKNOWN'}`;
   failures.push(reason);
   if(/^HTTP_4/.test(e.code||''))break;
  }
 }
 throw Object.assign(new Error(`식품안전나라 연결 오류: ${failures.join(' / ')}. 네트워크 진단 페이지(/diagnostics)를 확인하세요.`),{status:502});
}
function portProbe(port,secure,timeoutMs=6000){
 return new Promise(resolve=>{
  const began=Date.now();let finished=false;
  const finish=(ok,reason)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   socket.destroy();resolve({ok,detail:reason,ms:Date.now()-began});
  };
  const socket=secure?tls.connect({host:HOST,port,servername:HOST,family:4,rejectUnauthorized:true}):net.createConnection({host:HOST,port,family:4});
  const timer=setTimeout(()=>finish(false,'TIMEOUT'),timeoutMs);
  socket.on(secure?'secureConnect':'connect',()=>finish(true,'connected'));
  socket.on('error',e=>finish(false,e.code||'NETWORK_ERROR'));
 });
}
let diagnosticCache=null;
async function diagnose(){
 const now=Date.now();
 if(diagnosticCache&&now<diagnosticCache.expires)return diagnosticCache.promise;
 const promise=(async()=>{
  const report={version:'0.6',bridge_configured:!!process.env.FOOD_FINDER_BRIDGE_URL,api_key_configured:!!key(),tested_at:new Date().toISOString(),tests:[]};
  try{
   const started=Date.now();const records=await dns.lookup(HOST,{family:4,all:true});
   report.tests.push({name:'DNS IPv4',ok:records.length>0,detail:records.map(x=>x.address).join(', '),ms:Date.now()-started});
  }catch(e){report.tests.push({name:'DNS IPv4',ok:false,detail:e.code||'DNS_ERROR'});}
  const [p80,p443]=await Promise.all([portProbe(80,false),portProbe(443,true)]);
  report.tests.push({name:'TCP 80 (HTTP)',...p80},{name:'TLS 443 (HTTPS)',...p443});
  if(!key())return report;
  const suffix=`/api/${key()}/I1250/json/1/1`;
  const checks=await Promise.all(['https','http'].map(async protocol=>{
   try{
    const {data,meta}=await remoteRequest({protocol,relativePath:suffix,timeoutMs:8000});
    const result=data?.I1250?.RESULT||data?.RESULT||{};
    return {name:`I1250 ${protocol.toUpperCase()}`,ok:result.CODE==='INFO-000',detail:result.CODE||'NO_RESULT_CODE',ms:meta.elapsed_ms};
   }catch(e){return {name:`I1250 ${protocol.toUpperCase()}`,ok:false,detail:`${e.stage||'network'}: ${e.code||'UNKNOWN'}`,ms:e.elapsed_ms||null};}
  }));
  report.tests.push(...checks);
  if(process.env.FOOD_FINDER_BRIDGE_URL){
   try{
    const started=Date.now();
    const via=await fetchAPI('I1250','PRDLST_NM','간장',1);
    report.tests.push({name:'서울 중계 I1250',ok:Array.isArray(via.rows),detail:'조회 성공 · '+via.rows.length+'건',ms:Date.now()-started});
   }catch(e){report.tests.push({name:'서울 중계 I1250',ok:false,detail:e.message.replace(/\/api\/[^/]+\//g,'/api/[REDACTED]/')});}
  }
  return report;
 })();
 diagnosticCache={expires:now+120000,promise};
 return promise;
}
const DIAGNOSTICS_HTML=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FOOD FINDER 연결 진단</title><style>body{font-family:system-ui,sans-serif;background:#f6faf9;color:#18332e;margin:0;padding:24px}main{max-width:720px;margin:auto}h1{font-size:27px}.sub{color:#526b64}article{background:white;border:1px solid #dfeae5;padding:16px;border-radius:12px;margin:10px 0}.good{color:#087d56}.bad{color:#b14527}small{color:#777}button{border:0;border-radius:8px;background:#0a8068;color:white;padding:12px 16px;cursor:pointer}code{font-family:ui-monospace,monospace}pre{background:#e9f0ed;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere}.tip{padding:16px;background:#fff8e9;border:1px solid #ecdcab;border-radius:8px}</style><main><h1>FOOD FINDER 연결 진단</h1><p class="sub">Render 서버가 식품안전나라에 연결되는지 확인합니다. 서울 중계 설정 여부도 확인하세요. 인증키는 화면에 표시되지 않습니다.</p><p id="summary">확인 중…</p><div id="results"></div><p class="tip">화면의 진단 결과를 캡처해서 공유해 주세요. API 인증키를 공유할 필요는 없습니다.</p><button id="again">다시 확인</button><script>async function run(){document.getElementById('summary').textContent='확인 중…';document.getElementById('results').replaceChildren();try{const r=await fetch('/api/diagnostics');const d=await r.json();document.getElementById('summary').textContent=d.api_key_configured?'인증키 설정 확인됨 · 서버 연결 결과는 아래 참고':'인증키가 설정되어 있지 않습니다';for(const t of d.tests){const card=document.createElement('article');const h=document.createElement('strong');h.textContent=(t.ok?'✅ ':'❌ ')+t.name;h.className=t.ok?'good':'bad';const p=document.createElement('p');p.textContent=t.detail||'';const s=document.createElement('small');s.textContent=t.ms==null?'':t.ms+'ms';card.append(h,p,s);document.getElementById('results').append(card)}}catch(e){document.getElementById('summary').textContent='진단 요청 실패: '+e.message}}document.getElementById('again').onclick=run;run()</script></main></html>`;
async function route(req,res){
 const u=new URL(req.url,'http://localhost');
 if(req.method!=='GET')return send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(u.pathname==='/health')return send(res,200,{status:'ok',api_configured:!!key(),version:'0.6',bridge_configured:!!process.env.FOOD_FINDER_BRIDGE_URL});
 if(u.pathname==='/api/diagnostics')return send(res,200,await diagnose());
 if(u.pathname==='/diagnostics'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(DIAGNOSTICS_HTML);}
 if(u.pathname==='/api/search'){
  const o=search.options(u.searchParams),mode=u.searchParams.get('mode')||'live';
  if(!['demo','live'].includes(mode))return send(res,400,{error:'검색 모드가 올바르지 않습니다.'});
  let rows;
  if(mode==='demo')rows=DEMO.filter(p=>(o.field==='all'?search.FIELDS:[o.field]).some(f=>String(p[f]||'').toLowerCase().includes(o.q.toLowerCase())));
  else{
   if(!key())return send(res,503,{error:'서버에 FOODSAFETY_API_KEY가 설정되지 않았습니다.'});
   const id=JSON.stringify([o.q,o.field]);let cached=snapshots.get(id);
   if(!cached||cached.expires<Date.now()){
    if(snapshots.size>=20)snapshots.delete(snapshots.keys().next().value);
    cached={expires:Date.now()+300000,promise:search.collect(fetchAPI,o.q,o.field)};
    snapshots.set(id,cached);
    cached.promise.catch(()=>{if(snapshots.get(id)===cached)snapshots.delete(id)});
   }
   rows=await cached.promise;
  }
  const result=search.select(rows,o);
  result.rows=mode==='live'?await enrich(result.rows):result.rows.map(p=>({...p,nutrition:require('./lib/nutrition').missing('demo')}));
  return send(res,200,{...result,mode,notice:mode==='live'?'식품안전나라 공식 API · 검색 결과 5분 캐시 · 영양정보는 품목번호가 일치하는 단일 자료만 표시':'체험 데이터 (실시간 조회 아님)'});
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
 const assets={'/':'index.html','/static/app.js':'static/app.js','/static/search-ui.js':'static/search-ui.js','/static/style.css':'static/style.css'};
 if(!assets[u.pathname])return send(res,404,{error:'페이지를 찾을 수 없습니다.'});
 const file=path.join(root,assets[u.pathname]);
 let body=fs.readFileSync(file);
 if(u.pathname==='/'){
  const enabled=!!key();
  body=Buffer.from(body.toString().replace('__API_STATUS__',enabled?'실시간 API 설정됨':'실시간 API 설정 필요').replace('__HINT__',enabled?'공식 API 조회 결과를 제공합니다. 영양정보 미연결 또는 미확인 항목은 미제공으로 표시합니다.':'실시간 조회를 위해 서버 API 설정이 필요합니다.'));
 }
 res.writeHead(200,{'Content-Type':u.pathname.endsWith('.js')?'text/javascript; charset=utf-8':u.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(body);
}
const server=http.createServer((req,res)=>route(req,res).catch(e=>{console.error('Request error:',e.message);send(res,e.status||500,{error:e.status?e.message:'서버 오류가 발생했습니다.'})}));
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`FOOD FINDER listening on ${PORT}`));
module.exports={server,DEMO,remoteRequest,interpretApiData};

'use strict';
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const KEY = () => (process.env.FOODSAFETY_API_KEY || '').trim();
const HOST = 'openapi.foodsafetykorea.go.kr';
const MAX_BYTES = 3 * 1024 * 1024;
function reply(res,status,obj){ res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(obj)); }
function canonical(ts,service,field,term,limit,start=1){ return [String(ts),service,field,term,String(limit),String(start)].join('\n'); }
function signed(ts,sig,service,field,term,limit,start=1){
 if(!KEY() || typeof sig!=='string' || !/^[a-f0-9]{64}$/i.test(sig) || !Number.isSafeInteger(Number(ts)) || Math.abs(Date.now()-Number(ts))>300000)return false;
 const expected=crypto.createHmac('sha256',KEY()).update(canonical(ts,service,field,term,limit,start)).digest();
 return crypto.timingSafeEqual(expected,Buffer.from(sig,'hex'));
}
function fetchUpstream(protocol,path,timeoutMs=11000){
 return new Promise((resolve,reject)=>{
  const mod=protocol==='https'?https:http; let count=0,done=false;const chunks=[];
  const req=mod.get({hostname:HOST,port:protocol==='https'?443:80,path,method:'GET',family:4,headers:{'Accept':'application/json','User-Agent':'FoodFinderBridge/0.4'}},res=>{
   res.on('data',chunk=>{count+=chunk.length;if(count>MAX_BYTES){req.destroy(Object.assign(new Error('RESPONSE_TOO_LARGE'),{code:'RESPONSE_TOO_LARGE'}));return;}chunks.push(chunk);});
   res.on('error',reject);
   res.on('end',()=>{if(done)return;done=true;if(res.statusCode!==200)return reject(Object.assign(new Error('HTTP_'+res.statusCode),{code:'HTTP_'+res.statusCode}));try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Object.assign(new Error('INVALID_JSON'),{code:'INVALID_JSON'}));}});
  });
  req.setTimeout(timeoutMs,()=>req.destroy(Object.assign(new Error('TIMEOUT'),{code:'TIMEOUT'})));
  req.on('error',e=>{if(!done){done=true;reject(e);}});
 });
}
function normalize(data,service){
 const body=data?.[service]||{}, result=body.RESULT||data?.RESULT||{},code=result.CODE || (Array.isArray(body.row)&&body.row.length?'INFO-000':'UNKNOWN');
 if(code==='INFO-200')return {rows:[],total:0};
 if(code!=='INFO-000')throw Object.assign(new Error('식품안전나라 응답: '+code+' '+(result.MSG||'')),{status:502});
 return {rows:Array.isArray(body.row)?body.row:[],total:Number(body.total_count||0)};
}
async function requestBody(req){
 if(req.body&&typeof req.body==='object')return req.body;
 if(typeof req.body==='string')return JSON.parse(req.body);
 return new Promise((resolve,reject)=>{let len=0;const parts=[];req.on('data',b=>{len+=b.length;if(len>4096){reject(new Error('TOO_LARGE'));req.destroy();return;}parts.push(b);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch(e){reject(e);}});req.on('error',reject)});
}
async function handler(req,res){
 if(req.method!=='POST')return reply(res,405,{error:'POST만 허용'});
 if(!KEY())return reply(res,503,{error:'Vercel 환경변수 FOODSAFETY_API_KEY 미설정'});
 let b;try{b=await requestBody(req);}catch{return reply(res,400,{error:'JSON 본문 오류'});}
 const {service,field,term,limit,start=1}=b||{};
 if(service==='nutrition'){
  if(field!=='ITEM_REPORT_NO'||typeof term!=='string'||!/^\d{4,40}$/.test(term)||limit!==1||start!==1)return reply(res,400,{error:'조회 조건 오류'});
  if(!signed(req.headers['x-food-finder-timestamp'],req.headers['x-food-finder-signature'],service,field,term,limit,start))return reply(res,401,{error:'중계 인증 실패'});
  const [row]=await require('../lib/nutrition').createEnricher(fetch,false)([{PRDLST_REPORT_NO:term}]);
  return reply(res,200,{nutrition:row.nutrition});
 }
 if(!['I1250','C002'].includes(service)||!(service==='I1250'?require('../lib/search').FIELDS:['PRDLST_REPORT_NO']).includes(field)||typeof term!=='string'||term.trim()!==term||term.length<2||term.length>80||!Number.isInteger(limit)||limit<1||limit>1000||!Number.isSafeInteger(start)||start<1||!Number.isSafeInteger(start+limit-1))return reply(res,400,{error:'조회 조건 오류'});
 if(!signed(req.headers['x-food-finder-timestamp'],req.headers['x-food-finder-signature'],service,field,term,limit,start))return reply(res,401,{error:'중계 인증 실패: 양쪽 서버 API 키 동일 여부 확인'});
 const target=`/api/${KEY()}/${service}/json/${start}/${start+limit-1}/${field}=${encodeURIComponent(term)}`;
 const errs=[];
 for(const protocol of ['https','http']){
  try{return reply(res,200,{...normalize(await fetchUpstream(protocol,target),service),upstream:protocol});}
  catch(e){if(e.status)return reply(res,e.status,{error:e.message});errs.push(protocol+':'+(e.code||'NETWORK_ERROR'));}
 }
 return reply(res,502,{error:'서울 서버에서도 식품안전나라 연결 실패: '+errs.join(' / ')});
}
module.exports=handler;
module.exports.testOnly={canonical,signed,normalize};

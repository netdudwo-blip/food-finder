'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
test('live HTTP route signs bridge ranges, fetches 1103 results, then filters and paginates cached snapshot',async()=>{
 const nativeFetch=global.fetch,oldKey=process.env.FOODSAFETY_API_KEY,oldBridge=process.env.FOOD_FINDER_BRIDGE_URL;
 process.env.FOODSAFETY_API_KEY='integration-test';process.env.FOOD_FINDER_BRIDGE_URL='https://bridge.example/api/bridge';
 const source=Array.from({length:1103},(_,i)=>({PRDLST_NM:'검증 제품 '+i,PRDLST_REPORT_NO:String(100000+i),BSSH_NM:i%2?'가':'나',PRDLST_DCNM:'소스',PRMS_DT:String(20200101+i)}));const calls=[];
 global.fetch=async(url,init)=>{
  assert.equal(String(url),'https://bridge.example/api/bridge');const b=JSON.parse(init.body);calls.push(b);
  const {signed}=require('./api/bridge').testOnly;
  assert.equal(signed(init.headers['X-Food-Finder-Timestamp'],init.headers['X-Food-Finder-Signature'],b.service,b.field,b.term,b.limit,b.start),true);
  return {ok:true,json:async()=>({rows:source.slice(b.start-1,b.start-1+b.limit),total:source.length})};
 };
 process.env.FOOD_SEARCH_CACHE_DIR=require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'food-integration-'));
 const {server}=require('./server');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  let response=await nativeFetch(base+'/api/search?'+new URLSearchParams({q:'검증',field:'PRDLST_NM',page:6,size:10}));assert.equal(response.status,200);let data=await response.json();assert.equal(data.total,1103);assert.equal(data.rows[0].PRDLST_REPORT_NO,'100050');assert.deepEqual(calls.map(c=>[c.start,c.limit]),[[1,1000],[1001,1000]]);
  response=await nativeFetch(base+'/api/search?'+new URLSearchParams({q:'검증',field:'PRDLST_NM',manufacturer:'가',sort:'date',page:2,size:30}));data=await response.json();assert.equal(data.total,551);assert.equal(data.rows.length,30);assert.ok(data.rows.every(p=>p.BSSH_NM==='가'));assert.equal(calls.length,2);
 }finally{
  global.fetch=nativeFetch;if(oldKey===undefined)delete process.env.FOODSAFETY_API_KEY;else process.env.FOODSAFETY_API_KEY=oldKey;
  if(oldBridge===undefined)delete process.env.FOOD_FINDER_BRIDGE_URL;else process.env.FOOD_FINDER_BRIDGE_URL=oldBridge;
  await new Promise(resolve=>server.close(resolve));
 }
});

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { remoteRequest, interpretApiData } = require('./server');

async function withServer(handler, action){
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try { return await action(server.address().port); }
 finally { await new Promise(resolve=>server.close(resolve)); }
}

test('IPv4 upstream request reads and parses JSON from a mock API', async()=>{
 await withServer((req,res)=>{
  assert.equal(req.url,'/api/sample/I1250/json/1/1');
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({I1250:{RESULT:{CODE:'INFO-000',MSG:'정상 처리되었습니다'},total_count:'1',row:[{PRDLST_NM:'간장'}]}}));
 },async port=>{
  const {data,meta}=await remoteRequest({protocol:'http',host:'127.0.0.1',port,relativePath:'/api/sample/I1250/json/1/1',timeoutMs:2000});
  assert.equal(data.I1250.row[0].PRDLST_NM,'간장');
  assert.equal(meta.protocol,'http');
  assert.equal(interpretApiData(data,'I1250').total,1);
 });
});

test('IPv4 upstream request reports timeout without leaking URL', async()=>{
 await withServer((_req,res)=>{setTimeout(()=>res.end('{}'),200);},async port=>{
  await assert.rejects(
   remoteRequest({protocol:'http',host:'127.0.0.1',port,relativePath:'/api/privateKeyNotShown/I1250/json/1/1',timeoutMs:45}),
   e=>e.code==='TIMEOUT'&&!e.message.includes('privateKeyNotShown')
  );
 });
});

test('MFDS response code INFO-110 gives explicit permission error',()=>{
 assert.throws(
  ()=>interpretApiData({I1250:{RESULT:{CODE:'INFO-110',MSG:'활용 신청 내역이 없습니다'}}},'I1250'),
  /INFO-110/
 );
});

test('MFDS response with empty rows is handled gracefully',()=>{
 const result=interpretApiData({I1250:{total_count:'0',RESULT:{CODE:'INFO-200',MSG:'No data'}}},'I1250');
 assert.deepEqual(result,{rows:[],total:0});
});

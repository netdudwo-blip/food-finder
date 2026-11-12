'use strict';
const dns=require('node:dns').promises;
const net=require('node:net');
const HOST='openapi.foodsafetykorea.go.kr';
function check(port){return new Promise(resolve=>{const socket=net.createConnection({host:HOST,port,family:4});let done=false;const finish=(ok,reason)=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();resolve({ok,detail:reason});};const timer=setTimeout(()=>finish(false,'TIMEOUT'),4500);socket.on('connect',()=>finish(true,'CONNECTED'));socket.on('error',e=>finish(false,e.code||'NETWORK_ERROR'));});}
module.exports=async(req,res)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'GET only'}));}const report={service:'FOOD FINDER Seoul bridge',region:process.env.VERCEL_REGION||'unknown',key_configured:!!process.env.FOODSAFETY_API_KEY,checked_at:new Date().toISOString()};try{report.dns=await dns.lookup(HOST,{family:4});}catch(e){report.dns_error=e.code;}const [p80,p443]=await Promise.all([check(80),check(443)]);report.http80=p80;report.https443=p443;res.end(JSON.stringify(report));};

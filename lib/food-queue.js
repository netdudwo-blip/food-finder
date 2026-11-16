'use strict';
const {setTimeout:sleep}=require('node:timers/promises');

// The provider locks the key across all food-safety services.
module.exports=function serializeFoodRequests(request,wait=sleep){
 let tail=Promise.resolve(),pending=0;
 return function enqueue(...args){
  if(pending>=20)return Promise.reject(Object.assign(new Error('검색 요청이 많습니다. 잠시 후 다시 검색해 주세요.'),{status:503}));
  pending++;
  const result=tail.then(async()=>{
   for(const delay of [250,800,1600,3200]){
    await wait(delay);
    try{return await request(...args);}
    catch(error){if(!/\bINFO-500\b/.test(error.message))throw error;}
   }
   throw Object.assign(new Error('식품안전나라가 이전 요청을 처리 중입니다. 잠시 후 다시 검색해 주세요.'),{status:503});
  });
  tail=result.then(()=>{pending--;},()=>{pending--;});
  return result;
 };
};

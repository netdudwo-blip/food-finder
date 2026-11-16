'use strict';
const ENDPOINT='https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03';
const missing=reason=>({category:null,energy:null,basis:null,status:reason,source:'식품의약품안전처 식품영양성분DB'});
function matchNutrition(data,no){
 const response=data.response||data,header=response.header;
 if(!header||!['00','0','000'].includes(String(header.resultCode))){
  const code=String(header?.resultCode??'');
  throw Object.assign(new Error('영양성분 API 오류'),{reason:/^\d{1,3}$/.test(code)?'service_'+code:'invalid_response'});
 }
 const body=response.body||{},raw=body.items?.item??body.items??[];
 const rows=Array.isArray(raw)?raw:raw&&typeof raw==='object'?[raw]:[];
 if(Number(body.totalCount)>rows.length)return missing('incomplete');
 const matches=rows.filter(p=>String(p.ITEM_REPORT_NO||'').trim()===no);
 if(matches.length!==1)return missing(matches.length?'ambiguous':'not_available');
 const p=matches[0],s=String(p.AMT_NUM1??'').trim();
 const energy=/^\d+(\.\d+)?$/.test(s)?Number(s):null;
 return {category:String(p.FOOD_CAT1_NM||'').trim()||null,energy,basis:String(p.SERVING_SIZE||'').trim()||null,status:'matched',source:'식품의약품안전처 식품영양성분DB',food_code:p.FOOD_CD||null};
}
async function lookupViaBridge(no,signal){
 const url=new URL(process.env.FOOD_FINDER_BRIDGE_URL);
 if(url.protocol!=='https:'||url.pathname!=='/api/bridge'||url.username||url.password)throw new Error('invalid bridge');
 const timestamp=String(Date.now());
 const payload={service:'nutrition',field:'ITEM_REPORT_NO',term:no,limit:1,start:1};
 const signature=require('node:crypto').createHmac('sha256',process.env.FOODSAFETY_API_KEY.trim()).update([timestamp,payload.service,payload.field,no,1,1].join('\n')).digest('hex');
 const response=await fetch(url,{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json','X-Food-Finder-Timestamp':timestamp,'X-Food-Finder-Signature':signature},body:JSON.stringify(payload)});
 if(!response.ok)throw new Error('bridge unavailable');
 const {nutrition}=await response.json();
 if(!nutrition?.status)throw new Error('invalid bridge response');
 if(nutrition.status==='not_configured')return {...missing('api_error'),reason:'bridge_nutrition_key_missing'};
 return nutrition;
}
function createEnricher(request=fetch,allowBridge=true){
 const cache=new Map();
 return async function enrich(rows){
  const key=(process.env.MFDS_NUTRITION_API_KEY||'').trim();
  const out=new Array(rows.length);let next=0;const deadline=Date.now()+18000;
  async function worker(){while(next<rows.length){const index=next++,p=rows[index];
   const no=String(p.PRDLST_REPORT_NO||'');let nutrition;
   if(!key||!no)nutrition=missing(!key?'not_configured':'not_available');
   else if(cache.get(no)?.expires>Date.now())nutrition=cache.get(no).value;
   else if(Date.now()>=deadline)nutrition=missing('api_error');
   else{
    let bridgeFailure;
    try{
     if(allowBridge&&process.env.FOOD_FINDER_BRIDGE_URL){
      try {
       const bridged=await lookupViaBridge(no,AbortSignal.timeout(Math.min(8000,Math.max(1,deadline-Date.now()))));
       if(bridged.status!=='api_error'){out[index]={...p,nutrition:bridged};if(cache.size>=1000)cache.delete(cache.keys().next().value);cache.set(no,{value:bridged,expires:Date.now()+3600000});continue;}
       bridgeFailure=bridged.reason;
      }catch{bridgeFailure='bridge_unavailable';}
     }
     const url=new URL(ENDPOINT);url.search=new URLSearchParams({serviceKey:key,pageNo:'1',numOfRows:'100',type:'json',ITEM_REPORT_NO:no});
     const r=await request(url,{signal:AbortSignal.timeout(Math.max(1,deadline-Date.now()))});
     if(!r.ok)throw Object.assign(new Error('upstream'),{reason:'http_'+r.status});
     nutrition=matchNutrition(await r.json(),no);
    }catch(error){
     const reason=error.reason||(error.name==='TimeoutError'?'timeout':error.name==='SyntaxError'?'invalid_response':'network');
     nutrition={...missing('api_error'),reason};
     if(bridgeFailure)nutrition.bridge_reason=bridgeFailure;
    }
    if(cache.size>=1000)cache.delete(cache.keys().next().value);
    cache.set(no,{value:nutrition,expires:Date.now()+(nutrition.status==='api_error'?30000:3600000)});
   }
   out[index]={...p,nutrition};
  }}
  await Promise.all(Array.from({length:Math.min(3,rows.length)},worker));
  return out;
 };
}
module.exports={matchNutrition,createEnricher,missing};

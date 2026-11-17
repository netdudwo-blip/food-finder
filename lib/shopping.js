'use strict';
const {httpsUrl,text}=require('../static/buying');
const hour=3600000;
const error=(status,message)=>Object.assign(new Error(message),{status});

function decodeWeb(data){
  const raw=data?.web?.results;
  const out=[],seen=new Set();
  for(const row of Array.isArray(raw)?raw.slice(0,10):[]){
    const link=httpsUrl(row?.url);
    const item=text(row?.title);
    if(!link||!item||seen.has(link))continue;
    const host=new URL(link).hostname;
    seen.add(link);
    out.push({item,link,host});
  }
  return out;
}
function createShopping({env=process.env,request=fetch,clock=Date.now}={}){
  let calls=[];
  const inFlight=new Map(), webKey=()=>env.BRAVE_SEARCH_API_KEY?.trim();
  const status=()=>({web:!!webKey()});
  async function search(provider,value){
    if(provider!=='web')throw error(400,'지원하지 않는 후보 검색 경로입니다.');
    const keyword=typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
    const length=[...keyword].length;
    if(length<2||length>220)throw error(400,'판매처 검색어는 2~220자로 입력하세요.');
    const config=webKey();
    if(!config)throw error(503,'이 판매처 검색 API가 설정되지 않았습니다. 외부 검색 링크를 사용해 주세요.');
    if(inFlight.has(keyword))return inFlight.get(keyword);
    const now=clock();
    calls=calls.filter(t=>now-t<hour);
    if(calls.length>=10)throw error(429,'자동 후보 검색 한도에 도달했습니다. 외부 검색 링크를 사용해 주세요.');
    calls.push(now);
    const params=new URLSearchParams({q:keyword,country:'KR',search_lang:'ko',count:'10'});
    const url='https://api.search.brave.com/res/v1/web/search?'+params;
    const headers={Accept:'application/json','X-Subscription-Token':config};
    const promise=(async()=>{
      try{
        const response=await request(url,{headers,redirect:'error',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw error(response.status===429?429:502,'판매처 검색 응답을 가져오지 못했습니다. 외부 검색 링크를 사용해 주세요.');
        return {provider,keyword,items:decodeWeb(await response.json())};
      }catch(e){
        if(e.status)throw e;
        throw error(502,'판매처 검색 연결에 실패했습니다. 외부 검색 링크를 사용해 주세요.');
      }
    })();
    inFlight.set(keyword,promise);
    try{return await promise;}finally{inFlight.delete(keyword);}
  }
  return {status,search};
}
module.exports={createShopping};

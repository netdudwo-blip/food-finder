'use strict';
// Pure helpers shared with the browser tests.
(function(root){
 const clean=items=>Array.isArray(items)?items.filter(x=>typeof x==='string'&&x.trim().length>=2&&x.length<=80).filter((v,i,a)=>a.indexOf(v)===i).slice(0,10):[];
 const remember=(items,q)=>clean([q.trim(),...clean(items).filter(x=>x!==q.trim())]);
 const storageKey='food-finder-history';
 function readHistory(){try{return clean(JSON.parse(root.localStorage.getItem(storageKey)||'[]'));}catch{return [];}}
 function saveHistory(q){try{root.localStorage.setItem(storageKey,JSON.stringify(remember(readHistory(),q)));}catch{}}
 function clearHistory(){try{root.localStorage.removeItem(storageKey);}catch{}}
 async function findProducts(q,mode,field,signal){
  const r=await root.fetch('/api/search?'+new URLSearchParams({q,mode,field,view:'list'}),{signal});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'검색 실패');
  if(!Array.isArray(data.rows))throw new Error('검색 응답을 확인할 수 없습니다.');
  return data;
 }
 const api={clean,remember,readHistory,saveHistory,clearHistory,findProducts};
 if(typeof module==='object')module.exports=api;else root.SearchUI=api;
})(globalThis);

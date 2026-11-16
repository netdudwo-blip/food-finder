'use strict';
// Pure helpers shared with the browser tests.
(function(root){
 const clean=items=>Array.isArray(items)?items.filter(x=>typeof x==='string'&&x.trim().length>=2&&x.length<=80).filter((v,i,a)=>a.indexOf(v)===i).slice(0,10):[];
 const remember=(items,q)=>clean([q.trim(),...clean(items).filter(x=>x!==q.trim())]);
 const api={clean,remember};
 if(typeof module==='object')module.exports=api;else root.SearchUI=api;
})(globalThis);

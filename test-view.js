'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('view changes reuse search results even while nutrition is pending',async()=>{
 const elements=new Map(),requests=[];
 function element(){
  return {value:'',children:[],listeners:{},classList:{add(){},remove(){}},setAttribute(){},
   append(child){this.children.push(child);this.lastChild=child},replaceChildren(){this.children=[]},
   addEventListener(type,fn){this.listeners[type]=fn}};
 }
 function get(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}
 const rows=Array.from({length:65},(_,i)=>({PRDLST_REPORT_NO:String(1000+i),PRDLST_NM:'대상'+i}));
 const context=vm.createContext({URLSearchParams,AbortController,
  document:{getElementById:get,createElement:element,addEventListener(){},querySelectorAll(){return []}},
  fetch:async url=>{requests.push(url);if(url.startsWith('/api/nutrition'))return new Promise(()=>{});
   return {ok:true,json:async()=>({rows})}}});
 for(const file of ['result-page','app'])vm.runInContext(fs.readFileSync(__dirname+'/static/'+file+'.js','utf8'),context);
 get('pageSize').value='10';get('mode').value='live';get('searchField').value='all';
 await vm.runInContext("doSearch('대상')",context);
 for(const size of [10,30,50]){
  get('pageSize').value=String(size);get('pageSize').listeners.change();
  assert.equal((get('resultlist').innerHTML.match(/data-index=/g)||[]).length,size);
  assert.equal(get('searchBtn').disabled,false);
 }
 get('pagination').children.at(-1).onclick();
 assert.equal((get('resultlist').innerHTML.match(/data-index=/g)||[]).length,15);
 assert.equal(requests.filter(url=>url.startsWith('/api/search?')).length,1);
 assert.equal(requests.filter(url=>url.startsWith('/api/nutrition?')).length,1);
});

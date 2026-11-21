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
 const context=vm.createContext({URLSearchParams,AbortController,setInterval,clearInterval,
  document:{getElementById:get,createElement:element,addEventListener(){},querySelectorAll(){return []}},
  fetch:async url=>{requests.push(url);if(url.startsWith('/api/nutrition'))return new Promise(()=>{});
   return {ok:true,json:async()=>({rows})}}});
 for(const file of ['search-ui','result-page','app'])vm.runInContext(fs.readFileSync(__dirname+'/static/'+file+'.js','utf8'),context);
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

test('search loading counts real elapsed seconds, replaces old timers and stops on success or failure',async()=>{
 const elements=new Map(),timers=new Map(),pending=[];let now=0,nextTimer=0;
 const element=()=>({value:'',children:[],classList:{add(){},remove(){}},attrs:{},setAttribute(k,v){this.attrs[k]=v},append(child){this.children.push(child);this.lastChild=child},replaceChildren(){this.children=[]},addEventListener(){}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 const context=vm.createContext({URLSearchParams,AbortController,Date:{now:()=>now},setInterval:fn=>{timers.set(++nextTimer,fn);return nextTimer},clearInterval:id=>timers.delete(id),
  SearchUI:{findProducts:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))},
  document:{getElementById:get,createElement:element,addEventListener(){},querySelectorAll(){return []}}});
 for(const file of ['result-page','app'])vm.runInContext(fs.readFileSync(__dirname+'/static/'+file+'.js','utf8'),context);
 get('mode').value='demo';get('pageSize').value='10';
 const first=vm.runInContext("doSearch('첫검색')",context);
 assert.match(get('resultlist').innerHTML,/데이터를 가져오는 중/);assert.equal(get('resultlist').attrs['aria-busy'],'true');
 now=3000;[...timers.values()].forEach(fn=>fn());assert.equal(get('search-elapsed').textContent,'3초 경과');
 const second=vm.runInContext("doSearch('새검색')",context);assert.equal(timers.size,1);
 pending[0].resolve({rows:[]});await first;assert.equal(timers.size,1);assert.equal(get('searchBtn').disabled,true);
 now=19000;[...timers.values()].forEach(fn=>fn());assert.equal(get('search-elapsed').textContent,'16초 경과');assert.match(get('search-wait-note').textContent,/지연/);
 pending[1].resolve({rows:[]});await second;assert.equal(timers.size,0);assert.equal(get('resultlist').attrs['aria-busy'],'false');assert.equal(get('searchBtn').disabled,false);
 const third=vm.runInContext("doSearch('오류검색')",context);pending[2].reject(Error('조회 오류'));await third;assert.equal(timers.size,0);assert.equal(get('resultmode').textContent,'검색 실패');assert.equal(get('resultlist').attrs['aria-busy'],'false');
});

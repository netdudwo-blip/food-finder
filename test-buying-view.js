'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const model=require('./static/buying');
const wait=()=>new Promise(resolve=>setImmediate(resolve));
const soy={PRDLST_NM:'매일맛있는진간장',BSSH_NM:'매일식품주식회사',PRDLST_REPORT_NO:'195505090014',LCNS_NO:'19550509001',PRDLST_DCNM:'혼합간장'};
const other={...soy,PRDLST_REPORT_NO:'195505090015'};

function mount(){
  const reads=[],requests=[],docEvents={},store=new Map();
  const nodes=new Map();
  function node(tag='div'){
    const attrs=new Map(),classes=new Set();
    return {tag,attrs,events:{},style:{},children:[],hidden:false,textContent:'',value:'',innerHTML:'',disabled:false,
      classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle(k,v){if(v)classes.add(k);else classes.delete(k);}},
      setAttribute(k,v){attrs.set(k,v);},hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k),
      addEventListener(k,v){this.events[k]=v;},append(...args){this.children.push(...args);},replaceChildren(...args){this.children=args;},
      focus(){this.focused=true;},querySelector(selector){return this.children.find(x=>selector==='nav'||x.attrs?.get('aria-current')==='page')??null;}};
  }
  const html=fs.readFileSync(__dirname+'/index.html','utf8');
  for(const [,id] of html.matchAll(/\bid="(bid-[a-z-]+)"/g))nodes.set(id,node());
  for(const id of ['mode','query','searchHint','searchForm','searchField','searchBtn','history'])nodes.set('bid-'+id,node());
  nodes.get('bid-mode').value='live';nodes.get('bid-searchField').value='all';
  const orig=node();orig.cloneNode=()=>({querySelectorAll:()=>[],childNodes:[]});nodes.set('search',orig);
  for(const name of ['base-form','quote-form']){
    const map=new Map();const form=nodes.get('bid-'+name);
    form.elements={namedItem(k){if(!map.has(k))map.set(k,node('input'));return map.get(k);}};
    form.reset=()=>map.clear();
  }
  const document={getElementById(id){assert.ok(nodes.has(id),id);return nodes.get(id);},createElement(tag){return node(tag);},addEventListener(k,v){docEvents[k]=v;}};
  const searchUI={readHistory:()=>[],saveHistory:()=>{},clearHistory:()=>{},async findProducts(q,mode,field){reads.push({q,mode,field});return {rows:[soy,other]};}};
  const fetch=async url=>{
    requests.push(url);
    if(url==='/api/shopping/status')return {ok:true,json:async()=>({web:true})};
    if(url.startsWith('/api/shopping/candidates?provider=web&'))return {ok:true,json:async()=>({items:[{item:'판매처 제목',link:'https://example.com/sale',host:'example.com',price:10000}]})};
    throw new Error('Unexpected request');
  };
  const legacy=[{item:'예전 제품',seller:'예전 판매처',group:'기존 기준',link:'https://example.com/legacy',price:10000,date:'2026-11-16'}];
  store.set('food-finder-quotes-v1',JSON.stringify(legacy));
  const localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  const context=vm.createContext({FoodBuying:model,SearchUI:searchUI,document,localStorage,AbortController,URLSearchParams,fetch,
    FormData:class{constructor(form){return Object.entries(form.payload);}}});
  vm.runInContext(fs.readFileSync(__dirname+'/static/buying-view.js','utf8'),context);
  return {el:id=>document.getElementById('bid-'+id),docEvents,store,reads,requests,
    results:document.getElementById('bid-finder').children[0]};
}

test('matches official IDs, paginates 10 offers, and holds the 3 option limit across pages',async()=>{
  const h=mount(),{el,results}=h;
  const nav={children:[],replaceChildren(){this.children=[];},append(x){this.children.push(x);},querySelector(){return this.children.find(n=>n.attrs.get('aria-current')==='page');}};
  results.querySelector=()=>nav;
  el('mode').value='demo';el('searchField').value='PRDLST_NM';el('query').value='진간장';
  el('searchForm').events.submit({preventDefault(){}});await wait();
  assert.deepEqual(h.reads,[{q:'진간장',mode:'demo',field:'PRDLST_NM'}]);
  assert.match(results.innerHTML,/195505090014/);assert.match(results.innerHTML,/195505090015/);
  results.events.click({target:{closest:()=>({dataset:{baseRow:'0'}})}});
  assert.equal(el('count').textContent,'12건');assert.equal(el('range').textContent,'1–10 / 12건');
  assert.equal((el('offers').innerHTML.match(/type="checkbox"/g)||[]).length,10);
  assert.match(el('list-note').textContent,/체험용으로 만든 가격/);
  el('pages').children.find(b=>b.textContent==='다음').onclick();
  assert.equal(el('range').textContent,'11–12 / 12건');
  const box={type:'checkbox',value:'demo-11',checked:true,closest:()=>({classList:{toggle(){}}})};
  el('offers').events.change({target:box});assert.equal(box.checked,false);
  assert.match(el('selection').textContent,/최대 3개/);
  results.events.click({target:{closest:()=>({dataset:{baseRow:'1'}})}});
  assert.match(el('match-mode').textContent,/유사제품/);
  assert.doesNotMatch(el('matrix').innerHTML,/저장 견적 내 최저/);
});

test('live handoff uses the exact product, external links and confirmed quote data only',async()=>{
  const h=mount(),{el,docEvents,store}=h;
  docEvents['foodfinder:compare']({detail:{mode:'live',product:soy}});await wait();
  assert.equal(el('count').textContent,'0건');
  assert.match(el('base-id').textContent,/195505090014/);
  for(const name of ['쿠팡','네이버쇼핑','Google 검색','기타 판매처 검색'])assert.ok(el('shop-links').innerHTML.includes(name));
  assert.equal(el('legacy-details').hidden,false);
  await el('web').onclick();
  assert.match(el('leads').innerHTML,/동일 여부·판매금액·배송비 미확인/);
  assert.doesNotMatch(el('leads').innerHTML,/10,000원/);
  el('leads').events.click({target:{closest:()=>({dataset:{lead:'0'}})}});
  assert.equal(el('quote-form').elements.namedItem('price').value,'');
  assert.equal(el('quote-form').elements.namedItem('link').value,'https://example.com/sale');
  assert.equal(el('count').textContent,'0건');
  const baseForm=el('base-form');baseForm.payload={amount:'1800',count:'6',unit:'mL',barcode:'',distributor:''};
  baseForm.events.submit({preventDefault(){},currentTarget:baseForm});
  const form=el('quote-form');form.payload={item:soy.PRDLST_NM,seller:'판매처 <A>',maker:soy.BSSH_NM,amount:'1800',count:'6',unit:'mL',
    report:soy.PRDLST_REPORT_NO,barcode:'',price:'23100',shipping:'',date:'2026-11-17',link:'https://example.org/sale',intent:'check'};
  form.events.submit({preventDefault(){},currentTarget:form});
  assert.equal(el('count').textContent,'1건');assert.match(el('offers').innerHTML,/판매처 &lt;A&gt;/);
  assert.doesNotMatch(el('matrix').innerHTML,/저장 견적 내 최저/);
  form.payload={...form.payload,seller:'배송비 확인 가격',link:'https://example.org/new',shipping:'2500'};
  form.events.submit({preventDefault(){},currentTarget:form});
  assert.match(el('matrix').innerHTML,/저장 견적 내 최저/);assert.match(el('offers').innerHTML,/25,600원/);
  assert.equal(JSON.parse(store.get('food-finder-quotes-v1'))[0].item,'예전 제품');
  assert.equal(JSON.parse(store.get('food-finder-quotes-v2')).length,2);
});

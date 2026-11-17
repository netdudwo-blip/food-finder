'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const m=require('./static/buying');
const {createShopping}=require('./lib/shopping');
const product={PRDLST_NM:'업소용 간장',BSSH_NM:'제조사 A',PRDLST_REPORT_NO:1234567890123,LCNS_NO:'00000000001'};
const pack={amount:1800,count:6,unit:'mL'};
const base=m.baseProduct(product,'live',{spec:pack,barcode:'8801234567890'});
const raw={id:'quote-a',baseKey:base.key,item:'업소용 간장',seller:'판매처 A',maker:'제조사 A',price:23100,shipping:2500,
  date:'2026-11-17',link:'https://example.org/a',spec:pack,report:base.report};
const q=patch=>m.quote({...raw,...patch});

test('identical classification needs matching pack and reliable positive identity',()=>{
  assert.equal(base.report,'1234567890123');
  assert.equal(m.classify(base,q({})),'same');
  assert.equal(m.classify(base,q({spec:null})),'review');
  assert.equal(m.classify(base,q({spec:{amount:900,count:12,unit:'mL'}})),'review');
  assert.equal(m.classify(base,q({report:'99999999'})),'review');
  assert.equal(m.classify(base,q({maker:'다른 회사'})),'review');
  assert.equal(m.classify(base,q({barcode:'8800000000000'})),'review');
  assert.equal(m.classify(base,q({report:'',barcode:'08801234567890'})),'same');
  assert.equal(m.classify(base,q({report:''})),'review');
  assert.equal(m.classify(base,q({report:'',labelChecked:true})),'same');
  assert.equal(m.classify(base,q({report:'',labelChecked:true,item:'업소용 소스'})),'review');
  assert.equal(m.classify(base,q({baseKey:'demo:1234567890123:00000000001'})),'unrelated');
  assert.equal(m.classify(m.baseProduct(product,'live',null),q({})),'review');
});

test('ranks delivered total among verified identical offers and never assumes free shipping',()=>{
  const rows=[q({id:'unknown',price:20000,shipping:''}),q({id:'free',price:27000,shipping:0}),q({id:'best'}),q({id:'other',similar:true,price:10000,shipping:0})];
  const result=m.groups(base,rows);
  assert.equal(result.mode,'same');assert.equal(result.lowest,'best');
  assert.deepEqual(result.rows.map(x=>x.id),['best','free','unknown']);
  assert.equal(m.total(rows[0]),null);
  assert.equal(m.total(rows[1]),27000);
  assert.equal(m.total({price:'100',shipping:'0'}),100);
  assert.equal(m.unitPrice(rows[0]),null);
  assert.equal(m.unitPrice(rows[2]).value,25600/10.8);
  assert.deepEqual(m.unitPrice(q({spec:{amount:500,count:8,unit:'g'}})),{value:6400,unit:'kg'});
  assert.deepEqual(m.unitPrice(q({spec:{amount:1,count:20,unit:'개'}})),{value:1280,unit:'개'});
  const fallback=m.groups(base,[q({id:'unverified',report:''}),rows.at(-1)]);
  assert.equal(fallback.mode,'similar');assert.equal(fallback.lowest,null);assert.equal(fallback.review.length,1);
  assert.equal(m.groups(base,[rows[0]]).lowest,null);
});

test('offer input permits unknowns but rejects false shipping, malformed links and incomplete identity specs',()=>{
  for(const shipping of [-1,'error',2.5])assert.equal(q({shipping}),null);
  for(const link of ['http://example.org/','javascript:alert(1)','https://account:pass@example.org/'])assert.equal(q({link}),null);
  assert.equal(q({shipping:undefined}).shipping,null);
  assert.equal(m.packageSpec({amount:1800,unit:'mL',count:''}),null);
  assert.equal(m.packageSpec({amount:1.25,unit:'개',count:1}),null);
});

test('search links cover all four routes and include the confirmed packaging details',()=>{
  const links=m.searchLinks(base).map(({url})=>new URL(url));
  assert.deepEqual(links.map(url=>url.hostname),['www.coupang.com','search.shopping.naver.com','www.google.com','www.google.com']);
  for(const url of links)assert.match([...url.searchParams.values()][0],/업소용 간장 제조사 A 1800mL 6개 8801234567890/);
  assert.match(links[3].searchParams.get('q'),/-site:coupang.com -site:naver.com/);
  const data=Array.from({length:22},(_,i)=>i+1);
  assert.deepEqual(m.pageOf(data,1).rows,[1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(m.pageOf(data,3).rows,[21,22]);
  assert.equal(m.pageOf(data,20).page,3);
});

test('removed Coupang API is rejected locally even when web discovery is enabled',async()=>{
  let calls=0;
  const api=createShopping({env:{BRAVE_SEARCH_API_KEY:'test-key'},request:async()=>{calls++;throw new Error('Unexpected provider call');}});
  assert.deepEqual(api.status(),{web:true});
  await assert.rejects(api.search('coupang','간장 6병'),{status:400});
  assert.equal(calls,0);
});

test('web discovery returns candidate URLs only and configured providers enforce a local hour limit',async()=>{
  let now=100;let calls=0;
  const api=createShopping({clock:()=>now,env:{BRAVE_SEARCH_API_KEY:'test-key'},request:async(url,opts)=>{
    calls++;const u=new URL(url);
    assert.equal(u.hostname,'api.search.brave.com');assert.equal(u.searchParams.get('country'),'KR');
    assert.equal(opts.headers['X-Subscription-Token'],'test-key');
    return {ok:true,json:async()=>({web:{results:[{title:'식자재 제품 100원',url:'https://example.org/shop',price:100}]}})};
  }});
  for(let n=0;n<10;n++){
    const rows=await api.search('web','진간장 '+n);
    assert.deepEqual(rows.items,[{item:'식자재 제품 100원',link:'https://example.org/shop',host:'example.org'}]);
  }
  await assert.rejects(api.search('web','진간장'),{status:429});assert.equal(calls,10);
  now+=3600000;await api.search('web','진간장');assert.equal(calls,11);
  await assert.rejects(api.search('custom','진간장'),{status:400});
});

test('actual server exposes both comparison scripts and no offer data for unconfigured channels',async t=>{
  delete process.env.BRAVE_SEARCH_API_KEY;
  const {server}=require('./server');
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port;
  const [html,lib,view,status,unconfigured,removed]=await Promise.all([
    fetch(base+'/'),fetch(base+'/static/buying.js?v=bid-2'),fetch(base+'/static/buying-view.js?v=bid-2'),
    fetch(base+'/api/shopping/status'),fetch(base+'/api/shopping/candidates?provider=web&q=%EA%B0%84%EC%9E%A5'),
    fetch(base+'/api/shopping/candidates?provider=coupang&q=%EA%B0%84%EC%9E%A5')
  ]);
  const page=await html.text();assert.match(page,/id="bid-finder"/);assert.doesNotMatch(page,/id="bid-coupang"/);
  assert.match(lib.headers.get('content-type'),/javascript/);assert.match(await lib.text(),/function classify/);
  assert.match(await view.text(),/SearchUI\.findProducts/);
  assert.deepEqual(await status.json(),{web:false});
  assert.equal(unconfigured.status,503);
  assert.equal(removed.status,400);
});

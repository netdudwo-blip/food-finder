'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {FIELDS,options,collect,select}=require('./lib/search');
const {matchNutrition,createEnricher}=require('./lib/nutrition');
const ui=require('./static/search-ui');
const rows=Array.from({length:123},(_,i)=>({PRDLST_NM:'제품 '+i,PRDLST_REPORT_NO:String(100000+i),LCNS_NO:'12345',BSSH_NM:i%2?'가 제조사':'나 제조사',PRDLST_DCNM:i%3?'소스':'간장',PRMS_DT:String(20200101+i)}));
const opts=extra=>options(new URLSearchParams({q:'제품',...extra}));
test('123 results paginate without missing or repeated identities at sizes 10/30/50',()=>{
 for(const size of [10,30,50]){let seen=[];for(let page=1;page<=Math.ceil(rows.length/size);page++)seen.push(...select(rows,opts({size,page})).rows.map(p=>p.PRDLST_REPORT_NO));assert.equal(new Set(seen).size,123);assert.equal(seen.length,123)}
});
test('upstream collection passes ranges beyond row 50 and 1000',async()=>{
 const source=Array.from({length:1103},(_,i)=>({...rows[0],PRDLST_REPORT_NO:String(i)})),calls=[];
 const result=await collect(async(s,f,q,limit,start)=>{calls.push([limit,start]);return {rows:source.slice(start-1,start-1+limit),total:source.length}},'소스','PRDLST_NM');
 assert.equal(result.length,1103);assert.deepEqual(calls,[[1000,1],[1000,1001]]);
});
test('all five official search fields are queried and identity overlap is deduplicated',async()=>{
 const fields=[];const result=await collect(async(s,f)=>{fields.push(f);return {rows:[rows[0]],total:1}},'제품','all');assert.deepEqual(fields,FIELDS);assert.equal(result.length,1);
});
test('overly broad or incomplete upstream results are explicit errors',async()=>{
 await assert.rejects(collect(async()=>({total:5001,rows:[]}), '소스','PRDLST_NM'),e=>e.status===422);
 await assert.rejects(collect(async()=>({total:2,rows:[]}), '소스','PRDLST_NM'),e=>e.status===502);
});
test('filters and date sorting apply to complete set before pagination',()=>{
 const result=select(rows,opts({manufacturer:'가 제조사',type:'소스',sort:'date',size:10}));
 const expected=rows.filter(p=>p.BSSH_NM==='가 제조사'&&p.PRDLST_DCNM==='소스').sort((a,b)=>b.PRMS_DT.localeCompare(a.PRMS_DT));assert.equal(result.total,expected.length);assert.deepEqual(result.rows,expected.slice(0,10));assert.equal(select(rows,opts({page:999})).page,13);
});
test('manufacturer and type sorting are global and stable',()=>{
 for(const [sort,field] of [['manufacturer','BSSH_NM'],['type','PRDLST_DCNM']]){const out=select(rows,opts({sort,size:50})).rows;for(let i=1;i<out.length;i++)assert.ok(out[i-1][field].localeCompare(out[i][field],'ko')<=0)}
});
test('invalid page, size and fields rejected',()=>{for(const extra of [{page:0},{page:1.5},{size:20},{field:'unknown'},{sort:'unknown'}])assert.throws(()=>opts(extra),e=>e.status===400)});
const nutrition=(items,total=items.length)=>({header:{resultCode:'00'},body:{items:{item:items},totalCount:total}});
const n={ITEM_REPORT_NO:'12345',FOOD_CAT1_NM:'조미식품',AMT_NUM1:'0',SERVING_SIZE:'100g',FOOD_CD:'test'};
test('nutrition exact identity and zero energy are preserved with basis',()=>{const result=matchNutrition(nutrition([n]),'12345');assert.equal(result.energy,0);assert.equal(result.basis,'100g');assert.equal(result.category,'조미식품')});
test('nutrition name-only, multiple, missing and incomplete data are not guessed',()=>{
 assert.equal(matchNutrition(nutrition([{...n,ITEM_REPORT_NO:'123456'}]),'12345').status,'not_available');assert.equal(matchNutrition(nutrition([n,n]),'12345').status,'ambiguous');assert.equal(matchNutrition(nutrition([n],101),'12345').status,'incomplete');assert.equal(matchNutrition(nutrition([{...n,AMT_NUM1:'-'}]),'12345').energy,null);assert.throws(()=>matchNutrition({header:{resultCode:'30'}},'12345'));
});
test('nutrition enrichment uses server key, exact report filter and cache',async()=>{
 const old=process.env.MFDS_NUTRITION_API_KEY;process.env.MFDS_NUTRITION_API_KEY='test+key';let calls=0;
 try{const enrich=createEnricher(async url=>{calls++;assert.equal(url.searchParams.get('serviceKey'),'test+key');assert.equal(url.searchParams.get('ITEM_REPORT_NO'),'12345');return {ok:true,json:async()=>nutrition([n])}});const input=[{PRDLST_REPORT_NO:'12345'}];assert.equal((await enrich(input))[0].nutrition.energy,0);await enrich(input);assert.equal(calls,1)}finally{if(old===undefined)delete process.env.MFDS_NUTRITION_API_KEY;else process.env.MFDS_NUTRITION_API_KEY=old}
});
test('history keeps newest 10 unique entries and handles invalid storage',()=>{let history=[];for(let i=0;i<12;i++)history=ui.remember(history,'검색 '+i);assert.equal(history.length,10);history=ui.remember(history,'검색 5');assert.equal(history[0],'검색 5');assert.equal(history.length,10);assert.deepEqual(ui.clean(null),[]);assert.deepEqual(ui.clean([null,1,'a','간장','간장']),['간장'])});
test('bridge signature binds pagination start and quota errors never become empty success',()=>{
 const {canonical,normalize}=require('./api/bridge').testOnly;assert.notEqual(canonical('1','I1250','BSSH_NM','매일',50,1),canonical('1','I1250','BSSH_NM','매일',50,51));assert.throws(()=>normalize({I1250:{RESULT:{CODE:'INFO-300'}}},'I1250'),/INFO-300/);assert.throws(()=>require('./server').interpretApiData({I1250:{RESULT:{CODE:'INFO-300'}}},'I1250'),/INFO-300/);
});

'use strict';
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const val=(o,...keys)=>keys.map(k=>o?.[k]).find(x=>x!==undefined&&x!==null&&x!=='')??'미제공';
const qlink=(domain,query)=>domain+encodeURIComponent(query);
let products=[],currentMode='live',activeQuery='',page=1,requestId=0,controller;
function alertNotice(msg){$('notice').textContent=msg;$('notice').classList.remove('hidden')}
function clearNotice(){$('notice').classList.add('hidden')}
function readHistory(){return SearchUI.readHistory()}
function hideHistory(){$('history').classList.add('hidden');$('query').setAttribute('aria-expanded','false')}
function showHistory(){
 const entries=readHistory();$('history').replaceChildren();
 if(!entries.length){hideHistory();return}
 const title=document.createElement('div');title.textContent='최근 검색 · 이 브라우저에 저장';title.className='history-title';$('history').append(title);
 for(const q of entries){const b=document.createElement('button');b.type='button';b.textContent=q;b.onclick=()=>{$('query').value=q;doSearch(q,1,true)};$('history').append(b)}
 const clear=document.createElement('button');clear.type='button';clear.textContent='기록 전체 삭제';clear.onclick=()=>{SearchUI.clearHistory();hideHistory();$('query').focus()};$('history').append(clear);
 $('history').classList.remove('hidden');$('query').setAttribute('aria-expanded','true');
}
function saveHistory(q){SearchUI.saveHistory(q)}
const missingReasons={demo:'체험 모드에서는 영양 API를 조회하지 않음',not_configured:'영양 API 미설정',api_error:'영양 API 조회 오류',ambiguous:'동일 품목 복수 자료',incomplete:'전체 영양자료 미확인',not_available:'일치 자료 없음'};
function nutritionText(n){
 if(!n||n.energy===null||n.energy===undefined)return '미제공';
 return n.energy+' kcal / '+(n.basis||'기준량 미제공');
}
function facets(id,values,selected){$(id).innerHTML='<option value="">전체</option>'+values.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');$(id).value=selected}
let snapshot=null;
function nutritionSummary(p){
 const n=p.nutrition;
 if(!n)return '영양정보 확인 중…';
 const reason=n.status==='matched'?'':' · '+(missingReasons[n.status]||'자료 없음');
 return safe('식품대분류명 '+(n.category||'미제공')+' · 에너지 '+nutritionText(n)+' · 식약처 식품영양성분DB'+reason);
}
async function loadNutrition(state){
 if(state.loading||state!==snapshot||currentMode!=='live')return;
 const pending=products.filter(p=>!p.nutrition);
 for(const p of pending){
  if(!/^[0-9A-Za-z-]{4,40}$/.test(p.PRDLST_REPORT_NO||''))p.nutrition={status:'not_available'};
 }
 const ids=[...new Set(pending.filter(p=>!p.nutrition).map(p=>String(p.PRDLST_REPORT_NO)))].slice(0,10);
 if(ids.length){
  state.loading=true;
  const params=new URLSearchParams();
  ids.forEach(no=>params.append('no',no));
  let values=new Map();
  try{
   const r=await fetch('/api/nutrition?'+params,{signal:controller.signal});
   if(r.ok)values=new Map((await r.json()).rows.map(p=>[p.PRDLST_REPORT_NO,p.nutrition]));
  }catch{}finally{state.loading=false}
  if(state!==snapshot)return;
  for(const p of state.rows){
   const no=String(p.PRDLST_REPORT_NO);
   if(ids.includes(no))p.nutrition=values.get(no)||{status:'api_error'};
  }
 }
 document.querySelectorAll('#resultlist .nutrition-note').forEach((el,i)=>{el.innerHTML=nutritionSummary(products[i])});
 if(ids.length)loadNutrition(state);
}
function renderResults(wantedPage=1){
 if(!snapshot)return;
 const data=select(snapshot.rows,{page:wantedPage,size:Number($('pageSize').value),sort:$('sort').value,manufacturer:$('manufacturer').value,type:$('foodType').value});
 products=data.rows;page=data.page;
 $('count').textContent=data.total.toLocaleString()+'건';
 $('results-tip').textContent=(currentMode==='demo'?'체험 데이터':'식품안전나라 공식 API')+' · '+page+' / '+data.pages+'페이지 · '+products.length+'건 표시';
  $('resultlist').innerHTML=products.length?products.map((p,i)=>`<button class="item" data-index="${i}"><span class="itempic">▧</span><span class="itemmain"><span class="itemname">${safe(p.PRDLST_NM||'미제공')}</span><span class="itemmeta">${[['제조사',p.BSSH_NM],['품목보고번호',p.PRDLST_REPORT_NO],['인허가번호',p.LCNS_NO],['식품유형',p.PRDLST_DCNM],['보고일자',p.PRMS_DT]].map(([k,v])=>`<span>${k} <b>${safe(v===undefined||v===null||v===''?'미제공':v)}</b></span>`).join('')}</span><span class="nutrition-note">${nutritionSummary(p)}</span></span><span class="arrow">›</span></button>`).join(''):'<div class="empty"><strong>검색 결과가 없습니다.</strong><p>검색어 또는 필터를 변경해 주세요.</p></div>';
  const nav=$('pagination');nav.replaceChildren();
  function button(label,target,disabled=false){const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=()=>renderResults(target);nav.append(b)}
  button('이전',page-1,page<=1);
  for(let n=Math.max(1,page-2);n<=Math.min(data.pages,page+2);n++){button(String(n),n);if(n===page)nav.lastChild.setAttribute('aria-current','page')}
  button('다음',page+1,page>=data.pages);
 loadNutrition(snapshot);
}
async function doSearch(query,wantedPage=1,newSearch=false){
 const q=query.trim();if(q.length<2||q.length>80){alertNotice('검색어는 2~80자로 입력하세요.');return}
 if(newSearch){facets('manufacturer',[],'');facets('foodType',[],'');saveHistory(q)}
 hideHistory();activeQuery=q;currentMode=$('mode').value;snapshot=null;
 controller?.abort();controller=new AbortController();const id=++requestId;
 products=[];$('pagination').replaceChildren();
 const btn=$('searchBtn');btn.disabled=true;btn.textContent='검색 중…';$('resultmode').textContent='검색 중';
 $('resultlist').innerHTML='<div class="loading">제품 정보를 조회하고 있습니다…</div>';clearNotice();$('count').textContent='…';
 try{
  const data=await SearchUI.findProducts(q,currentMode,$('searchField').value,controller.signal);if(id!==requestId)return;
  snapshot={rows:data.rows,loading:false};
  if(currentMode==='demo')snapshot.rows.forEach(p=>p.nutrition={status:'demo'});
  for(const [id,key] of [['manufacturer','BSSH_NM'],['foodType','PRDLST_DCNM']]){
   facets(id,[...new Set(snapshot.rows.map(p=>p[key]).filter(Boolean))].sort(),'');
  }
  $('resultmode').textContent=currentMode==='demo'?'체험 데이터':'식품안전나라 실시간';
  renderResults(wantedPage);
 }catch(e){if(id!==requestId||e.name==='AbortError')return;$('resultmode').textContent='검색 실패';$('count').textContent='—';$('results-tip').textContent='검색 결과를 가져오지 못했습니다.';$('resultlist').innerHTML='<div class="empty"><strong>검색 결과를 표시할 수 없습니다.</strong><p>오류 안내를 확인해 주세요.</p></div>';alertNotice(e.message)}
 finally{if(id===requestId){btn.disabled=false;btn.textContent='검색하기 ↗'}}
}
$('query').addEventListener('focus',showHistory);
$('query').addEventListener('click',showHistory);
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))hideHistory()});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')hideHistory();
 if(e.key==='ArrowDown'&&!$('history').classList.contains('hidden')&&document.activeElement===$('query')){e.preventDefault();$('history').querySelector('button')?.focus()}
});
for(const id of ['sort','manufacturer','foodType','pageSize'])$(id).addEventListener('change',()=>{renderResults()});
for(const id of ['mode','searchField'])$(id).addEventListener('change',()=>{if(activeQuery)doSearch($('query').value,1,true)});

function field(label,value){return `<div class="field"><dt>${safe(label)}</dt><dd>${safe(value===undefined||value===null||value===''?'미제공':value)}</dd></div>`}
let detailCompareState;
async function openDetail(index){const p=products[index];if(!p)return;detailCompareState=null;const no=p.PRDLST_REPORT_NO;$('modal').classList.remove('hidden');document.body.style.overflow='hidden';$('detailBody').innerHTML='<div class="loading">제품 상세정보를 불러오는 중…</div>';try{const r=await fetch('/api/detail?'+new URLSearchParams({report_no:no,mode:currentMode}));const data=await r.json();if(!r.ok)throw new Error(data.error||'상세 조회 실패');const item=data.product;detailCompareState={product:item,mode:data.mode};const name=val(item,'PRDLST_NM'),company=val(item,'BSSH_NM');const query=name+' '+company;const imgG=qlink('https://www.google.com/search?tbm=isch&q=',query+' 제품 포장');const imgN=qlink('https://search.naver.com/search.naver?where=image&query=',query+' 제품');const back=qlink('https://www.google.com/search?tbm=isch&q=',query+' 표시사항 뒷면');const priceN=qlink('https://search.shopping.naver.com/search/all?query=',query);const priceG=qlink('https://www.google.com/search?tbm=shop&q=',query);$('detailBody').innerHTML=`<h2 class="detailtitle" id="detailTitle">${safe(name)}</h2><p class="company">${safe(company)} ${data.mode==='demo'?'· 체험용 예시 데이터':'· 식품안전나라 공식 조회'}</p><div class="detailsub">공식 품목제조보고 정보</div><div class="fields">${field('품목제조보고번호',item.PRDLST_REPORT_NO)}${field('인허가번호',item.LCNS_NO)}${field('식품유형',val(item,'PRDLST_DCNM','PRDLST_CDNM'))}${field('보고일자',item.PRMS_DT)}${field('식품대분류명',p.nutrition?.category)}${field('에너지',nutritionText(p.nutrition))}${field('소비기한',val(item,'POG_DAYCNT','VLD_PRD_YMD'))}${field('제품형태',item.DISPOS)}${field('포장재질',item.FRMLC_MTRQLT)}${field('생산종료 여부',item.PRODUCTION)}${field('업종',item.INDUTY_CD_NM)}${field('내수/겸용구분',val(item,'ETQTY_XPORT_PRDLST_YN'))}</div><div class="detailsub">원재료 정보</div><div class="ingredients">${data.ingredients.length?data.ingredients.map(v=>`<span>${safe(v)}</span>`).join(''):'<p class="muted">표시할 원재료 정보가 없습니다.'+(data.ingredients_status==='api_error'?' (원재료 API 조회 오류)':'')+'</p>'}</div><div class="detailsub">앞면 · 뒷면 이미지 찾기</div><div class="linkrow"><a href="${imgG}" target="_blank" rel="noopener noreferrer">구글 앞면 이미지 ↗</a><a href="${imgN}" target="_blank" rel="noopener noreferrer">네이버 이미지 ↗</a><a href="${back}" target="_blank" rel="noopener noreferrer">뒷면 표시사항 ↗</a></div><div class="caution">검색된 이미지는 동일 제품으로 검증되지 않았습니다. 제조사·규격·품목보고번호를 직접 대조하세요. 이미지 자동 수집 및 매칭은 아직 구현되지 않았습니다.</div><div class="detailsub">온라인 판매가 찾아보기</div><div class="linkrow"><a href="${priceN}" target="_blank" rel="noopener noreferrer">네이버쇼핑 검색 ↗</a><a href="${priceG}" target="_blank" rel="noopener noreferrer">구글쇼핑 검색 ↗</a></div><p class="muted"><button type="button" data-compare>이 상품 견적 비교하기</button> B2B 제품은 온라인 판매 정보가 없을 수 있습니다.</p>`}catch(e){$('detailBody').innerHTML=`<p class="caution">${safe(e.message)}</p>`}}
$('detailBody').addEventListener('click',event=>{
 if(!event.target.closest('[data-compare]')||!detailCompareState)return;
 closeModal();
 location.hash='compare';
 document.dispatchEvent(new CustomEvent('foodfinder:compare',{detail:detailCompareState}));
});
function closeModal(){$('modal').classList.add('hidden');document.body.style.overflow=''}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();doSearch($('query').value,1,true)});

$('resultlist').addEventListener('click',e=>{const el=e.target.closest('[data-index]');if(el)openDetail(Number(el.dataset.index))});
$('close').addEventListener('click',closeModal);$('overlay').addEventListener('click',closeModal);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

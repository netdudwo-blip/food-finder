'use strict';
(() => {
  const model=FoodBuying;
  const el=id=>document.getElementById('bid-'+id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const unknown=value=>esc(value||'미제공');
  const countText=num=>Number(num).toLocaleString('ko-KR')+'건';
  const format=num=>num===null||num===undefined?'미제공':num.toLocaleString('ko-KR',{maximumFractionDigits:2})+'원';
  const dateNow=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  const storage={offers:'food-finder-quotes-v2',base:'food-finder-buying-spec-v1',legacy:'food-finder-quotes-v1'};
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  function write(key,value,message){
    try{localStorage.setItem(key,JSON.stringify(value));return true;}
    catch{el(message).textContent='브라우저 저장 공간을 사용할 수 없습니다.';return false;}
  }
  const old=read(storage.legacy,[]);
  const legacy=Array.isArray(old)?old.filter(q=>q&&model.text(q.item)&&model.text(q.seller)&&model.httpsUrl(q.link)&&model.money(q.price)!==null):[];
  const stored=read(storage.offers,[]);
  let quotes=Array.isArray(stored)?stored.map(model.quote).filter(Boolean):[];
  const loadedPreferences=read(storage.base,{});
  let preferences=loadedPreferences&&typeof loadedPreferences==='object'&&!Array.isArray(loadedPreferences)?loadedPreferences:{};
  let base=null, rawBase=null, offers=model.groups(null,[]), selections=[], page=1, candidatePage=1, trace=[], searchedMode='live';
  let searchController,providerController,providerConfiguration,leads=[],editId=null;

  // Clone the actual home search form, not a visually similar second form.
  const finder=document.getElementById('search').cloneNode(true);
  finder.querySelectorAll('[id]').forEach(node=>{node.id='bid-'+node.id;});
  finder.querySelectorAll('[for],[aria-controls]').forEach(node=>{
    for(const attr of ['for','aria-controls'])if(node.hasAttribute(attr))node.setAttribute(attr,'bid-'+node.getAttribute(attr));
  });
  el('finder').replaceChildren(...finder.childNodes);
  el('query').setAttribute('aria-label','비교 기준품 통합 검색어');
  el('searchHint').textContent='첫 페이지와 같은 식품안전나라 품목 검색입니다. 기준품을 선택한 뒤 판매처 견적을 확인하세요.';
  const results=document.createElement('div');
  results.className='bid-search-results';results.hidden=true;
  results.setAttribute('aria-live','polite');el('finder').append(results);

  const specText=spec=>spec?`${spec.amount.toLocaleString('ko-KR')} ${spec.unit} × ${spec.count.toLocaleString('ko-KR')}개`:'미제공';
  const unitText=q=>{const value=model.unitPrice(q);return value?`${format(value.value)}/${value.unit}`:'미제공';};
  const lowestText=()=>base?.mode==='demo'?'체험 예시 최저':'저장 견적 내 최저';
  function shopLink(label,url){const safe=model.httpsUrl(url);return safe?`<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'미제공';}
  const saleLink=q=>shopLink('판매 페이지',q.link);
  const set=(form,name,value)=>{form.elements.namedItem(name).value=value??'';};
  const fields=form=>Object.fromEntries(new FormData(form));
  function formSpec(values){
    return model.packageSpec({amount:values.amount,unit:values.unit,count:values.count});
  }
  function fillSpec(form,spec){set(form,'amount',spec?.amount);set(form,'unit',spec?.unit||'mL');set(form,'count',spec?.count);}
  function resetDraft(){
    const form=el('quote-form');form.reset();set(form,'date',dateNow());
    editId=null;el('quote-msg').textContent='';
  }
  function fixtureSpec(product){return /과자|한과/.test(product.type)?{unit:'g',amount:100,count:12}:{unit:'mL',amount:1800,count:6};}
  function demoOffers(product){
    const similar=product.report!=='195505090014';
    return Array.from({length:similar?3:12},(_,i)=>({id:'demo-'+i,baseKey:product.key,
      item:similar?`예시 대체품 ${i+1}`:product.name,maker:similar?`가상 제조사 ${i+1}`:product.maker,
      distributor:'',seller:`가상 판매처 ${i+1}`,spec:similar&&i===1?{...product.spec,count:product.spec.count+1}:product.spec,
      report:similar?'':product.report,barcode:'',similar,price:23100+i*440,shipping:i%4===3?null:i%2===0?2500:0,
      date:'2026-11-16',link:''}));
  }
  function compareTable(){
    const chosen=Array.from({length:3},(_,i)=>offers.rows.find(q=>q.id===selections[i]));
    const lines=[
      ['제품명',unknown(base?.name),q=>unknown(q.item)],['제조사',unknown(base?.maker),q=>unknown(q.maker)],
      ['유통전문판매원',unknown(base?.distributor),q=>unknown(q.distributor)],['포장 규격',specText(base?.spec),q=>specText(q.spec)],
      ['판매처 · 확인일','—',q=>`${esc(q.seller)} <small>${esc(q.date)}</small>`],['단위당 가격','—',unitText],
      ['판매금액','—',q=>format(q.price)],['배송비','—',q=>format(q.shipping)],['합계','—',q=>format(model.total(q))],['판매 링크','—',saleLink]
    ];
    const win=q=>q?.id===offers.lowest?' class="bid-winner"':'';
    el('matrix').innerHTML=`<caption class="bid-only-sr">기준품과 선택한 견적 최대 3개</caption><colgroup><col style="width:17%"><col style="width:20%"><col><col><col></colgroup><thead><tr><th scope="col">항목</th><th scope="col">기준</th>${chosen.map((q,i)=>`<th scope="col"${win(q)}>${i+1}안${q?.id===offers.lowest?` <small>${lowestText()}</small>`:''}</th>`).join('')}</tr></thead><tbody>${lines.map(([label,b,read],i)=>`<tr${i===8?' class="bid-sum"':''}><th scope="row">${label}</th><td>${base?b:'—'}</td>${chosen.map(q=>`<td${win(q)}>${q?read(q):'—'}</td>`).join('')}</tr>`).join('')}</tbody>`;
    el('selection').textContent=`비교 선택 ${selections.length}/3`;
  }
  function reviewList(){
    const review=offers.review.map(q=>[q,'동일 여부·규격 확인 필요']).concat(offers.mode==='same'?offers.similar.map(q=>[q,'보관된 유사 후보']):[]);
    el('review-details').hidden=!review.length;
    el('review-title').textContent=`별도 보관 · ${countText(review.length)}`;
    el('review').innerHTML=review.map(([q,note])=>`<li><strong>${esc(q.item)}</strong><small>${esc(q.seller)} · ${note}</small>${saleLink(q)} <button type="button" data-edit="${esc(q.id)}">수정</button> <button type="button" data-remove="${esc(q.id)}">삭제</button></li>`).join('');
  }
  function renderOffers(){
    const data=model.pageOf(offers.rows,page);page=data.page;
    const empty=!base?'통합검색에서 비교 기준품을 선택하세요.':base.mode==='demo'?'표시할 체험 견적이 없습니다.':'비교할 견적이 아직 없습니다. 아래 판매처 찾기에서 확인한 견적을 추가하세요.';
    el('offers').innerHTML=data.rows.length?data.rows.map((q,i)=>{
      const chosen=selections.includes(q.id);
      const manage=base.mode==='live'?` <button class="bid-edit" type="button" data-edit="${esc(q.id)}">수정</button> <button class="bid-edit" type="button" data-remove="${esc(q.id)}">삭제</button>`:'';
      return `<tr${chosen?' class="bid-selected"':''}><td><label class="bid-check"><input type="checkbox" value="${esc(q.id)}" aria-label="${esc(q.seller)} 견적 비교"${chosen?' checked':''}> ${data.start+i+1}</label></td><td><strong>${esc(q.item)}</strong><small>${esc(q.seller)} · ${esc(q.date)}${base.mode==='demo'?' · 체험 예시':''}</small></td><td>${unknown(q.maker)}</td><td>${specText(q.spec)}</td><td class="bid-num">${unitText(q)}</td><td class="bid-num">${format(q.price)}</td><td class="bid-num">${format(q.shipping)}</td><td class="bid-num"><strong>${format(model.total(q))}</strong>${q.id===offers.lowest?`<small>${lowestText()}</small>`:''}</td><td>${saleLink(q)}${manage}</td></tr>`;
    }).join(''):`<tr><td class="bid-empty" colspan="9">${empty}</td></tr>`;
    el('range').textContent=data.total?`${data.start+1}–${data.start+data.rows.length} / ${countText(data.total)}`:'0건';
    renderPages(el('pages'),data.page,data.pages,to=>{page=to;renderOffers();});
  }
  function renderPages(out,p,max,render){
    out.replaceChildren();
    if(max===1)return;
    const button=(text,next,disabled=false,current=false)=>{
      const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;
      if(current)b.setAttribute('aria-current','page');
      b.onclick=()=>{render(next);out.querySelector('[aria-current="page"]')?.focus();};
      out.append(b);
    };
    button('이전',p-1,p===1);
    for(let i=Math.max(1,p-2);i<=Math.min(max,p+2);i++)button(String(i),i,false,i===p);
    button('다음',p+1,p>=max);
  }
  function refresh(autopick=false){
    offers=model.groups(base,base?.mode==='demo'?demoOffers(base):quotes);
    const available=new Set(offers.rows.map(q=>q.id));
    selections=autopick?offers.rows.filter(q=>offers.mode==='similar'||model.total(q)!==null).slice(0,3).map(q=>q.id):selections.filter(id=>available.has(id));
    if(!selections.length&&offers.rows.length)selections=offers.rows.slice(0,3).map(q=>q.id);
    el('count').textContent=countText(offers.rows.length);
    el('match-mode').textContent=offers.mode==='same'?'동일제품 우선':offers.mode==='similar'?'동일품 미확인 · 유사제품':base?'동일품 미확인':'기준품 선택 전';
    el('base-id').textContent=base?`${base.mode==='demo'?'체험 예시 · ':''}품목제조보고번호 ${base.report}${base.barcode?' · 바코드 '+base.barcode:''}`:'';
    el('list-note').textContent=base?.mode==='demo'?'체험용으로 만든 가격입니다. 구매에 사용할 수 없습니다. 한 페이지 10건.':offers.mode==='same'?'배송비 포함 총액순 · 저장 견적만 비교 · 한 페이지 10건':offers.mode==='similar'?'동일 제품 확인 견적이 없어 유사 후보를 표시합니다. 대체 사용 가능 여부는 별도 검토하세요.':'품목과 규격이 확인된 동일제품이 우선입니다. 미확인 견적은 별도 보관합니다.';
    compareTable();renderOffers();reviewList();
  }

  function renderProviderButton(config={}){
    el('web').hidden=!config.web;el('web').disabled=false;
    el('provider-status').textContent=config.web?'웹 검색 후보는 동일 여부와 판매금액·배송비를 확인한 후 견적에 추가하세요.':'위 검색 링크에서 상품을 확인한 뒤 견적을 추가하세요.';
  }
  function renderLeads(){
    el('leads').innerHTML=leads.map((x,i)=>`<li><strong>${esc(x.item)}</strong><small>${esc(x.host)} · 웹 검색 후보 · 동일 여부·판매금액·배송비 미확인</small>${shopLink('원문 확인',x.link)} <button type="button" data-lead="${i}">견적 양식에 가져오기</button></li>`).join('');
  }
  function discovery(){
    providerController?.abort();providerController=null;leads=[];
    el('discovery').hidden=base?.mode!=='live';el('shop-links').innerHTML='';renderLeads();
    if(base?.mode!=='live')return;
    el('shop-links').innerHTML=model.searchLinks(base).map(link=>shopLink(link.label,link.url)).join('');
    renderProviderButton();
    if(!providerConfiguration)providerConfiguration=fetch('/api/shopping/status').then(r=>r.ok?r.json():Promise.reject(new Error('status'))).catch(()=>{providerConfiguration=null;return {};});
    const key=base.key;
    providerConfiguration.then(config=>{if(base?.key===key)renderProviderButton(config);});
  }
  async function loadLeads(){
    if(base?.mode!=='live')return;
    providerController?.abort();const current=new AbortController();providerController=current;
    const context=base;
    const s=base.spec;
    const query=[base.name,base.maker,s?`${s.amount}${s.unit} ${s.count}개`:'',base.barcode,'식자재 판매 가격'].filter(Boolean).join(' ');
    const q=Array.from(query).slice(0,220).join('');
    el('web').disabled=true;
    el('provider-status').textContent='판매처 후보 확인 중…';
    try{
      const params=new URLSearchParams({provider:'web',q});
      const r=await fetch('/api/shopping/candidates?'+params,{signal:current.signal});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'판매처 검색 실패');
      if(base!==context||current!==providerController)return;
      const newRows=Array.isArray(data.items)?data.items.filter(x=>x&&model.text(x.item)&&model.httpsUrl(x.link)):[];
      leads=[...new Map([...leads,...newRows].map(x=>[x.link,x])).values()];renderLeads();
      el('provider-status').textContent=newRows.length?`${countText(newRows.length)} 후보를 찾았습니다. 검토 전에는 비교 순위에 넣지 않습니다.`:'후보가 없습니다. 외부 검색 링크도 확인해 보세요.';
    }catch(e){if(base===context&&current===providerController&&e.name!=='AbortError')el('provider-status').textContent=e.message;}
    finally{if(current===providerController)el('web').disabled=false;}
  }

  function chooseBase(product,mode){
    const initial=model.baseProduct(product,mode);if(!initial)return;
    rawBase=product;
    base=model.baseProduct(product,mode,mode==='demo'?{spec:fixtureSpec(initial)}:preferences[initial.key]);
    const live=mode==='live';
    el('base-details').hidden=el('quote-details').hidden=!live;
    el('base-details').open=el('quote-details').open=false;
    el('base-msg').textContent='';
    if(live){const form=el('base-form');fillSpec(form,base.spec);set(form,'barcode',base.barcode);set(form,'distributor',base.distributor);}
    resetDraft();page=1;refresh(true);discovery();
    el('legacy-details').hidden=!live||!legacy.length;
  }
  el('base-form').addEventListener('submit',event=>{
    event.preventDefault();if(base?.mode!=='live')return;
    const values=fields(event.currentTarget), spec=formSpec(values), code=model.barcode(values.barcode);
    if(((values.amount||values.count)&&!spec)||(values.barcode.trim()&&!code)){
      el('base-msg').textContent='포장 규격은 낱개당 값과 판매 단위 개수 모두 입력하세요. 바코드는 8·12·13·14자리 숫자만 허용됩니다.';return;
    }
    const config={spec,barcode:code,distributor:model.text(values.distributor)},next={...preferences,[base.key]:config};
    if(!write(storage.base,next,'base-msg'))return;
    preferences=next;base=model.baseProduct(rawBase,'live',config);page=1;refresh(true);discovery();
    el('base-msg').textContent='기준품 정보를 저장했습니다. 비교 여부와 검색어에 반영했습니다.';
  });
  function draft(q,asEdit=false){
    if(base?.mode!=='live')return;
    const form=el('quote-form');resetDraft();
    for(const name of ['item','seller','maker','distributor','barcode','report','price','shipping','link'])set(form,name,q[name]);
    set(form,'date',q.date&&/^\d{4}-\d{2}-\d{2}$/.test(q.date)?q.date:dateNow());
    set(form,'intent',q.similar?'similar':'check');fillSpec(form,q.spec);
    form.elements.namedItem('labelChecked').checked=q.labelChecked===true;
    editId=asEdit?q.id:null;
    el('quote-details').open=true;form.elements.namedItem('item').focus();
    el('quote-msg').textContent=asEdit?'확인한 견적을 수정할 수 있습니다.':'복사된 정보와 배송비·포장 규격을 판매 페이지에서 확인하세요.';
  }
  el('quote-form').addEventListener('submit',event=>{
    event.preventDefault();if(base?.mode!=='live')return;
    const values=fields(event.currentTarget), spec=formSpec(values);
    if(((values.amount||values.count)&&!spec)||(values.barcode.trim()&&!model.barcode(values.barcode))||(values.report.trim()&&!model.report(values.report))){
      el('quote-msg').textContent='포장 규격과 식별번호를 확인하세요. 규격을 모르면 용량·수량을 모두 비워 둘 수 있습니다.';return;
    }
    const candidate=model.quote({...values,id:editId||globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,
      baseKey:base.key,spec,similar:values.intent==='similar',labelChecked:values.labelChecked==='on'});
    if(!candidate){el('quote-msg').textContent='제품명, 판매처, 판매금액, 확인일과 HTTPS 판매 링크를 확인하세요.';return;}
    const next=[...quotes.filter(q=>q.id!==candidate.id),candidate];
    if(!write(storage.offers,next,'quote-msg'))return;
    quotes=next;const kind=model.classify(base,candidate);
    if(selections.length<3&&!selections.includes(candidate.id)&&model.groups(base,quotes).rows.some(row=>row.id===candidate.id))selections.push(candidate.id);
    resetDraft();page=1;refresh();renderLeads();
    el('quote-msg').textContent=kind==='same'?'동일제품 견적을 저장했습니다.':kind==='similar'?'유사제품 후보를 저장했습니다.':'견적을 별도 보관했습니다. 기준품과 견적의 규격·식별정보를 확인하면 비교에 반영됩니다.';
  });
  function manage(event){
    const action=event.target.closest('[data-edit],[data-remove]');if(!action)return;
    const quote=quotes.find(q=>q.baseKey===base?.key&&q.id===(action.dataset.edit||action.dataset.remove));if(!quote)return;
    if(action.dataset.edit){draft(quote,true);return;}
    const next=quotes.filter(q=>q.id!==quote.id);
    if(write(storage.offers,next,'quote-msg')){quotes=next;if(editId===quote.id)resetDraft();refresh();renderLeads();}
  }
  el('offers').addEventListener('click',manage);el('review').addEventListener('click',manage);
  el('offers').addEventListener('change',event=>{
    const box=event.target;if(box.type!=='checkbox'||!offers.rows.some(q=>q.id===box.value))return;
    if(box.checked&&selections.length>=3){box.checked=false;el('selection').textContent='최대 3개 · 기존 선택을 먼저 해제하세요';return;}
    selections=box.checked?[...selections,box.value]:selections.filter(id=>id!==box.value);
    box.closest('tr').classList.toggle('bid-selected',box.checked);compareTable();
  });
  el('web').onclick=loadLeads;
  el('leads').addEventListener('click',event=>{
    const button=event.target.closest('[data-lead]');if(!button)return;
    const row=leads[Number(button.dataset.lead)];if(row)draft({item:row.item,seller:row.host,link:row.link});
  });
  el('legacy-title').textContent=`기존 브라우저 견적 · ${countText(legacy.length)}`;
  el('legacy').innerHTML=legacy.map((q,i)=>`<li><strong>${esc(q.item)}</strong><small>${esc(q.seller)} · ${esc(q.group||'')}</small><button type="button" data-legacy="${i}">견적 양식으로 복사</button></li>`).join('');
  el('legacy').addEventListener('click',event=>{
    const button=event.target.closest('[data-legacy]');if(!button)return;
    const q=legacy[Number(button.dataset.legacy)];if(q)draft({item:q.item,seller:q.seller,link:q.link,price:q.price,date:q.date});
  });

  function hideHistory(){el('history').classList.add('hidden');el('query').setAttribute('aria-expanded','false');}
  function showHistory(){
    const saved=SearchUI.readHistory();if(!saved.length){hideHistory();return;}
    const history=el('history');history.replaceChildren();
    const title=document.createElement('div');title.className='history-title';title.textContent='최근 검색 · 이 브라우저에 저장';history.append(title);
    function add(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;history.append(b);}
    saved.forEach(q=>add(q,()=>{el('query').value=q;lookup(q);}));
    add('기록 전체 삭제',()=>{SearchUI.clearHistory();el('query').focus();hideHistory();});
    history.classList.remove('hidden');el('query').setAttribute('aria-expanded','true');
  }
  function renderMatches(){
    const data=model.pageOf(trace,candidatePage);candidatePage=data.page;
    results.innerHTML=`<p class="hint">${searchedMode==='demo'?'체험 데이터':'식품안전나라'} · 기준품 검색 ${countText(trace.length)}</p><div class="bid-matches">${data.rows.map((p,i)=>`<button type="button" data-base-row="${data.start+i}"><span><strong>${unknown(p.PRDLST_NM)}</strong><small>제조사 ${unknown(p.BSSH_NM)} · 품목번호 ${unknown(p.PRDLST_REPORT_NO)} · 인허가번호 ${unknown(p.LCNS_NO)} · ${unknown(p.PRDLST_DCNM)}</small></span><span>기준품 선택 ↗</span></button>`).join('')}</div><nav class="pagination" aria-label="기준품 검색 결과 페이지"></nav>`;
    renderPages(results.querySelector('nav'),data.page,data.pages,to=>{candidatePage=to;renderMatches();});
  }
  async function lookup(value){
    const q=String(value||'').trim(), mode=el('mode').value;
    hideHistory();results.hidden=false;
    if(q.length<2||q.length>80){results.textContent='검색어는 2~80자로 입력해 주세요.';return;}
    SearchUI.saveHistory(q);searchController?.abort();const controller=new AbortController();searchController=controller;
    trace=[];el('searchBtn').disabled=true;el('searchBtn').textContent='검색 중…';results.textContent='제품 정보를 조회하고 있습니다…';
    try{
      const data=await SearchUI.findProducts(q,mode,el('searchField').value,controller.signal);
      if(controller!==searchController)return;
      searchedMode=mode;trace=data.rows.filter(p=>model.baseProduct(p,mode));candidatePage=1;
      if(trace.length)renderMatches();else results.textContent='기준품 검색 결과가 없습니다. 제품명이나 제조사를 바꿔 보세요.';
    }catch(e){if(controller===searchController&&e.name!=='AbortError')results.textContent=e.message;}
    finally{if(controller===searchController){el('searchBtn').disabled=false;el('searchBtn').textContent='검색하기 ↗';}}
  }
  results.addEventListener('click',event=>{
    const button=event.target.closest('[data-base-row]');if(!button)return;
    const row=trace[Number(button.dataset.baseRow)];if(!row)return;
    chooseBase(row,searchedMode);results.hidden=true;el('query').value=row.PRDLST_NM;el('query').focus();hideHistory();
  });
  el('searchForm').addEventListener('submit',event=>{event.preventDefault();lookup(el('query').value);});
  for(const name of ['mode','searchField'])el(name).addEventListener('change',()=>{if(el('query').value.trim().length>=2)lookup(el('query').value);});
  el('query').addEventListener('focus',showHistory);el('query').addEventListener('click',showHistory);
  el('finder').addEventListener('keydown',event=>{
    if(event.key==='Escape')hideHistory();
    if(event.key==='ArrowDown'&&event.target===el('query')&&!el('history').classList.contains('hidden')){event.preventDefault();el('history').querySelector('button')?.focus();}
  });
  document.addEventListener('click',event=>{if(!event.target.closest('#bid-finder .search-wrap'))hideHistory();});
  document.addEventListener('foodfinder:compare',event=>{
    const {product,mode}=event.detail||{};if(!model.baseProduct(product,mode))return;
    searchController?.abort();chooseBase(product,mode);
    el('mode').value=mode;el('query').value=product.PRDLST_NM;results.hidden=true;
  });
  refresh();
})();

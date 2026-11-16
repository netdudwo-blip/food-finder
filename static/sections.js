(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const panels = Array.from(document.querySelectorAll('.tabview'));
  function navigate() {
    const target = panels.find(panel => '#' + panel.id === location.hash) || panels[0];
    panels.forEach(panel => { panel.hidden = panel !== target; });
    document.querySelectorAll('.navlinks a').forEach(link => {
      if (link.hash === '#' + target.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (panels.some(panel => '#' + panel.id === location.hash)) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', navigate);
  navigate();

  function node(tag, value, className) {
    const el = document.createElement(tag);
    if (value !== undefined) el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  function source(title, url) {
    const link = node('a', title);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }
  const water = '제주삼다수 무라벨 2L × 6';
  const records = [
    ['동일제품',water,'이마트몰',6980,'https://emart.ssg.com/item/itemView.ssg?itemId=1000518316605'],
    ['유사제품','제주삼다수 2L × 6 (라벨 여부 미확인)','롯데ON',14250,'https://www.lotteon.com/p/product/LO2694209589'],
    ['유사제품','노브랜드 미네랄워터 2L × 6','이마트몰',1980,'https://emart.ssg.com/item/itemView.ssg?itemId=1000043234963']
  ].map(([kind,item,seller,price,link]) => ({group:water,kind,item,seller,price,link,unit:'mL',amount:12000,date:'2026-11-16'}));
  const key = 'food-finder-quotes-v1';
  const form = byId('quote-form');
  const select = byId('benchmark');
  let saved = [];
  function valid(q) {
    try {
      return ['group','seller','item','date'].every(k => typeof q[k] === 'string' && q[k].trim()) &&
        ['동일제품','유사제품'].includes(q.kind) && ['g','mL','개'].includes(q.unit) &&
        Number.isFinite(q.price) && Number.isFinite(q.amount) && q.price > 0 && q.amount > 0 &&
        new URL(q.link).protocol === 'https:';
    } catch { return false; }
  }
  try {
    const data = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(data)) saved = data.filter(valid);
  } catch { /* Storage is optional for viewing public prices. */ }
  const cost = q => q.price / q.amount * (q.unit === '개' ? 1 : 100);
  const format = number => number.toLocaleString('ko-KR', {maximumFractionDigits:2});
  function persist(next) {
    try { localStorage.setItem(key,JSON.stringify(next)); saved = next; return true; }
    catch { byId('quote-msg').textContent = '브라우저 저장 공간을 사용할 수 없습니다.'; return false; }
  }
  function render(group) {
    const all = records.concat(saved);
    const groups = [...new Set(all.map(q => q.group))];
    select.replaceChildren(...groups.map(name => new Option(name,name)));
    select.value = groups.includes(group) ? group : groups[0];
    form.elements.group.value = select.value;
    const out = byId('quotes');
    out.replaceChildren();
    byId('chart-unit').textContent = '막대는 같은 단위 안에서 비교한 상품 단가입니다. 판매 페이지에서 최신 가격을 확인하세요.';
    const quotes = all.filter(q => q.group === select.value);
    for (const unit of new Set(quotes.map(q => q.unit))) {
      const rows = quotes.filter(q => q.unit === unit).sort((a,b) => cost(a)-cost(b));
      const basis = unit === '개' ? '1개' : '100' + unit;
      out.append(node('h3',basis + '당 가격'));
      const max = Math.max(...rows.map(cost));
      for (const q of rows) {
        const row = node('div',undefined,'price-row');
        const userQuote = saved.includes(q);
        row.append(node('strong',q.kind + ' · ' + q.item),source(q.seller + ' ↗',q.link));
        const bar = node('div',undefined,'bar');
        bar.style.width = (100*cost(q)/max) + '%';
        row.append(bar,node('span',format(cost(q)) + '원 / ' + basis + '　·　상품가 ' + format(q.price) + '원'));
        row.append(node('small',q.date + (userQuote ? ' · 직접 입력' : ' · 판매 페이지 확인가')));
        if (userQuote) {
          const del = node('button','삭제');
          del.onclick = () => { if (persist(saved.filter(entry => entry !== q))) render(select.value); };
          row.append(del);
        }
        out.append(row);
      }
    }
  }
  select.onchange = () => render(select.value);
  form.onsubmit = event => {
    event.preventDefault();
    const q = Object.fromEntries(new FormData(form));
    for (const k of ['group','item','seller','link']) q[k] = q[k].trim();
    q.price = Number(q.price); q.amount = Number(q.amount);
    q.date = new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
    if (!valid(q)) { byId('quote-msg').textContent = '상품명, 판매처, 금액, 용량과 https 판매 주소를 확인하세요.'; return; }
    if (persist([...saved,q])) {
      form.reset(); render(q.group); byId('quote-msg').textContent = '견적을 저장했습니다.';
    }
  };
  render(water);
  byId('detailBody').addEventListener('click', event => {
    const button = event.target.closest('[data-compare]');
    if (!button) return;
    byId('close').click();
    location.hash = 'compare';
    form.closest('details').open = true;
    form.elements.group.value = button.dataset.compare;
    form.elements.item.value = button.dataset.compare;
    form.elements.seller.focus();
  });

  const cpi = [2.4,2.4,2.3,2,2,2.2,2.6,3.1,3.2,2.8,3.1,2.9,2.8];
  cpi.forEach((value,index) => {
    const date = new Date(Date.UTC(2025,9+index,1)).toISOString().slice(0,7);
    const row = node('div',undefined,'cpi-row');
    const track = node('div');
    const bar = node('div',undefined,'bar');
    bar.style.width = (value / 4 * 100) + '%';
    track.append(bar);
    row.append(node('time',date),track,node('strong',value.toFixed(1)+'%'));
    byId('cpi-chart').append(row);
  });
  const wb = 'https://www.worldbank.org/en/research/commodity-markets';
  const kamis = 'https://www.kamis.or.kr/customer/reference/openapi_list.do?action=detail&boardno=17';
  const indicators = [
    ['원/달러 환율','원화로 결제하는 수입 원료비의 변동을 확인합니다.','한국은행 ECOS','https://ecos.bok.or.kr/'],
    ['국제 원유 가격','운송비와 포장재 원가의 방향을 살핍니다.','세계은행',wb],
    ['국제 밀 가격','제분·제빵·면류의 원료비를 추적합니다.','세계은행',wb],
    ['국제 대두유 가격','식용유와 튀김 제품의 원료비를 살핍니다.','세계은행',wb],
    ['국제 설탕 가격','음료·제과 원료 구매 시 참고합니다.','세계은행',wb],
    ['국제 옥수수 가격','전분·사료 원료비의 변화를 살핍니다.','세계은행',wb],
    ['국내 쌀 소매가격','같은 품종·등급의 쌀 가격을 비교합니다.','aT KAMIS',kamis],
    ['국내 배추 소매가격','김치 원료의 계절적 가격 변화를 살핍니다.','aT KAMIS',kamis],
    ['전국 소비자물가 전년동월비','최종 소비 단계의 전반적인 가격 변화를 확인합니다.','국가데이터처','https://mods.go.kr/boardDownload.es?bid=213&list_no=447801&seq=2'],
    ['최저시급','식품 가공·포장 인건비의 기준입니다. 2026년 시간당 10,320원입니다.','최저임금위원회','https://www.minimumwage.go.kr/']
  ];
  for (const [title,description,label,url] of indicators) {
    const card = node('article',undefined,'panel');
    card.append(node('h3',title),node('p',description),source(label+' ↗',url));
    byId('indicators').append(card);
  }
})();

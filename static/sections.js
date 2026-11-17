(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const panels = Array.from(document.querySelectorAll('.tabview'));
  function navigate() {
    const target = panels.find(panel => '#' + panel.id === location.hash) || panels[0];
    panels.forEach(panel => { panel.hidden = panel !== target; });
    if (target !== panels[0]) panels[0].classList.remove('intro');
    document.querySelectorAll('.navlinks a').forEach(link => {
      if (link.hash === '#' + target.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (panels.some(panel => '#' + panel.id === location.hash)) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', navigate);
  navigate();
  const finder = byId('search');
  const finishIntro = event => {
    if (event.target === finder && (!event.animationName || event.animationName === 'home-arrive')) {
      panels[0].classList.remove('intro');
    }
  };
  finder.addEventListener('animationend', finishIntro, {once: true});
  finder.addEventListener('animationcancel', finishIntro, {once: true});

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

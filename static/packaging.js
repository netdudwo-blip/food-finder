'use strict';
(() => {
 const host=document.getElementById('pack-list'),intro=document.getElementById('pack-material'),nav=document.getElementById('pack-material-nav'),query=document.getElementById('pack-query');
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
 function link(text,url){const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a}
 let items=[],materials=[],selected='all';
 function select(id){selected=id;query.value='';render()}
 function render(){
  const term=query.value.trim().toLocaleLowerCase('ko-KR');
  const chosen=materials.find(m=>m.id===selected);
  nav.replaceChildren();
  for(const m of [{id:'all',title:'전체 재질'},...materials]){
   const b=node('button',m.title,m.group==='플라스틱'&&m.id!=='plastic'?'pack-subitem':'');b.type='button';b.setAttribute('aria-current',String(selected===m.id));b.onclick=()=>select(m.id);nav.append(b);
  }
  const visible=materials.filter(m=>((selected==='all'&&(term||m.group!=='플라스틱'||m.id==='plastic'))||m.id===selected||(selected==='plastic'&&m.group==='플라스틱'))&&JSON.stringify(m).toLocaleLowerCase('ko-KR').includes(term));
  document.getElementById('pack-count').textContent=visible.length+'개 재질';
  intro.replaceChildren();host.replaceChildren();
  if(!visible.length){intro.append(node('p','일치하는 재질이 없습니다. 검색어를 바꾸거나 전체 재질을 선택하세요.'));return}
  intro.append(node('p',chosen?chosen.title+' · 재질 안내':'포장재의 기본 재료부터 살펴보세요','pack-eyebrow'));
  const grid=node('div',null,'pack-material-grid');
  for(const m of visible){
   const card=node('article',null,'pack-material-card');
   const top=node('div',null,'pack-material-head');top.append(node('span',m.group,'pack-category'),node('h2',m.title),node('p',m.feature));
   card.append(top);
   const dl=node('dl');for(const [k,v] of [['특성·주의점',m.caution],['생산방법',m.process],['대표 예시',m.example],['주문 전 확인',m.check]])dl.append(node('dt',k),node('dd',v));card.append(dl);
   const photos=node('div',null,'pack-material-photos');
   for(const id of m.photos){const p=items[id];if(!p)continue;const f=node('figure');const img=node('img');img.src=p.image;img.alt=p.title+' · 대표 제품 예시';img.loading='lazy';img.width=240;img.height=170;f.append(img,node('figcaption',p.title),link('사진·규격 출처 ↗',p.url));photos.append(f)}
   if(m.photos.length)card.append(photos);else card.append(node('p','사진 미확보 · 위 대표 예시는 용도 설명입니다. 다른 재질의 사진으로 대체하지 않았습니다.','pack-photo-note'));
   const refs=node('div',null,'pack-card-links');m.sources.forEach(([label,url])=>refs.append(link(label+' ↗',url)));card.append(refs);
   const more=node('button','해당 재질만 보기 →','pack-material-open');more.type='button';more.onclick=()=>select(m.id);if(selected!==m.id)card.append(more);
   grid.append(card);
  }
  intro.append(grid);
  intro.append(node('p','내열온도는 재질 전체에 공통인 숫자로 안내하지 않습니다. 완제품의 식품용 표시·시험성적서와 가열 사용 표시를 확인하세요.','pack-material-note'));
  const ids=new Set(visible.flatMap(m=>m.photos));
  if(ids.size)host.append(node('h2','사진 속 포장재 · 생산과 주문 조건','pack-examples-title'));
  for(const id of ids){const p=items[id];if(!p)continue;
   const card=node('article',null,'pack-card');const body=node('div',null,'pack-body');body.append(node('span',p.group,'pack-category'),node('h3',p.title),node('p',p.look));
   const details=node('details');details.append(node('summary','생산방법 · 최소주문수량 확인'));
   const ol=node('ol',null,'pack-process');p.steps.forEach(s=>ol.append(node('li',s)));details.append(ol,link('공정 참고 ↗',p.processSource));
   const dl=node('dl');for(const [k,v] of [['실제 재질',p.material],['기성품 판매·출하 단위',p.pack],['맞춤 생산 MOQ',p.moq]])dl.append(node('dt',k),node('dd',v));details.append(dl);
   const ul=node('ul');p.terms.forEach(t=>ul.append(node('li',t)));details.append(ul);body.append(details,link('대표 제품·사진 출처 ↗',p.url));card.append(body);host.append(card);
  }
 }
 document.getElementById('pack-menu-toggle').onclick=function(){const open=this.getAttribute('aria-expanded')!=='true';this.setAttribute('aria-expanded',String(open));nav.hidden=!open;document.getElementById('pack-workspace').classList.toggle('pack-menu-closed',!open)};
 query.oninput=render;
 Promise.all(['/static/packaging-data.json','/static/packaging-materials.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error();return r.json()}))).then(([p,m])=>{items=p;materials=m;render()}).catch(()=>{intro.textContent='포장재 자료를 가져오지 못했습니다. 새로고침해 주세요.'});
})();

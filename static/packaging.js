'use strict';
(() => {
 const host=document.getElementById('pack-list');
 const filter=document.getElementById('pack-filter'),query=document.getElementById('pack-query');
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n};
 function link(text,url){const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a}
 let items=[];
 function render(){
  const term=query.value.trim().toLocaleLowerCase('ko-KR');
  const visible=items.filter(item=>(!filter.value||item.group===filter.value)&&
   [item.title,item.material,item.look,item.use,item.product,...item.steps].join(' ').toLocaleLowerCase('ko-KR').includes(term));
  document.getElementById('pack-count').textContent=visible.length+'종';
  host.replaceChildren();
  if(!visible.length){host.append(node('p','조건에 맞는 포장재가 없습니다. 검색어나 종류를 변경하세요.'));return}
  for(const p of visible){
   const card=node('article');card.className='pack-card';
   const image=node('img');image.src=p.image;image.alt=p.title+' 대표 제품 사진 · '+p.supplier;image.loading='lazy';image.width=400;image.height=300;
   const caption=node('figcaption',p.supplier+' · '+p.product);
   const figure=node('figure');figure.append(image,caption);
   const body=node('div');body.className='pack-body';
   const category=node('span',p.group);category.className='pack-category';
   body.append(category,node('h2',p.title),node('p',p.look));
   const dl=node('dl');
   for(const [title,value] of [['재질',p.material],['이런 곳에 사용',p.use]]){
    dl.append(node('dt',title),node('dd',value));
   }
   body.append(dl);
   const detail=node('details'),summary=node('summary','생산방법 · 주문 조건 살펴보기');
   detail.append(summary,node('h3','보통 이렇게 만듭니다'));
   const steps=node('ol');steps.className='pack-process';
   for(const step of p.steps)steps.append(node('li',step));
   detail.append(steps,link('생산 공정 참고 ↗',p.processSource));
   const counts=node('dl');
   counts.append(node('dt','공개 판매·출하 단위'),node('dd',p.pack),node('dt','맞춤 생산 MOQ'),node('dd',p.moq));
   detail.append(counts,node('h3','제작 전 확인'));
   const list=node('ul');p.terms.forEach(t=>list.append(node('li',t)));
   detail.append(list);
   body.append(detail);
   const sources=node('div');sources.className='pack-card-links';
   sources.append(link('대표 제품·사진 출처 ↗',p.url),link('제작 상담 안내 ↗',p.supplier==='두레'?'https://www.durepack.com/consulting':'https://www.saeropnl.com/shop/board.php?ps_bbscuid=20'));
   body.append(sources);card.append(figure,body);host.append(card);
  }
 }
 filter.onchange=render;query.oninput=render;
 fetch('/static/packaging-data.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{items=data;render()})
 .catch(()=>{host.textContent='포장재 자료를 가져오지 못했습니다. 새로고침해 주세요.'});
})();

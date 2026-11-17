'use strict';
(() => {
 const hero=document.querySelector('.photo-hero');
 const slides=Array.from(hero.querySelectorAll('.photo-slide')),dots=Array.from(hero.querySelectorAll('[data-slide]'));
 const pause=hero.querySelector('.slide-pause'),media=matchMedia('(prefers-reduced-motion: reduce)');
 let index=0,stopped=media.matches,timer;
 function show(next){
  index=next;
  slides.forEach((s,i)=>{s.classList.toggle('active',i===index);s.setAttribute('aria-hidden',String(i!==index))});
  dots.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
 }
 function schedule(){
  clearInterval(timer);
  if(!stopped&&!document.hidden)timer=setInterval(()=>show((index+1)%slides.length),6500);
  hero.classList.toggle('motion-paused',stopped);
  pause.textContent=stopped?'재생':'일시정지';pause.setAttribute('aria-pressed',String(stopped));
 }
 dots.forEach((b,i)=>b.onclick=()=>{show(i);schedule()});
 pause.onclick=()=>{stopped=!stopped;schedule()};
 document.addEventListener('visibilitychange',schedule);
 media.addEventListener('change',()=>{stopped=media.matches;schedule()});
 show(0);schedule();
 document.getElementById('hero-search').onclick=()=>{
  document.getElementById('search').scrollIntoView({behavior:media.matches?'instant':'smooth',block:'start'});
  document.getElementById('query').focus({preventScroll:true});
 };
})();

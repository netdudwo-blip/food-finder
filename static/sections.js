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
})();

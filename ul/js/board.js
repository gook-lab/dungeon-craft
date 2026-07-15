/* ============================================================
   board.js — 초기화 · 내비 스크롤스파이 · 날씨 컨트롤
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function init() {
    // 콘텐츠 생성
    window.Components.buildSwatches();
    window.Components.buildTypes();
    window.Components.buildDialog();
    window.Components.buildCommand();
    window.Components.buildField();
    window.Components.buildMenu();
    if (window.Components.buildEquip) window.Components.buildEquip();
    window.Components.buildMinimap();
    window.Demo.buildCombatStage();
    window.Demo.buildStatusShowcase();
    window.Demo.buildInteractive();

    // 날씨
    const wxStage = $('#weatherStage');
    const wx = window.WeatherStage(wxStage);
    $$('[data-wx]').forEach(btn => btn.addEventListener('click', () => {
      $$('[data-wx]').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      wx.set(btn.dataset.wx);
    }));

    // 내비 스크롤스파이
    const links = $$('.nav a');
    const map = {};
    links.forEach(a => { map[a.getAttribute('href').slice(1)] = a; });
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(a => a.classList.remove('active'));
          const a = map[e.target.id]; if (a) a.classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('section.block').forEach(s => obs.observe(s));

    // 부드러운 스크롤
    links.forEach(a => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const t = document.getElementById(id);
      if (t) { e.preventDefault();
        const y = t.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: y, behavior: 'smooth' }); }
    }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ============================================================
   settings.js — 설정 화면 (사운드 / 게임 / 조작)
   슬라이더·토글·세그먼트 라디오 + 키보드 네비. localStorage 지속.
   게임 audio.setVolume 등에 매핑되는 값 구조를 그대로 반영.
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  const KEY = 'dq_settings_v1';
  const DEFAULTS = {
    master: 80, bgm: 60, sfx: 90, mute: false,          // 사운드
    textSpeed: '보통', battleSpeed: '보통', autosave: true, colorblind: false, // 게임
    screenShake: true,
  };
  let S = load();
  function load() { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return { ...DEFAULTS }; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); flashSaved(); apply(); }
  let savedT;
  function flashSaved() { const n = $('#savenote'); n.style.opacity = '1'; clearTimeout(savedT); savedT = setTimeout(() => n.style.opacity = '0', 1100); }
  function apply() {
    // 실제 게임에서는 여기서 audio.setVolume(S.mute?0:S.master/100) 등 호출.
    document.documentElement.style.setProperty('--demo-cb', S.colorblind ? '1' : '0');
    renderCbPrev();
  }

  // ---- 페이지 정의: 각 항목 {id, name, type, hint, ...} ----
  const PAGES = {
    audio: [
      { id: 'master', name: '전체 음량', type: 'slider', hint: '모든 소리의 기준 음량' },
      { id: 'bgm', name: '배경음악 (BGM)', type: 'slider', hint: '지역별 음악 · SFX 아래로 깔림' },
      { id: 'sfx', name: '효과음 (SFX)', type: 'slider', hint: '타격·메뉴·발소리 등' },
      { id: 'mute', name: '음소거', type: 'toggle', hint: '모든 소리를 일시 정지' },
    ],
    game: [
      { id: 'textSpeed', name: '텍스트 속도', type: 'radio', opts: ['느림', '보통', '빠름', '즉시'], hint: '대사 출력 속도' },
      { id: 'battleSpeed', name: '전투 속도', type: 'radio', opts: ['보통', '빠름', '2배'], hint: '전투 연출·애니메이션 배속' },
      { id: 'autosave', name: '자동 저장', type: 'toggle', hint: '지역 이동·전투 후 자동으로 저장' },
      { id: 'screenShake', name: '화면 흔들림', type: 'toggle', hint: '강타·피격 시 카메라 셰이크' },
      { id: 'colorblind', name: '색맹 모드', type: 'toggle', hint: '상태·속성을 색 외에 기호/패턴으로도 구분', prev: true },
    ],
  };

  let page = 'audio';
  let sel = 0; // 현재 선택 항목 인덱스 (audio/game)

  function segBar(v) {
    const n = 10, f = Math.round(v / 100 * n);
    let html = '';
    for (let i = 0; i < n; i++) html += `<div class="seg ${i < f ? 'f' : ''}"></div>`;
    return `<div class="bar">${html}</div>`;
  }

  function renderPage() {
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.page === page));
    const body = $('#body'); body.innerHTML = '';
    if (page === 'controls') { body.appendChild(controlsPage()); return; }
    const items = PAGES[page];
    const wrap = el('div', 'page on');
    items.forEach((it, i) => {
      const row = el('div', 'opt' + (i === sel ? ' sel' : ''));
      row.dataset.idx = i;
      const name = el('div', 'name', `<span class="cur">▶</span>${it.name}`);
      const ctl = el('div');
      if (it.type === 'slider') {
        ctl.className = 'slider';
        ctl.innerHTML = segBar(S[it.id]) + `<span class="val">${S[it.id]}</span>`;
      } else if (it.type === 'toggle') {
        const tg = el('div', 'toggle' + (S[it.id] ? ' on' : ''));
        tg.innerHTML = `<span class="sw"><span class="knob"></span></span><span class="txt">${S[it.id] ? 'ON' : 'OFF'}</span>`;
        tg.onclick = () => { S[it.id] = !S[it.id]; sel = i; save(); renderPage(); };
        ctl.appendChild(tg);
      } else if (it.type === 'radio') {
        const sr = el('div', 'seg-radio');
        it.opts.forEach(o => { const b = el('button', S[it.id] === o ? 'on' : '', o);
          b.onclick = () => { S[it.id] = o; sel = i; save(); renderPage(); }; sr.appendChild(b); });
        ctl.appendChild(sr);
      }
      row.append(name, ctl);
      row.onclick = () => { sel = i; renderPage(); };
      wrap.appendChild(row);
      if (i === sel && it.hint) wrap.appendChild(el('div', 'hint', it.hint));
      if (i === sel && it.prev) wrap.appendChild(cbPrevEl());
    });
    body.appendChild(wrap);
  }

  function cbPrevEl() {
    const d = el('div', 'cbprev');
    const chips = S.colorblind
      ? [['독 ☣', '#9ad94f'], ['수면 ☾', '#b59cff'], ['약화 ▼', '#d98446'], ['약점 ▲', '#fff0b8'], ['반감 ◇', '#a7b0d8']]
      : [['독', '#9ad94f'], ['수면', '#b59cff'], ['약화', '#d98446'], ['약점', '#fff0b8'], ['반감', '#a7b0d8']];
    chips.forEach(([t, c]) => { const chip = el('span', 'chip', t);
      chip.style.color = c; chip.style.boxShadow = `inset 0 0 0 1px ${c}`; chip.style.background = 'rgba(0,0,0,.5)'; d.appendChild(chip); });
    return d;
  }
  function renderCbPrev() { /* 미리보기는 renderPage에서 재생성 */ }

  function controlsPage() {
    const wrap = el('div', 'page on');
    const rows = [
      ['이동', '방향키 / WASD'], ['확인 · 조사 · 대화', 'Z / Enter'],
      ['취소 · 뒤로', 'X / Esc'], ['메뉴 (상태·편성·퀘스트)', 'X (필드)'],
      ['도감', 'C'], ['빠른 이동', '룬게이트에서 Z'],
      ['전투 — 명령 선택', '방향키 + Z'], ['전투 — 대상 지정', '방향키 + Z'],
      ['설정', 'Esc → 설정'], ['전체화면', 'F11'],
    ];
    const grid = el('div', 'keys');
    rows.forEach(([a, k]) => grid.appendChild(el('div', 'k', `<span class="act">${a}</span><span class="kbd">${k}</span>`)));
    wrap.appendChild(grid);
    wrap.appendChild(el('div', 'hint', '조작은 현재 고정입니다. 리매핑은 추후 지원 예정.'));
    return wrap;
  }

  // ---- 키보드 ----
  function items() { return PAGES[page] || []; }
  function adjust(dir) {
    const it = items()[sel]; if (!it) return;
    if (it.type === 'slider') { S[it.id] = Math.max(0, Math.min(100, S[it.id] + dir * 5)); save(); renderPage(); }
    else if (it.type === 'toggle') { S[it.id] = dir > 0 ? true : false; save(); renderPage(); }
    else if (it.type === 'radio') { const i = it.opts.indexOf(S[it.id]); const ni = Math.max(0, Math.min(it.opts.length - 1, i + dir)); S[it.id] = it.opts[ni]; save(); renderPage(); }
  }
  function switchTab(dir) {
    const order = ['audio', 'game', 'controls'];
    let i = order.indexOf(page); i = (i + dir + order.length) % order.length; page = order[i]; sel = 0; renderPage();
  }
  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'Tab') { e.preventDefault(); switchTab(e.shiftKey ? -1 : 1); return; }
    if (page === 'controls') { if (k === 'x' || k === 'X') $('#closeBtn').click(); return; }
    const n = items().length;
    if (k === 'ArrowUp') { e.preventDefault(); sel = (sel + n - 1) % n; renderPage(); }
    else if (k === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % n; renderPage(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); adjust(-1); }
    else if (k === 'ArrowRight') { e.preventDefault(); adjust(1); }
    else if (k === 'x' || k === 'X') { $('#closeBtn').click(); }
  });

  $$('.tab').forEach(t => t.onclick = () => { page = t.dataset.page; sel = 0; renderPage(); });
  $('#resetBtn').onclick = () => { S = { ...DEFAULTS }; save(); renderPage(); };
  $('#closeBtn').onclick = () => { const s = $('#settings'); s.animate([{ opacity: 1 }, { opacity: .4, transform: 'scale(.99)' }], { duration: 160 }); };

  apply(); renderPage();
})();

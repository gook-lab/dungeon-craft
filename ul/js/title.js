/* ============================================================
   title.js — 드래곤 크립트 타이틀 화면 로직
   파릴랙스 픽셀 배경 + 세이브 슬롯 카드 + 키보드 플로우(slots/action).
   실제 titleScene.js 흐름과 1:1: 빈 슬롯=새 게임 직행, 채운 슬롯=액션 메뉴.
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const HERO_KR = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };

  // --- 세이브 슬롯 데이터 (목업) ---
  const SLOTS = [
    { slot: 1, party: ['knight', 'warrior', 'huntress'], level: 12, gold: 1240, place: '늪지대 · 마녀의 가마솥', play: '3:12' },
    { slot: 2, party: ['mage', 'knight', 'warrior', 'duelist'], level: 20, gold: 4580, place: '심연의 핵', play: '8:41' },
    { slot: 3, party: null }, // 빈 슬롯
  ];
  const ACTIONS = [
    { id: 'continue', label: '이어하기' },
    { id: 'new', label: '새로 시작' },
    { id: 'delete', label: '삭제', danger: true },
    { id: 'cancel', label: '취소' },
  ];

  let mode = 'slots';      // 'slots' | 'action'
  let slotIdx = +(localStorage.getItem('dc_title_slot') || 0);
  let actIdx = 0;

  /* ===== 스케일 ===== */
  function fit() {
    const stage = $('#stage');
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = `scale(${s})`;
  }

  /* ===== 파릴랙스 픽셀 배경 ===== */
  function drawBg() {
    const c = $('#bgCanvas'); const W = c.width = 1280, H = c.height = 720;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    // 하늘 그라데이션
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0a0b16'); sky.addColorStop(0.45, '#141a36'); sky.addColorStop(0.72, '#1d2547'); sky.addColorStop(1, '#0e1228');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // 별 (시드 고정 느낌)
    let seed = 1337; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 140; i++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H * 0.6), s = rnd() < 0.85 ? 1 : 2;
      g.fillStyle = rnd() < 0.5 ? 'rgba(243,237,218,.9)' : 'rgba(180,131,240,.7)'; g.fillRect(x, y, s, s); }
    // 달 (창백한 보라)
    g.fillStyle = '#cfc4e8'; g.beginPath(); g.arc(W * 0.78, H * 0.2, 46, 0, 7); g.fill();
    g.fillStyle = '#141a36'; g.beginPath(); g.arc(W * 0.80, H * 0.18, 42, 0, 7); g.fill();
    g.fillStyle = 'rgba(180,131,240,.12)'; g.beginPath(); g.arc(W * 0.78, H * 0.2, 70, 0, 7); g.fill();
    // 원경 첨탑 실루엣 (먼 성/던전)
    function spires(baseY, col, count, hMax, jitter) {
      g.fillStyle = col;
      for (let i = 0; i < count; i++) { const bw = W / count; const x = i * bw + (rnd() - 0.5) * jitter;
        const ph = hMax * (0.4 + rnd() * 0.6); g.fillRect(x, baseY - ph, bw * 0.8, ph + 40);
        // 뾰족 지붕
        g.beginPath(); g.moveTo(x, baseY - ph); g.lineTo(x + bw * 0.4, baseY - ph - 28); g.lineTo(x + bw * 0.8, baseY - ph); g.closePath(); g.fill();
      }
    }
    spires(H * 0.72, '#171d38', 7, 200, 30);
    spires(H * 0.80, '#10142a', 9, 150, 40);
    // 안개 띠
    const fog = g.createLinearGradient(0, H * 0.62, 0, H * 0.86); fog.addColorStop(0, 'rgba(60,70,110,0)'); fog.addColorStop(1, 'rgba(60,70,110,.22)');
    g.fillStyle = fog; g.fillRect(0, H * 0.62, W, H * 0.24);
    // 전경 지면 (영웅이 선 절벽)
    g.fillStyle = '#0c1020'; g.fillRect(0, H * 0.82, W, H * 0.18);
    g.fillStyle = '#161c30'; g.fillRect(0, H * 0.82, W, 4);
    // 지면 픽셀 텍스처
    for (let i = 0; i < 80; i++) { const x = Math.floor(rnd() * W), y = H * 0.82 + Math.floor(rnd() * H * 0.16);
      g.fillStyle = rnd() < 0.5 ? '#101526' : '#0a0e1c'; g.fillRect(x, y, 2, 2); }
  }

  /* ===== 슬롯 카드 렌더 ===== */
  function slotPortraits(party) {
    if (!party) return `<div class="pp"><span class="pp-plus">＋</span></div>`;
    const shown = party.slice(0, 3).map(c => `<div class="pp"><img src="assets/${c}.png" alt=""></div>`).join('');
    const more = party.length > 3 ? `<span class="more">+${party.length - 3}</span>` : '';
    return shown + more;
  }
  function slotLabel(s) {
    if (!s.party) return '비어있음';
    const lead = HERO_KR[s.party[0]] || s.party[0];
    return s.party.length > 1 ? `${lead} 외 ${s.party.length - 1}인` : lead;
  }
  function renderSlots() {
    const root = $('#slots');
    root.innerHTML = `<div class="slot-head">SAVE DATA · 모험을 선택하라</div>` + SLOTS.map((s, i) => {
      const sel = i === slotIdx ? ' sel' : '';
      if (!s.party) return `<div class="slot-card empty${sel}" data-i="${i}"><span class="cursor">▶</span>
        <div class="slot-portraits">${slotPortraits(null)}</div>
        <div class="slot-info"><div class="slot-empty">슬롯 ${s.slot} — 비어있음</div>
        <div class="slot-meta"><span class="play">새로운 모험을 시작합니다</span></div></div></div>`;
      return `<div class="slot-card${sel}" data-i="${i}"><span class="cursor">▶</span>
        <div class="slot-portraits">${slotPortraits(s.party)}</div>
        <div class="slot-info">
          <div class="slot-title">슬롯 ${s.slot} · ${slotLabel(s)}</div>
          <div class="slot-meta"><span class="lv">Lv.${s.level}</span><span class="gold">◆ ${s.gold.toLocaleString()}G</span></div>
          <div class="slot-meta"><span class="place">${s.place}</span><span class="play">⏱ ${s.play}</span></div>
        </div></div>`;
    }).join('');
    root.querySelectorAll('.slot-card').forEach(card => {
      card.addEventListener('click', () => { slotIdx = +card.dataset.i; renderSlots(); confirmSlot(); });
    });
    updateHero();
  }

  function renderAction() {
    const ov = $('#actionOverlay');
    ov.classList.toggle('on', mode === 'action');
    if (mode !== 'action') return;
    const s = SLOTS[slotIdx];
    $('#actionTitle').textContent = `슬롯 ${s.slot} · ${slotLabel(s)}`;
    $('#actionList').innerHTML = ACTIONS.map((a, i) =>
      `<div class="action-row${a.danger ? ' danger' : ''}${i === actIdx ? ' sel' : ''}"><span class="cursor">▶</span><span class="lbl">${a.label}</span></div>`).join('');
  }

  function updateHero() {
    const s = SLOTS[slotIdx];
    const hero = $('#hero');
    if (s.party) { hero.src = `assets/${s.party[0]}.png`; hero.style.opacity = '1'; $('#heroShadow').style.opacity = '1'; }
    else { hero.style.opacity = '0'; $('#heroShadow').style.opacity = '0'; }
  }

  function updateHint() {
    $('#hint').innerHTML = mode === 'slots'
      ? `<span class="kbd">↑</span><span class="kbd">↓</span> 슬롯 선택 · <span class="kbd">Z</span> 확인`
      : `<span class="kbd">↑</span><span class="kbd">↓</span> 선택 · <span class="kbd">Z</span> 확인 · <span class="kbd">X</span> 뒤로`;
  }

  function confirmSlot() {
    const s = SLOTS[slotIdx];
    if (!s.party) { flash('새 게임 시작! (슬롯 ' + s.slot + ')'); return; } // 빈 슬롯 → 새 게임 직행
    mode = 'action'; actIdx = 0; renderAction(); updateHint();
  }
  function doAction() {
    const a = ACTIONS[actIdx]; const s = SLOTS[slotIdx];
    if (a.id === 'cancel') { mode = 'slots'; renderAction(); updateHint(); return; }
    if (a.id === 'delete') { SLOTS[slotIdx] = { slot: s.slot, party: null }; mode = 'slots'; renderSlots(); renderAction(); updateHint(); flash('슬롯 ' + s.slot + ' 삭제됨'); return; }
    flash((a.id === 'continue' ? '이어하기' : '새로 시작') + ' — 슬롯 ' + s.slot);
  }

  // 데모용 토스트
  function flash(msg) {
    let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast';
      t.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;font-family:var(--f-display);font-size:26px;color:#0a0b16;background:var(--c-gold);padding:12px 26px;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:none';
      $('#stage').appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    t.animate([{ opacity: 0, transform: 'translate(-50%,-40%)' }, { opacity: 1, transform: 'translate(-50%,-50%)', offset: .2 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: 1400 });
    clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = '0', 1400);
  }

  /* ===== 키보드 ===== */
  function onKey(e) {
    const k = e.key;
    if (['ArrowUp', 'ArrowDown', 'z', 'Z', 'x', 'X', ' '].includes(k)) e.preventDefault();
    if (mode === 'slots') {
      if (k === 'ArrowUp') { slotIdx = (slotIdx + SLOTS.length - 1) % SLOTS.length; localStorage.setItem('dc_title_slot', slotIdx); renderSlots(); }
      else if (k === 'ArrowDown') { slotIdx = (slotIdx + 1) % SLOTS.length; localStorage.setItem('dc_title_slot', slotIdx); renderSlots(); }
      else if (k === 'z' || k === 'Z' || k === ' ') confirmSlot();
    } else {
      if (k === 'ArrowUp') { actIdx = (actIdx + ACTIONS.length - 1) % ACTIONS.length; renderAction(); }
      else if (k === 'ArrowDown') { actIdx = (actIdx + 1) % ACTIONS.length; renderAction(); }
      else if (k === 'z' || k === 'Z' || k === ' ') doAction();
      else if (k === 'x' || k === 'X') { mode = 'slots'; renderAction(); updateHint(); }
    }
  }

  function init() {
    fit(); window.addEventListener('resize', fit);
    drawBg();
    // 날씨 (기존 엔진 재활용)
    const wx = window.WeatherStage($('#wxHost'));
    wx.set('rain');
    document.querySelectorAll('.wx-toggle button').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.wx-toggle button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); wx.set(b.dataset.wx);
    }));
    renderSlots(); renderAction(); updateHint();
    window.addEventListener('keydown', onKey);
    // 액션 행 클릭
    $('#actionList').addEventListener('click', (e) => { const row = e.target.closest('.action-row'); if (!row) return;
      actIdx = [...row.parentNode.children].indexOf(row); renderAction(); doAction(); });
    $('#stage').addEventListener('click', () => $('#stage').focus());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ============================================================
   fasttravel.js — 룬게이트 빠른 이동 UI
   월드맵(canvas) + 지역 노드(HTML) + 선택 상세 패널 + 이동 연출
   실제 게임 26맵의 권역/연결을 반영. 좌표는 0~1 정규화.
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  // ---- 노드 데이터: 실제 게임 맵 반영 ----
  // state: current | hub(룬게이트) | safe(안전 허브) | boss(위험) | node(일반) | locked(미발견)
  // x,y: 지도 정규화 좌표. act: 1|2|3. lv: 권장 레벨. enc: 조우 위험.
  const NODES = [
    // ── 1막 · 크립트 권역 ──
    { id: 'town', name: '크립트 마을', region: '1막 · 크립트', kind: '시작 마을 · 룬게이트', state: 'hub', x: .12, y: .74, lv: 1, enc: 'safe', tile: 'town', desc: '모험의 거점. 여관·상점·대장간이 있는 안전한 마을. 룬게이트의 중심축.' },
    { id: 'lake_town', name: '호숫가 마을', region: '1막 · 크립트', kind: '안전 허브', state: 'safe', x: .04, y: .52, lv: 3, enc: 'safe', tile: 'town', desc: '황야 서편의 조용한 휴식촌. 호수 부두와 낚시꾼, 연금 재료를 파는 잡화점.' },
    { id: 'wild', name: '황야', region: '1막 · 크립트', kind: '평원 필드', state: 'current', x: .22, y: .55, lv: 3, enc: 'low', tile: 'meadow', desc: '마을과 묘지를 잇는 드넓은 초원. 사행로와 개울, 북부 고지의 폐허.' },
    { id: 'darkforest', name: '어둠숲', region: '1막 · 크립트', kind: '수목 미로', state: 'node', x: .34, y: .4, lv: 5, enc: 'mid', tile: 'forest', desc: '빛이 들지 않는 수목 미로. 늑대와 거미 무리의 매복이 잦다.' },
    { id: 'dungeon', name: '지하 묘지', region: '1막 · 크립트', kind: '던전 · 해골왕', state: 'boss', x: .25, y: .3, lv: 6, enc: 'high', tile: 'dungeon', desc: '해골 왕이 왕좌를 지키는 뼈의 묘실. 금고 안쪽엔 비밀 수로가 있다.' },
    { id: 'frost', name: '설원', region: '1막 · 크립트', kind: '설빙 동굴 · 늑대왕', state: 'boss', x: .42, y: .2, lv: 10, enc: 'high', tile: 'frost_ice', desc: '대빙호가 얼어붙은 서리 동굴. 늑대 왕의 영역이며 빙판 함정이 도사린다.' },
    { id: 'swamp', name: '늪지대', region: '1막 · 크립트', kind: '독늪 · 늪의 마녀', state: 'boss', x: .56, y: .32, lv: 13, enc: 'high', tile: 'swamp', desc: '독안개가 깔린 일곱 늪의 습지. 늪의 마녀가 뿌리 단상에 웅크린다.' },

    // ── 2막 · 제국 권역 ──
    { id: 'overworld', name: '몰락 평원', region: '2막 · 제국', kind: '대여정 필드', state: 'node', x: .5, y: .5, lv: 14, enc: 'mid', tile: 'meadow', desc: '늪과 제국을 잇는 광대한 평원. 북부 산악과 사행 강, 역참 폐허.' },
    { id: 'empire_camp', name: '피난민 야영지', region: '2막 · 제국', kind: '안전 허브', state: 'safe', x: .66, y: .48, lv: 15, enc: 'safe', tile: 'empire_marble', desc: '무너진 제국 성벽 안의 생존자 야영지. 상인과 치유사가 머문다.' },
    { id: 'port_city', name: '운하 항구', region: '2막 · 제국', kind: '안전 허브', state: 'safe', x: .72, y: .64, lv: 16, enc: 'safe', tile: 'empire_marble', desc: '운하가 가로지르는 보급항. 연금술사와 보석상, 영주의 저택.' },
    { id: 'empire_city', name: '폐허 시가지', region: '2막 · 제국', kind: '시가전 · 타락기사', state: 'boss', x: .74, y: .36, lv: 17, enc: 'high', tile: 'empire_marble', desc: '격자 대로가 미로처럼 얽힌 폐허 수도. 타락한 기사가 배회한다.' },
    { id: 'grand_citadel', name: '대성채', region: '2막 · 제국', kind: '옵션 던전', state: 'locked', x: .84, y: .24, lv: 18, enc: 'high', tile: 'empire_marble', desc: '???' },
    { id: 'empire_throne', name: '황좌의 방', region: '2막 · 제국', kind: '보스 · 황제', state: 'locked', x: .8, y: .12, lv: 20, enc: 'high', tile: 'empire_marble', desc: '???' },

    // ── 3막 · 종막 권역 ──
    { id: 'starfall', name: '별락 재의 길', region: '3막 · 종막', kind: '잿길 필드', state: 'locked', x: .62, y: .12, lv: 22, enc: 'high', tile: 'meadow', desc: '???' },
    { id: 'lava_core', name: '용암 화구', region: '3막 · 종막', kind: '슈퍼보스 · 마그마 드레이크', state: 'locked', x: .5, y: .08, lv: 26, enc: 'high', tile: 'lava', desc: '???' },
    { id: 'void_core', name: '공허의 핵', region: '3막 · 종막', kind: '최종보스 · 공허 군주', state: 'locked', x: .36, y: .07, lv: 30, enc: 'high', tile: 'void_nebula', desc: '???' },
  ];
  // 연결(선) — 지도 경로
  const EDGES = [
    ['town', 'wild'], ['wild', 'lake_town'], ['wild', 'darkforest'], ['wild', 'dungeon'],
    ['dungeon', 'frost'], ['frost', 'swamp'], ['swamp', 'overworld'], ['overworld', 'empire_camp'],
    ['empire_camp', 'port_city'], ['empire_camp', 'empire_city'], ['empire_city', 'grand_citadel'],
    ['empire_city', 'empire_throne'], ['empire_throne', 'starfall'], ['starfall', 'lava_core'],
    ['lava_core', 'void_core'],
  ];
  const KIND_CLASS = { current: 'current', hub: 'hub', safe: 'safe', boss: 'boss', locked: 'locked', node: '' };
  const byId = {}; NODES.forEach(n => byId[n.id] = n);

  const ENC_LABEL = { safe: ['조우 없음', 'safe'], low: ['낮음', ''], mid: ['보통', ''], high: ['높음', 'danger'] };

  // ---- 지역 미니 프리뷰 (타일별 코드 드로잉) ----
  const TILE_PAL = {
    meadow: ['#3f6a30', '#4a7a3a', '#568a3c', '#6b5a3f'],
    forest: ['#26381e', '#2c4a22', '#375426', '#1a2814'],
    dungeon: ['#2a2833', '#36323e', '#4a4652', '#1c1a24'],
    frost_ice: ['#7fa0c0', '#a8c8e4', '#d6e8ff', '#5a7290'],
    swamp: ['#3a4a26', '#45402e', '#3f5a2a', '#2a3018'],
    empire_marble: ['#4a4046', '#6a5c60', '#463a3c', '#8a7c80'],
    lava: ['#2a1208', '#5a2410', '#c94a1a', '#f0a030'],
    void_nebula: ['#1a1030', '#2a1a48', '#6a5a8a', '#b483f0'],
    town: ['#3f6a30', '#4a7a3a', '#6b5a3f', '#8a6a44'],
  };
  function drawPreview(cv, tile, seedStr) {
    const g = cv.getContext('2d'); const W = cv.width = 220, H = cv.height = 150;
    const pal = TILE_PAL[tile] || TILE_PAL.meadow;
    let s = 0; for (const c of (seedStr || tile)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const cell = 10;
    for (let y = 0; y < H / cell; y++) for (let x = 0; x < W / cell; x++) {
      g.fillStyle = pal[(rnd() * 3) | 0]; g.fillRect(x * cell, y * cell, cell, cell);
    }
    // 액센트 데칼
    for (let i = 0; i < 20; i++) { g.fillStyle = pal[3]; const px = (rnd() * W) | 0, py = (rnd() * H) | 0;
      g.fillRect(px, py, 3 + (rnd() * 4 | 0), 3 + (rnd() * 4 | 0)); }
    // 비네트
    const grd = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * .7);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  }

  // ---- 지도 배경 (권역 대륙 + 물 + 경로) ----
  function drawMap() {
    const cv = $('#mapcanvas'); const wrap = cv.parentElement;
    const W = cv.width = wrap.clientWidth, H = cv.height = wrap.clientHeight;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    // 심해 바탕
    g.fillStyle = '#0a1024'; g.fillRect(0, 0, W, H);
    const P = (n) => [n.x * W, n.y * H];
    // 권역 대륙 덩어리 (부드러운 blob)
    const LAND = [
      { c: '#16321a', pts: [[.05, .8], [.2, .48], [.4, .35], [.35, .62], [.18, .85]] },       // 1막 서남
      { c: '#1a2a16', pts: [[.28, .42], [.5, .18], [.62, .38], [.5, .58], [.32, .52]] },      // 1막 북
      { c: '#2a2224', pts: [[.5, .55], [.68, .38], [.88, .2], [.82, .5], [.62, .68]] },       // 2막 제국
      { c: '#1a1230', pts: [[.3, .2], [.55, .04], [.68, .18], [.46, .3], [.32, .3]] },        // 3막 종막
    ];
    LAND.forEach(L => {
      g.fillStyle = L.c; g.beginPath();
      L.pts.forEach((p, i) => { const x = p[0] * W, y = p[1] * H; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath(); g.fill();
      // 해안 하이라이트
      g.strokeStyle = 'rgba(90,120,160,.25)'; g.lineWidth = 3; g.stroke();
    });
    // 물결 텍스처 (심해)
    g.strokeStyle = 'rgba(60,90,140,.10)'; g.lineWidth = 1;
    for (let y = 8; y < H; y += 12) { g.beginPath();
      for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin((x + y) * .05) * 2); g.stroke(); }

    // 경로(엣지)
    EDGES.forEach(([a, b]) => {
      const na = byId[a], nb = byId[b]; if (!na || !nb) return;
      const [x1, y1] = P(na), [x2, y2] = P(nb);
      const locked = na.state === 'locked' || nb.state === 'locked';
      g.strokeStyle = locked ? 'rgba(80,86,120,.3)' : 'rgba(201,139,44,.55)';
      g.lineWidth = 2; g.setLineDash(locked ? [4, 5] : [2, 6]); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    });
    g.setLineDash([]);

  }

  // ---- 노드 렌더 ----
  let selId = 'town';
  function buildNodes() {
    const host = $('#nodes');
    host.querySelectorAll('.node').forEach(e => e.remove());
    NODES.forEach(n => {
      const node = el('div', 'node ' + (KIND_CLASS[n.state] || ''));
      node.style.left = (n.x * 100) + '%'; node.style.top = (n.y * 100) + '%';
      node.innerHTML = `<div class="dot"></div><div class="lbl">${n.state === 'locked' ? '???' : n.name}</div>`;
      node.dataset.id = n.id;
      node.addEventListener('click', () => select(n.id));
      host.appendChild(node);
    });
    highlightSel();
  }
  function highlightSel() {
    $('#nodes').querySelectorAll('.node').forEach(nd => nd.classList.toggle('sel', nd.dataset.id === selId));
  }

  // ---- 사이드 패널 ----
  function select(id) {
    selId = id; highlightSel();
    const n = byId[id]; const side = $('#side');
    const isCurrent = n.state === 'current';
    const isLocked = n.state === 'locked';
    const [encTxt, encCls] = ENC_LABEL[n.enc] || ENC_LABEL.mid;

    side.innerHTML = '';
    side.appendChild(el('div', 'region-tag', isLocked ? '미발견 지역' : n.region));
    side.appendChild(el('h2', '', isLocked ? '??? ' : n.name));
    side.appendChild(el('div', 'kind', isLocked ? '아직 발견하지 못한 장소' : n.kind));

    const prev = el('div', 'preview');
    const cv = document.createElement('canvas'); prev.appendChild(cv);
    if (isLocked) { const fog = el('div', 'fog', '<div class="q">?</div><div>먼저 방문해야 이동할 수 있습니다</div>'); prev.appendChild(fog); }
    else drawPreview(cv, n.tile, n.id);
    side.appendChild(prev);

    const desc = el('div', 'desc');
    desc.innerHTML = `<div style="margin-bottom:10px">${n.desc}</div>` + (isLocked ? '' :
      `<div class="row"><span class="k">권장 레벨</span><span class="v">Lv ${n.lv}+</span></div>
       <div class="row"><span class="k">조우 위험</span><span class="v ${encCls}">${encTxt}</span></div>
       <div class="row"><span class="k">권역</span><span class="v" style="font-family:var(--f-ui)">${n.region}</span></div>`);
    side.appendChild(desc);

    const btn = el('button', 'travelbtn');
    if (isCurrent) { btn.className = 'travelbtn disabled'; btn.innerHTML = '현재 위치'; }
    else if (isLocked) { btn.className = 'travelbtn disabled'; btn.innerHTML = '이동 불가'; }
    else { btn.innerHTML = `이곳으로 이동 <span class="cost">◆ 10</span>`; btn.onclick = () => warpTo(n); }
    side.appendChild(btn);
    side.appendChild(el('div', 'foot-hint', isLocked ? '탐험으로 지도를 밝히세요' : isCurrent ? '이미 이 지역에 있습니다' : '<span class="kbd">Z</span> 로도 이동할 수 있습니다'));
  }

  // ---- 이동 연출 ----
  function warpTo(n) {
    const nodeEl = $(`.node[data-id="${n.id}"]`);
    const r = nodeEl.getBoundingClientRect();
    const warp = $('#warp');
    warp.style.setProperty('--wx', r.left + r.width / 2 + 'px');
    warp.style.setProperty('--wy', r.top + r.height / 2 + 'px');
    warp.animate([{ opacity: 0 }, { opacity: 1, offset: .55 }, { opacity: 1 }], { duration: 900, easing: 'ease-in' });
    warp.style.opacity = '1';
    setTimeout(() => {
      // 도착: 현재 위치 갱신
      NODES.forEach(x => { if (x.state === 'current') x.state = 'node'; });
      n.state = 'current';
      drawMap(); buildNodes(); select(n.id);
      warp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' });
      warp.style.opacity = '0';
    }, 620);
  }

  // ---- 키보드 네비 (가장 가까운 방향 노드로) ----
  function nav(dx, dy) {
    const cur = byId[selId]; let best = null, bestScore = Infinity;
    NODES.forEach(n => {
      if (n.id === selId) return;
      const vx = n.x - cur.x, vy = n.y - cur.y;
      const dot = vx * dx + vy * dy; if (dot <= 0.02) return;
      const dist = Math.hypot(vx, vy); const align = dot / (dist || 1);
      const score = dist / (align * align + .1);
      if (score < bestScore) { bestScore = score; best = n; }
    });
    if (best) select(best.id);
  }
  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowUp') { e.preventDefault(); nav(0, -1); }
    else if (k === 'ArrowDown') { e.preventDefault(); nav(0, 1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); nav(-1, 0); }
    else if (k === 'ArrowRight') { e.preventDefault(); nav(1, 0); }
    else if (k === 'z' || k === 'Z') { const n = byId[selId]; if (n && n.state !== 'current' && n.state !== 'locked') warpTo(n); }
    else if (k === 'x' || k === 'X') { $('#closeHint').textContent = '(데모에서는 닫기 비활성)'; }
  });

  function init() { drawMap(); buildNodes(); select('town'); }
  window.addEventListener('resize', () => { drawMap(); buildNodes(); highlightSel(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

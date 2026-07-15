/* ============================================================
   mapmaker.js — 맵 카탈로그 + 맵 디자이너
   게임의 맵 시맨틱(ground 0잔디/1길/2바닥/3물/4용암제안, collision,
   elev, stairs, spawn, portals)을 그대로 편집·미리보기하고
   content/maps/ 에 바로 넣을 수 있는 JS 모듈로 내보낸다.
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const TILE = 24, ELEV = 12;

  /* ===== 맵 카탈로그 (현재 18맵) ===== */
  const CATALOG = [
    ['1막 · 크립트 권역', [
      ['town', '크립트 마을', '허브 타운', 'town', '상점·여관·영입 4인·워프 룬게이트 · 북측 테라스(L1) · 안전지대'],
      ['wild', '황야', '필드', 'meadow', '첫 전투 지역 · 남→북 진행 · 어둠숲 사이드 분기'],
      ['darkforest', '어둠숲', '옵션 사이드', 'forest', 'dead-end 보상형 · 늑대/거미/말벌 2-4 무리 · 반 계단 위 난도'],
      ['lake_town', '호숫가 마을', '서브 타운', 'town', '황야↔어둠숲 휴식촌 · 호수 부두 · 북측 테라스(L1)'],
      ['dungeon', '지하 묘지', '던전 · 보스', 'dungeon_stone', '해골왕 · 열쇠-돌문 금고 · 왕좌 단상(L2) · 서리 출구'],
      ['waterway', '지하 수로', '옵션 사이드', 'dungeon_stone', '묘지 금고 뒤 비밀 수로 · 링 해자+다리 3 · 단상 보상'],
      ['frost', '설원', '필드 · 보스', 'frost_ice', '늑대인간 왕 보스 선반(L2) · 조각 계단 2개 · 던전 게이트'],
      ['switchback', '협곡 스위치백', '옵션 사이드', 'frost_ice', '설원 북동 등반로 · 3단 지그재그 · 정상 제단 보상'],
      ['swamp', '늪지대', '필드 · 보스', 'swamp', '늪의 마녀 · 침수 금고(열쇠문) · 뿌리 계단 층계 · 제국 출구'],
    ]],
    ['2막 · 제국 권역', [
      ['overworld', '대륙 오버월드', '여정 필드', 'meadow', '늪지대→제국 관문 대여정 · 산악 2단 · 사행 강 다리 2 · 역참'],
      ['empire_gate', '제국 관문', '필드', 'empire_marble', '무너진 성벽 램파트 · 계단 하나로 통과'],
      ['empire_camp', '피난민 야영지', '허브', 'empire_marble', '루버블 단상 · 심연의 다리 남측 분기'],
      ['port_city', '운하 항구도시', '서브 타운', 'town', '야영지 남측 보급항 · 격자 시가+운하 · 영주 테라스(L1)'],
      ['empire_bridge', '심연의 다리', '옵션 사이드', 'dungeon_stone', '붕괴 매복 → 다리 파수꾼(자비 분기) · bridgeChasm 단일 통로'],
      ['empire_city', '폐허 시가지', '필드', 'empire_marble', '우리 스위치·레버 동료 · 지하 의식장 계단(브레이지어 액자)'],
      ['grand_citadel', '대성채', '옵션 던전', 'empire_marble', '귀족구 테라스 위 성채 · 물 정원 홀 · 날개 방 4 · 왕좌(L2)'],
      ['ruins_below', '지하 의식장', '옵션 사이드', 'crypt_a2', '2막 퀘스트라인 목적지 · dead-end'],
      ['empire_throne', '황좌의 방', '보스 · 분기', 'empire_marble', '의식 계단 어센트 · 자비/무자비 두 문이 수렴'],
    ]],
    ['3막 · 별락 & 종반', [
      ['starfall', '별락 재의 길', '필드', 'meadow', '재+운석 파편 길 · 크레이터로 상승'],
      ['starfall_crater', '별락 크레이터', '보스', 'lava', '별 박힌 융기 단상 + 단일 계단 (lava_core 패턴)'],
      ['lava_gate', '용암 관문', '필드', 'lava', '상승 계단 문턱 — 심부 위협 연출'],
      ['lava_keep', '용암 요새', '옵션 던전', 'lava', '관문 동측 요새 · 용암 해자+코즈웨이 · 화염 파수장(옵션 보스)'],
      ['lava_core', '용암 화구', '슈퍼보스', 'lava', '마그마 드레이크 · 코즈웨이 끝 계단 선반 어센트'],
      ['void_gate', '공허 관문', '필드', 'void', '공허 룬 · 단일 계단'],
      ['void_core', '공허의 핵', '슈퍼보스', 'void_nebula', '계단식 왕좌 단상(L1→L2) · 서쪽 귀환 포탈'],
    ]],
  ];

  function buildCatalog() {
    const root = $('#catalog'); if (!root) return;
    root.innerHTML = CATALOG.map(([act, maps]) => `
      <div class="cat-act">${act}</div>
      <div class="cat-grid">${maps.map(([id, name, type, tileset, note]) => `
        <div class="cat-card" data-id="${id}" data-name="${name}" data-tileset="${tileset}">
          <div class="cat-head"><span class="cat-name">${name}</span><span class="cat-type">${type}</span></div>
          <div class="cat-id">${id} · <span class="cat-ts">${tileset}</span> · <span style="color:var(--c-gold-deep)">클릭 = 프리뷰</span></div>
          <div class="cat-note">${note}</div>
          <div class="cat-prev" style="display:none">
            <div class="stage-frame" style="width:100%"><canvas style="width:100%;image-rendering:pixelated"></canvas></div>
            <button class="btn" data-catload style="margin-top:8px">에디터로 불러오기 →</button>
          </div>
        </div>`).join('')}</div>`).join('');
    root.addEventListener('click', async (e) => {
      const loadBtn = e.target.closest('[data-catload]');
      const card = e.target.closest('.cat-card'); if (!card) return;
      const id = card.dataset.id;
      if (loadBtn) {
        const s = await loadCatMap(id, card); if (!s) return;
        st = JSON.parse(JSON.stringify(s)); save();
        $('#mapId').value = id; $('#mapName').value = card.dataset.name; $('#mapTileset').value = card.dataset.tileset;
        $('#mapW').value = st.w; $('#mapH').value = st.h;
        window.scrollTo({ top: $('#toolbar').getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        return;
      }
      await toggleCatPreview(card);
    });
  }

  /* --- 카탈로그 프리뷰: maps-export/ 모듈을 동적 import해 렌더 --- */
  const catCache = {}, catOpen = new Set();
  function stateFromModule(m) {
    return { w: m.w, h: m.h, ground: m.ground.slice(), wall: (m.collision || []).slice(), elev: m.elev.slice(),
      stairs: (m.stairs || []).map(p => ({ ...p })), portals: (m.portals || []).map(p => ({ ...p })),
      props: (m.props || []).map(p => ({ ...p })), spawn: { ...m.spawn } };
  }
  async function loadCatMap(id, card) {
    if (catCache[id]) return catCache[id];
    try {
      const txt = await (await fetch('maps-export/' + id + '.js')).text();
      if (!txt.includes('export default')) throw new Error('not a map module');
      const mod = new Function(txt.replace('export default', 'return'))();
      catCache[id] = stateFromModule(mod); catCache[id]._ts = card.dataset.tileset; return catCache[id];
    }
    catch (err) { const box = card.querySelector('.cat-prev');
      box.style.display = 'block'; box.innerHTML = '<div class="cat-note" style="color:var(--c-danger)">maps-export/' + id + '.js 로드 실패 — 파일이 프로젝트에 있는지 확인</div>'; return null; }
  }
  async function toggleCatPreview(card) {
    const id = card.dataset.id, box = card.querySelector('.cat-prev'); if (!box) return;
    if (box.style.display === 'block') { box.style.display = 'none'; catOpen.delete(id); return; }
    const s = await loadCatMap(id, card); if (!s) return;
    box.style.display = 'block'; catOpen.add(id);
    const cv = box.querySelector('canvas'); if (cv) { const t = Math.max(4, Math.min(12, Math.floor(600 / s.w))); renderTo(s, cv, t, Math.round(t / 2), false, palFor(s._ts)); }
  }
  function renderCatPreviews() {
    catOpen.forEach(id => { const cv = document.querySelector('.cat-card[data-id="' + id + '"] .cat-prev canvas');
      const s = catCache[id]; if (cv && s) { const t = Math.max(4, Math.min(12, Math.floor(600 / s.w))); renderTo(s, cv, t, Math.round(t / 2), false, palFor(s._ts)); } });
  }

  /* ===== 맵 디자이너 ===== */
  const GROUND_COLORS = { // 시맨틱 id → 기본 프리뷰 색
    0: ['#3d4a2e', '#354026'],
    1: ['#6a5a38', '#5f5030'],
    2: ['#33344a', '#2c2d40'],
    3: null, 4: null,
  };
  // 타일셋별 팔레트 — 맵마다 톤이 달라지도록
  const BIOME_PAL = {
    town: { 0: ['#3d4a2e', '#354026'], 1: ['#6a5a38', '#5f5030'], 2: ['#8a8ca8', '#7a7c98'], w: ['#4a3a28', '#6a5638', '#2e2418'] },
    meadow: { 0: ['#41522f', '#384627'], 1: ['#6a5a38', '#5f5030'], 2: ['#8a8ca8', '#7a7c98'], w: ['#3a4430', '#54644a', '#242e1e'] },
    forest: { 0: ['#2c3a22', '#26321c'], 1: ['#54462c', '#493d26'], 2: ['#3a4652', '#323e48'], w: ['#243020', '#3a5230', '#161f12'] },
    dungeon_stone: { 0: ['#2e2f44', '#28293c'], 1: ['#4a4c66', '#42445c'], 2: ['#3a3b54', '#323348'], w: ['#20213a', '#3a3c5e', '#12131f'] },
    crypt_a2: { 0: ['#2a2438', '#241f30'], 1: ['#463c54', '#3e3549'], 2: ['#362e46', '#2f283c'], w: ['#1e1830', '#3a2e52', '#100c1c'] },
    frost_ice: { 0: ['#c8dcea', '#b8cfe0'], 1: ['#9ab6cc', '#8aa8c0'], 2: ['#dceaf4', '#cfe0ee'], w: ['#8098b2', '#b0c8dc', '#5a7290'] },
    swamp: { 0: ['#3a4a2a', '#324020'], 1: ['#5a4a30', '#4f4028'], 2: ['#4a5a38', '#40502e'], w: ['#2c3a20', '#465a34', '#1a2412'] },
    empire_marble: { 0: ['#4a5a38', '#405030'], 1: ['#9a96a8', '#8c889a'], 2: ['#b4b0c0', '#a5a1b3'], w: ['#6a6678', '#8e8a9e', '#454152'] },
    lava: { 0: ['#3a2626', '#301f1f'], 1: ['#5a3a2a', '#4e3224'], 2: ['#4a3230', '#3e2a28'], w: ['#2c1a18', '#4e2e28', '#180e0c'] },
    void: { 0: ['#241a3a', '#1e1530'], 1: ['#3a2a5a', '#32244e'], 2: ['#2e2248', '#281d3e'], w: ['#1a1230', '#342456', '#0e0820'] },
    void_nebula: { 0: ['#241a3a', '#1e1530'], 1: ['#3a2a5a', '#32244e'], 2: ['#2e2248', '#281d3e'], w: ['#1a1230', '#342456', '#0e0820'] },
  };
  const palFor = (ts) => BIOME_PAL[ts] || null;
  const PROP_KINDS = new Set(['door', 'brazier', 'rune', 'grave', 'tree', 'rock', 'barrel', 'statue', 'bones', 'mushroom', 'crystal', 'bush']);
  const TOOLS = [
    ['g0', '잔디', 'ground', 0], ['g1', '길', 'ground', 1], ['g2', '석재 바닥', 'ground', 2],
    ['g3', '물 🌊', 'ground', 3], ['g4', '용암 🔥', 'ground', 4],
    ['wall', '벽', 'wall'], ['elev', '고도 ±', 'elev'], ['stair', '계단', 'stair'],
    ['portal', '포탈', 'portal'], ['spawn', '스폰', 'spawn'],
    ['door', '돌문', 'prop'], ['brazier', '화로', 'prop'], ['rune', '룬', 'prop'],
    ['grave', '묘비', 'prop'], ['tree', '나무', 'prop'], ['rock', '바위', 'prop'], ['barrel', '나무통', 'prop'],
    ['statue', '석상', 'prop'], ['bones', '유골', 'prop'], ['mushroom', '버섯', 'prop'], ['crystal', '수정', 'prop'], ['bush', '덤불', 'prop'],
    ['erase', '지우개', 'erase'],
  ];

  let MW = 16, MH = 13;
  let st = load() || fresh(MW, MH);
  let tool = 'g1';
  let T = 0, painting = false;
  // 대형 맵 대응: 타일 크기를 맵 폭에 맞춰 자동 조정 (최대 128폭)
  const tileFor = (w) => Math.max(7, Math.min(24, Math.floor(1400 / w)));

  function fresh(w, h) {
    const n = w * h;
    const wall = new Array(n).fill(0);
    for (let x = 0; x < w; x++) { wall[x] = 1; wall[(h - 1) * w + x] = 1; }
    for (let y = 0; y < h; y++) { wall[y * w] = 1; wall[y * w + w - 1] = 1; }
    return { w, h, ground: new Array(n).fill(0), wall, elev: new Array(n).fill(0),
      stairs: [], portals: [], props: [], spawn: { x: (w / 2) | 0, y: h - 2 } };
  }
  function save() { localStorage.setItem('dc_mapmaker', JSON.stringify(st)); }
  function load() { try { return JSON.parse(localStorage.getItem('dc_mapmaker')); } catch (e) { return null; } }

  function applyTool(x, y) {
    if (x < 0 || y < 0 || x >= st.w || y >= st.h) return;
    const k = y * st.w + x;
    const delStair = () => { st.stairs = st.stairs.filter(s => !(s.x === x && s.y === y)); };
    const delPortal = () => { st.portals = st.portals.filter(p => !(p.x === x && p.y === y)); };
    const delProp = () => { st.props = (st.props || []).filter(p => !(p.x === x && p.y === y)); };
    if (tool.startsWith('g')) { st.ground[k] = +tool.slice(1); st.wall[k] = 0; }
    else if (tool === 'wall') { st.wall[k] = 1; delStair(); delPortal(); delProp(); }
    else if (PROP_KINDS.has(tool)) { st.wall[k] = 0; delProp(); (st.props = st.props || []).push({ x, y, kind: tool }); }
    else if (tool === 'elev') { st.elev[k] = (st.elev[k] + 1) % 3; }
    else if (tool === 'stair') { st.wall[k] = 0; delStair(); st.stairs.push({ x, y }); }
    else if (tool === 'portal') { st.wall[k] = 0; delPortal(); st.portals.push({ x, y, to: 'wild', tx: 1, ty: 1 }); }
    else if (tool === 'spawn') { st.wall[k] = 0; st.spawn = { x, y }; }
    else if (tool === 'erase') { st.wall[k] = 0; st.elev[k] = 0; st.ground[k] = 0; delStair(); delPortal(); delProp(); }
    save();
  }

  /* --- 프리뷰 렌더 (파라미터화 — 메인 캔버스 + 샘플 썸네일 공용) --- */
  function render() { const t = tileFor(st.w); renderTo(st, $('#mapCanvas'), t, Math.round(t / 2), t >= 10, palFor($('#mapTileset').value)); }
  function renderTo(S, c, tile, es, grid, pal) {
    if (!c) return;
    const g = c.getContext('2d');
    const oy = 2 * es + 4;
    c.width = S.w * tile; c.height = S.h * tile + oy + 4;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a0b16'; g.fillRect(0, 0, c.width, c.height);
    const elevAt = (x, y) => (x < 0 || y < 0 || x >= S.w || y >= S.h) ? null : S.elev[y * S.w + x];
    const isStair = (x, y) => S.stairs.some(s => s.x === x && s.y === y);
    const pcol = (gid) => (pal && pal[gid]) || GROUND_COLORS[gid] || GROUND_COLORS[0];
    const liq = (nx, ny) => nx >= 0 && ny >= 0 && nx < S.w && ny < S.h && (S.ground[ny * S.w + nx] === 3 || S.ground[ny * S.w + nx] === 4);
    let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    // 바닥
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
      const k = y * S.w + x, e = S.elev[k];
      const ty = oy + y * tile - e * es, sx = x * tile;
      const gid = S.ground[k];
      if (gid === 3 || gid === 4) { drawLiquid(g, sx, ty, x, y, gid, tile); }
      else { const pal2 = pcol(gid);
        g.fillStyle = ((x + y) % 2 === 0) ? pal2[0] : pal2[1]; g.fillRect(sx, ty, tile, tile);
        for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(sx + (rnd() * (tile - 4) | 0), ty + (rnd() * (tile - 4) | 0), 2, 2); }
        // 자동 다리: 물/용암 사이의 길 타일은 널판으로
        if (!S.wall[k] && (gid === 1 || gid === 2) && ((liq(x - 1, y) && liq(x + 1, y)) || (liq(x, y - 1) && liq(x, y + 1)))) {
          g.fillStyle = '#6a5238'; g.fillRect(sx, ty + 1, tile, tile - 2);
          for (let py2 = ty + 3; py2 < ty + tile - 2; py2 += 4) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(sx, py2, tile, 1); }
          g.fillStyle = '#8a7048'; g.fillRect(sx, ty, tile, 2); g.fillRect(sx, ty + tile - 2, tile, 2);
        } }
      // 벽 — 물/용암 타일은 제외 (통행불가는 collision 시맨틱, 시각은 액체 유지)
      if (S.wall[k] && gid !== 3 && gid !== 4) {
        const wp = (pal && pal.w) || ['#1c1d2e', '#2e3048', '#0e0f1c'];
        g.fillStyle = wp[0]; g.fillRect(sx, ty, tile, tile);
        g.fillStyle = wp[1]; g.fillRect(sx + 1, ty + 1, tile - 2, tile / 2 - 1);
        g.fillStyle = wp[2]; g.fillRect(sx, ty + tile - 3, tile, 3); }
    }
    // 절벽 (남면만 — 프리뷰 간이)
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
      const k = y * S.w + x, e = S.elev[k];
      if (e <= 0 || S.wall[k] || isStair(x, y)) continue;
      const eS = elevAt(x, y + 1) ?? e;
      if (eS < e) { const sx = x * tile, ct = oy + y * tile - e * es + tile, ch = (e - eS) * es;
        g.fillStyle = '#232434'; g.fillRect(sx, ct, tile, ch);
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(sx, ct + ch, tile, es * 0.6);
        g.fillStyle = 'rgba(138,140,176,.5)'; g.fillRect(sx, ct - 2, tile, 2); }
    }
    // 계단 (석조 B안)
    for (const s of S.stairs) {
      const e = S.elev[s.y * S.w + s.x] || 1;
      const x0 = s.x * tile, y0 = oy + s.y * tile - e * es, hgt = tile + e * es;
      const steps = 5, sh = hgt / steps;
      for (let i = 0; i < steps; i++) { const yy = y0 + i * sh;
        g.fillStyle = '#4a4c6a'; g.fillRect(x0 + 2, yy, tile - 4, sh * 0.55);
        g.fillStyle = '#232434'; g.fillRect(x0 + 2, yy + sh * 0.55, tile - 4, sh * 0.5);
        g.fillStyle = 'rgba(138,140,176,.7)'; g.fillRect(x0 + 2, yy, tile - 4, 1); }
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.strokeRect(x0 + .5, y0 + .5, tile - 1, hgt - 1);
      g.fillStyle = '#ffd766'; g.fillRect(x0 + 2, y0 + hgt - 3, 3, 2); g.fillRect(x0 + tile - 5, y0 + hgt - 3, 3, 2);
    }
    // 프롭: 돌문 · 화로 · 룬
    (S.props || []).forEach(p => {
      const px = p.x * tile, py = oy + p.y * tile - (S.elev[p.y * S.w + p.x] || 0) * es;
      if (p.kind === 'door') {
        g.fillStyle = '#14151f'; g.fillRect(px + 2, py + 1, tile - 4, tile - 1);
        g.fillStyle = '#3a3c52'; g.fillRect(px + 3, py + 3, tile - 6, tile - 3);
        g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(px + tile / 2, py + 3, 1, tile - 3);
        g.strokeStyle = '#5a5c7a'; g.lineWidth = 1; g.strokeRect(px + 2.5, py + 1.5, tile - 5, tile - 2);
        g.fillStyle = '#ffd766'; g.fillRect(px + tile / 2 - 1, py + tile * 0.55, 3, 3);
      } else if (p.kind === 'brazier') {
        const f = Math.abs(Math.sin(T * 5 + p.x * 3 + p.y)) * tile * 0.18;
        g.fillStyle = '#4a3a26'; g.fillRect(px + tile / 2 - 3, py + tile - 5, 6, 4);
        g.fillStyle = '#e25563'; g.fillRect(px + tile / 2 - 2.5, py + tile - 9 - f, 5, 4 + f);
        g.fillStyle = '#f0c44c'; g.fillRect(px + tile / 2 - 1.5, py + tile - 8 - f, 3, 3 + f);
        g.fillStyle = '#fff0b8'; g.fillRect(px + tile / 2 - 0.5, py + tile - 7 - f * 0.6, 1, 2);
      } else if (p.kind === 'rune') {
        const pu = 0.45 + Math.abs(Math.sin(T * 2.5 + p.x + p.y)) * 0.5;
        g.fillStyle = `rgba(127,222,208,${pu})`; g.fillRect(px + tile / 2 - 2, py + tile / 2 - 2, 4, 4);
        g.strokeStyle = `rgba(180,131,240,${pu * 0.8})`; g.lineWidth = 1;
        g.strokeRect(px + tile / 2 - 4.5, py + tile / 2 - 4.5, 9, 9);
      } else if (p.kind === 'grave') {
        g.fillStyle = '#8a8ca8'; g.fillRect(px + tile / 2 - 3, py + tile * 0.3, 6, tile * 0.55);
        g.fillRect(px + tile / 2 - 2, py + tile * 0.2, 4, 3);
        g.fillStyle = '#5a5c7a'; g.fillRect(px + tile / 2 - 3, py + tile * 0.72, 6, tile * 0.13);
        g.fillStyle = '#3a3c52'; g.fillRect(px + tile / 2 - 0.5, py + tile * 0.38, 1, tile * 0.3);
        g.fillRect(px + tile / 2 - 2, py + tile * 0.46, 4, 1);
      } else if (p.kind === 'tree') {
        g.fillStyle = '#4a3a26'; g.fillRect(px + tile / 2 - 1.5, py + tile * 0.55, 3, tile * 0.4);
        g.fillStyle = '#26381e'; g.fillRect(px + tile / 2 - 5, py + tile * 0.28, 10, tile * 0.36);
        g.fillStyle = '#375426'; g.fillRect(px + tile / 2 - 3.5, py + tile * 0.1, 7, tile * 0.32);
        g.fillStyle = '#4a6a34'; g.fillRect(px + tile / 2 - 1.5, py + tile * 0.12, 3, 2);
      } else if (p.kind === 'rock') {
        g.fillStyle = '#5a5c72'; g.fillRect(px + tile * 0.2, py + tile * 0.45, tile * 0.6, tile * 0.4);
        g.fillStyle = '#73758e'; g.fillRect(px + tile * 0.32, py + tile * 0.3, tile * 0.38, tile * 0.3);
        g.fillStyle = '#3a3c52'; g.fillRect(px + tile * 0.2, py + tile * 0.78, tile * 0.6, tile * 0.08);
      } else if (p.kind === 'barrel') {
        g.fillStyle = '#6a4a2c'; g.fillRect(px + tile * 0.28, py + tile * 0.25, tile * 0.44, tile * 0.6);
        g.fillStyle = '#4a3420'; g.fillRect(px + tile * 0.28, py + tile * 0.38, tile * 0.44, 1.5);
        g.fillRect(px + tile * 0.28, py + tile * 0.62, tile * 0.44, 1.5);
        g.fillStyle = '#8a6038'; g.fillRect(px + tile * 0.34, py + tile * 0.28, tile * 0.12, tile * 0.52);
      } else if (p.kind === 'statue') {
        g.fillStyle = '#8a8ca8'; g.fillRect(px + tile * 0.3, py + tile * 0.72, tile * 0.4, tile * 0.16);
        g.fillStyle = '#a5a7c0'; g.fillRect(px + tile / 2 - 2, py + tile * 0.32, 4, tile * 0.42);
        g.fillRect(px + tile / 2 - 2.5, py + tile * 0.18, 5, 4);
        g.fillStyle = '#5a5c7a'; g.fillRect(px + tile / 2 + 1, py + tile * 0.34, 1, tile * 0.36);
      } else if (p.kind === 'bones') {
        g.fillStyle = '#e8e4d0'; g.fillRect(px + tile * 0.3, py + tile * 0.5, 4, 4);
        g.fillStyle = '#14151f'; g.fillRect(px + tile * 0.3 + 1, py + tile * 0.5 + 1.5, 1, 1); g.fillRect(px + tile * 0.3 + 2.5, py + tile * 0.5 + 1.5, 1, 1);
        g.fillStyle = '#cfcab4'; g.fillRect(px + tile * 0.55, py + tile * 0.6, tile * 0.3, 1.5);
        g.fillRect(px + tile * 0.6, py + tile * 0.72, tile * 0.25, 1.5);
      } else if (p.kind === 'mushroom') {
        g.fillStyle = '#d8d4c0'; g.fillRect(px + tile / 2 - 1, py + tile * 0.55, 2, tile * 0.25);
        g.fillStyle = '#b0483a'; g.fillRect(px + tile / 2 - 3.5, py + tile * 0.4, 7, tile * 0.2);
        g.fillStyle = '#e8e4d0'; g.fillRect(px + tile / 2 - 1.5, py + tile * 0.43, 1.5, 1.5); g.fillRect(px + tile / 2 + 1, py + tile * 0.46, 1.5, 1.5);
      } else if (p.kind === 'crystal') {
        const pu = 0.5 + Math.abs(Math.sin(T * 3 + p.x * 2 + p.y)) * 0.5;
        g.fillStyle = `rgba(127,222,208,${pu})`;
        g.beginPath(); g.moveTo(px + tile / 2, py + tile * 0.2); g.lineTo(px + tile / 2 + 3, py + tile * 0.55); g.lineTo(px + tile / 2, py + tile * 0.85); g.lineTo(px + tile / 2 - 3, py + tile * 0.55); g.closePath(); g.fill();
        g.fillStyle = `rgba(230,250,246,${pu})`; g.fillRect(px + tile / 2 - 0.5, py + tile * 0.3, 1, tile * 0.2);
      } else if (p.kind === 'bush') {
        g.fillStyle = '#2c4a22'; g.fillRect(px + tile * 0.2, py + tile * 0.45, tile * 0.6, tile * 0.4);
        g.fillStyle = '#3a5e2c'; g.fillRect(px + tile * 0.3, py + tile * 0.32, tile * 0.4, tile * 0.3);
        g.fillStyle = '#4a6a34'; g.fillRect(px + tile * 0.42, py + tile * 0.36, 2, 2);
      }
    });
    // 포탈 + 스폰
    for (const p of S.portals) { const px = p.x * tile + tile / 2, py = oy + p.y * tile - (S.elev[p.y * S.w + p.x] || 0) * es + tile / 2;
      g.strokeStyle = '#7fded0'; g.lineWidth = 2; g.beginPath(); g.ellipse(px, py + 4, tile * .37, tile * .17, 0, 0, 7); g.stroke();
      for (let i = 0; i < 8; i++) { const a = i * 0.8 + T * 2, r = 2 + i * 0.5; g.fillStyle = i % 2 ? '#7fded0' : '#b483f0';
        g.fillRect(px + Math.cos(a) * r - 1, py + 2 - i * 1.4, 2, 2); } }
    { const p = S.spawn; const px = p.x * tile, py = oy + p.y * tile - (S.elev[p.y * S.w + p.x] || 0) * es;
      g.strokeStyle = '#ffd766'; g.lineWidth = 2; g.strokeRect(px + 3, py + 3, tile - 6, tile - 6);
      g.fillStyle = '#ffd766'; g.font = '10px monospace'; g.fillText('S', px + tile / 2 - 3, py + tile / 2 + 3); }
    // 그리드 라인 (메인만)
    if (grid) { g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
      for (let x = 0; x <= S.w; x++) { g.beginPath(); g.moveTo(x * tile + .5, oy); g.lineTo(x * tile + .5, oy + S.h * tile); g.stroke(); }
      for (let y = 0; y <= S.h; y++) { g.beginPath(); g.moveTo(0, oy + y * tile + .5); g.lineTo(S.w * tile, oy + y * tile + .5); g.stroke(); } }
  }

  function drawLiquid(g, sx, ty, x, y, gid, tile) {
    tile = tile || TILE;
    if (gid === 3) {
      g.fillStyle = '#274a78'; g.fillRect(sx, ty, tile, tile);
      const ph = (x * 13 + y * 29) % 100 / 100;
      for (let i = 0; i < 2; i++) { const wy = ty + ((i * (tile * .42) + Math.sin(T * 1.4 + ph * 6.28 + i) * 3 + tile * .25) | 0);
        g.fillStyle = 'rgba(90,140,200,.5)'; g.fillRect(sx + 2, wy, tile - 4, 2); }
      if (((x * 7 + y * 3 + (T * 2 | 0)) % 9) === 0) { g.fillStyle = '#dceaf8'; g.fillRect(sx + ((x * 17) % (tile - 6)) + 3, ty + ((y * 23) % (tile - 6)) + 3, 2, 2); }
    } else {
      const pulse = 0.45 + Math.sin(T * 2 + x + y) * 0.18;
      g.fillStyle = '#d84a20'; g.fillRect(sx, ty, tile, tile);
      g.fillStyle = `rgba(255,180,80,${pulse})`; g.fillRect(sx + 3, ty + 4, tile * .37, tile * .2); g.fillRect(sx + tile * .5, ty + tile * .58, tile * .37, tile * .17);
      g.fillStyle = '#3a1a14'; g.fillRect(sx + ((x * 11) % (tile * .5)), ty + ((y * 17) % (tile * .58)), tile * .3, tile * .17);
    }
  }

  /* --- 내보내기: 게임 형식 JS 모듈 --- */
  function fmtGrid(arr, w) {
    const rows = [];
    for (let y = 0; y < arr.length / w; y++) rows.push('  ' + arr.slice(y * w, (y + 1) * w).join(', ') + ',');
    return rows.join('\n');
  }
  function exportJs() {
    const id = ($('#mapId').value || 'custom_map').trim();
    const name = ($('#mapName').value || '새 맵').trim();
    const tileset = $('#mapTileset').value;
    const hasLava = st.ground.includes(4);
    return `// ${name} — 맵 디자이너 내보내기 (${new Date().toISOString().slice(0, 10)})
// ground 시맨틱: 0=잔디 1=길 2=바닥 3=물${hasLava ? ' 4=용암(신규 — fieldScene 타일 변환에 케이스 추가 필요)' : ''}
const W = ${st.w}, H = ${st.h};
const ground = [
${fmtGrid(st.ground, st.w)}
];
const collision = [
${fmtGrid(st.wall, st.w)}
];
const elev = [
${fmtGrid(st.elev, st.w)}
];
const stairs = ${JSON.stringify(st.stairs)};

export default {
  id: '${id}',
  name: '${name}',
  w: W, h: H,
  tileset: '${tileset}',
  ground, collision, elev, stairs,
  props: ${JSON.stringify(st.props || [])},
  spawn: ${JSON.stringify(st.spawn)},
  objects: [
    // { x, y, kind: 'npc'|'prop'|'sign'|'chest'|'boss'|'trigger', ... }
  ],
  portals: [
${st.portals.map(p => `    { x: ${p.x}, y: ${p.y}, to: '${p.to}', tx: ${p.tx}, ty: ${p.ty} },`).join('\n') || '    // { x, y, to: \'맵id\', tx, ty },'}
  ],
  encounters: null, // { pool: ['goblin', ...], rate: 0.12 }
};
`;
  }

  /* ===== 샘플 맵 프리셋 — 클래식 2D 탑다운 패턴 참조 ===== */
  function gRect(grid, w, x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < w) grid[y * w + x] = v; }

  function buildLakeTown() { // 허브-스포크 + 호수 부두 (젤다 카카리코 / DQ 마을 문법)
    const s = fresh(20, 14), w = 20;
    gRect(s.ground, w, 1, 1, 18, 12, 0);
    // 호수 (우하단, 부두가 뻗음)
    gRect(s.ground, w, 13, 8, 18, 12, 3);
    gRect(s.ground, w, 14, 9, 15, 10, 3);
    gRect(s.ground, w, 15, 9, 15, 11, 1); // 나무 부두
    // 길: 세로 스파인 + 광장
    gRect(s.ground, w, 9, 1, 10, 12, 1);
    gRect(s.ground, w, 6, 5, 13, 8, 1);
    gRect(s.ground, w, 2, 6, 6, 6, 1); gRect(s.ground, w, 13, 6, 17, 6, 1); // 스포크
    // 집 (벽 블록)
    gRect(s.wall, w, 3, 2, 4, 3, 1); gRect(s.wall, w, 15, 2, 16, 3, 1); gRect(s.wall, w, 3, 9, 4, 10, 1);
    // 북측 테라스 (L1) + 계단 2
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 18; x++) if (!s.wall[y * w + x]) s.elev[y * w + x] = 1;
    s.stairs = [{ x: 9, y: 3 }, { x: 10, y: 3 }];
    s.spawn = { x: 9, y: 11 };
    s.portals = [{ x: 9, y: 13 - 0, to: 'wild', tx: 1, ty: 1 }];
    s.portals = [{ x: 9, y: 12, to: 'wild', tx: 1, ty: 1 }];
    return { id: 'lake_town', name: '호숫가 마을', tileset: 'town', note: '허브-스포크 광장 + 호수·부두. 북측 상가 테라스(L1)는 중앙 계단으로만.', ref: '젤다 마을 / DQ 성읍 문법', state: s };
  }

  function buildWaterway() { // 링 회랑 수로 던전 (젤다 물 던전 문법)
    const s = fresh(20, 14), w = 20;
    gRect(s.ground, w, 1, 1, 18, 12, 2);
    // 수로 링 (해자) — 다리 3곳만 통과
    gRect(s.ground, w, 4, 3, 15, 3, 3); gRect(s.ground, w, 4, 10, 15, 10, 3);
    gRect(s.ground, w, 4, 3, 4, 10, 3); gRect(s.ground, w, 15, 3, 15, 10, 3);
    // 물은 못 건넘 → 벽 처리 후 다리 3곳 개방
    [[9, 3], [4, 7], [15, 6]].forEach(() => {});
    for (let y = 0; y < 14; y++) for (let x = 0; x < w; x++) if (s.ground[y * w + x] === 3) s.wall[y * w + x] = 1;
    [[9, 3], [10, 3], [4, 7], [15, 6], [9, 10]].forEach(([x, y]) => { s.wall[y * w + x] = 0; s.ground[y * w + x] = 1; });
    // 중앙 금고 방 (안쪽 섬) + 보스 단상
    gRect(s.ground, w, 8, 6, 11, 8, 2);
    s.elev[6 * w + 9] = 1; s.elev[6 * w + 10] = 1;
    s.stairs = [{ x: 9, y: 6 }];
    s.spawn = { x: 2, y: 12 };
    s.portals = [{ x: 18, y: 1, to: 'dungeon', tx: 1, ty: 8 }];
    return { id: 'waterway', name: '지하 수로', tileset: 'dungeon_stone', note: '링 해자 + 다리 3곳 단일 동선 강제. 중앙 섬에 단상(L1).', ref: '젤다 물 던전 링 회랑', state: s };
  }

  function buildLavaKeep() { // 용암 해자 + 외길 코즈웨이 + 왕좌 어센트 (DQ 마왕성 문법)
    const s = fresh(20, 14), w = 20;
    gRect(s.ground, w, 1, 1, 18, 12, 2);
    // 용암 해자 링
    gRect(s.ground, w, 3, 2, 16, 2, 4); gRect(s.ground, w, 3, 9, 16, 9, 4);
    gRect(s.ground, w, 3, 2, 3, 9, 4); gRect(s.ground, w, 16, 2, 16, 9, 4);
    for (let y = 0; y < 14; y++) for (let x = 0; x < w; x++) if (s.ground[y * w + x] === 4) s.wall[y * w + x] = 1;
    // 남측 외길 코즈웨이 하나만
    s.wall[9 * w + 9] = 0; s.ground[9 * w + 9] = 1; s.wall[9 * w + 10] = 0; s.ground[9 * w + 10] = 1;
    // 내부 성채: L1 전체 + 왕좌 L2
    for (let y = 3; y <= 8; y++) for (let x = 4; x <= 15; x++) if (!s.wall[y * w + x]) s.elev[y * w + x] = 1;
    gRect(s.ground, w, 8, 4, 11, 5, 2);
    for (let y = 4; y <= 5; y++) for (let x = 8; x <= 11; x++) s.elev[y * w + x] = 2;
    s.stairs = [{ x: 9, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 5 }];
    s.spawn = { x: 9, y: 12 };
    s.portals = [{ x: 10, y: 12, to: 'lava_gate', tx: 1, ty: 8 }];
    return { id: 'lava_keep', name: '용암 요새', tileset: 'lava', note: '용암 해자 + 남측 외길 코즈웨이 → L1 성채 → L2 왕좌 3단 어센트.', ref: 'DQ 마왕성 해자 문법', state: s };
  }

  function buildSwitchback() { // 스위치백 협곡 등반 (탑다운 설산 등반 문법)
    const s = fresh(20, 14), w = 20;
    gRect(s.ground, w, 1, 1, 18, 12, 0);
    // 3단 밴드: 아래(L0) → 중단(L1) → 상단(L2)
    for (let y = 1; y <= 4; y++) for (let x = 1; x <= 18; x++) s.elev[y * w + x] = 2;
    for (let y = 5; y <= 8; y++) for (let x = 1; x <= 18; x++) s.elev[y * w + x] = 1;
    // 지그재그 계단 (좌 → 우 → 좌)
    s.stairs = [{ x: 16, y: 8 }, { x: 3, y: 4 }];
    // 하단 연못 + 상단 석재 제단
    gRect(s.ground, w, 2, 10, 5, 12, 3);
    for (let y = 10; y <= 12; y++) for (let x = 2; x <= 5; x++) s.wall[y * w + x] = 1;
    gRect(s.ground, w, 8, 1, 11, 2, 2);
    s.spawn = { x: 9, y: 11 };
    s.portals = [{ x: 9, y: 1, to: 'frost', tx: 1, ty: 10 }];
    return { id: 'switchback', name: '협곡 스위치백', tileset: 'frost_ice', note: '3단 고도 밴드를 지그재그 계단으로 등반 — 좌우 왕복 동선이 맵을 길게 쓴다.', ref: '탑다운 설산 등반 문법', state: s };
  }

  /* --- 프리셋 프롭 산포 (maps-export와 동일 규칙: 길·계단·포탈·액체변 회피) --- */
  const PRESET_KITS = {
    lake_town: { kinds: ['tree', 'bush', 'barrel', 'tree'], n: 10, g: [0] },
    waterway: { kinds: ['statue', 'bones', 'barrel'], n: 8, g: [2] },
    lava_keep: { kinds: ['rock', 'bones', 'statue'], n: 8, g: [2] },
    switchback: { kinds: ['rock', 'tree', 'crystal', 'rock'], n: 10, g: [0] },
    overworld: { kinds: ['tree', 'rock', 'bush', 'tree', 'mushroom'], n: 30, g: [0] },
    grand_citadel: { kinds: ['statue', 'barrel', 'bones', 'statue'], n: 16, g: [2] },
    port_city: { kinds: ['barrel', 'barrel', 'statue', 'bush', 'rock'], n: 16, g: [0, 2] },
  };
  function scatterProps(p) {
    const kit = PRESET_KITS[p.id]; if (!kit) return p;
    const s = p.state, w = s.w;
    let seed = 0; for (const c of p.id) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed < 0 ? -seed : seed) / 2147483647; };
    const taken = new Set();
    const mark = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) taken.add((x + dx) + ',' + (y + dy)); };
    (s.props = s.props || []).forEach(q => mark(q.x, q.y, 1));
    s.stairs.forEach(q => mark(q.x, q.y, 1)); s.portals.forEach(q => mark(q.x, q.y, 2)); mark(s.spawn.x, s.spawn.y, 2);
    let tries = 0, added = 0;
    while (added < kit.n && tries < kit.n * 60) {
      tries++;
      const x = 1 + (rng() * (w - 2) | 0), y = 1 + (rng() * (s.h - 2) | 0), k = y * w + x;
      if (s.wall[k] || !kit.g.includes(s.ground[k]) || s.ground[k] === 1 || taken.has(x + ',' + y)) continue;
      const nb = [s.ground[k - 1], s.ground[k + 1], s.ground[k - w], s.ground[k + w]];
      if (nb.some(v => v === 3 || v === 4)) continue;
      s.props.push({ x, y, kind: kit.kinds[(rng() * kit.kinds.length) | 0] }); mark(x, y, 1); added++;
    }
    return p;
  }

  const PRESETS = [buildLakeTown(), buildWaterway(), buildLavaKeep(), buildSwitchback(), buildOverworld(), buildGrandCitadel(), buildPortCity()].map(scatterProps);

  /* ===== 대형 샘플 (32~64폭) — 클래식 오버월드/대형 던전 문법 ===== */
  function buildOverworld() { // 대륙 오버월드 (젤다1 하이랄 / DQ 오버월드 문법) 64×44
    const W2 = 64, H2 = 44, s = fresh(W2, H2), w = W2;
    // 전부 바다 → 대륙 융기
    gRect(s.ground, w, 0, 0, W2 - 1, H2 - 1, 3);
    for (let i = 0; i < w * H2; i++) s.wall[i] = 1;
    for (let y = 2; y < H2 - 2; y++) for (let x = 2; x < w - 2; x++) {
      const dx = (x - 32) / 28, dy = (y - 22) / 17;
      if (dx * dx + dy * dy < 0.95 + 0.14 * Math.sin(x * 0.55) + 0.12 * Math.cos(y * 0.8)) { s.ground[y * w + x] = 0; s.wall[y * w + x] = 0; }
    }
    // 북부 산악 (L1→L2 밴드)
    for (let y = 4; y <= 13; y++) for (let x = 8; x <= 56; x++) { const k = y * w + x;
      if (!s.wall[k]) s.elev[k] = y <= 8 ? 2 : 1; }
    // 강: 산에서 남해로 (다리 2곳)
    for (let y = 14; y < H2 - 3; y++) { const rx = 40 + Math.round(Math.sin(y * 0.4) * 3);
      for (let x = rx; x <= rx + 1; x++) { const k = y * w + x; if (!s.wall[k] || s.ground[k] === 3) { s.ground[k] = 3; s.wall[k] = 1; s.elev[k] = 0; } } }
    [[40, 20], [41, 20], [39, 33], [40, 33]].forEach(([x, y]) => { const k = y * w + x; s.ground[k] = 1; s.wall[k] = 0; });
    // 가도: 서부 마을 → 동부 다리 → 산악 동굴
    for (let x = 12; x <= 52; x++) { const y = 26 + Math.round(Math.sin(x * 0.25) * 2); const k = y * w + x; if (!s.wall[k]) s.ground[k] = 1; }
    // 마을 포켓(석재) + 산 동굴 입구(포탈)
    gRect(s.ground, w, 12, 24, 17, 28, 2);
    s.stairs = [{ x: 20, y: 13 }, { x: 34, y: 13 }, { x: 27, y: 8 }];
    s.spawn = { x: 14, y: 26 };
    s.portals = [{ x: 27, y: 6, to: 'dungeon', tx: 1, ty: 8 }, { x: 15, y: 25, to: 'town', tx: 9, ty: 11 }];
    return { id: 'overworld', name: '대륙 오버월드', tileset: 'meadow', note: '바다로 둘러싼 대륙 + 북부 산악 2단 + 사행 강(다리 2곳) + 가도가 마을·동굴을 잇는다.', ref: '젤다1 하이랄 / DQ 오버월드', state: s };
  }

  function buildGrandCitadel() { // 대성채 (수직 3층 홀 + 날개 방 — 대형 던전 문법) 48×36
    const W2 = 48, H2 = 36, s = fresh(W2, H2), w = W2;
    gRect(s.ground, w, 1, 1, 46, 34, 2);
    // 외곽 용암 해자 + 정문 코즈웨이
    gRect(s.ground, w, 3, 31, 44, 32, 4);
    for (let x = 3; x <= 44; x++) for (let y = 31; y <= 32; y++) s.wall[y * w + x] = 1;
    [[23, 31], [24, 31], [23, 32], [24, 32]].forEach(([x, y]) => { const k = y * w + x; s.ground[k] = 1; s.wall[k] = 0; });
    // 3단 층계: 하층(L0) → 중층(L1) → 상층 왕좌(L2)
    for (let y = 3; y <= 18; y++) for (let x = 6; x <= 41; x++) s.elev[y * w + x] = 1;
    for (let y = 3; y <= 9; y++) for (let x = 16; x <= 31; x++) s.elev[y * w + x] = 2;
    // 내부 벽: 날개 방 4개 (스위치/보물 방 문법)
    gRect(s.wall, w, 6, 12, 14, 12, 1); gRect(s.wall, w, 33, 12, 41, 12, 1);
    gRect(s.wall, w, 10, 3, 10, 9, 1); gRect(s.wall, w, 37, 3, 37, 9, 1);
    [[10, 6], [37, 6], [10, 12], [37, 12]].forEach(([x, y]) => s.wall[y * w + x] = 0);
    // 중앙 홀 물 정원 (좌우 대칭 연못)
    gRect(s.ground, w, 12, 22, 16, 25, 3); gRect(s.ground, w, 31, 22, 35, 25, 3);
    for (let y = 22; y <= 25; y++) { for (let x = 12; x <= 16; x++) s.wall[y * w + x] = 1; for (let x = 31; x <= 35; x++) s.wall[y * w + x] = 1; }
    s.stairs = [{ x: 23, y: 18 }, { x: 24, y: 18 }, { x: 23, y: 9 }, { x: 24, y: 9 }];
    s.spawn = { x: 23, y: 29 };
    s.portals = [{ x: 24, y: 34, to: 'empire_city', tx: 1, ty: 1 }];
    return { id: 'grand_citadel', name: '대성채', tileset: 'empire_marble', note: '정문 코즈웨이 → 물 정원 홀(L0) → 중층 날개 방 4개(L1) → 왕좌(L2). 중앙 축 대칭 + 날개 탐색.', ref: 'DQ 성 / 젤다 성채 던전', state: s };
  }

  function buildPortCity() { // 운하 항구도시 (그리드 시가 + 운하 — 탑다운 도시 문법) 44×30
    const W2 = 44, H2 = 30, s = fresh(W2, H2), w = W2;
    gRect(s.ground, w, 1, 1, 42, 28, 0);
    // 남측 바다 + 부두 3열
    gRect(s.ground, w, 1, 23, 42, 28, 3);
    for (let y = 23; y <= 28; y++) for (let x = 1; x <= 42; x++) s.wall[y * w + x] = 1;
    [[8, 0], [21, 0], [34, 0]].forEach(([px]) => { for (let y = 23; y <= 26; y++) { const k = y * w + px; s.ground[k] = 1; s.wall[k] = 0; } });
    // 운하 (세로) + 다리 2곳
    for (let y = 2; y <= 22; y++) for (let x = 27; x <= 28; x++) { const k = y * w + x; s.ground[k] = 3; s.wall[k] = 1; }
    [[27, 8], [28, 8], [27, 17], [28, 17]].forEach(([x, y]) => { const k = y * w + x; s.ground[k] = 1; s.wall[k] = 0; });
    // 격자 시가: 가로 2 + 세로 3 도로, 블록엔 건물(벽)
    [5, 13, 21].forEach(rx => gRect(s.ground, w, rx, 2, rx, 22, 1));
    [35].forEach(rx => gRect(s.ground, w, rx, 2, rx, 22, 1));
    [8, 17].forEach(ry => gRect(s.ground, w, 2, ry, 42, ry, 1));
    [[7, 4], [15, 4], [30, 4], [37, 4], [7, 11], [15, 11], [30, 11], [37, 11], [7, 19], [15, 19], [37, 19]].forEach(([bx, by]) => gRect(s.wall, w, bx, by, bx + 3, by + 2, 1));
    // 북측 영주 저택 테라스 (L1)
    for (let y = 2; y <= 5; y++) for (let x = 30; x <= 42; x++) if (!s.wall[y * w + x]) s.elev[y * w + x] = 1;
    s.stairs = [{ x: 35, y: 5 }];
    gRect(s.ground, w, 30, 2, 42, 5, 2);
    s.spawn = { x: 21, y: 24 };
    s.portals = [{ x: 21, y: 27, to: 'wild', tx: 1, ty: 1 }];
    return { id: 'port_city', name: '운하 항구도시', tileset: 'town', note: '격자 시가 + 세로 운하(다리 2곳) + 부두 3열 + 영주 저택 테라스(L1). 도로가 구획을 만든다.', ref: '탑다운 항구도시 (크로노/스이코덴 문법)', state: s };
  }


  function buildSamples() {
    const root = $('#samples'); if (!root) return;
    root.innerHTML = PRESETS.map((p, i) => `
      <div class="cat-card">
        <div class="stage-frame" style="width:100%"><canvas class="sample-cv" data-i="${i}" style="width:100%;image-rendering:pixelated"></canvas></div>
        <div class="cat-head" style="margin-top:10px"><span class="cat-name">${p.name} <span style="font-family:var(--f-mono);font-size:13px;color:var(--c-text-mute)">${p.state.w}×${p.state.h}</span></span><span class="cat-type">${p.ref}</span></div>
        <div class="cat-note">${p.note}</div>
        <button class="btn" data-load="${i}" style="margin-top:10px">에디터로 불러오기 →</button>
      </div>`).join('');
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-load]'); if (!b) return;
      const p = PRESETS[+b.dataset.load];
      st = JSON.parse(JSON.stringify(p.state)); save();
      $('#mapId').value = p.id; $('#mapName').value = p.name; $('#mapTileset').value = p.tileset;
      $('#mapW').value = st.w; $('#mapH').value = st.h;
      window.scrollTo({ top: $('#toolbar').getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });
  }
  function renderSamples() {
    document.querySelectorAll('.sample-cv').forEach(cv => { const p = PRESETS[+cv.dataset.i];
      const t = Math.max(4, Math.min(14, Math.floor(560 / p.state.w)));
      renderTo(p.state, cv, t, Math.round(t / 2), false, palFor(p.tileset)); });
  }

  /* --- 이벤트 --- */
  function cellFromEvent(ev) {
    const c = $('#mapCanvas'); const r = c.getBoundingClientRect();
    const t = tileFor(st.w), es = Math.round(t / 2);
    const scale = c.width / r.width;
    const px = (ev.clientX - r.left) * scale, py = (ev.clientY - r.top) * scale;
    const oy = 2 * es + 4;
    return { x: (px / t) | 0, y: ((py - oy) / t) | 0 };
  }
  function wire() {
    // 툴 버튼
    const tb = $('#toolbar');
    tb.innerHTML = TOOLS.map(([id, label]) => `<button class="btn${id === tool ? ' on' : ''}" data-tool="${id}">${label}</button>`).join('');
    tb.addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (!b) return;
      tool = b.dataset.tool; tb.querySelectorAll('.btn').forEach(x => x.classList.toggle('on', x.dataset.tool === tool)); });
    // 캔버스 페인트
    const c = $('#mapCanvas');
    c.addEventListener('mousedown', (e) => { painting = true; const { x, y } = cellFromEvent(e); applyTool(x, y); });
    window.addEventListener('mouseup', () => painting = false);
    c.addEventListener('mousemove', (e) => { if (!painting) return; const { x, y } = cellFromEvent(e); applyTool(x, y); });
    // 크기 변경 / 리셋 / 내보내기
    $('#applySize').addEventListener('click', () => {
      const w = Math.max(8, Math.min(128, +$('#mapW').value || 16));
      const h = Math.max(6, Math.min(96, +$('#mapH').value || 13));
      st = fresh(w, h); save();
    });
    $('#resetMap').addEventListener('click', () => { st = fresh(st.w, st.h); save(); });
    $('#exportBtn').addEventListener('click', () => { $('#exportOut').value = exportJs(); $('#exportOut').style.display = 'block';
      $('#exportOut').select(); });
    $('#downloadBtn').addEventListener('click', () => {
      const id = ($('#mapId').value || 'custom_map').trim();
      const blob = new Blob([exportJs()], { type: 'text/javascript' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = id + '.js'; a.click();
    });
  }

  function init() {
    buildCatalog(); buildSamples(); wire();
    let last = performance.now(), frame = 0;
    (function loop(now) {
      T += Math.min(0.05, (now - last) / 1000); last = now; frame++;
      // 대형 맵은 격프레임, 샘플 썸네일은 저속 갱신
      if (st.w <= 48 || frame % 2 === 0) render();
      if (frame % 10 === 0) { renderSamples(); renderCatPreviews(); }
      requestAnimationFrame(loop);
    })(performance.now());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

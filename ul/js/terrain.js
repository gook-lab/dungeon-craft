/* ============================================================
   terrain.js — 지형지물 리디자인 미니 렌더러
   fieldScene의 엘리베이션/절벽/계단 렌더링을 캔버스로 재현하고
   계단 3변형 × 지역 재질을 라이브로 비교한다.
   ============================================================ */
(function () {
  const TILE = 32, ELEV = 16;
  const $ = (s, r) => (r || document).querySelector(s);

  /* ---- 지역(무드) 팔레트 ---- */
  const BIOMES = {
    dungeon: { name: '던전 · 크립트', floorA: '#33344a', floorB: '#2c2d40', face: '#232434', overhang: '#3d3e56', rim: '#8a8cb0', accent: '#ffd766' },
    frost: { name: '설원 · 얼음', floorA: '#c8dcea', floorB: '#b8cfe0', face: '#5a7a9a', overhang: '#e8f2fa', rim: '#ffffff', accent: '#56a8e8' },
    swamp: { name: '늪지대', floorA: '#3d4a2e', floorB: '#354026', face: '#2a3020', overhang: '#4a5a34', rim: '#9ab060', accent: '#9ad94f' },
    lava: { name: '용암 화구', floorA: '#3a2626', floorB: '#301f1f', face: '#241416', overhang: '#4a2a24', rim: '#e08050', accent: '#f0644c' },
  };
  const STAIR_NAMES = { gold: 'A · 골드 램프 (현행+)', stone: 'B · 석조 계단 (조각)', biome: 'C · 지역 재질 계단' };

  let biome = 'dungeon', variant = 'stone';

  function hx(c) { return c; }
  function shade(hex, f) { // f<0 어둡게, f>0 밝게
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = f < 0 ? 0 : 255, k = Math.abs(f);
    r = Math.round(r + (t - r) * k); g = Math.round(g + (t - g) * k); b = Math.round(b + (t - b) * k);
    return `rgb(${r},${g},${b})`;
  }

  /* ---- 데모 씬: 13×8 그리드, 고원(elev1) + 상단 단상(elev2) ---- */
  const W = 13, H = 8;
  const elevMap = []; // elev per cell
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let e = 0;
    if (y <= 3 && x >= 3 && x <= 10) e = 1;
    if (y <= 1 && x >= 6 && x <= 9) e = 2;
    elevMap[y * W + x] = e;
  }
  const STAIRS = [{ x: 6, y: 3 }, { x: 8, y: 1 }]; // elev1 진입, elev2 진입
  const elevAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : elevMap[y * W + x];
  // 물(좌하단) + 용암(우하단) 풀
  const WATER = new Set(), LAVA = new Set();
  for (let y = 5; y <= 7; y++) { for (let x = 0; x <= 2; x++) WATER.add(y * W + x); for (let x = 10; x <= 12; x++) LAVA.add(y * W + x); }
  const isLiquid = (x, y) => WATER.has(y * W + x) || LAVA.has(y * W + x);

  /* ---- 렌더 ---- */
  let T = 0;
  function render() {
    const c = $('#terrainCanvas'); const g = c.getContext('2d');
    const B = BIOMES[biome];
    const CW = W * TILE, CH = H * TILE + 2 * ELEV + 8;
    c.width = CW; c.height = CH;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a0b16'; g.fillRect(0, 0, CW, CH);
    const oy = 2 * ELEV + 4; // 상단 여유 (lifted tiles)

    // 1) 바닥 타일 (checker + 미세 노이즈)
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = elevAt(x, y);
      const ty = oy + y * TILE - e * ELEV;
      if (isLiquid(x, y)) { drawLiquid(g, x, y, ty, WATER.has(y * W + x) ? 'water' : 'lava'); continue; }
      g.fillStyle = ((x + y) % 2 === 0) ? B.floorA : B.floorB;
      g.fillRect(x * TILE, ty, TILE, TILE);
      // 노이즈 점
      for (let i = 0; i < 3; i++) { g.fillStyle = rnd() < 0.5 ? shade(B.floorA, -0.15) : shade(B.floorB, 0.08);
        g.fillRect(x * TILE + (rnd() * 28 | 0), ty + (rnd() * 28 | 0), 2, 2); }
    }

    // 2) 절벽 면 (남쪽 드롭 + 서/동/북 에지) — fieldScene 로직 재현
    const isStair = (x, y) => STAIRS.some(s => s.x === x && s.y === y);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = elevAt(x, y); if (e <= 0 || isStair(x, y)) continue;
      const sx = x * TILE, topY = oy + y * TILE - e * ELEV;
      const eS = elevAt(x, y + 1) ?? e, eW = elevAt(x - 1, y) ?? e, eE = elevAt(x + 1, y) ?? e, eN = elevAt(x, y - 1) ?? e;
      if (eS < e) {
        const ct = topY + TILE, chH = (e - eS) * ELEV;
        g.fillStyle = B.face; g.fillRect(sx, ct, TILE, chH);
        for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(sx + 4 + i * 8, ct + 1, 1, chH - 1); }
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(sx, ct + chH * 0.55, TILE, chH * 0.45);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(sx, ct + chH, TILE, ELEV);
        for (let xx = 0; xx < TILE; xx += 4) { g.fillStyle = B.overhang; g.fillRect(sx + xx, ct - 2, 4, 3 + (rnd() * 4 | 0)); }
        g.fillStyle = B.rim; g.globalAlpha = 0.5; g.fillRect(sx, ct - 3, TILE, 2); g.globalAlpha = 1;
      }
      if (eW < e) { g.fillStyle = B.face; g.globalAlpha = .5; g.fillRect(sx, topY, 5, TILE); g.globalAlpha = .7; g.fillStyle = B.rim; g.fillRect(sx, topY, 2, TILE); g.globalAlpha = 1; }
      if (eE < e) { g.fillStyle = B.face; g.globalAlpha = .6; g.fillRect(sx + TILE - 5, topY, 5, TILE); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(sx + TILE - 5, topY, 5, TILE); g.globalAlpha = 1; }
      if (eN < e) { g.fillStyle = B.face; g.globalAlpha = .45; g.fillRect(sx, topY, TILE, 4); g.globalAlpha = .85; g.fillStyle = B.rim; g.fillRect(sx, topY, TILE, 1); g.globalAlpha = 1; }
    }

    // 3) 계단 (선택 변형)
    for (const s of STAIRS) drawStair(g, s, oy, B);

    // 4) 스프라이트 배치 (스케일 감)
    const img = $('#knightSpr');
    if (img && img.complete) { const px = 5 * TILE + 2, py = oy + 5 * TILE - 30; g.drawImage(img, px, py, 28, 30); }
  }

  /* ---- 물·용암 타일 (애니메이션) ---- */
  function drawLiquid(g, x, y, ty, type) {
    const sx = x * TILE;
    const land = (nx, ny) => !isLiquid(nx, ny) && nx >= 0 && ny >= 0 && nx < W && ny < H;
    if (type === 'water') {
      // 기본 수면 2톤 + 흘러가는 물결 밴드
      g.fillStyle = '#274a78'; g.fillRect(sx, ty, TILE, TILE);
      const ph = (x * 13 + y * 29) % 100 / 100;
      for (let i = 0; i < 3; i++) {
        const wy = ty + ((i * 11 + Math.sin(T * 1.4 + ph * 6.28 + i) * 4 + 8) | 0);
        g.fillStyle = 'rgba(90,140,200,.5)'; g.fillRect(sx + 2, wy, TILE - 4, 2);
      }
      // 반짝임 (시드+시간)
      if (((x * 7 + y * 3 + (T * 2 | 0)) % 9) === 0) { g.fillStyle = '#dceaf8'; g.fillRect(sx + ((x * 17 + (T * 3 | 0) * 5) % 26) + 3, ty + ((y * 23) % 26) + 3, 2, 2); }
      // 물가 폼 (육지 접한 변에만, 숨쉬듯 오프셋)
      const foam = 'rgba(220,240,250,.8)', off = (Math.sin(T * 2.2 + ph * 6.28) * 1.5 + 1.5) | 0;
      g.fillStyle = foam;
      if (land(x, y - 1)) g.fillRect(sx, ty + off, TILE, 2);
      if (land(x, y + 1)) g.fillRect(sx, ty + TILE - 2 - off, TILE, 2);
      if (land(x - 1, y)) g.fillRect(sx + off, ty, 2, TILE);
      if (land(x + 1, y)) g.fillRect(sx + TILE - 2 - off, ty, 2, TILE);
    } else {
      // 용암: 밝은 코어 + 암반 크러스트 + 글로우 펄스 + 상승 불씨
      const pulse = 0.5 + Math.sin(T * 2 + (x + y)) * 0.18;
      g.fillStyle = '#d84a20'; g.fillRect(sx, ty, TILE, TILE);
      g.fillStyle = `rgba(255,180,80,${pulse})`;
      g.fillRect(sx + 3 + ((x * 7) % 6), ty + 4 + ((y * 5) % 6), 10, 6);
      g.fillRect(sx + 16 - ((y * 3) % 5), ty + 18 + ((x * 3) % 5), 12, 5);
      // 식은 크러스트 조각
      g.fillStyle = '#3a1a14';
      g.fillRect(sx + ((x * 11) % 18), ty + ((y * 17) % 20), 8, 5);
      g.fillRect(sx + ((x * 23 + 9) % 20), ty + ((y * 7 + 13) % 22), 6, 4);
      // 육지 경계: 어두운 크러스트 립
      g.fillStyle = '#2a1210';
      if (land(x, y - 1)) g.fillRect(sx, ty, TILE, 3);
      if (land(x, y + 1)) g.fillRect(sx, ty + TILE - 3, TILE, 3);
      if (land(x - 1, y)) g.fillRect(sx, ty, 3, TILE);
      if (land(x + 1, y)) g.fillRect(sx + TILE - 3, ty, 3, TILE);
      // 불씨 (상승)
      const ei = ((T * 1.2 + x * 0.7 + y * 0.3) % 1);
      if ((x + y) % 2 === 0) { g.fillStyle = `rgba(255,220,140,${1 - ei})`; g.fillRect(sx + ((x * 13) % 26) + 3, ty + TILE - 6 - ei * 26, 2, 2); }
    }
  }

  function drawStair(g, s, oy, B) {
    const e = elevAt(s.x, s.y);
    const lo = elevAt(s.x, s.y + 1) ?? 0; // 남쪽에서 오른다 (데모 고정)
    const hX = s.x * TILE;
    const hiY = oy + s.y * TILE - e * ELEV;
    const loY = oy + (s.y + 1) * TILE - lo * ELEV;
    const x0 = hX, x1 = hX + TILE, y0 = hiY, y1 = loY + TILE;
    const steps = 6, fullH = y1 - y0;

    if (variant === 'gold') {
      // 현행 정련: 골드 반투명 램프 + 트레드
      g.fillStyle = 'rgba(255,224,138,.22)'; g.fillRect(x0 + 2, y0 + 2, TILE - 4, fullH - 4);
      for (let i = 0; i < 5; i++) { const yy = y0 + 3 + ((i + .5) / 5) * (fullH - 6);
        g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x0 + 3, yy, TILE - 6, 2);
        g.fillStyle = 'rgba(255,224,138,.95)'; g.fillRect(x0 + 3, yy, TILE - 6, 1); }
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; g.strokeRect(x0 + 1, y0 + 1, TILE - 2, fullH - 2);
      g.strokeStyle = 'rgba(255,224,138,.95)'; g.lineWidth = 1.5; g.strokeRect(x0 + 2, y0 + 2, TILE - 4, fullH - 4);
      return;
    }

    // B/C 공용: 실제 단(step) 지오메트리 — 아래로 갈수록 넓어지는 계단
    const mat = variant === 'stone'
      ? { top: shade(B.face, 0.34), face: B.face, lip: B.rim, edge: 'rgba(0,0,0,.45)', accent: B.accent }
      : matForBiome(B);
    const stepH = fullH / steps;
    for (let i = 0; i < steps; i++) {
      const yy = y0 + i * stepH;
      const inset = 2 + (steps - 1 - i) * 0.6; // 위가 살짝 좁음
      // 발판(트레드) 윗면
      g.fillStyle = mat.top; g.fillRect(x0 + inset, yy, TILE - inset * 2, stepH * 0.55);
      // 챌면(라이저)
      g.fillStyle = mat.face; g.fillRect(x0 + inset, yy + stepH * 0.55, TILE - inset * 2, stepH * 0.5);
      // 립 하이라이트
      g.fillStyle = mat.lip; g.globalAlpha = 0.75; g.fillRect(x0 + inset, yy, TILE - inset * 2, 1.5); g.globalAlpha = 1;
      // 라이저 하단 음영
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x0 + inset, yy + stepH - 1.5, TILE - inset * 2, 1.5);
    }
    // 측벽 (양쪽 낮은 담)
    g.fillStyle = mat.face; g.fillRect(x0, y0, 3, fullH); g.fillRect(x1 - 3, y0, 3, fullH);
    g.fillStyle = mat.lip; g.globalAlpha = .6; g.fillRect(x0, y0, 3, 1.5); g.fillRect(x1 - 3, y0, 3, 1.5); g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 + 3, y0, 1, fullH); g.fillRect(x1 - 4, y0, 1, fullH);
    // 외곽 이중선 (가독 보장) + 골드 힌트 (입구 표식 축소 유지)
    g.strokeStyle = mat.edge; g.lineWidth = 2; g.strokeRect(x0 + .5, y0 + .5, TILE - 1, fullH - 1);
    g.fillStyle = mat.accent; g.globalAlpha = .9;
    g.fillRect(x0 + 2, y1 - 3, 4, 2); g.fillRect(x1 - 6, y1 - 3, 4, 2); // 입구 골드 스텃 2개
    g.globalAlpha = 1;
    if (mat.deco) mat.deco(g, x0, y0, TILE, fullH);
  }

  function matForBiome(B) {
    if (biome === 'frost') return { top: '#dceaf4', face: '#7a9ab8', lip: '#ffffff', edge: 'rgba(20,40,70,.5)', accent: B.accent,
      deco: (g, x, y, w, h) => { g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 4; i++) g.fillRect(x + 5 + (i * 7) % (w - 10), y + 4 + (i * 11) % (h - 8), 2, 2); } };
    if (biome === 'swamp') return { top: '#6a5a38', face: '#4a3e26', lip: '#9ab060', edge: 'rgba(0,0,0,.5)', accent: B.accent,
      deco: (g, x, y, w, h) => { g.fillStyle = '#3a5a2a'; for (let i = 0; i < 3; i++) g.fillRect(x + 4 + (i * 9) % (w - 8), y + 6 + (i * 13) % (h - 10), 3, 2); } };
    if (biome === 'lava') return { top: '#4a3230', face: '#241416', lip: '#e08050', edge: 'rgba(0,0,0,.55)', accent: B.accent,
      deco: (g, x, y, w, h) => { g.fillStyle = 'rgba(240,100,76,.8)'; for (let i = 0; i < 3; i++) g.fillRect(x + 5 + (i * 8) % (w - 10), y + 5 + (i * 15) % (h - 8), 2, 1); } };
    return { top: shade(BIOMES.dungeon.face, 0.34), face: BIOMES.dungeon.face, lip: BIOMES.dungeon.rim, edge: 'rgba(0,0,0,.45)', accent: BIOMES.dungeon.accent };
  }

  /* ---- 기타 지형지물: 다리 · 돌문 · 포탈 ---- */
  function drawBridge() {
    const c = $('#bridgeCanvas'); const g = c.getContext('2d');
    c.width = 224; c.height = 160; g.imageSmoothingEnabled = false;
    // 심연
    g.fillStyle = '#0a0b16'; g.fillRect(0, 0, 224, 160);
    const B = BIOMES[biome === 'lava' ? 'lava' : 'dungeon'];
    // 양쪽 지면
    g.fillStyle = B.floorA; g.fillRect(0, 0, 224, 40); g.fillRect(0, 120, 224, 40);
    g.fillStyle = B.face; g.fillRect(0, 40, 224, 8); g.fillRect(0, 112, 224, 8);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 48, 224, 12); g.fillRect(0, 104, 224, 8);
    // 심연 그라데이션 별
    for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(120,110,180,.25)'; g.fillRect((i * 37) % 224, 60 + (i * 13) % 44, 1, 1); }
    // 널판 다리 (세로) — 썩은 판자 + 로프
    const bx = 96, bw = 32;
    for (let y = 44; y < 116; y += 8) {
      const off = (y / 8) % 2 ? 1 : -1;
      g.fillStyle = y % 16 ? '#6a5238' : '#5a4530';
      g.fillRect(bx + off, y, bw - 2, 6);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(bx + off, y + 5, bw - 2, 1);
      // 부서진 판자 (한 칸 비움)
      if (y === 76) { g.fillStyle = '#0a0b16'; g.fillRect(bx + 6, y, bw - 14, 7); }
    }
    // 로프 (양측)
    g.strokeStyle = '#8a7048'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(bx - 3, 42); g.quadraticCurveTo(bx - 6, 80, bx - 3, 118); g.stroke();
    g.beginPath(); g.moveTo(bx + bw + 1, 42); g.quadraticCurveTo(bx + bw + 4, 80, bx + bw + 1, 118); g.stroke();
    // 말뚝
    g.fillStyle = '#4a3a26'; [[bx - 5, 36], [bx + bw - 1, 36], [bx - 5, 116], [bx + bw - 1, 116]].forEach(([x, y]) => g.fillRect(x, y, 5, 10));
  }

  function drawDoor() {
    const c = $('#doorCanvas'); const g = c.getContext('2d');
    c.width = 224; c.height = 160; g.imageSmoothingEnabled = false;
    const B = BIOMES.dungeon;
    g.fillStyle = B.floorB; g.fillRect(0, 0, 224, 160);
    // 벽
    g.fillStyle = B.face; g.fillRect(0, 0, 224, 96);
    for (let y = 0; y < 96; y += 16) for (let x = 0; x < 224; x += 32) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + ((y / 16) % 2) * 16, y, 1, 16); }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 92, 224, 4);
    // 돌문 (아치 + 룬)
    const dx = 80, dy = 20, dw = 64, dh = 76;
    g.fillStyle = '#1a1b28'; g.beginPath(); g.moveTo(dx, dy + 18);
    g.arc(dx + dw / 2, dy + 18, dw / 2, Math.PI, 0); g.lineTo(dx + dw, dy + dh); g.lineTo(dx, dy + dh); g.closePath(); g.fill();
    // 문짝 (2분할 석판)
    g.fillStyle = '#3a3c52'; g.fillRect(dx + 6, dy + 12, dw - 12, dh - 12);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(dx + dw / 2 - 1, dy + 12, 2, dh - 12);
    // 아치 벽돌 테
    g.strokeStyle = '#5a5c7a'; g.lineWidth = 4;
    g.beginPath(); g.arc(dx + dw / 2, dy + 18, dw / 2 - 2, Math.PI, 0); g.stroke();
    // 룬 (골드 글로우)
    g.fillStyle = '#ffd766';
    const runes = [[0, -3], [-14, 2], [14, 2], [-7, 9], [7, 9]];
    runes.forEach(([ox, oyy]) => { g.fillRect(dx + dw / 2 + ox - 1, dy + 26 + oyy, 2, 5); g.fillRect(dx + dw / 2 + ox - 2, dy + 28 + oyy, 4, 1); });
    g.fillStyle = 'rgba(255,215,102,.14)'; g.fillRect(dx + 6, dy + 12, dw - 12, dh - 12);
    // 자물쇠 판
    g.fillStyle = '#c98b2c'; g.fillRect(dx + dw / 2 - 5, dy + 46, 10, 12);
    g.fillStyle = '#0a0b16'; g.fillRect(dx + dw / 2 - 1.5, dy + 50, 3, 5);
  }

  function drawPortal() {
    const c = $('#portalCanvas'); const g = c.getContext('2d');
    c.width = 224; c.height = 160; g.imageSmoothingEnabled = false;
    const B = BIOMES[biome] || BIOMES.dungeon;
    g.fillStyle = B.floorA; g.fillRect(0, 0, 224, 160);
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect((i * 41) % 224, (i * 23) % 160, 2, 2); }
    const cx = 112, cy = 84;
    // 바닥 룬 링
    g.strokeStyle = 'rgba(127,222,208,.8)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(cx, cy + 18, 34, 12, 0, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(127,222,208,.35)'; g.beginPath(); g.ellipse(cx, cy + 18, 42, 16, 0, 0, 7); g.stroke();
    // 룬 문자 점
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.fillStyle = '#7fded0';
      g.fillRect(cx + Math.cos(a) * 38 - 1, cy + 18 + Math.sin(a) * 14 - 1, 3, 3); }
    // 수직 소용돌이 (2톤)
    for (let i = 0; i < 26; i++) { const a = i * 0.6 + T * 2, r = 4 + i * 0.9, yy = cy + 10 - i * 2.4;
      g.fillStyle = i % 2 ? 'rgba(127,222,208,.85)' : 'rgba(180,131,240,.8)';
      g.fillRect(cx + Math.cos(a) * r - 1.5, yy, 3, 3); }
    // 코어 글로우
    g.fillStyle = 'rgba(230,255,250,.9)'; g.fillRect(cx - 2, cy - 26, 4, 34);
    g.fillStyle = 'rgba(127,222,208,.25)'; g.beginPath(); g.ellipse(cx, cy - 6, 20, 30, 0, 0, 7); g.fill();
  }

  /* ---- 컨트롤 ---- */
  function wire() {
    document.querySelectorAll('[data-biome]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-biome]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); biome = b.dataset.biome; render(); drawBridge(); drawPortal();
    }));
    document.querySelectorAll('[data-variant]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-variant]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); variant = b.dataset.variant; render();
      $('#variantNote').textContent = NOTES[variant];
    }));
  }
  const NOTES = {
    gold: '현행 유지+: 골드 오버레이 램프. "여기서 오른다"는 신호가 가장 강하지만 지형과 겉돎.',
    stone: '추천: 실제 단 지오메트리(발판+챌면+측벽). 지형에 녹아들고, 입구의 골드 스텃 2개가 신호를 유지.',
    biome: '지역 재질: 던전=석조, 설원=얼음(반짝), 늪=뿌리·이끼, 용암=흑요석(불씨). 몰입감 최고 — 재질만 바꿔 4지역 대응.',
  };

  function init() {
    wire(); drawDoor();
    $('#variantNote').textContent = NOTES[variant];
    const img = $('#knightSpr'); if (img) img.onload = () => {};
    // 애니메이션 루프 (물·용암·포탈)
    let last = performance.now();
    (function loop(now) {
      T += Math.min(0.05, ((now || performance.now()) - last) / 1000); last = now || performance.now();
      render(); drawBridge(); drawPortal();
      requestAnimationFrame(loop);
    })(performance.now());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

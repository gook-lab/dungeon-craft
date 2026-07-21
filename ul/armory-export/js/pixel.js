/* ============================================================
   pixel.js — 코드 생성 픽셀아트
   문자 그리드 → 캔버스. 상태이상 아이콘 · 스킬 타격 이펙트.
   새 에셋 없이 전부 코드로 그림.
   ============================================================ */
(function () {
  // 문자 그리드 → canvas. ' '/'.'=투명. scale=픽셀 1칸 크기.
  function pix(rows, pal, scale) {
    scale = scale || 4;
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    c.style.imageRendering = 'pixelated';
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === ' ' || ch === '.') continue;
        g.fillStyle = pal[ch] || '#f00';
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  }
  function dataURL(rows, pal, scale) { return pix(rows, pal, scale).toDataURL(); }

  /* ---- 상태이상 아이콘 (10x10) ----------------------------- */
  // 독 — 해골+물방울
  const POISON = [
    '..xxxx....',
    '.xKKKKx...',
    '.xKbKbx...',
    '.xKKKKx...',
    '..xKKx....',
    '...dd.....',
    '..dggd....',
    '.dggggd...',
    '.dggggd...',
    '..dggd....',
  ];
  // 수면 — Z 세 개
  const SLEEP = [
    'zzzz......',
    '...z......',
    '..z.......',
    '.zzzz.....',
    '.....zz...',
    '....z.....',
    '...z......',
    '...zz.....',
    '..........',
    '..........',
  ];
  // 약화 — 깨진 방패 + 하강 화살
  const WEAKEN = [
    '..wwww....',
    '.wwwwww...',
    '.ww..ww...',
    '.wwwwww...',
    '..wwww....',
    '...ww.....',
    '.a.ww.a...',
    '.aa..aa...',
    '..aaaa....',
    '...aa.....',
  ];
  const ST_PAL = {
    poison: { K: '#e8f7c0', b: '#1b2030', d: '#6fae2e', g: '#9ad94f' },
    sleep: { z: '#b59cff' },
    weaken: { w: '#d98446', a: '#e25563' },
  };

  /* ---- 스킬 타격 이펙트 스프라이트 ------------------------- */
  // 베기(슬래시) — 대각 빛줄기
  const SLASH = [
    '.........#',
    '........##',
    '.......##.',
    '......##W.',
    '.....##W..',
    '....##W...',
    '...##W....',
    '..##W.....',
    '.##W......',
    '##W.......',
  ];
  // 화염구
  const FIRE = [
    '...oo...',
    '..oRRo..',
    '.oRYYRo.',
    'oRYWYRo.',
    'oRYYYRoo',
    '.oRYRRo.',
    '..oRRo..',
    '...oo...',
  ];
  // 얼음 파편
  const ICE = [
    '...c....',
    '..ccc...',
    '.cWcWc..',
    'cccWccc.',
    '.cWcWc..',
    '..ccc...',
    '...c....',
    '..c.c...',
  ];
  // 회복 반짝임
  const SPARK = [
    '...g....',
    '..ggg...',
    '.gWWWg..',
    'gWWWWWg.',
    '.gWWWg..',
    '..ggg...',
    '...g....',
    '.g.g.g..',
  ];
  const FX_PAL = {
    slash: { '#': '#fff0b8', W: '#ffd766' },
    fire: { o: '#7a1f0a', R: '#e25563', Y: '#f0c44c', W: '#fff0b8' },
    ice: { c: '#56a8e8', W: '#eaf6ff' },
    spark: { g: '#62c46a', W: '#eafbe8' },
  };

  window.Pixel = {
    pix, dataURL,
    statusIcon(kind, scale) {
      const map = { poison: POISON, sleep: SLEEP, weaken: WEAKEN };
      return pix(map[kind], ST_PAL[kind], scale || 3);
    },
    statusURL(kind, scale) {
      const map = { poison: POISON, sleep: SLEEP, weaken: WEAKEN };
      return dataURL(map[kind], ST_PAL[kind], scale || 3);
    },
    fx(kind, scale) {
      const map = { slash: SLASH, fire: FIRE, ice: ICE, spark: SPARK };
      return pix(map[kind], FX_PAL[kind], scale || 5);
    },
  };
})();

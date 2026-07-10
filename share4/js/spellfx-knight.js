/* ============================================================
   spellfx-knight.js — 기사 확장 신성기 (전체 회복/정화)
   기존: heal(단일)·cleanse(단일 해제)·holy_nova(전체 회복·신성)
   추가: 전체 치유(파티 전원 회복) · 전체 정화(파티 전원 상태 해제)
   window.SpellFXDefs.{DEFS,META} 에 병합. (아군 대상 — 필드 전체 오라)
   ============================================================ */
(function () {
  const { DEFS, META, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };
  const heal = '#62c46a', healW = '#eafbe8', gold = '#ffd766', goldW = '#fff0b8';
  const cyan = '#7fded0', cyanW = '#eafcf8', white = '#ffffff';

  // 십자 광휘 (회복 표식)
  function cross(g, x, y, r, col, a) { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x - 1, y - r, 2, r * 2); g.fillRect(x - r, y - 1, r * 2, 2); g.globalAlpha = 1; }
  // 확장 링 floatSpr 헬퍼
  function ring(S, x, y, col, life, maxR) { S.floatSpr({ x, y, life, max: life, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * maxR, 0, 7); g.stroke(); g.globalAlpha = 1; } }); }

  const KNIGHT = {
    /* 전체 방어막 — 파티 전원에 보호막. 필드 위로 금/청 보호 돔 전개 */
    masbarrier(S) {
      cast(S); let t = 0, formed = false; const W = S.W, gy = S.groundY;
      const cx = S.caster.x, cy = S.caster.y - 9;
      const shield = PAL.shield || '#56a8e8', shieldW = PAL.shieldW || '#cfe0ff';
      const domes = []; // 파티원별 작은 보호막 (필드에 분산)
      for (let i = 0; i < 4; i++) domes.push({ x: W * (0.14 + i * 0.13), born: false, at: 0.12 + i * 0.1 });
      return {
        update(dt) {
          t += dt;
          if (!formed && t > 0.1) { formed = true; S.doFlash(shieldW, 0.34); ring(S, cx, cy, shield, 0.7, 120); ring(S, cx, cy, gold, 0.5, 80); }
          // 분산된 보호막 돔 팝업 (각 아군)
          domes.forEach(d => { if (!d.born && t >= d.at) { d.born = true;
            S.floatSpr({ x: d.x, y: gy - 6, life: 1.0, max: 1.0, draw: (g, s) => { const ap = Math.min(1, (s.max - s.life) * 5) * (s.life > 0.3 ? 1 : s.life / 0.3); const R = 15; g.globalAlpha = ap * 0.85; g.strokeStyle = shieldW; g.lineWidth = 1; g.beginPath(); for (let k = 0; k <= 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3, px = s.x + Math.cos(a) * R * 0.8, py = s.y - 8 + Math.sin(a) * R; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.globalAlpha = ap * 0.16; g.fillStyle = shield; g.fill(); g.globalAlpha = 1; } });
            for (let k = 0; k < 6; k++) S.p({ x: d.x + rnd(-8, 8), y: gy - rnd(4, 22), vy: -rnd(10, 30), life: rnd(0.3, 0.6), max: 0.6, size: 2, color: Math.random() < 0.5 ? shield : shieldW, additive: true, shrink: true });
          } });
          // 표면 글린트 + 상승 입자
          if (t < 0.95 && Math.random() < 0.6) S.p({ x: rnd(0, W), y: rnd(gy - 24, gy), vy: -rnd(14, 38), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? shieldW : gold, additive: true, shrink: true });
          // 방어↑ 표식
          if (Math.abs(t - 0.45) < dt) S.floatSpr({ x: cx, y: S.caster.y - 24, vy: -12, life: 0.9, max: 0.9, draw: (g, s) => { g.globalAlpha = Math.min(1, s.life / s.max + .2); g.fillStyle = shieldW; g.fillRect(s.x - 0.5, s.y - 4, 1, 8); g.fillRect(s.x - 2, s.y - 3, 1, 1); g.fillRect(s.x + 1, s.y - 3, 1, 1); g.fillRect(s.x - 1, s.y - 4, 1, 1); g.fillRect(s.x, s.y - 4, 1, 1); g.globalAlpha = 1; } });
        },
        done: (tt) => tt > 1.3,
      };
    },

    /* 전체 치유 — 파티 전원 회복. 필드 전체에 녹/금 성역의 빛 강림 */
    masheal(S) {
      cast(S); let t = 0, em = 0, flashed = false; const W = S.W, gy = S.groundY;
      const cx = S.caster.x, cy = S.caster.y - 9;
      return {
        update(dt) {
          t += dt; em += dt;
          if (!flashed && t > 0.1) { flashed = true; S.doFlash(healW, 0.35); ring(S, cx, cy, heal, 0.6, 80); }
          // 필드 전역 상승 회복 반짝 (전체 대상 암시)
          if (em > 0.025 && t < 1.0) { em = 0;
            S.p({ x: rnd(0, W), y: rnd(gy - 30, gy + 4), vy: -rnd(24, 56), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: Math.random() < 0.5 ? heal : healW, additive: true, shrink: true });
            if (Math.random() < 0.35) S.p({ x: rnd(0, W), y: rnd(gy - 24, gy), vy: -rnd(20, 44), life: rnd(0.5, 0.9), max: 0.9, size: 2, color: gold, additive: true, shrink: true });
          }
          // 하강하는 성역의 빛 기둥 (드문드문)
          if (t < 0.7 && Math.random() < 0.25) { const x = rnd(W * 0.1, W * 0.95);
            S.beam({ x1: x, y1: -2, x2: x, y2: gy, color: Math.random() < 0.5 ? goldW : healW, width: rnd(2, 4), jag: 0, life: 0.12, max: 0.12 }); }
          // 회복 십자 팝
          if (t < 0.9 && Math.random() < 0.18) S.floatSpr({ x: rnd(W * 0.08, W * 0.95), y: rnd(gy - 30, gy - 6), life: 0.4, max: 0.4, draw: (g, s) => cross(g, s.x, s.y, 4 + (1 - s.life / s.max) * 4, healW, s.life / s.max) });
        },
        done: (tt) => tt > 1.3,
      };
    },

    /* 전체 정화 — 파티 전원 상태이상 해제. 청백 정화 물결이 필드를 휩쓺 */
    masscleanse(S) {
      cast(S); let t = 0, em = 0, flashed = false; const W = S.W, gy = S.groundY;
      const cx = S.caster.x, cy = S.caster.y - 9;
      return {
        update(dt) {
          t += dt; em += dt;
          if (!flashed && t > 0.1) { flashed = true; S.doFlash(cyanW, 0.4); ring(S, cx, cy, cyan, 0.7, 120); ring(S, cx, cy, white, 0.5, 90); }
          // 청백 정화 물결 (수평 확장)
          if (t < 0.9) { const wr = (t) * 360; const n = 16; for (let i = 0; i < n; i++) { if (Math.random() < 0.55) continue; const a = (i / n) * 6.28; S.p({ x: cx + Math.cos(a) * wr, y: cy + Math.sin(a) * wr * 0.5, life: 0.12, max: 0.12, size: 2, color: Math.random() < 0.5 ? cyan : cyanW, additive: true }); } }
          // 상승 정화 모트 (전역)
          if (em > 0.03 && t < 1.0) { em = 0; S.p({ x: rnd(0, W), y: rnd(gy - 26, gy), vy: -rnd(20, 50), life: rnd(0.5, 1), max: 1, size: 2, color: Math.random() < 0.5 ? cyanW : white, additive: true, shrink: true }); }
          // 떨어져 나가는 상태이상(적/보라 잔재) — 위로 흩어지며 소멸
          if (t < 0.7 && Math.random() < 0.4) { const x = rnd(W * 0.1, W * 0.95); S.p({ x, y: rnd(gy - 24, gy - 4), vx: rnd(-16, 16), vy: -rnd(24, 52), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: ['#9ad94f', '#b59cff', '#d98446'][(rnd(0, 3) | 0)], shrink: true }); }
          // 정화 별 반짝
          if (t < 0.9 && Math.random() < 0.2) S.floatSpr({ x: rnd(W * 0.08, W * 0.95), y: rnd(gy - 30, gy - 6), life: 0.35, max: 0.35, draw: (g, s) => { const r = 3 + (1 - s.life / s.max) * 5, a = s.life / s.max; g.globalAlpha = a; g.fillStyle = cyanW; g.fillRect(s.x - 0.5, s.y - r, 1, r * 2); g.fillRect(s.x - r, s.y - 0.5, r * 2, 1); g.globalAlpha = 1; } });
        },
        done: (tt) => tt > 1.3,
      };
    },
  };

  const GRP = '기사 · 신성/회복';
  const KNIGHT_META = [
    { id: 'masheal', name: '전체 치유', cost: 'MP 10', kind: '전체 회복 · 신성', el: 'heal', grp: GRP, caster: 'knight', enemy: 'goblin', self: true, from: '필드 전역 성역의 빛 · 파티 회복', power: 16 },
    { id: 'masscleanse', name: '전체 정화', cost: 'MP 8', kind: '전체 해제 · 신성', el: 'heal', grp: GRP, caster: 'knight', enemy: 'goblin', self: true, from: '청백 정화 물결 · 파티 상태 해제', power: 0 },
    { id: 'masbarrier', name: '전체 방어막', cost: 'MP 9', kind: '전체 보호 · 신성', el: 'shield', grp: GRP, caster: 'knight', enemy: 'goblin', self: true, from: '금/청 보호 돔 · 파티 피해 흡수', power: 0 },
  ];

  Object.assign(DEFS, KNIGHT);
  KNIGHT_META.forEach(m => META.push(m));
  window.SpellFXDefs.KNIGHT_META = KNIGHT_META;
})();

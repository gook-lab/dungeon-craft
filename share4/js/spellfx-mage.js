/* ============================================================
   spellfx-mage.js — 마법사 직업 고유기 (순수 비전/원소 캐스터)
   마법사는 기존 원소 마법(화염·얼음·뇌전·대지·바람·암흑)을 전담하고,
   여기에 비전(arcane) 시그니처 + 유틸(보호막·명상·가속)을 더한다.
   window.SpellFXDefs.{DEFS,META,ALL_TARGET} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };
  const arc = '#b483f0', arcW = '#e6dcff', arcD = '#6a4fb0', mana = '#56a8e8', manaW = '#cfe0ff';

  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.25, 0.55), max: 0.55, size: o.size || 2, color: cols[i % cols.length], shrink: true, additive: o.additive }); }
  }
  function arrowMark(g, s, up) { g.globalAlpha = Math.min(1, s.life / s.max + 0.2); g.fillStyle = s.col; const d = up ? -1 : 1, y = s.y;
    g.fillRect(s.x - 0.5, y - 4, 1, 8); g.fillRect(s.x - 2, y + d, 1, 1); g.fillRect(s.x + 1, y + d, 1, 1); g.fillRect(s.x - 1, y + d * 2, 1, 1); g.fillRect(s.x, y + d * 2, 1, 1); g.globalAlpha = 1; }
  // 4점 별(반짝) 그리기
  function sparkle(g, x, y, r, col, a) { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x - 0.5, y - r, 1, r * 2); g.fillRect(x - r, y - 0.5, r * 2, 1); g.globalAlpha = 1; }

  // --- 마력 충전(charge) 상태 — 마력 충전으로 진입. 다음 주문이 [과부하] 강화(소비형).
  const ovr = '#fff0b8';
  const consumeCharge = (S) => { const v = !!S._charge; if (v) { S._charge = false; if (S.notifyState) S.notifyState(); } return v; };
  // 과부하 표식 (금/보라 별폭발)
  function overMark(g, x, y, a) { g.globalAlpha = a; for (const c of [[ovr, 7], [arc, 4]]) { g.fillStyle = c[0]; const r = c[1]; g.fillRect(x - 0.5, y - r, 1, r * 2); g.fillRect(x - r, y - 0.5, r * 2, 1); g.fillRect(x - r * 0.7, y - r * 0.7, 1, 1); g.fillRect(x + r * 0.7 - 1, y + r * 0.7 - 1, 1, 1); } g.globalAlpha = 1; }
  function chargeBurst(S, x, y) {
    burst(S, x, y, [ovr, arcW, arc, '#fff'], 20, 160, { additive: true, size: 3, up: 6 });
    S.floatSpr({ x, y: y - 18, vy: -14, life: 0.8, max: 0.8, draw: (g, s) => overMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2)) });
    [0, 0.07].forEach(dl => S.floatSpr({ x, y, life: 0.45 - dl, max: 0.45, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = ovr; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 30, 0, 7); g.stroke(); g.globalAlpha = 1; } }));
  }

  const MAGE = {
    /* 마력탄 — 단일 비전. 유도하는 보라 마력탄 → 별빛 폭발. 충전 중: [과부하] 강화 */
    arcanebolt(S) {
      cast(S); const tgt = S.primary(); const over = consumeCharge(S); let t = 0, hit = false; const from = { x: S.caster.x + 6, y: S.caster.y - 13 };
      return {
        update(dt) {
          t += dt; const dur = 0.4, k = Math.min(1, t / dur);
          if (!hit) {
            // 곡선 유도 경로
            const x = from.x + (tgt.x - from.x) * k, y = from.y + (tgt.y - 9 - from.y) * k - Math.sin(k * Math.PI) * 16;
            S.p({ x, y, life: 0.1, max: 0.1, size: over ? 6 : 4, color: over ? ovr : arcW, additive: true });
            for (let i = 0; i < (over ? 4 : 2); i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: rnd(-12, 12), vy: rnd(-12, 12), life: rnd(0.2, 0.4), max: 0.4, size: 2, color: over ? (Math.random() < 0.5 ? ovr : arc) : (Math.random() < 0.5 ? arc : arcD), additive: true, shrink: true });
            if (k >= 1) { hit = true; S.doFlash(over ? ovr : arcW, over ? 0.7 : 0.4); S.doShake(over ? 6 : 3); tgt.flinch = over ? 6 : 4; tgt.tint = over ? 1 : 0.7;
              burst(S, tgt.x, tgt.y - 9, [arcW, arc, arcD, '#fff'], over ? 34 : 22, over ? 170 : 130, { additive: true });
              if (over) chargeBurst(S, tgt.x, tgt.y - 9);
              else S.floatSpr({ x: tgt.x, y: tgt.y - 9, life: 0.3, max: 0.3, draw: (g, s) => sparkle(g, s.x, s.y, 4 + (1 - s.life / s.max) * 8, arcW, s.life / s.max) });
            }
          }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 비전 폭발 — 단일 대형 비전. 차징 → 거대 폭발 + 룬 링. 충전 중: [과부하] 초대형 */
    arcaneblast(S) {
      cast(S); const tgt = S.primary(); const over = consumeCharge(S); let t = 0, hit = false; const cx = tgt.x, cy = tgt.y - 9;
      return {
        update(dt) {
          t += dt;
          // 차징: 타겟 주위로 마력 수렴
          if (t < 0.5) { for (let i = 0; i < (over ? 5 : 3); i++) { const a = Math.random() * 6.28, r = 30 - t * 40; S.p({ x: cx + Math.cos(a) * Math.max(4, r), y: cy + Math.sin(a) * Math.max(4, r), vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30, life: 0.25, max: 0.25, size: 2, color: over ? (Math.random() < 0.5 ? ovr : arc) : (Math.random() < 0.5 ? arc : mana), additive: true, shrink: true }); } }
          if (!hit && t >= 0.5) { hit = true; S.doFlash(over ? '#ffffff' : arcW, over ? 1.0 : 0.85); S.doShake(over ? 10 : 7); tgt.flinch = 6; tgt.tint = 1;
            burst(S, cx, cy, over ? [ovr, arcW, arc, '#fff'] : [arcW, arc, arcD, mana, '#fff'], over ? 64 : 44, over ? 240 : 200, { additive: true, size: 3, up: 6 });
            // 확장 룬 링 (충전 중 3겹)
            (over ? [0, 0.06, 0.12] : [0, 0.08]).forEach((dl, idx) => S.floatSpr({ x: cx, y: cy, life: (over ? 0.6 : 0.5) - dl, max: over ? 0.6 : 0.5, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = over ? (idx ? arc : ovr) : (idx ? mana : arc); g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * (over ? 58 : 46), 0, 7); g.stroke(); g.globalAlpha = 1; } }));
            if (over) chargeBurst(S, cx, cy);
          }
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 마력 보호막 — 자기/아군. 보라 육각 보호막 + 흡수 광채 */
    manashield(S) {
      cast(S); let t = 0, formed = false; const u = S.caster, cx = u.x, cy = u.y - 10;
      return {
        update(dt) {
          t += dt;
          if (!formed && t > 0.1) { formed = true; S.doFlash(arcW, 0.3); }
          // 궤도 마력 입자
          if (t < 1.0) { const a = t * 7; for (let k = 0; k < 2; k++) { const ang = a + k * Math.PI; S.p({ x: cx + Math.cos(ang) * 14, y: cy + Math.sin(ang) * 16, life: 0.18, max: 0.18, size: 2, color: Math.random() < 0.5 ? arc : mana, additive: true }); } }
          if (t < 0.9 && Math.random() < 0.6) S.p({ x: cx + rnd(-12, 12), y: u.y - rnd(0, 6), vy: -rnd(16, 40), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? arcW : manaW, additive: true, shrink: true });
          // 육각 보호막 윤곽
          if (!u._mshex) { u._mshex = true; S.floatSpr({ x: cx, y: cy, life: 1.2, max: 1.2, draw: (g, s) => { const ap = Math.min(1, (s.max - s.life) * 4) * (s.life > 0.3 ? 1 : s.life / 0.3); g.globalAlpha = ap * 0.85; g.strokeStyle = arc; g.lineWidth = 1; g.beginPath(); const R = 16; for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3, px = s.x + Math.cos(a) * R * 0.8, py = s.y + Math.sin(a) * R; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.globalAlpha = ap * 0.16; g.fillStyle = mana; g.fill(); g.globalAlpha = 1; } }); }
        },
        done: (tt) => { if (tt > 1.3) { S.caster._mshex = false; return true; } return false; },
      };
    },

    /* 명상 — 자기 MP 회복. 마나 입자가 안으로 수렴 + MP↑ */
    meditate(S) {
      cast(S); let t = 0, em = 0; const u = S.caster, cx = u.x, cy = u.y - 11;
      return {
        update(dt) {
          t += dt; em += dt;
          // 바깥에서 안으로 수렴하는 마나
          if (em > 0.03 && t < 0.95) { em = 0; const a = Math.random() * 6.28, r = rnd(20, 34);
            S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.4, vy: -Math.sin(a) * r * 2.4, life: r / (r * 2.4), max: 0.5, size: 2, color: Math.random() < 0.5 ? mana : manaW, additive: true, shrink: true }); }
          if (t > 0.1 && !u._medf) { u._medf = true; S.doFlash(manaW, 0.22); }
          if (Math.abs(t - 0.55) < dt) S.floatSpr({ x: cx, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: mana, draw: (g, s) => arrowMark(g, s, true) });
        },
        done: (tt) => { if (tt > 1.1) { S.caster._medf = false; return true; } return false; },
      };
    },

    /* 가속 — 아군 속도 버프. 청백 잔상 + 시간 가속 휘선 */
    haste(S) {
      cast(S); let t = 0; const u = S.caster, cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt;
          // 수평 속도선
          if (t < 0.9 && Math.random() < 0.8) S.p({ x: cx - 10, y: cy + rnd(-10, 8), vx: rnd(120, 220), vy: 0, life: 0.35, max: 0.35, size: 1, color: Math.random() < 0.5 ? manaW : '#ffffff', streak: rnd(8, 16), additive: true, fade: false });
          // 상승 시계 반짝
          if (t < 0.9 && Math.random() < 0.5) S.p({ x: cx + rnd(-8, 8), y: u.y - rnd(0, 6), vy: -rnd(20, 46), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: mana, additive: true, shrink: true });
          if (t > 0.1 && !u._hf) { u._hf = true; S.doFlash(manaW, 0.26); }
          if (Math.abs(t - 0.5) < dt) S.floatSpr({ x: cx, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: manaW, draw: (g, s) => arrowMark(g, s, true) });
        },
        done: (tt) => { if (tt > 1.0) { S.caster._hf = false; return true; } return false; },
      };
    },

    /* 전체 마력 가속 — 파티 전원 속도↑. 필드 전역 청백 시간 가속 물결 */
    masshaste(S) {
      cast(S); let t = 0, em = 0, flashed = false; const W = S.W, gy = S.groundY;
      const cx = S.caster.x, cy = S.caster.y - 9;
      return {
        update(dt) {
          t += dt; em += dt;
          if (!flashed && t > 0.1) { flashed = true; S.doFlash(manaW, 0.32);
            S.floatSpr({ x: cx, y: cy, life: 0.6, max: 0.6, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = mana; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 100, 0, 7); g.stroke(); g.globalAlpha = 1; } }); }
          // 필드 전역 수평 속도선 (전체 대상 암시)
          if (em > 0.025 && t < 1.0) { em = 0;
            S.p({ x: -10, y: rnd(gy - 34, gy + 2), vx: rnd(180, 320), vy: 0, life: 0.4, max: 0.4, size: 1, color: Math.random() < 0.5 ? manaW : '#ffffff', streak: rnd(10, 18), additive: true, fade: false }); }
          // 상승 가속 반짝 (전역)
          if (t < 0.95 && Math.random() < 0.7) S.p({ x: rnd(0, W), y: rnd(gy - 24, gy), vy: -rnd(20, 48), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? mana : manaW, additive: true, shrink: true });
          // 속도↑ 표식 (분산 — 파티원별)
          [0.18, 0.32, 0.46, 0.6].forEach((at, i) => { if (Math.abs(t - at) < dt) S.floatSpr({ x: W * (0.16 + i * 0.13), y: gy - 24, vy: -12, life: 0.9, max: 0.9, col: manaW, draw: (g, s) => arrowMark(g, s, true) }); });
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 마력 충전 — 상태 진입. 마나가 손끝에 응축 → 다음 주문이 [과부하] 강화됨(소비형) */
    overcharge(S) {
      cast(S); let t = 0, em = 0; const u = S.caster, cx = u.x, cy = u.y - 11;
      S._charge = true; if (S.notifyState) S.notifyState(); // 즉시 충전 상태
      return {
        update(dt) {
          t += dt; em += dt;
          // 바깥에서 손끝으로 응축하는 금/보라 마나
          if (em > 0.025 && t < 0.95) { em = 0; const a = Math.random() * 6.28, r = rnd(18, 32);
            S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 2.6, life: r / (r * 2.6), max: 0.5, size: 2, color: Math.random() < 0.5 ? ovr : arc, additive: true, shrink: true }); }
          // 응축 코어 맥동
          if (t < 0.95) S.p({ x: cx + rnd(-2, 2), y: cy + rnd(-2, 2), life: 0.12, max: 0.12, size: 3 + Math.round(Math.sin(t * 14) + 1), color: ovr, additive: true });
          if (t > 0.1 && !u._ocf) { u._ocf = true; S.doFlash(ovr, 0.3); }
          // 과부하 표식
          if (!u._ocm && t > 0.4) { u._ocm = true; S.floatSpr({ x: cx, y: u.y - 24, vy: -10, life: 0.9, max: 0.9, draw: (g, s) => overMark(g, s.x, s.y, Math.min(1, s.life / s.max)) }); }
        },
        done: (tt) => { if (tt > 1.0) { S.caster._ocf = false; S.caster._ocm = false; return true; } return false; },
      };
    },
  };

  const GRP = '마법사 · 비전 고유기';
  const MAGE_META = [
    { id: 'overcharge', name: '마력 충전', cost: 'MP 4', kind: '상태 · 충전', el: 'arcane', grp: GRP, caster: 'mage', enemy: 'goblin', self: true, from: '마나 응축 → 다음 주문 [과부하]', power: 0, state: 'charge' },
    { id: 'arcanebolt', name: '마력탄', cost: 'MP 3', kind: '단일 · 비전', el: 'arcane', grp: GRP, caster: 'mage', enemy: 'goblin', from: '유도 마력탄 → 별빛 폭발', power: 12, charge: '과부하 강화 (대형)' },
    { id: 'arcaneblast', name: '비전 폭발', cost: 'MP 7', kind: '단일 · 비전', el: 'arcane', grp: GRP, caster: 'mage', enemy: 'golem', from: '차징 → 거대 폭발 + 룬 링', power: 20, charge: '과부하 초대형 폭발' },
    { id: 'manashield', name: '마력 보호막', cost: 'MP 6', kind: '자기/아군 · 보호', el: 'arcane', grp: GRP, caster: 'mage', enemy: 'goblin', self: true, from: '육각 보호막 (피해 흡수)', power: 0 },
    { id: 'meditate', name: '명상', cost: 'MP 0', kind: '자기 · MP 회복', el: 'mana', grp: GRP, caster: 'mage', enemy: 'goblin', self: true, from: '마나 수렴 → MP 회복', power: 0 },
    { id: 'haste', name: '가속', cost: 'MP 5', kind: '아군 · 속도↑', el: 'mana', grp: GRP, caster: 'mage', enemy: 'goblin', self: true, from: '청백 잔상 · 속도 버프', power: 0 },
    { id: 'masshaste', name: '전체 마력 가속', cost: 'MP 9', kind: '전체 · 속도↑', el: 'mana', grp: GRP, caster: 'mage', enemy: 'goblin', self: true, from: '필드 전역 가속 물결 · 파티 속도↑', power: 0 },
  ];

  Object.assign(DEFS, MAGE);
  MAGE_META.forEach(m => META.push(m));
  window.SpellFXDefs.MAGE_META = MAGE_META;
})();

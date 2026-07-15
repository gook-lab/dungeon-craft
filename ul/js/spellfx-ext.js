/* ============================================================
   spellfx-ext.js — 추가 스킬: 새 원소축(바람·암흑) + 신성 공격기 + 필살기
   기존 환경 입자 테마를 이어가며 전투에 색을 더함.
   window.SpellFXDefs.{DEFS,META,ALL_TARGET} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };

  const C = {
    wind1: '#dff5e8', wind2: '#a8e6c8', leaf1: '#6fae2e', leaf2: '#c98b2c', leaf3: '#9ad94f',
    darkSmoke: '#241a3a', darkSmoke2: '#3a2c5a', wisp: '#b59cff',
  };

  // 공통 AoE 골격 (aoe.js와 동일 — 독립 유지를 위해 재정의)
  function aoe(S, cfg) {
    cast(S); if (cfg.tint) S.tint(cfg.tint.c, cfg.tint.a, cfg.dur);
    const targets = S.targets();
    let t = 0; const next = targets.map(() => rnd(0.1, 0.5));
    return {
      update(dt) {
        t += dt;
        if (cfg.field) cfg.field(S, dt, t);
        if (cfg.ambient) cfg.ambient(S, dt, t);
        targets.forEach((e, i) => { next[i] -= dt; if (next[i] <= 0 && t < cfg.dur - 0.25) { next[i] = rnd(cfg.gap[0], cfg.gap[1]); cfg.strike(S, e, t); } });
      },
      done: (tt) => tt > cfg.dur,
    };
  }
  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.2, 0.5), max: 0.5, size: o.size || 2, color: cols[i % cols.length], shrink: true, additive: o.additive }); }
  }

  const EXT = {
    /* 태풍 — 가로로 휩쓰는 바람 줄기 + 나뭇잎 (바람 전체기) */
    cyclone(S) {
      return aoe(S, {
        dur: 1.8, gap: [0.16, 0.36], tint: { c: '#16241c', a: 0.16 },
        field: (s, dt) => {
          const n = Math.round(72 * dt);
          for (let i = 0; i < n; i++) { const y = rnd(0, s.groundY); s.p({ x: rnd(-12, 0), y, vx: rnd(230, 380), vy: Math.sin(y * 0.4) * 26, life: 0.6, max: 0.6, size: 1, color: Math.random() < 0.5 ? C.wind1 : C.wind2, streak: rnd(8, 14), additive: true, fade: false }); }
          if (Math.random() < 0.7) s.p({ x: rnd(-6, 0), y: rnd(0, s.groundY), vx: rnd(170, 280), vy: rnd(-26, 26), g: 28, life: rnd(0.6, 1.1), max: 1.1, size: 2, color: [C.leaf1, C.leaf2, C.leaf3][(rnd(0, 3) | 0)] });
        },
        strike: (s, e) => { burst(s, e.x, e.y - 8, [C.wind1, C.wind2, C.leaf3], 10, 90, { up: 6, additive: true }); e.flinch = 3; e.tint = 0.35; },
      });
    },

    /* 암흑 안개 — 화면 암전 + 그림자 안개 상승 (암흑 전체기, 실명/저주) */
    darkmist(S) {
      return aoe(S, {
        dur: 2.0, gap: [0.26, 0.5], tint: { c: '#0a0612', a: 0.46 },
        field: (s, dt) => {
          const n = Math.round(18 * dt);
          for (let i = 0; i < n; i++) s.p({ x: rnd(0, s.W), y: rnd(s.H * 0.35, s.H + 4), vx: rnd(-8, 8), vy: -rnd(4, 14), life: rnd(0.8, 1.5), max: 1.5, size: (rnd(4, 7) | 0), color: Math.random() < 0.6 ? C.darkSmoke : C.darkSmoke2, shrink: true });
          if (Math.random() < 0.45) s.p({ x: rnd(0, s.W), y: rnd(s.H * 0.3, s.H), vy: -rnd(8, 18), life: rnd(0.7, 1.2), max: 1.2, size: 2, color: C.wisp, additive: true, shrink: true });
        },
        strike: (s, e) => {
          // 저주 고리 + 어둠 침식
          s.floatSpr({ x: e.x, y: e.y - 9, life: 0.45, max: 0.45, draw: (g, sp) => { const k = 1 - sp.life / sp.max; g.globalAlpha = sp.life / sp.max; g.strokeStyle = C.wisp; g.lineWidth = 1; g.beginPath(); g.arc(sp.x, sp.y, 3 + k * 14, 0, 7); g.stroke(); g.globalAlpha = 1; } });
          burst(s, e.x, e.y - 8, [C.wisp, C.darkSmoke2, '#7a5fb0'], 10, 60, { additive: true }); e.tint = 0.55; e.flinch = 2;
        },
      });
    },

    /* 천벌 — 성스러운 빛(회복)의 공격판. 황금 광선이 전체에 강림 */
    divinewrath(S) {
      return aoe(S, {
        dur: 1.8, gap: [0.16, 0.36], tint: { c: '#2e2408', a: 0.16 },
        field: (s, dt) => { const n = Math.round(24 * dt); for (let i = 0; i < n; i++) s.p({ x: rnd(0, s.W), y: rnd(-6, s.H * 0.3), vx: rnd(-6, 6), vy: rnd(34, 72), life: 1.1, max: 1.1, size: 1, color: Math.random() < 0.5 ? PAL.gold : PAL.goldGlow, additive: true, fade: false }); },
        ambient: (s, dt) => { if (Math.random() < 0.08) s.doFlash(PAL.goldGlow, 0.12); },
        strike: (s, e) => {
          s.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: PAL.goldGlow, width: rnd(5, 8), jag: 0, life: 0.12, max: 0.12 });
          s.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: PAL.gold, width: rnd(2, 4), jag: 0, life: 0.1, max: 0.1 });
          s.doFlash(PAL.goldGlow, 0.42); s.doShake(2.5); e.flinch = 4; e.tint = 1;
          burst(s, e.x, e.y - 8, [PAL.goldGlow, PAL.gold, PAL.goldDeep], 16, 100, { up: 20, additive: true });
        },
      });
    },

    /* 메테오 — 단일 필살기. 화면 암전 → 거대 운석 낙하 → 대폭발 */
    meteor(S) {
      cast(S); const tgt = S.primary(); let t = 0, hit = false;
      return {
        update(dt) {
          t += dt;
          // phase0: 암전 + 잿불 상승 + 점증 진동
          if (t < 0.6) { S.tint('#1a0604', 0.55, 0.62); if (Math.random() < 0.7) S.p({ x: rnd(0, S.W), y: rnd(S.H * 0.7, S.H), vy: -rnd(24, 60), life: rnd(0.6, 1.2), max: 1.2, size: (rnd(1, 3) | 0) || 1, color: [PAL.fireY, PAL.fireR, PAL.fireDeep][(rnd(0, 3) | 0)], additive: true, shrink: true }); S.doShake(0.6 + t * 4); }
          // phase1: 운석 강하 (우상단 → 타겟)
          if (t >= 0.5 && t < 0.92) {
            const k = (t - 0.5) / 0.42; const sx = S.W * 1.08, sy = -12, ex = tgt.x, ey = tgt.y - 8;
            const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k;
            for (let i = 0; i < 6; i++) S.p({ x: x + rnd(-4, 4), y: y + rnd(-4, 4), life: 0.22, max: 0.22, size: (rnd(3, 6) | 0), color: [PAL.fireY, PAL.fireR, PAL.fireW, PAL.fireDeep][i % 4], additive: true, shrink: true });
            for (let i = 0; i < 3; i++) S.p({ x: x + rnd(-2, 2), y: y - rnd(2, 10), vx: rnd(-20, 20), vy: -rnd(20, 50), life: 0.4, max: 0.4, size: 3, color: PAL.fireR, additive: true, shrink: true });
          }
          // phase2: 대폭발
          if (t >= 0.9 && !hit) { hit = true; S.doFlash('#fff0b8', 0.95); S.doShake(8); tgt.flinch = 6; tgt.tint = 1;
            burst(S, tgt.x, tgt.y - 8, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 40, 200, { up: 20, g: 60, additive: true, size: 3 });
            for (let i = 0; i < 16; i++) S.p({ x: tgt.x + rnd(-10, 10), y: tgt.y, vx: rnd(-60, 60), vy: -rnd(40, 110), g: 220, life: rnd(0.5, 1), max: 1, size: (rnd(1, 3) | 0) || 2, color: [PAL.fireR, PAL.fireDeep, PAL.dust][i % 3] }); }
        },
        done: (tt) => tt > 1.7,
      };
    },
  };

  const EXT_META = [
    { id: 'cyclone', name: '태풍', mp: 9, kind: '전체 · 바람', el: 'wind', rec: true, from: '신규 회전 입자', power: 11, note: '회피 무시 · 관통' },
    { id: 'darkmist', name: '암흑 안개', mp: 9, kind: '전체 · 암흑', el: 'dark', rec: true, from: '안개(암전)', power: 10, note: '전체 실명/저주' },
    { id: 'divinewrath', name: '천벌', mp: 11, kind: '전체 · 신성', el: 'holy', rec: true, from: '신규 광선비', power: 13, note: '성스러운 빛의 공격판' },
    { id: 'meteor', name: '메테오', mp: 12, kind: '단일 · 필살', el: 'fire', rec: true, single: true, from: '잿불+암전', power: 30, note: '암전→운석 낙하 · 보스전 필살' },
  ];

  Object.assign(DEFS, EXT);
  EXT_META.forEach(m => { META.push(m); if (!m.single) ALL_TARGET.add(m.id); });
  window.SpellFXDefs.EXT_META = EXT_META;
})();

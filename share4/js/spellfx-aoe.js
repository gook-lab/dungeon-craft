/* ============================================================
   spellfx-aoe.js — 환경 픽셀 애니메이션 연동 전체타격기(AoE)
   기존 날씨(비/천둥/눈/잿불)를 스킬 비주얼로 재활용.
   화면 전체 입자장 + 적별 임팩트 = "전체기" 즉시 전달.
   window.SpellFXDefs.{DEFS,META,ALL_TARGET} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };

  // ---- 화면 전체 날씨형 입자장 (effect.update에서 매 프레임 호출) ----
  function rainField(S, dt, o) {
    const n = Math.round((o.rate || 70) * dt);
    for (let i = 0; i < n; i++) {
      S.p({ x: rnd(-6, S.W * 1.15), y: rnd(-8, S.H * 0.25), vx: o.vx || -14, vy: o.vy || 280,
        life: 0.6, max: 0.6, size: o.size || 1, color: o.color, streak: o.streak || 7, head: o.head, headColor: o.headColor, additive: o.additive, fade: false });
    }
  }
  function snowField(S, dt, o) {
    const n = Math.round((o.rate || 46) * dt);
    for (let i = 0; i < n; i++) {
      S.p({ x: rnd(-4, S.W), y: rnd(-6, 2), vx: rnd(-14, 14), vy: rnd(34, 74),
        life: 2.2, max: 2.2, size: (rnd(1, 3) | 0) || 1, color: Math.random() < 0.5 ? o.color : o.color2, fade: false, _wob: Math.random() * 6 });
    }
  }
  function emberField(S, dt, o) {
    const n = Math.round((o.rate || 30) * dt);
    for (let i = 0; i < n; i++) {
      S.p({ x: rnd(0, S.W), y: rnd(S.H * 0.7, S.H + 6), vx: rnd(-8, 8), vy: -rnd(26, 64),
        life: rnd(0.8, 1.6), max: 1.6, size: (rnd(1, 3) | 0) || 1, color: [o.c1, o.c2, o.c3][i % 3], additive: true, shrink: true });
    }
  }
  function fogField(S, dt, o) {
    const n = Math.round((o.rate || 16) * dt);
    for (let i = 0; i < n; i++) {
      S.p({ x: rnd(0, S.W), y: rnd(S.H * 0.4, S.H), vx: rnd(-10, 10), vy: -rnd(3, 12),
        life: rnd(0.7, 1.4), max: 1.4, size: (rnd(3, 6) | 0), color: Math.random() < 0.5 ? o.color : o.color2, additive: true, shrink: true });
    }
    // 떠오르는 작은 거품
    if (Math.random() < 0.5) S.p({ x: rnd(0, S.W), y: rnd(S.H * 0.6, S.H), vy: -rnd(10, 22), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: o.color, additive: true, shrink: true });
  }
  function sandField(S, dt, o) {
    const n = Math.round((o.rate || 60) * dt);
    for (let i = 0; i < n; i++) {
      const fromLeft = true;
      S.p({ x: rnd(-10, 0), y: rnd(S.H * 0.2, S.groundY + 4), vx: rnd(180, 320), vy: rnd(-12, 12),
        life: 0.7, max: 0.7, size: (rnd(1, 3) | 0) || 1, color: [o.c1, o.c2, o.c3][i % 3], streak: rnd(5, 11), fade: false });
    }
  }

  // ---- 공통 AoE 골격 ----
  function aoe(S, cfg) {
    cast(S); if (cfg.tint) S.tint(cfg.tint.c, cfg.tint.a, cfg.dur);
    const targets = S.targets();
    let t = 0; const next = targets.map(() => rnd(0.1, 0.5));
    return {
      update(dt) {
        t += dt;
        if (cfg.field) cfg.field(S, dt, t);
        if (cfg.ambient) cfg.ambient(S, dt, t);
        targets.forEach((e, i) => {
          next[i] -= dt;
          if (next[i] <= 0 && t < cfg.dur - 0.25) { next[i] = rnd(cfg.gap[0], cfg.gap[1]); cfg.strike(S, e, t); }
        });
      },
      done: (tt) => tt > cfg.dur,
    };
  }

  // 작은 임팩트 버스트
  function burst(S, x, y, cols, n, spd, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), g: opts.g || 0, drag: 0.92, life: rnd(0.2, 0.5), max: 0.5, size: opts.size || 2, color: cols[i % cols.length], shrink: true, additive: opts.additive }); }
  }

  const AOE = {
    /* 화살비 — 기존 "비"를 화살로. 물리 다단히트 (사냥꾼 시그니처) */
    arrowrain(S) {
      return aoe(S, {
        dur: 1.7, gap: [0.14, 0.32], tint: { c: '#0e1430', a: 0.18 },
        field: (s, dt) => rainField(s, dt, { rate: 60, vx: -40, vy: 300, size: 1, streak: 9, color: '#cfd8ec', head: true, headColor: '#fff0b8' }),
        strike: (s, e) => { burst(s, e.x + rnd(-5, 5), e.y - rnd(2, 14), ['#cfd8ec', '#b9b48f', '#fff0b8'], 7, 70, { g: 80 }); e.flinch = 3; e.tint = 0.4;
          // 박힌 화살 흔적
          s.p({ x: e.x + rnd(-6, 6), y: e.y - rnd(4, 16), vx: -30, vy: 220, life: 0.12, max: 0.12, size: 1, color: '#cfd8ec', streak: 8, head: true, headColor: '#fff0b8', fade: false }); },
      });
    },

    /* 천둥폭풍 — 기존 "천둥(storm)". 비 + 연속 낙뢰, 전체 다단 뇌전 */
    thunderstorm(S) {
      return aoe(S, {
        dur: 1.9, gap: [0.2, 0.45], tint: { c: '#0b1024', a: 0.3 },
        field: (s, dt) => rainField(s, dt, { rate: 55, vx: -22, vy: 300, size: 1, streak: 8, color: 'rgba(150,170,210,1)' }),
        ambient: (s, dt, t) => { if (Math.random() < 0.06) s.doFlash('#aab6e0', 0.12); },
        strike: (s, e) => {
          s.beam({ x1: e.x + rnd(-3, 3), y1: -2, x2: e.x, y2: e.y - 6, color: PAL.thunder, width: 2, jag: 6, life: 0.16, max: 0.16 });
          s.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: PAL.thunderP, width: 4, jag: 8, life: 0.12, max: 0.12 });
          s.doFlash('#dfe6ff', 0.5); s.doShake(3.5); e.flinch = 4; e.tint = 0.85;
          burst(s, e.x, e.y - 6, [PAL.thunder, PAL.thunderB, PAL.thunderP], 16, 110, { up: 18, additive: true });
        },
      });
    },

    /* 눈보라 — 기존 "눈" 격화 + 얼음 파편. 냉기 + 둔화 */
    blizzard(S) {
      return aoe(S, {
        dur: 2.0, gap: [0.22, 0.46], tint: { c: '#bfe6ff', a: 0.12 },
        field: (s, dt) => { snowField(s, dt, { rate: 70, color: PAL.iceW, color2: PAL.iceP }); rainField(s, dt, { rate: 16, vx: -30, vy: 200, size: 1, streak: 6, color: PAL.ice, additive: true }); },
        strike: (s, e) => {
          for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2), sp = rnd(40, 120); s.p({ x: e.x, y: e.y - 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 160, drag: 0.96, life: rnd(0.3, 0.6), max: 0.6, size: (rnd(1, 3) | 0) || 2, color: [PAL.iceW, PAL.iceP, PAL.ice][i % 3] }); }
          s.doFlash(PAL.iceW, 0.28); s.doShake(2); e.flinch = 3; e.tint = 0.7;
        },
      });
    },

    /* 화염폭풍 — 기존 "잿불" + 낙하 화염구. 화염 전체기 (기존 firestorm 강화판) */
    inferno(S) {
      return aoe(S, {
        dur: 1.9, gap: [0.16, 0.34], tint: { c: PAL.fireDeep, a: 0.28 },
        field: (s, dt) => emberField(s, dt, { rate: 40, c1: PAL.fireY, c2: PAL.fireR, c3: PAL.fireW }),
        ambient: (s, dt) => { if (Math.random() < 0.35) s.doFlash(PAL.fireY, 0.1); },
        strike: (s, e) => {
          // 낙하 화염구
          for (let k = 0; k < 6; k++) s.p({ x: e.x + rnd(-3, 3), y: e.y - 50 - k * 5, vy: 260, life: 0.2, max: 0.2, size: 3, color: [PAL.fireY, PAL.fireR, PAL.fireW][k % 3], shrink: true, additive: true });
          setTimeout(() => { burst(s, e.x, e.y - 6, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 16, 100, { up: 26, g: 40, additive: true }); s.doShake(2.5); }, 170);
          e.tint = 0.7; e.flinch = 3;
        },
      });
    },

    /* 독무 — 잿불 변형(부유 안개). 독 전체기 */
    venomcloud(S) {
      return aoe(S, {
        dur: 2.0, gap: [0.3, 0.55], tint: { c: '#163a18', a: 0.26 },
        field: (s, dt) => fogField(s, dt, { rate: 18, color: PAL.poison, color2: PAL.poisonD }),
        strike: (s, e) => {
          burst(s, e.x, e.y - 8, [PAL.poison, PAL.poisonD, PAL.healW], 12, 60, { up: 14, additive: true });
          for (let i = 0; i < 4; i++) s.p({ x: e.x + rnd(-6, 6), y: e.y - rnd(2, 14), vy: -rnd(8, 18), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: PAL.poison, additive: true, shrink: true });
          e.tint = 0.45;
        },
      });
    },

    /* 모래폭풍 — 가로로 휩쓰는 흙먼지(신규). 물리 + 명중↓ */
    sandstorm(S) {
      return aoe(S, {
        dur: 1.8, gap: [0.18, 0.4], tint: { c: '#3a2c14', a: 0.3 },
        field: (s, dt) => sandField(s, dt, { rate: 80, c1: PAL.earth, c2: PAL.dust, c3: PAL.earthD }),
        ambient: (s, dt) => { if (Math.random() < 0.5) s.doShake(1.2); },
        strike: (s, e) => {
          for (let i = 0; i < 8; i++) s.p({ x: e.x - 8, y: e.y - rnd(2, 18), vx: rnd(120, 240), vy: rnd(-20, 20), life: rnd(0.25, 0.5), max: 0.5, size: (rnd(1, 3) | 0) || 1, color: [PAL.earth, PAL.dust, PAL.earthD][i % 3], streak: rnd(4, 8), fade: false });
          e.flinch = 2; e.tint = 0.35;
        },
      });
    },
  };

  // 메타 (게임 밸런스 제안값 포함) — 모두 전체기 + 추천
  const AOE_META = [
    { id: 'arrowrain', name: '화살비', mp: 7, kind: '전체 · 물리', el: 'arrow', rec: true, from: '비', power: 9, note: '사냥꾼 시그니처 · 다단히트' },
    { id: 'thunderstorm', name: '천둥폭풍', mp: 10, kind: '전체 · 뇌전', el: 'thunder', rec: true, from: '천둥', power: 13, note: '연속 낙뢰 · 강한 섬광' },
    { id: 'blizzard', name: '눈보라', mp: 9, kind: '전체 · 냉기', el: 'ice', rec: true, from: '눈', power: 11, note: '냉기 + 둔화(민첩↓)' },
    { id: 'inferno', name: '화염폭풍', mp: 9, kind: '전체 · 화염', el: 'fire', rec: true, from: '잿불', power: 12, note: '잿불 배경 + 화염구 낙하' },
    { id: 'venomcloud', name: '독무', mp: 8, kind: '전체 · 독', el: 'poison', rec: true, from: '잿불(변형)', power: 7, note: '전체 독 부여' },
    { id: 'sandstorm', name: '모래폭풍', mp: 8, kind: '전체 · 물리', el: 'earth', rec: true, from: '신규', power: 8, note: '물리 + 명중률↓' },
  ];

  Object.assign(DEFS, AOE);
  AOE_META.forEach(m => { META.push(m); ALL_TARGET.add(m.id); });
  window.SpellFXDefs.AOE_META = AOE_META;
})();

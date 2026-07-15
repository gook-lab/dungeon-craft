/* ============================================================
   spellfx-duelist.js — 쌍검사(duelist) 직업기 + 필살기
   컨셉: 총·폭탄·투척의 현대 건슬링거. 빠른 글래스캐논.
   탄피·총구 화염·폭발·표창 등 "현대적 픽셀" 연출.
   window.SpellFXDefs.{DEFS,META,ALL_TARGET} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 3; };
  const muzzle = '#fff0b8', muzzleO = '#f0a040', smoke = '#46506a', smokeD = '#2a2438',
    steel = '#dfe4f2', steelD = '#9aa3c8', brass = '#c98b2c', fireR = '#e25563', fireY = '#f0c44c',
    blood = '#c0303a', bloodD = '#7a1820';

  // 출혈 표식 — 핏방울이 떨어지며 ▼ 표식
  function bleed(S, e) {
    for (let i = 0; i < 5; i++) S.p({ x: e.x + rnd(-7, 7), y: e.y - rnd(2, 14), vy: rnd(20, 50), g: 80, life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? blood : bloodD });
    S.floatSpr({ x: e.x, y: e.y - 18, vy: -10, life: 0.8, max: 0.8, draw: (g, s) => { g.globalAlpha = Math.min(1, s.life / s.max + 0.2); g.fillStyle = blood; g.fillRect(s.x - 0.5, s.y - 4, 1, 8); g.fillRect(s.x - 2, s.y + 1, 1, 1); g.fillRect(s.x + 1, s.y + 1, 1, 1); g.fillRect(s.x - 1, s.y + 2, 1, 1); g.fillRect(s.x, s.y + 2, 1, 1); g.globalAlpha = 1; } });
  }

  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.2, 0.5), max: 0.5, size: o.size || 2, color: cols[i % cols.length], shrink: o.shrink !== false, additive: o.additive }); }
  }
  // 총구 화염 + 탄환 + 탄피 배출
  function shoot(S, from, to, opt) {
    opt = opt || {};
    // 총구 화염
    S.p({ x: from.x, y: from.y, life: 0.08, max: 0.08, size: 4, color: muzzle, additive: true });
    S.p({ x: from.x + rnd(2, 6), y: from.y, life: 0.1, max: 0.1, size: 3, color: muzzleO, additive: true });
    // 탄환 트레이서
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    S.p({ x: from.x, y: from.y, vx: dx / d * 520, vy: dy / d * 520, life: d / 520, max: d / 520, size: 2, color: muzzle, streak: 13, head: true, headColor: '#fff', fade: false, additive: true });
    // 탄피 배출
    S.p({ x: from.x - 3, y: from.y - 2, vx: rnd(-30, -10), vy: -rnd(20, 50), g: 240, life: rnd(0.4, 0.7), max: 0.7, size: 2, color: brass });
    if (opt.smoke) S.p({ x: from.x + rnd(2, 8), y: from.y - rnd(0, 4), vy: -rnd(8, 18), life: rnd(0.4, 0.8), max: 0.8, size: 3, color: smoke, shrink: true });
  }
  function impact(S, x, y, big) {
    burst(S, x, y, [muzzle, '#fff', steel], big ? 16 : 8, big ? 130 : 90, { additive: true });
    if (big) burst(S, x, y, [smoke, smokeD], 6, 60, { up: 6 });
  }
  // 폭발 (작약탄/수류탄)
  function explode(S, x, y, scale) {
    scale = scale || 1;
    S.doFlash(fireY, 0.5 * scale); S.doShake(6 * scale);
    burst(S, x, y, [muzzle, fireY, fireR, '#fff'], Math.round(28 * scale), 180 * scale, { up: 14, g: 40, additive: true, size: 3 });
    burst(S, x, y, [smoke, smokeD, '#5a5060'], Math.round(12 * scale), 80, { up: 20 });
    S.floatSpr({ x, y, life: 0.35, max: 0.35, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = fireY; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 30 * scale, 0, 7); g.stroke(); g.globalAlpha = 1; } });
  }

  const DUEL = {
    /* 쾌속 사격 — 단일 권총 다단(4발). 빠른 연사 + 탄피 */
    quickdraw(S) {
      cast(S); const tgt = S.primary(); let t = 0, shots = 0; const from = () => ({ x: S.caster.x + 9, y: S.caster.y - 12 });
      return {
        update(dt) {
          t += dt;
          if (shots < 4 && t >= 0.12 + shots * 0.11) { shots++;
            const f = from(), to = { x: tgt.x, y: tgt.y - 9 + rnd(-6, 6) };
            shoot(S, f, to, { smoke: true });
            setTimeout(() => { impact(S, to.x, to.y); tgt.flinch = 3; tgt.tint = 0.5; S.doShake(2); }, 60);
          }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 헤드샷 — 단일 치명 단발. 조준선 → 강력한 한 발 */
    headshot(S) {
      cast(S); const tgt = S.primary(); let t = 0, fired = false; const from = { x: S.caster.x + 9, y: S.caster.y - 12 };
      return {
        update(dt) {
          t += dt;
          // 레이저 조준선
          if (t < 0.45) S.beam({ x1: from.x, y1: from.y, x2: tgt.x, y2: tgt.y - 11, color: fireR, width: 1, jag: 0, life: 0.06, max: 0.06 });
          if (t < 0.45 && Math.random() < 0.4) S.floatSpr({ x: tgt.x, y: tgt.y - 11, life: 0.05, max: 0.05, draw: (g, s) => { g.globalAlpha = 0.8; g.strokeStyle = fireR; g.lineWidth = 1; const k = 1 - t / 0.45; g.beginPath(); g.arc(s.x, s.y, 5 + k * 9, 0, 7); g.stroke(); g.globalAlpha = 1; } });
          if (!fired && t >= 0.45) { fired = true; shoot(S, from, { x: tgt.x, y: tgt.y - 11 }, { smoke: true });
            S.doFlash('#fff', 0.6); S.doShake(6); tgt.flinch = 6; tgt.tint = 0.9;
            burst(S, tgt.x, tgt.y - 11, ['#fff', muzzle, fireR, steel], 24, 170, { additive: true, size: 3 }); }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 작약탄 — 전체 폭발 AoE. 투척 → 착탄 대폭발 */
    fragbomb(S) {
      cast(S); const targets = S.targets(); let t = 0, thrown = false, blown = false;
      const apex = { x: (S.caster.x + (targets[0] ? targets[0].x : S.W * 0.7)) / 2, y: S.caster.y - 60 };
      const land = { x: targets.length > 1 ? (targets[0].x + targets[targets.length - 1].x) / 2 : (targets[0] ? targets[0].x : S.W * 0.7), y: S.groundY - 4 };
      const from = { x: S.caster.x + 7, y: S.caster.y - 13 };
      return {
        update(dt) {
          t += dt;
          // 투척 포물선 (폭탄 본체 + 도화선 불꽃)
          if (t < 0.45) { const k = t / 0.45; const x = from.x + (land.x - from.x) * k, y = from.y + (land.y - from.y) * k - Math.sin(k * Math.PI) * 50;
            S.p({ x, y, life: 0.12, max: 0.12, size: 4, color: smokeD });
            S.p({ x: x + rnd(-2, 2), y: y - rnd(2, 5), life: 0.2, max: 0.2, size: 2, color: Math.random() < 0.5 ? fireY : fireR, additive: true, shrink: true }); }
          if (!blown && t >= 0.45) { blown = true; explode(S, land.x, land.y, 1.2);
            targets.forEach(e => { e.flinch = 5; e.tint = 0.7; const dl = Math.abs(e.x - land.x); setTimeout(() => burst(S, e.x, e.y - 9, [fireY, fireR, '#fff'], 10, 110, { additive: true }), dl); }); }
          // 잔류 화상 불씨 (지속 화염 피해 암시)
          if (blown && t < 1.15 && Math.random() < 0.6) { const e = targets[(Math.random() * targets.length) | 0]; S.p({ x: e.x + rnd(-8, 8), y: e.y - rnd(0, 14), vy: -rnd(12, 28), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? fireY : fireR, additive: true, shrink: true }); }
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 표창 난사 — 단일 투척 다단(5연). 회전 표창이 빠르게 박힘 */
    shurikenflurry(S) {
      cast(S); const tgt = S.primary(); let t = 0, thrown = 0; const from = () => ({ x: S.caster.x + 8, y: S.caster.y - 12 });
      return {
        update(dt) {
          t += dt;
          if (thrown < 5 && t >= 0.1 + thrown * 0.09) { thrown++;
            const f = from(), to = { x: tgt.x, y: tgt.y - 9 + rnd(-7, 7) };
            const dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy) || 1;
            // 회전 표창 (스핀 스프라이트)
            S.floatSpr({ x: f.x, y: f.y, vx: dx / d * 360, vy: dy / d * 360, life: d / 360, max: d / 360, _sp: 0, draw: (g, s) => { s._sp += dt * 30; g.save(); g.translate(s.x, s.y); g.rotate(s._sp); g.fillStyle = steel; g.fillRect(-4, -1, 8, 2); g.fillRect(-1, -4, 2, 8); g.restore(); } });
            setTimeout(() => { impact(S, to.x, to.y); tgt.flinch = 3; tgt.tint = 0.5; }, (d / 360) * 1000);
          }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 산탄 — 전체 부채꼴 산탄. 근거리 샷건 펠릿이 퍼지며 출혈 */
    buckshot(S) {
      cast(S); const targets = S.targets(); let t = 0, fired = false;
      const fx = S.caster.x + 10, fy = S.caster.y - 12;
      return {
        update(dt) {
          t += dt;
          if (t < 0.25 && Math.random() < 0.5) S.p({ x: fx, y: fy, life: 0.1, max: 0.1, size: 2, color: muzzleO, additive: true });
          if (!fired && t >= 0.25) { fired = true;
            // 총구 대형 화염
            S.p({ x: fx, y: fy, life: 0.12, max: 0.12, size: 6, color: muzzle, additive: true });
            S.doFlash(muzzle, 0.4); S.doShake(5);
            // 부채꼴 펠릿 산탄 (앞쪽으로 넓게)
            for (let i = 0; i < 40; i++) { const a = rnd(-0.55, 0.55); const sp = rnd(180, 360);
              S.p({ x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.93, life: rnd(0.3, 0.6), max: 0.6, size: (rnd(1, 3) | 0) || 1, color: Math.random() < 0.5 ? steel : muzzle, streak: rnd(4, 9), head: true, headColor: '#fff', fade: false, additive: true }); }
            // 탄피 무더기 배출
            for (let i = 0; i < 4; i++) S.p({ x: fx - 3, y: fy - 2, vx: rnd(-40, -10), vy: -rnd(20, 50), g: 240, life: rnd(0.4, 0.7), max: 0.7, size: 2, color: brass });
            // 적별 다발 피격 + 출혈
            targets.forEach(e => { const dl = Math.abs(e.x - fx) * 0.9; setTimeout(() => { impact(S, e.x + rnd(-6, 6), e.y - rnd(2, 14), true); e.flinch = 4; e.tint = 0.6; bleed(S, e); }, dl); });
          }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 난자 — 단일 쌍검 교차 베기. 강력한 출혈(피분출) */
    rend(S) {
      cast(S); const tgt = S.primary(); let t = 0, hits = 0; const cx = tgt.x, cy = tgt.y - 9;
      const angs = [[-34, -20, 30, 12], [34, -20, -30, 12], [-30, -28, 34, 6]];
      return {
        update(dt) {
          t += dt;
          if (t < 0.2) S.caster.hop = 4;
          if (hits < 3 && t >= 0.2 + hits * 0.13) { const a = angs[hits]; hits++;
            // 쌍검 베기 선 (강철 → 핏빛)
            S.beam({ x1: cx + a[0], y1: cy + a[1], x2: cx + a[2], y2: cy + a[3], color: '#ffffff', width: 3, jag: 0, life: 0.13, max: 0.13 });
            S.beam({ x1: cx + a[0], y1: cy + a[1] + 2, x2: cx + a[2], y2: cy + a[3] + 2, color: blood, width: 2, jag: 0, life: 0.18, max: 0.18 });
            // 피 분출
            for (let i = 0; i < 8; i++) { const ba = rnd(-0.6, 0.6) + (a[0] < 0 ? 0 : Math.PI); S.p({ x: cx, y: cy, vx: Math.cos(ba) * rnd(40, 120), vy: Math.sin(ba) * rnd(40, 120) - 10, g: 180, life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? blood : bloodD }); }
            burst(S, cx, cy, [steel, '#fff', blood], 8, 100, { additive: true }); tgt.flinch = 4; tgt.tint = 0.6; S.doShake(3);
          }
          if (Math.abs(t - 0.6) < dt) { S.doFlash('#fff', 0.5); tgt.tint = 0.9; bleed(S, tgt); }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 연막 수류탄 — 자기 회피↑ + 적 명중↓. 연막탄 투척 → 연기 폭발 */
    smokegrenade(S) {
      cast(S); let t = 0, popped = false; const u = S.caster; const targets = S.targets();
      const land = { x: u.x + 18, y: S.groundY - 3 }; const from = { x: u.x + 7, y: u.y - 12 };
      return {
        update(dt) {
          t += dt;
          if (t < 0.35) { const k = t / 0.35; const x = from.x + (land.x - from.x) * k, y = from.y + (land.y - from.y) * k - Math.sin(k * Math.PI) * 26; S.p({ x, y, life: 0.12, max: 0.12, size: 3, color: smokeD }); }
          if (!popped && t >= 0.35) { popped = true; S.doShake(2);
            for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28, s = rnd(30, 90); S.p({ x: land.x, y: land.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 12, g: -8, drag: 0.9, life: rnd(0.7, 1.4), max: 1.4, size: (rnd(3, 6) | 0), color: Math.random() < 0.5 ? smoke : smokeD, shrink: true }); } }
          if (popped && t < 1.1 && Math.random() < 0.6) S.p({ x: land.x + rnd(-18, 18), y: land.y - rnd(0, 16), vy: -rnd(4, 14), life: rnd(0.5, 1), max: 1, size: (rnd(3, 6) | 0), color: smoke, shrink: true });
          if (t > 0.4 && t < 1.0) u.alpha = 0.4 + 0.4 * Math.sin(t * 18);
        },
        done: (tt) => { if (tt > 1.2) { S.caster.alpha = 1; return true; } return false; },
      };
    },

    /* ===== 필살기 ===== */
    /* 풀버스트 — 단일/전체 난사 피날레. 쌍권총 전탄 난사 → 작약탄 대폭발 */
    fullburst(S) {
      cast(S); const targets = S.targets(); const tgt = S.primary(); let t = 0, em = 0, fin = false;
      return {
        update(dt) {
          t += dt; em += dt;
          // 난사 (양손 번갈아)
          if (em > 0.045 && t < 0.95) { em = 0; const f = { x: S.caster.x + 9, y: S.caster.y - 12 + (Math.random() < 0.5 ? -2 : 3) };
            const e = targets[(Math.random() * targets.length) | 0]; const to = { x: e.x + rnd(-8, 8), y: e.y - 9 + rnd(-8, 8) };
            shoot(S, f, to); setTimeout(() => { impact(S, to.x, to.y); e.flinch = 3; e.tint = 0.6; }, 50); S.doShake(1.5); }
          // 피날레 작약탄 대폭발
          if (!fin && t >= 0.98) { fin = true;
            targets.forEach((e, i) => setTimeout(() => { explode(S, e.x, e.y - 9, 1.1); e.flinch = 6; e.tint = 1; }, i * 90)); }
        },
        done: (tt) => tt > 1.6,
      };
    },
  };

  const GRP = '쌍검사 · 건슬링거 (총·폭탄·투척)';
  const DUEL_META = [
    { id: 'quickdraw', name: '쾌속 사격', cost: 'MP 3', kind: '단일 · 다단(4)', el: 'phys', grp: GRP, caster: 'duelist', enemy: 'goblin', power: 7, from: '권총 4연사' },
    { id: 'headshot', name: '헤드샷', cost: 'MP 4', kind: '단일 · 치명 단발', el: 'phys', grp: GRP, caster: 'duelist', enemy: 'golem', power: 22, from: '조준선 → 치명 일격' },
    { id: 'fragbomb', name: '작약탄', cost: 'MP 6', kind: '전체 · 폭발', el: 'fire', grp: GRP, caster: 'duelist', enemy: 'goblin', aoe: true, power: 14, from: '폭탄 투척 → 대폭발 · 화상' },
    { id: 'shurikenflurry', name: '표창 난사', cost: 'MP 4', kind: '단일 · 투척 다단(5)', el: 'phys', grp: GRP, caster: 'duelist', enemy: 'golem', power: 6, from: '회전 표창 5연타' },
    { id: 'buckshot', name: '산탄', cost: 'MP 5', kind: '전체 · 근접 산탄', el: 'phys', grp: GRP, caster: 'duelist', enemy: 'goblin', aoe: true, power: 11, from: '부채꼴 샷건 → 출혈' },
    { id: 'rend', name: '난자', cost: 'MP 4', kind: '단일 · 쌍검 다단(3)', el: 'phys', grp: GRP, caster: 'duelist', enemy: 'golem', power: 9, from: '쌍검 교차 베기 → 강한 출혈' },
    { id: 'smokegrenade', name: '연막 수류탄', cost: 'MP 3', kind: '자기 · 회피↑', el: 'shield', grp: GRP, caster: 'duelist', enemy: 'goblin', self: true, from: '연막 → 회피↑·적 명중↓' },
    { id: 'fullburst', name: '풀버스트', cost: 'MP 12', kind: '단일 필살 · 난사', el: 'fire', grp: GRP, cls: '쌍검사', caster: 'duelist', enemy: 'skeleton_king', ult: true, aoe: true, power: 40, from: '쌍권총 전탄 난사 → 작약탄 대폭발' },
  ];

  Object.assign(DEFS, DUEL);
  DUEL_META.forEach(m => { META.push(m); if (m.aoe) ALL_TARGET.add(m.id); });
  window.SpellFXDefs.DUEL_META = DUEL_META;
})();

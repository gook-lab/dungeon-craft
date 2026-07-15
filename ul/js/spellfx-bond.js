/* ============================================================
   spellfx-bond.js — 인연공격(Bond Strike / 운명협동스킬) 이펙트 3종
   game/content/bondSkills.js 의 BOND_SKILLS와 1:1 매핑:
     duo_oath_charge     맹세의 돌격   기사×전사   단일 성속성 강타
     duo_hallowed_volley 축복받은 연사 사냥꾼×기사 전체 성속성 3연사
     duo_pincer          협공         사냥꾼×전사 단일 2연타
     duo_skyjudgment     천공 심판     기사×법사   전체 성+비전 빛기둥
     duo_blazingblade    작열참       전사×법사   단일 화염 대검 강타
     duo_arcanevolley    마탄 3연사    사냥꾼×법사  단일 관통(뇌전) 3연사
   컷신(2인 포트레이트)과 조합해 재생된다.
   window.SpellFXDefs.{DEFS,META} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };
  const gold = '#ffd766', goldW = '#fff0b8', goldD = '#c98b2c', steel = '#dfe4f2', white = '#ffffff';

  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.25, 0.6), max: 0.6, size: o.size || 2, color: cols[i % cols.length], shrink: o.shrink !== false, additive: o.additive }); }
  }

  const BOND = {
    /* 맹세의 돌격 — 기사 축복(골드 오라) → 전사 돌격 십자 강타 → 성속성 폭발 */
    duo_oath_charge(S) {
      cast(S); const tgt = S.primary(); let t = 0, blessed = false, slam = false;
      const cx = tgt.x, cy = tgt.y - 9;
      return {
        update(dt) {
          t += dt;
          // 축복 단계: 캐스터/타겟에 골드 룬 수렴
          if (t < 0.4) { if (Math.random() < 0.8) { const a = Math.random() * 6.28, r = 30 - t * 40; S.p({ x: cx + Math.cos(a) * Math.max(4, r), y: cy + Math.sin(a) * Math.max(4, r), vx: -Math.cos(a) * 26, vy: -Math.sin(a) * 26, life: 0.25, max: 0.25, size: 2, color: Math.random() < 0.5 ? gold : goldW, additive: true, shrink: true }); } }
          if (!blessed && t >= 0.38) { blessed = true; S.doFlash(goldW, 0.35);
            S.floatSpr({ x: cx, y: cy, life: 0.4, max: 0.4, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = gold; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 6 + k * 22, 0, 7); g.stroke(); g.globalAlpha = 1; } }); }
          // 돌격 강타: 거대 십자 베기
          if (!slam && t >= 0.55) { slam = true; S.doFlash(white, 0.9); S.doShake(8); tgt.flinch = 6; tgt.tint = 1;
            S.beam({ x1: cx - 36, y1: cy - 30, x2: cx + 36, y2: cy + 14, color: goldW, width: 5, jag: 0, life: 0.24, max: 0.24 });
            S.beam({ x1: cx + 36, y1: cy - 30, x2: cx - 36, y2: cy + 14, color: gold, width: 4, jag: 0, life: 0.26, max: 0.26 });
            S.beam({ x1: cx, y1: cy - 40, x2: cx, y2: cy + 16, color: goldW, width: 3, jag: 0, life: 0.2, max: 0.2 });
            burst(S, cx, cy, [goldW, gold, goldD, steel, white], 42, 200, { up: 14, additive: true, size: 3 });
            for (let i = 0; i < 14; i++) S.p({ x: cx + rnd(-8, 8), y: cy, vy: -rnd(40, 110), life: rnd(0.5, 1), max: 1, size: 2, color: gold, additive: true, shrink: true });
          }
        },
        done: (tt) => tt > 1.3,
      };
    },

    /* 축복받은 연사 — 골든 화살이 전체 적에게 3연사(관통) */
    duo_hallowed_volley(S) {
      cast(S); const targets = S.targets(); let t = 0, wave = 0; const fx = S.caster.x + 7, fy = S.caster.y - 12;
      return {
        update(dt) {
          t += dt;
          if (t < 0.3 && Math.random() < 0.7) S.p({ x: fx + rnd(-4, 4), y: fy + rnd(-4, 4), life: 0.25, max: 0.25, size: 2, color: Math.random() < 0.5 ? gold : goldW, additive: true, shrink: true });
          if (wave < 3 && t >= 0.3 + wave * 0.22) { wave++;
            targets.forEach((e, i) => {
              setTimeout(() => {
                // 관통 골드 화살 휘선
                S.beam({ x1: fx, y1: fy, x2: e.x, y2: e.y - 9, color: goldW, width: 2, jag: 0, life: 0.14, max: 0.14 });
                S.p({ x: e.x, y: e.y - 9, vx: 200, vy: 0, life: 0.14, max: 0.14, size: 1, color: gold, streak: 12, head: true, headColor: goldW, fade: false, additive: true });
                burst(S, e.x, e.y - 9, [goldW, gold, white], 9, 100, { additive: true });
                e.flinch = 3; e.tint = 0.6;
              }, i * 40);
            });
            S.doFlash(goldW, 0.28); S.doShake(2.5);
          }
        },
        done: (tt) => tt > 1.3,
      };
    },

    /* 협공 — 전사 견제(스틸 강타) → 사냥꾼 빈틈 2연타 */
    duo_pincer(S) {
      cast(S); const tgt = S.primary(); let t = 0, slam = false, h1 = false, h2 = false;
      const cx = tgt.x, cy = tgt.y - 9;
      return {
        update(dt) {
          t += dt;
          if (t < 0.25) S.caster.hop = 4;
          // 전사 견제 강타 (왼쪽에서)
          if (!slam && t >= 0.22) { slam = true; S.beam({ x1: cx - 34, y1: cy - 18, x2: cx + 10, y2: cy + 8, color: steel, width: 3, jag: 0, life: 0.14, max: 0.14 });
            burst(S, cx, cy, [steel, white, PAL.dust], 12, 90, { additive: true }); S.doShake(3); tgt.flinch = 3; tgt.tint = 0.5; }
          // 사냥꾼 빈틈 일격 ①
          if (!h1 && t >= 0.5) { h1 = true; S.beam({ x1: cx + 30, y1: cy - 22, x2: cx - 14, y2: cy + 6, color: goldW, width: 2, jag: 0, life: 0.14, max: 0.14 });
            burst(S, cx, cy - 4, [goldW, gold, white], 12, 110, { additive: true }); S.doShake(3); tgt.flinch = 4; }
          // ② 마무리
          if (!h2 && t >= 0.7) { h2 = true; S.doFlash('#fff6e0', 0.55); S.doShake(6); tgt.flinch = 5; tgt.tint = 0.9;
            S.beam({ x1: cx - 30, y1: cy - 20, x2: cx + 30, y2: cy + 10, color: white, width: 2, jag: 0, life: 0.16, max: 0.16 });
            burst(S, cx, cy, [goldW, gold, steel, white], 26, 160, { additive: true, size: 2 }); }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 천공 심판 — 기사×법사: 성+비전 광역. 하늘에서 골드·보라 빛기둥이 전체에 강림 */
    duo_skyjudgment(S) {
      cast(S); const targets = S.targets(); let t = 0; const struck = targets.map(() => false);
      const holy = '#ffd766', holyW = '#fff0b8', arc = '#b483f0', arcW = '#e6dcff';
      return {
        update(dt) {
          t += dt;
          // 시전 수렴 (양 캐스터 색)
          if (t < 0.4 && Math.random() < 0.8) S.p({ x: S.caster.x + rnd(-8, 8), y: S.caster.y - rnd(2, 16), vy: -rnd(16, 40), life: 0.4, max: 0.4, size: 2, color: Math.random() < 0.5 ? holy : arc, additive: true, shrink: true });
          targets.forEach((e, i) => {
            const at = 0.4 + i * 0.16;
            if (!struck[i] && t >= at) { struck[i] = true;
              S.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: holyW, width: rnd(5, 8), jag: 0, life: 0.12, max: 0.12 });
              S.beam({ x1: e.x + rnd(-4, 4), y1: -2, x2: e.x, y2: e.y - 6, color: arc, width: rnd(2, 4), jag: 0, life: 0.1, max: 0.1 });
              S.doFlash(i === 0 ? holyW : arcW, 0.4); S.doShake(3.5); e.flinch = 5; e.tint = 1;
              burst(S, e.x, e.y - 8, [holyW, holy, arc, arcW], 22, 130, { up: 18, additive: true });
              S.floatSpr({ x: e.x, y: e.y - 8, life: 0.4, max: 0.4, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = arc; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 24, 0, 7); g.stroke(); g.globalAlpha = 1; } });
            }
          });
        },
        done: (tt) => tt > (0.4 + targets.length * 0.16 + 0.7),
      };
    },

    /* 작열참 — 전사×법사: 강철+화염 단일. 화염 두른 강철 대검 강타 */
    duo_blazingblade(S) {
      cast(S); const tgt = S.primary(); let t = 0, charged = false, slam = false;
      const cx = tgt.x, cy = tgt.y - 9; const fR = '#e25563', fY = '#f0c44c', fW = '#fff0b8', st = '#dfe4f2';
      return {
        update(dt) {
          t += dt;
          // 검에 화염 충전 (캐스터 위)
          if (t < 0.45) { S.caster.hop = 4; if (Math.random() < 0.85) { const a = Math.random() * 6.28, r = rnd(6, 18); S.p({ x: S.caster.x + 4 + Math.cos(a) * r, y: S.caster.y - 14 + Math.sin(a) * r, vx: -Math.cos(a) * r, vy: -Math.sin(a) * r - 8, life: 0.4, max: 0.4, size: 2, color: [fY, fR, fW][(rnd(0, 3) | 0)], additive: true, shrink: true }); } }
          if (!charged && t >= 0.42) { charged = true; S.doFlash(fY, 0.3); }
          // 작열 대검 내려긋기
          if (!slam && t >= 0.58) { slam = true; S.doFlash(fW, 0.9); S.doShake(8); tgt.flinch = 6; tgt.tint = 1; tgt.tintColor = '#e25563';
            // 강철 검신 + 화염 궤적
            S.beam({ x1: cx - 30, y1: cy - 38, x2: cx + 24, y2: cy + 12, color: st, width: 5, jag: 0, life: 0.22, max: 0.22 });
            S.beam({ x1: cx - 30, y1: cy - 34, x2: cx + 24, y2: cy + 16, color: fY, width: 3, jag: 0, life: 0.24, max: 0.24 });
            S.beam({ x1: cx - 28, y1: cy - 30, x2: cx + 26, y2: cy + 18, color: fR, width: 2, jag: 0, life: 0.26, max: 0.26 });
            burst(S, cx, cy, [fW, fY, fR, st, '#fff'], 40, 200, { up: 16, g: 30, additive: true, size: 3 });
            for (let i = 0; i < 14; i++) S.p({ x: cx + rnd(-8, 8), y: cy, vy: -rnd(40, 110), life: rnd(0.5, 1), max: 1, size: 2, color: [fR, fY][i % 2], additive: true, shrink: true });
          }
        },
        done: (tt) => { if (tt > 1.3) { tgt.tintColor = null; return true; } return false; },
      };
    },

    /* 마탄 3연사 — 사냥꾼×법사: 화살+비전 단일 관통. 비전 마탄 3연발(뇌전 관통) */
    duo_arcanevolley(S) {
      cast(S); const tgt = S.primary(); let t = 0, fired = 0; const fx = S.caster.x + 7, fy = S.caster.y - 12;
      const arc = '#b483f0', arcW = '#e6dcff', th = '#fff0b8', thB = '#9ad6ff';
      return {
        update(dt) {
          t += dt;
          if (t < 0.3 && Math.random() < 0.7) S.p({ x: fx + rnd(-4, 4), y: fy + rnd(-4, 4), life: 0.25, max: 0.25, size: 2, color: Math.random() < 0.5 ? arc : th, additive: true, shrink: true });
          if (fired < 3 && t >= 0.3 + fired * 0.18) { fired++;
            // 비전 마탄: 관통 휘선 + 뇌전 지그재그
            S.beam({ x1: fx, y1: fy, x2: S.W + 10, y2: tgt.y - 9 + rnd(-4, 4), color: arcW, width: 2, jag: 0, life: 0.16, max: 0.16 });
            S.beam({ x1: tgt.x, y1: tgt.y - 9, x2: S.W + 6, y2: tgt.y - 9, color: th, width: 1, jag: 4, life: 0.12, max: 0.12 });
            S.p({ x: tgt.x, y: tgt.y - 9, vx: 280, vy: 0, life: 0.16, max: 0.16, size: 1, color: arc, streak: 14, head: true, headColor: arcW, fade: false, additive: true });
            burst(S, tgt.x, tgt.y - 9, [arcW, arc, th, thB], 14, 120, { additive: true });
            S.doFlash(arcW, 0.3); S.doShake(3); tgt.flinch = 4; tgt.tint = 0.8; tgt.tintColor = '#b483f0';
          }
        },
        done: (tt) => { if (tt > 1.2) { tgt.tintColor = null; return true; } return false; },
      };
    },

    /* ===== 트리플 인연기 (3인) ===== */
    /* 삼위 강타 — 기사×전사×법사: 강철 돌격 → 비전 폭발 → 신성 빛기둥. 단일 초고화력 */
    tri_trinity(S) {
      cast(S); const tgt = S.primary(); let t = 0, s1 = false, s2 = false, s3 = false;
      const cx = tgt.x, cy = tgt.y - 9; const st = '#dfe4f2', arc = '#b483f0', arcW = '#e6dcff', holy = '#ffd766', holyW = '#fff0b8';
      return {
        update(dt) {
          t += dt;
          if (t < 0.3 && Math.random() < 0.7) S.p({ x: S.caster.x + rnd(-8, 8), y: S.caster.y - rnd(2, 16), vy: -rnd(16, 40), life: 0.4, max: 0.4, size: 2, color: [st, arc, holy][(rnd(0, 3) | 0)], additive: true, shrink: true });
          if (!s1 && t >= 0.3) { s1 = true; S.beam({ x1: cx - 34, y1: cy - 20, x2: cx + 18, y2: cy + 8, color: st, width: 4, jag: 0, life: 0.16, max: 0.16 }); burst(S, cx, cy, [st, '#fff'], 14, 110, { additive: true }); S.doShake(3); tgt.flinch = 4; tgt.tint = 0.6; }
          if (!s2 && t >= 0.55) { s2 = true; S.doFlash(arcW, 0.45); S.doShake(4); tgt.tint = 0.8; tgt.tintColor = '#b483f0';
            burst(S, cx, cy, [arcW, arc, '#fff'], 22, 150, { additive: true, size: 2 });
            S.floatSpr({ x: cx, y: cy, life: 0.4, max: 0.4, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = arc; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 30, 0, 7); g.stroke(); g.globalAlpha = 1; } }); }
          if (!s3 && t >= 0.82) { s3 = true; S.doFlash(holyW, 0.92); S.doShake(8); tgt.flinch = 6; tgt.tint = 1; tgt.tintColor = null;
            S.beam({ x1: cx, y1: -2, x2: cx, y2: cy + 8, color: holyW, width: 8, jag: 0, life: 0.26, max: 0.26 });
            S.beam({ x1: cx, y1: -2, x2: cx, y2: cy + 8, color: holy, width: 4, jag: 0, life: 0.22, max: 0.22 });
            burst(S, cx, cy, [holyW, holy, arc, st, '#fff'], 46, 220, { up: 18, additive: true, size: 3 });
            for (let i = 0; i < 16; i++) S.p({ x: cx + rnd(-10, 10), y: cy, vy: -rnd(40, 120), life: rnd(0.5, 1), max: 1, size: 2, color: [holy, arc, st][i % 3], additive: true, shrink: true }); }
        },
        done: (tt) => { if (tt > 1.4) { tgt.tintColor = null; return true; } return false; },
      };
    },

    /* 사냥의 결속 — 기사×사냥꾼×전사: 물리 3인. 전체 견제 다단 → 집중 일격 */
    tri_huntbond(S) {
      cast(S); const targets = S.targets(); let t = 0, volley = 0, finish = false; const fx = S.caster.x + 7, fy = S.caster.y - 12;
      const gold = '#ffd766', goldW = '#fff0b8', st = '#dfe4f2';
      return {
        update(dt) {
          t += dt;
          if (volley < 4 && t >= 0.2 + volley * 0.13) { volley++;
            targets.forEach((e, i) => setTimeout(() => { S.beam({ x1: fx, y1: fy, x2: e.x, y2: e.y - 9, color: goldW, width: 2, jag: 0, life: 0.12, max: 0.12 }); burst(S, e.x, e.y - 9, [gold, st, '#fff'], 7, 90, { additive: true }); e.flinch = 3; e.tint = 0.5; }, i * 35));
            S.doShake(2);
          }
          if (!finish && t >= 0.85) { finish = true; const tg = targets[0]; S.doFlash(goldW, 0.7); S.doShake(7); tg.flinch = 6; tg.tint = 1;
            S.beam({ x1: tg.x - 30, y1: tg.y - 24, x2: tg.x + 30, y2: tg.y + 10, color: '#fff', width: 3, jag: 0, life: 0.18, max: 0.18 });
            S.beam({ x1: tg.x + 30, y1: tg.y - 24, x2: tg.x - 30, y2: tg.y + 10, color: gold, width: 2, jag: 0, life: 0.2, max: 0.2 });
            burst(S, tg.x, tg.y - 9, [goldW, gold, st, '#fff'], 30, 170, { additive: true, size: 2 }); }
        },
        done: (tt) => tt > 1.3,
      };
    },

    /* ===== 쌍검사 인연기 (듀오 3쌍) ===== */
    /* 강철 폭풍 — 쌍검사×전사: 전사 강타로 묶고 쌍검사 난사. 단일 물리 다단 */
    duo_steelstorm(S) {
      cast(S); const tgt = S.primary(); let t = 0, slam = false, em = 0; const cx = tgt.x, cy = tgt.y - 9;
      const muzzle = '#fff0b8', steel = '#dfe4f2';
      return {
        update(dt) {
          t += dt; em += dt;
          // 전사 견제 강타
          if (!slam && t >= 0.22) { slam = true; S.beam({ x1: cx - 34, y1: cy - 18, x2: cx + 10, y2: cy + 8, color: steel, width: 3, jag: 0, life: 0.14, max: 0.14 }); burst(S, cx, cy, [steel, '#fff'], 12, 90, { additive: true }); S.doShake(3); tgt.flinch = 3; tgt.tint = 0.5; }
          // 쌍검사 난사 (빈틈에)
          if (t >= 0.4 && t < 0.95 && em > 0.07) { em = 0; const f = { x: S.caster.x + 9, y: S.caster.y - 12 + rnd(-3, 3) };
            const dx = cx - f.x, dy = (cy + rnd(-8, 8)) - f.y, d = Math.hypot(dx, dy) || 1;
            S.p({ x: f.x, y: f.y, life: 0.07, max: 0.07, size: 4, color: muzzle, additive: true });
            S.p({ x: f.x, y: f.y, vx: dx / d * 520, vy: dy / d * 520, life: d / 520, max: d / 520, size: 2, color: muzzle, streak: 12, head: true, headColor: '#fff', fade: false, additive: true });
            burst(S, cx + rnd(-6, 6), cy + rnd(-6, 6), [muzzle, '#fff', steel], 6, 90, { additive: true }); tgt.flinch = 3; S.doShake(1.5); }
          if (Math.abs(t - 0.95) < dt) { S.doFlash('#fff', 0.5); S.doShake(5); tgt.tint = 0.9;
            burst(S, cx, cy, [muzzle, '#fff', steel], 22, 160, { additive: true, size: 2 }); }
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 소이탄 연격 — 쌍검사×법사: 법사 화염을 두른 작약탄 난사. 전체 화염 폭발 */
    duo_incendiary(S) {
      cast(S); const targets = S.targets(); let t = 0, em = 0; S.tint('#2a1206', 0.2, 1.4);
      const fireR = '#e25563', fireY = '#f0c44c', muzzle = '#fff0b8';
      return {
        update(dt) {
          t += dt; em += dt;
          // 법사 화염 충전(캐스터)
          if (t < 0.35 && Math.random() < 0.8) S.p({ x: S.caster.x + rnd(-6, 8), y: S.caster.y - rnd(8, 18), vy: -rnd(10, 30), life: 0.4, max: 0.4, size: 2, color: Math.random() < 0.5 ? fireR : fireY, additive: true, shrink: true });
          // 소이 작약탄 난사 → 적별 폭발
          if (t >= 0.35 && em > 0.13 && t < 1.05) { em = 0; const e = targets[(Math.random() * targets.length) | 0];
            const f = { x: S.caster.x + 9, y: S.caster.y - 12 };
            S.p({ x: f.x, y: f.y, vx: (e.x - f.x) * 3, vy: (e.y - 9 - f.y) * 3, life: 0.18, max: 0.18, size: 3, color: fireY, additive: true, shrink: true });
            setTimeout(() => { S.doFlash(fireY, 0.4); S.doShake(4); burst(S, e.x, e.y - 9, [muzzle, fireY, fireR, '#fff'], 16, 140, { up: 10, additive: true, size: 2 }); e.flinch = 4; e.tint = 0.8; e.tintColor = '#e25563'; }, 70); }
        },
        done: (tt) => { if (tt > 1.3) { targets.forEach(e => e.tintColor = null); return true; } return false; },
      };
    },

    /* 십자포화 — 쌍검사×사냥꾼: 양쪽에서 탄환·화살 교차 집중사. 단일 다단 */
    duo_crossfire(S) {
      cast(S); const tgt = S.primary(); let t = 0, em = 0, fin = false; const cx = tgt.x, cy = tgt.y - 9;
      const muzzle = '#fff0b8', gold = '#ffd766', goldW = '#fff0b8';
      return {
        update(dt) {
          t += dt; em += dt;
          // 좌(쌍검사 총)·우(사냥꾼 화살) 교차 사격
          if (em > 0.08 && t < 0.95) { em = 0;
            const left = Math.random() < 0.5;
            const f = left ? { x: cx - 70, y: cy + rnd(-6, 6) } : { x: cx + 70, y: cy + rnd(-6, 6) };
            const col = left ? muzzle : gold;
            const dx = cx - f.x, dy = (cy + rnd(-4, 4)) - f.y, d = Math.hypot(dx, dy) || 1;
            S.p({ x: f.x, y: f.y, vx: dx / d * 480, vy: dy / d * 480, life: d / 480, max: d / 480, size: 2, color: col, streak: 12, head: true, headColor: '#fff', fade: false, additive: true });
            burst(S, cx + rnd(-5, 5), cy + rnd(-5, 5), [col, '#fff'], 6, 90, { additive: true }); tgt.flinch = 3; tgt.tint = 0.55; S.doShake(1.6); }
          if (!fin && t >= 0.95) { fin = true; S.doFlash(goldW, 0.55); S.doShake(6); tgt.flinch = 6; tgt.tint = 1;
            burst(S, cx, cy, [muzzle, gold, '#fff', '#dfe4f2'], 28, 170, { additive: true, size: 3 }); }
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* ===== 쿼드 인연기 (4인 최종 합동기) ===== */
    /* 운명의 결전 — 4인 전원: 4색 수렴 → 사방 강타 → 전 원소 대붕괴. 전체 최강기 */
    quad_finale(S) {
      cast(S); const targets = S.targets(); let t = 0, boom = false;
      const ELC = ['#dfe4f2', '#b483f0', '#ffd766', '#e25563', '#56a8e8', '#9ad94f'];
      return {
        update(dt) {
          t += dt;
          if (t < 0.5) { S.tint('#0a0816', 0.32, 0.5); for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = 40 - t * 56, cc = ELC[(Math.random() * ELC.length) | 0]; targets.forEach(e => S.p({ x: e.x + Math.cos(a) * Math.max(4, r), y: e.y - 9 + Math.sin(a) * Math.max(4, r), vx: -Math.cos(a) * 26, vy: -Math.sin(a) * 26, life: 0.25, max: 0.25, size: 2, color: cc, additive: true, shrink: true })); } }
          if (t >= 0.45 && t < 0.95) { targets.forEach((e) => { if (Math.random() < 0.5) return; const cc = ELC[(Math.random() * ELC.length) | 0], a = Math.random() * 6.28, R = 30;
            S.beam({ x1: e.x + Math.cos(a) * R, y1: e.y - 9 + Math.sin(a) * R, x2: e.x, y2: e.y - 9, color: cc, width: rnd(2, 4), jag: 0, life: 0.1, max: 0.1 }); e.flinch = 3; e.tint = 0.7; });
            if (Math.random() < 0.5) S.doFlash(ELC[(Math.random() * ELC.length) | 0], 0.16); S.doShake(3.5); }
          if (!boom && t >= 0.95) { boom = true; S.doFlash('#ffffff', 0.98); S.doShake(10);
            targets.forEach(e => { e.flinch = 6; e.tint = 1;
              ELC.forEach((c, i) => burst(S, e.x, e.y - 9, [c, '#fff'], 10, 150 + i * 10, { additive: true, size: 3, up: 8 }));
              [0, 0.06, 0.12].forEach(dl => S.floatSpr({ x: e.x, y: e.y - 9, life: 0.6 - dl, max: 0.6, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = '#fff0b8'; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 54, 0, 7); g.stroke(); g.globalAlpha = 1; } })); }); }
          if (t > 0.95 && t < 1.4) targets.forEach(e => { if (Math.random() < 0.3) S.p({ x: e.x + rnd(-12, 12), y: e.y - 9, vy: -rnd(40, 120), life: rnd(0.5, 1), max: 1, size: 2, color: ELC[(Math.random() * ELC.length) | 0], additive: true, shrink: true }); });
        },
        done: (tt) => tt > 1.7,
      };
    },
  };

  const GRP = '운명 · 인연공격 (협동)';
  const BOND_META = [
    { id: 'duo_oath_charge', name: '맹세의 돌격', cost: '운명 3', kind: '인연 · 단일 성속성', el: 'holy', grp: GRP, bond: true, pair: ['knight', 'warrior'], caster: 'knight', enemy: 'skeleton_king', power: 34, from: '기사 축복 + 전사 돌격 → 십자 강타' },
    { id: 'duo_hallowed_volley', name: '축복받은 연사', cost: '운명 3', kind: '인연 · 전체 성속성', el: 'holy', grp: GRP, bond: true, pair: ['huntress', 'knight'], caster: 'huntress', enemy: 'goblin', aoe: true, power: 16, from: '축복받은 화살 3연사(관통)' },
    { id: 'duo_pincer', name: '협공', cost: '운명 3', kind: '인연 · 단일 2연타', el: 'phys', grp: GRP, bond: true, pair: ['huntress', 'warrior'], caster: 'warrior', enemy: 'golem', power: 24, from: '전사 견제 → 사냥꾼 일격' },
    { id: 'duo_skyjudgment', name: '천공 심판', cost: '운명 3', kind: '인연 · 전체 성+비전', el: 'holy', grp: GRP, bond: true, pair: ['knight', 'mage'], caster: 'knight', enemy: 'skeleton_king', aoe: true, power: 20, from: '기사 신성 + 법사 비전 → 광역 빛기둥' },
    { id: 'duo_blazingblade', name: '작열참', cost: '운명 3', kind: '인연 · 단일 화염', el: 'fire', grp: GRP, bond: true, pair: ['warrior', 'mage'], caster: 'warrior', enemy: 'golem', power: 36, from: '전사 강철 + 법사 화염 → 작열 대검 강타' },
    { id: 'duo_arcanevolley', name: '마탄 3연사', cost: '운명 3', kind: '인연 · 단일 관통(뇌전)', el: 'thunder', grp: GRP, bond: true, pair: ['huntress', 'mage'], caster: 'huntress', enemy: 'golem', power: 14, from: '사냥꾼 화살 + 법사 비전 → 마탄 3연사(관통)' },
    { id: 'duo_steelstorm', name: '강철 폭풍', cost: '운명 3', kind: '인연 · 단일 물리 다단', el: 'phys', grp: GRP, bond: true, pair: ['duelist', 'warrior'], caster: 'duelist', enemy: 'golem', power: 26, from: '전사 견제 + 쌍검사 난사' },
    { id: 'duo_incendiary', name: '소이탄 연격', cost: '운명 3', kind: '인연 · 전체 화염', el: 'fire', grp: GRP, bond: true, pair: ['duelist', 'mage'], caster: 'duelist', enemy: 'goblin', aoe: true, power: 18, from: '법사 화염 + 쌍검사 작약탄 난사' },
    { id: 'duo_crossfire', name: '십자포화', cost: '운명 3', kind: '인연 · 단일 다단', el: 'phys', grp: GRP, bond: true, pair: ['duelist', 'huntress'], caster: 'duelist', enemy: 'skeleton_king', power: 20, from: '총·화살 교차 집중사' },
    { id: 'tri_trinity', name: '삼위 강타', cost: '운명 5', kind: '트리플 · 단일 초고화력', el: 'holy', grp: GRP, bond: true, pair: ['knight', 'warrior', 'mage'], caster: 'knight', enemy: 'skeleton_king', power: 52, from: '강철 돌격 → 비전 폭발 → 신성 빛기둥' },
    { id: 'tri_huntbond', name: '사냥의 결속', cost: '운명 5', kind: '트리플 · 전체+집중', el: 'phys', grp: GRP, bond: true, pair: ['knight', 'huntress', 'warrior'], caster: 'huntress', enemy: 'goblin', aoe: true, power: 30, from: '전체 견제 다단 → 집중 일격' },
    { id: 'quad_finale', name: '운명의 결전', cost: '운명 8', kind: '쿼드 · 전체 최종기', el: 'arcane', grp: GRP, bond: true, pair: ['knight', 'warrior', 'mage', 'huntress'], caster: 'knight', enemy: 'skeleton_king', aoe: true, power: 60, from: '4인 사방 강타 → 전 원소 대붕괴' },
  ];

  Object.assign(DEFS, BOND);
  BOND_META.forEach(m => { META.push(m); if (m.aoe) ALL_TARGET.add(m.id); });
  window.SpellFXDefs.BOND_META = BOND_META;
})();

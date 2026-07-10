/* ============================================================
   spellfx-class.js — 클래스별 단일 필살기 (화려한 연출)
   나이트(성검 강타) · 전사(무쌍난무) · 사냥꾼(별빛 연사) · 마법사(대붕괴)
   window.SpellFXDefs.{DEFS,META} 에 병합. (단일기 — ALL_TARGET 제외)
   ============================================================ */
(function () {
  const { DEFS, META, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };
  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.25, 0.6), max: 0.6, size: o.size || 2, color: cols[i % cols.length], shrink: true, additive: o.additive }); }
  }

  // 거대 성검 스프라이트 (tip이 (x,y), 위로 뻗음)
  function drawBlade(g, x, y, alpha) {
    g.globalAlpha = alpha;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,240,184,0.35)'; g.fillRect(x - 5, y - 40, 10, 44); // 글로우
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = alpha;
    g.fillStyle = '#fff0b8'; g.fillRect(x - 2, y - 38, 4, 38);   // 검신
    g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 36, 2, 34);   // 하이라이트
    g.fillStyle = '#ffd766'; g.fillRect(x - 9, y - 30, 18, 3);   // 가드
    g.fillStyle = '#c98b2c'; g.fillRect(x - 1, y - 44, 2, 8);    // 자루
    g.fillStyle = '#fff0b8'; g.fillRect(x - 3, y - 46, 6, 3);    // 폼멜
    g.globalAlpha = 1;
  }

  const CLASS = {
    /* 나이트 — 성검 강타: 거대 성검 강림 → 십자 폭발 */
    holyblade(S) {
      cast(S); const tgt = S.primary(); let t = 0, sword = false, slam = false;
      return {
        update(dt) {
          t += dt;
          if (t < 0.45) { S.tint('#2e2408', 0.12, 0.45); if (Math.random() < 0.85) { const a = Math.random() * 6.28, r = rnd(6, 20); S.p({ x: S.caster.x + Math.cos(a) * r, y: S.caster.y - 10 + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3 - 10, life: rnd(0.3, 0.6), max: 0.6, size: 2, color: Math.random() < 0.5 ? PAL.gold : PAL.goldGlow, additive: true, shrink: true }); } }
          if (!sword && t >= 0.42) { sword = true; const tipY = tgt.y - 8; S.floatSpr({ x: tgt.x, y: -34, vy: (tipY + 34) / 0.3, life: 0.31, max: 0.31, draw: (g, s) => drawBlade(g, s.x, s.y, Math.min(1, s.life / s.max + 0.4)) }); }
          if (!slam && t >= 0.72) { slam = true;
            S.doFlash(PAL.goldGlow, 0.92); S.doShake(7); tgt.flinch = 6; tgt.tint = 1;
            S.beam({ x1: tgt.x, y1: tgt.y - 44, x2: tgt.x, y2: tgt.y + 12, color: PAL.goldGlow, width: 7, jag: 0, life: 0.22, max: 0.22 });
            S.beam({ x1: tgt.x - 34, y1: tgt.y - 14, x2: tgt.x + 34, y2: tgt.y - 14, color: PAL.goldGlow, width: 5, jag: 0, life: 0.22, max: 0.22 });
            burst(S, tgt.x, tgt.y - 10, [PAL.goldGlow, PAL.gold, PAL.goldDeep, '#fff'], 40, 180, { up: 16, g: 40, additive: true, size: 3 });
            for (let i = 0; i < 16; i++) S.p({ x: tgt.x + rnd(-8, 8), y: tgt.y, vy: -rnd(40, 110), life: rnd(0.5, 1), max: 1, size: 2, color: PAL.gold, additive: true, shrink: true });
          }
        },
        done: (tt) => tt > 1.5,
      };
    },

    /* 전사 — 무쌍난무: 연속 베기 → 필살 X참 */
    berserk(S) {
      cast(S); const tgt = S.primary(); let t = 0, last = 0, count = 0, fin = false;
      const ang = [[1, -1], [1, 1], [1, -0.4], [1, 0.4], [1, -1], [1, 1]];
      return {
        update(dt) {
          t += dt;
          if (t < 0.3) { S.caster.hop = 4; if (Math.random() < 0.7) S.p({ x: S.caster.x + rnd(-8, 8), y: S.caster.y - rnd(0, 16), vy: -rnd(20, 50), life: rnd(0.3, 0.5), max: 0.5, size: 2, color: Math.random() < 0.5 ? PAL.red : PAL.gold, additive: true, shrink: true }); }
          if (t >= 0.3 && t < 0.95) { last += dt; if (last > 0.085) { last = 0; const a = ang[count % ang.length]; const len = 28;
            S.beam({ x1: tgt.x - a[0] * len, y1: tgt.y - 9 - a[1] * len, x2: tgt.x + a[0] * len, y2: tgt.y - 9 + a[1] * len, color: Math.random() < 0.5 ? '#ffffff' : PAL.gold, width: 2, jag: 0, life: 0.14, max: 0.14 });
            burst(S, tgt.x + rnd(-5, 5), tgt.y - 9, ['#ffffff', PAL.gold, PAL.red], 7, 90, { additive: true });
            tgt.flinch = 3; tgt.tint = 0.6; S.doShake(2); count++;
          } }
          if (t >= 0.95 && !fin) { fin = true;
            S.beam({ x1: tgt.x - 32, y1: tgt.y - 34, x2: tgt.x + 32, y2: tgt.y + 10, color: PAL.goldGlow, width: 4, jag: 0, life: 0.26, max: 0.26 });
            S.beam({ x1: tgt.x + 32, y1: tgt.y - 34, x2: tgt.x - 32, y2: tgt.y + 10, color: PAL.goldGlow, width: 4, jag: 0, life: 0.26, max: 0.26 });
            S.doFlash('#ffe0d0', 0.72); S.doShake(7); tgt.flinch = 6; tgt.tint = 1;
            burst(S, tgt.x, tgt.y - 9, [PAL.goldGlow, PAL.gold, PAL.red, PAL.fireDeep], 36, 180, { up: 14, additive: true, size: 3 });
          }
        },
        done: (tt) => tt > 1.4,
      };
    },

    /* 사냥꾼 — 별빛 연사: 별빛 화살 집중사 → 관통 일격 */
    starfall(S) {
      cast(S); const tgt = S.primary(); let t = 0, em = 0, fin = false;
      const star = '#9ad6ff', glow = '#eaf6ff';
      return {
        update(dt) {
          t += dt;
          if (t < 0.4) { if (Math.random() < 0.85) { const a = Math.random() * 6.28, r = rnd(8, 20); S.p({ x: S.caster.x + 6 + Math.cos(a) * r, y: S.caster.y - 10 + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 2.6, life: 0.3, max: 0.3, size: 2, color: Math.random() < 0.5 ? star : PAL.gold, additive: true, shrink: true }); } }
          if (t >= 0.4 && t < 0.95) { em += dt; if (em > 0.045) { em = 0;
            const sx = rnd(0, S.W), sy = -8; const dx = tgt.x - sx, dy = (tgt.y - 9) - sy, d = Math.hypot(dx, dy) || 1; const sp = 440;
            S.p({ x: sx, y: sy, vx: dx / d * sp, vy: dy / d * sp, life: d / sp, max: d / sp, size: 1, color: Math.random() < 0.5 ? star : glow, streak: 11, head: true, headColor: PAL.gold, fade: false });
            setTimeout(() => { burst(S, tgt.x + rnd(-6, 6), tgt.y - rnd(2, 16), [star, glow, PAL.gold], 6, 60, { additive: true }); tgt.flinch = 2; tgt.tint = 0.4; }, (d / sp) * 1000);
          } }
          if (t >= 0.95 && !fin) { fin = true;
            S.beam({ x1: S.caster.x + 6, y1: S.caster.y - 10, x2: tgt.x, y2: tgt.y - 9, color: glow, width: 3, jag: 0, life: 0.16, max: 0.16 });
            S.doFlash(glow, 0.6); S.doShake(5); tgt.flinch = 6; tgt.tint = 1;
            burst(S, tgt.x, tgt.y - 9, [star, glow, PAL.gold, '#ffffff'], 34, 160, { additive: true, size: 3 });
            S.floatSpr({ x: tgt.x, y: tgt.y - 9, life: 0.5, max: 0.5, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = star; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 30, 0, 7); g.stroke(); g.globalAlpha = 1; } });
          }
        },
        done: (tt) => tt > 1.5,
      };
    },

    /* 마법사 — 대붕괴(아르카나): 마법진 전개 → 시공 왜곡 → 다원소 빛기둥 강림 → 대폭발 */
    cataclysm(S) {
      cast(S); const tgt = S.primary(); let t = 0, pillars = false, boom = false;
      const cx = tgt.x, cy = tgt.y - 9;
      const ELC = ['#e25563', '#56a8e8', '#b483f0', '#9ad94f', '#fff0b8']; // 화·빙·비전·독·뇌
      return {
        update(dt) {
          t += dt;
          // phase0: 발밑 마법진 전개 + 수렴
          if (t < 0.55) { S.tint('#140a22', 0.3, 0.55);
            S.floatSpr({ x: cx, y: cy, life: 0.05, max: 0.05, draw: (g, s) => { const k = Math.min(1, t / 0.5); g.globalAlpha = 0.8 * k; g.strokeStyle = '#b483f0'; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 30 * k, 0, 7); g.stroke(); g.beginPath(); g.arc(s.x, s.y, 20 * k, 0, 7); g.stroke(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t; g.beginPath(); g.moveTo(s.x + Math.cos(a) * 30 * k, s.y + Math.sin(a) * 30 * k); g.lineTo(s.x + Math.cos(a + 2.09) * 30 * k, s.y + Math.sin(a + 2.09) * 30 * k); g.stroke(); } g.globalAlpha = 1; } });
            for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = 38 - t * 50; S.p({ x: cx + Math.cos(a) * Math.max(4, r), y: cy + Math.sin(a) * Math.max(4, r), vx: -Math.cos(a) * 28, vy: -Math.sin(a) * 28, life: 0.25, max: 0.25, size: 2, color: ELC[(Math.random() * 5) | 0], additive: true, shrink: true }); }
          }
          // phase1: 다원소 빛기둥 강림
          if (t >= 0.5 && t < 0.95) { if (Math.random() < 0.9) { const col = ELC[(Math.random() * 5) | 0]; const ox = rnd(-26, 26);
            S.beam({ x1: cx + ox, y1: -2, x2: cx + ox, y2: cy + 6, color: col, width: rnd(2, 5), jag: 0, life: 0.1, max: 0.1 }); S.p({ x: cx + ox + rnd(-2, 2), y: rnd(0, cy), vy: 220, life: 0.25, max: 0.25, size: 2, color: col, additive: true, shrink: true }); }
            if (Math.random() < 0.5) S.doFlash(ELC[(Math.random() * 5) | 0], 0.14); S.doShake(2.5);
          }
          // phase2: 대붕괴 폭발
          if (!boom && t >= 0.92) { boom = true; S.doFlash('#ffffff', 0.95); S.doShake(9); tgt.flinch = 6; tgt.tint = 1;
            ELC.forEach((c, i) => burst(S, cx, cy, [c, '#fff'], 12, 150 + i * 12, { additive: true, size: 3, up: 8 }));
            [0, 0.06, 0.12].forEach(dl => S.floatSpr({ x: cx, y: cy, life: 0.6 - dl, max: 0.6, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = '#e6dcff'; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 60, 0, 7); g.stroke(); g.globalAlpha = 1; } }));
            for (let i = 0; i < 18; i++) S.p({ x: cx + rnd(-10, 10), y: cy, vy: -rnd(40, 120), life: rnd(0.5, 1), max: 1, size: 2, color: ELC[i % 5], additive: true, shrink: true });
          }
        },
        done: (tt) => tt > 1.7,
      };
    },
  };

  const CLASS_META = [
    { id: 'holyblade', name: '성검 강타', cost: 'MP 12', kind: '단일 필살 · 신성', el: 'holy', cls: '나이트', caster: 'knight', enemy: 'skeleton_king', ult: true, power: 26, from: '거대 성검 강림 → 십자 폭발' },
    { id: 'berserk', name: '무쌍난무', cost: '운명 2', kind: '단일 필살 · 물리', el: 'phys', cls: '전사', caster: 'warrior', enemy: 'golem', ult: true, power: 24, from: '연속 베기 → 필살 X참' },
    { id: 'starfall', name: '별빛 연사', cost: 'MP 10', kind: '단일 필살 · 천궁', el: 'star', cls: '사냥꾼', caster: 'huntress', enemy: 'skeleton_king', ult: true, power: 25, from: '화살 집중사 → 관통 일격' },
    { id: 'cataclysm', name: '대붕괴', cost: 'MP 16', kind: '단일 필살 · 비전', el: 'arcane', cls: '마법사', caster: 'mage', enemy: 'golem', ult: true, power: 30, from: '마법진 → 다원소 빛기둥 → 대붕괴' },
  ];

  Object.assign(DEFS, CLASS);
  CLASS_META.forEach(m => META.push(m)); // 단일기 — ALL_TARGET에 넣지 않음
  window.SpellFXDefs.CLASS_META = CLASS_META;
})();

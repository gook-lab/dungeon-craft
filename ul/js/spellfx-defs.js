/* ============================================================
   spellfx-defs.js — 13개 주문 애니메이션 연출 정의
   각 주문 = (stage) => effect{ update(dt,t), done(t) }
   game/content/spells.js 의 실제 스펠북과 1:1 매핑.
   ============================================================ */
(function () {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const PAL = {
    fireDeep: '#7a1f0a', fireR: '#e25563', fireY: '#f0c44c', fireW: '#fff0b8',
    ice: '#56a8e8', iceW: '#eaf6ff', iceP: '#bfe6ff',
    thunder: '#fff0b8', thunderP: '#b483f0', thunderB: '#9ad6ff',
    poison: '#9ad94f', poisonD: '#6fae2e',
    gold: '#ffd766', goldGlow: '#fff0b8', goldDeep: '#c98b2c',
    heal: '#62c46a', healW: '#eafbe8',
    red: '#e25563', shield: '#56a8e8', shieldW: '#cfe0ff',
    sleep: '#b59cff', sleepW: '#e6dcff',
    earth: '#c98b2c', earthD: '#7a5224', earthDk: '#5a3c18', dust: '#b9b48f',
  };

  // 작은 폭발 버스트 (impact)
  function burst(S, x, y, cols, n, spd, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), g: opts.g || 0, drag: 0.92,
        life: rnd(0.25, 0.6), max: 0.6, size: opts.size || 2, color: cols[i % cols.length],
        shrink: opts.shrink !== false, additive: opts.additive });
    }
  }

  // 화살/창 발사체: caster→target, onHit 콜백
  function projectile(S, target, opts, onHit) {
    const from = { x: S.caster.x + 6, y: S.caster.y - 9 };
    const to = { x: target.x, y: target.y - 9 };
    let t = 0; const dur = opts.dur || 0.34; let hit = false;
    return {
      update(dt) {
        t += dt; const k = Math.min(1, t / dur);
        const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * (opts.arc || 0);
        S.p({ x, y, vx: rnd(-4, 4), vy: rnd(-4, 4), life: rnd(0.12, 0.28), max: 0.28, size: opts.size || 2, color: opts.trail[Math.floor(Math.random() * opts.trail.length)], shrink: true, additive: true });
        if (opts.core) S.p({ x, y, life: 0.08, max: 0.08, size: (opts.size || 2) + 1, color: opts.core, additive: true });
        if (k >= 1 && !hit) { hit = true; onHit(x, y); }
      },
    };
  }

  const cast = (S) => { S.caster.hop = 4; };

  const DEFS = {
    /* 1. 화염 화살 */
    firebolt(S) {
      cast(S); const tgt = S.primary(); let proj = null, phase = 0;
      return {
        update(dt) {
          if (phase === 0) { proj = projectile(S, tgt, { trail: [PAL.fireY, PAL.fireR, PAL.fireW], core: PAL.fireW, size: 3, dur: 0.32 },
            (x, y) => { phase = 1; burst(S, x, y, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 26, 130, { g: 60, additive: true }); S.doFlash(PAL.fireY, .35); S.doShake(3); tgt.flinch = 4; tgt.tint = .8; }); phase = 0.5; }
          if (proj && phase < 1) proj.update(dt);
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 2. 화염 폭풍 */
    firestorm(S) {
      cast(S); S.tint(PAL.fireDeep, .25, 1.4); let t = 0; const drops = []; const targets = S.targets();
      for (let i = 0; i < 14; i++) drops.push({ at: rnd(0.05, 1.0), x: rnd(S.W * 0.5, S.W * 0.98), done: false });
      return {
        update(dt) {
          t += dt;
          drops.forEach(d => {
            if (!d.done && t >= d.at) { d.done = true;
              const gy = S.groundY - rnd(0, 18);
              for (let k = 0; k < 8; k++) S.p({ x: d.x + rnd(-2, 2), y: gy - 40 - k * 4, vy: 220, life: 0.22, max: 0.22, size: 3, color: [PAL.fireY, PAL.fireR, PAL.fireW][k % 3], shrink: true, additive: true });
              setTimeout(() => { burst(S, d.x, gy, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 14, 90, { g: 40, up: 30, additive: true }); S.doShake(2); }, 180);
            }
          });
          if (Math.random() < 0.4) S.doFlash(PAL.fireY, .12);
          targets.forEach(e => { if (Math.random() < 0.06) { e.tint = .6; e.flinch = 2; } });
        },
        done: (tt) => tt > 1.7,
      };
    },

    /* 3. 얼음 창 */
    ice_lance(S) {
      cast(S); const tgt = S.primary(); let proj = null, phase = 0;
      return {
        update(dt) {
          if (phase === 0) { proj = projectile(S, tgt, { trail: [PAL.ice, PAL.iceP, PAL.iceW], core: PAL.iceW, size: 3, dur: 0.28 },
            (x, y) => { phase = 1; S.doFlash(PAL.iceW, .3); S.doShake(2); tgt.flinch = 3; tgt.tint = .7;
              for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2); const s = rnd(40, 130); S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 180, drag: 0.96, life: rnd(0.3, 0.7), max: 0.7, size: (rnd(1, 3) | 0) || 2, color: [PAL.iceW, PAL.iceP, PAL.ice][i % 3] }); }
            }); phase = 0.5; }
          if (proj && phase < 1) proj.update(dt);
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 4. 뇌격 */
    thunderclap(S) {
      cast(S); let t = 0; const targets = S.targets(); const struck = targets.map(() => false);
      return {
        update(dt) {
          t += dt;
          targets.forEach((e, i) => {
            const at = 0.15 + i * 0.18;
            if (!struck[i] && t >= at) { struck[i] = true;
              S.beam({ x1: e.x + rnd(-3, 3), y1: -2, x2: e.x, y2: e.y - 6, color: PAL.thunder, width: 2, jag: 6, life: 0.18, max: 0.18 });
              S.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: PAL.thunderP, width: 4, jag: 8, life: 0.14, max: 0.14 });
              S.doFlash('#dfe6ff', .55); S.doShake(4); e.flinch = 4; e.tint = .9;
              burst(S, e.x, e.y - 6, [PAL.thunder, PAL.thunderB, PAL.thunderP], 20, 120, { up: 20, additive: true });
            }
          });
        },
        done: (tt) => tt > (0.15 + targets.length * 0.18 + 0.7),
      };
    },

    /* 5. 독화살 */
    venom_shot(S) {
      cast(S); const tgt = S.primary(); let proj = null, phase = 0, bubT = 0;
      return {
        update(dt) {
          if (phase === 0) { proj = projectile(S, tgt, { trail: [PAL.poison, PAL.poisonD], core: PAL.poison, size: 2, dur: 0.3, arc: 14 },
            (x, y) => { phase = 1; burst(S, x, y, [PAL.poison, PAL.poisonD, PAL.healW], 16, 80, { g: 30, additive: true }); S.doShake(2); tgt.flinch = 3; tgt.tint = .6; }); phase = 0.5; }
          if (proj && phase < 1) proj.update(dt);
          if (phase >= 1) { bubT += dt; if (bubT > 0.05) { bubT = 0; S.p({ x: tgt.x + rnd(-6, 6), y: tgt.y - rnd(2, 16), vy: -rnd(6, 16), life: rnd(0.5, 1), max: 1, size: 2, color: Math.random() < 0.5 ? PAL.poison : PAL.poisonD, shrink: true, additive: true }); } }
        },
        done: (tt) => tt > 1.5,
      };
    },

    /* 6. 심판의 빛 */
    smite(S) {
      cast(S); const tgt = S.primary(); let t = 0, hit = false;
      return {
        update(dt) {
          t += dt;
          if (t > 0.2 && t < 0.7) {
            S.beam({ x1: tgt.x, y1: -2, x2: tgt.x, y2: tgt.y - 6, color: PAL.goldGlow, width: rnd(5, 9), jag: 0, life: 0.1, max: 0.1 });
            S.beam({ x1: tgt.x, y1: -2, x2: tgt.x, y2: tgt.y - 6, color: PAL.gold, width: rnd(2, 4), jag: 0, life: 0.08, max: 0.08 });
            S.p({ x: tgt.x + rnd(-4, 4), y: rnd(0, tgt.y - 10), vy: 200, life: 0.3, max: 0.3, size: 2, color: PAL.goldGlow, additive: true, shrink: true });
          }
          if (t > 0.55 && !hit) { hit = true; S.doFlash(PAL.goldGlow, .6); S.doShake(3); tgt.flinch = 4; tgt.tint = 1;
            burst(S, tgt.x, tgt.y - 8, [PAL.goldGlow, PAL.gold, PAL.goldDeep], 24, 110, { up: 24, additive: true });
            for (let i = 0; i < 10; i++) S.p({ x: tgt.x + rnd(-6, 6), y: tgt.y, vy: -rnd(30, 80), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: PAL.gold, additive: true, shrink: true });
          }
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 7. 치유 */
    heal(S) {
      cast(S); let t = 0, em = 0; const u = S.caster;
      return {
        update(dt) {
          t += dt; em += dt;
          if (em > 0.04 && t < 1.0) { em = 0;
            S.p({ x: u.x + rnd(-7, 7), y: u.y - rnd(0, 4), vy: -rnd(18, 40), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: Math.random() < 0.5 ? PAL.heal : PAL.healW, additive: true, shrink: true });
          }
          if (t > 0.1 && t < 0.5 && Math.random() < 0.5) {
            S.floatSpr({ x: u.x + rnd(-6, 6), y: u.y - rnd(6, 22), life: 0.3, max: 0.3, draw: (g, s) => { g.globalAlpha = s.life / s.max; g.fillStyle = PAL.healW; g.fillRect(s.x - 0.5, s.y - 2, 1, 4); g.fillRect(s.x - 2, s.y - 0.5, 4, 1); g.globalAlpha = 1; } });
          }
        },
        done: (tt) => tt > 1.3,
      };
    },

    /* 8. 성스러운 빛 */
    holy_nova(S) {
      cast(S); let t = 0; const cx = S.caster.x, cy = S.caster.y - 8; let ringDrawn = false;
      return {
        update(dt) {
          t += dt;
          const r = t * 90;
          if (t < 0.9) {
            const n = 26;
            for (let i = 0; i < n; i++) { if (Math.random() < 0.5) continue; const a = (i / n) * Math.PI * 2; S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6, life: 0.12, max: 0.12, size: 2, color: Math.random() < 0.5 ? PAL.gold : PAL.goldGlow, additive: true }); }
          }
          if (!ringDrawn && t > 0.05) { ringDrawn = true; S.doFlash(PAL.goldGlow, .4); }
          if (Math.random() < 0.6) S.p({ x: cx + rnd(-30, 30), y: cy + rnd(-6, 14), vy: -rnd(20, 50), life: rnd(0.5, 1), max: 1, size: 2, color: PAL.goldGlow, additive: true, shrink: true });
        },
        done: (tt) => tt > 1.3,
      };
    },

    /* 9. 전투의 함성 */
    warcry(S) {
      cast(S); let t = 0, pulse = 0; const u = S.caster;
      return {
        update(dt) {
          t += dt; pulse += dt;
          if (Math.random() < 0.8) S.p({ x: u.x + rnd(-8, 8), y: u.y - rnd(0, 6), vy: -rnd(20, 55), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? PAL.red : PAL.gold, additive: true, shrink: true });
          if (pulse > 0.22 && t < 0.9) { pulse = 0; S.floatSpr({ x: u.x, y: u.y - 10, life: 0.4, max: 0.4, r0: 4, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = PAL.gold; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, s.r0 + k * 22, 0, 7); g.stroke(); g.globalAlpha = 1; } }); S.doShake(1.5); }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 10. 방벽 */
    shield_wall(S) {
      cast(S); let t = 0, formed = false; const u = S.caster;
      return {
        update(dt) {
          t += dt;
          if (!formed && t > 0.1) { formed = true; S.doFlash(PAL.shieldW, .3); }
          if (t < 1.0 && Math.random() < 0.7) S.p({ x: u.x + rnd(2, 16), y: u.y - rnd(2, 22), vx: rnd(-4, 4), vy: rnd(-8, 4), life: rnd(0.3, 0.7), max: 0.7, size: 2, color: Math.random() < 0.5 ? PAL.shield : PAL.shieldW, additive: true, shrink: true });
          if (!u._hex) { u._hex = true; S.floatSpr({ x: u.x + 11, y: u.y - 10, life: 1.2, max: 1.2, draw: (g, s) => { const ap = Math.min(1, (s.max - s.life) * 4) * (s.life > 0.3 ? 1 : s.life / 0.3); g.globalAlpha = ap * 0.85; g.strokeStyle = PAL.shieldW; g.lineWidth = 1; g.beginPath(); const R = 13; for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; const px = s.x + Math.cos(a) * R * 0.7, py = s.y + Math.sin(a) * R; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.globalAlpha = ap * 0.18; g.fillStyle = PAL.shield; g.fill(); g.globalAlpha = 1; } }); }
        },
        done: (tt) => { if (tt > 1.3) { S.caster._hex = false; return true; } return false; },
      };
    },

    /* 11. 자장가 */
    lullaby(S) {
      cast(S); const tgt = S.primary(); let t = 0, em = 0;
      const note = (g, s) => { g.globalAlpha = Math.min(1, s.life / s.max + 0.2); g.fillStyle = s.col; g.fillRect(s.x - 1, s.y - 3, 2, 5); g.fillRect(s.x + 1, s.y - 4, 2, 2); g.fillRect(s.x - 2, s.y + 2, 3, 2); g.globalAlpha = 1; };
      const zee = (g, s) => { g.globalAlpha = Math.min(1, s.life / s.max + 0.2); g.fillStyle = s.col; g.fillRect(s.x - 2, s.y - 2, 5, 1); g.fillRect(s.x + 1, s.y - 1, 1, 1); g.fillRect(s.x, s.y, 1, 1); g.fillRect(s.x - 2, s.y + 1, 5, 1); g.globalAlpha = 1; };
      return {
        update(dt) {
          t += dt; em += dt;
          if (em > 0.16 && t < 1.1) { em = 0;
            const fromX = S.caster.x + 6, fromY = S.caster.y - 12;
            const isZ = Math.random() < 0.4;
            S.floatSpr({ x: fromX, y: fromY, vx: (tgt.x - fromX) * 0.5, vy: -rnd(8, 16), life: 1.0, max: 1.0, col: Math.random() < 0.5 ? PAL.sleep : PAL.sleepW, _w: 0, draw: (g, s) => { s._w += dt; const wob = Math.sin(s._w * 6) * 3; g.save(); g.translate(wob, 0); (isZ ? zee : note)(g, s); g.restore(); } });
          }
          if (t > 0.5 && Math.random() < 0.15) tgt.tint = 0.3;
        },
        done: (tt) => tt > 1.6,
      };
    },

    /* 12. 정화 */
    cleanse(S) {
      cast(S); let t = 0, em = 0; const u = S.caster;
      return {
        update(dt) {
          t += dt; em += dt;
          if (em > 0.03 && t < 0.9) { em = 0;
            S.p({ x: u.x + rnd(-9, 9), y: u.y - 26, vy: rnd(50, 90), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: Math.random() < 0.4 ? PAL.gold : PAL.healW, additive: true, shrink: true });
          }
          if (t > 0.15 && t < 0.6 && Math.random() < 0.3) S.beam({ x1: u.x + rnd(-8, 8), y1: u.y - 28, x2: u.x + rnd(-6, 6), y2: u.y - 2, color: PAL.healW, width: 1, jag: 0, life: 0.1, max: 0.1 });
          if (t > 0.1 && !u._cf) { u._cf = true; S.doFlash(PAL.healW, .3); }
          if (t > 0.4 && Math.random() < 0.4) S.p({ x: u.x + rnd(-10, 10), y: u.y - 1, vx: rnd(-20, 20), vy: -rnd(2, 10), life: 0.4, max: 0.4, size: 2, color: PAL.healW, additive: true, shrink: true });
        },
        done: (tt) => { if (tt > 1.1) { S.caster._cf = false; return true; } return false; },
      };
    },

    /* 13. 대지분쇄 */
    quake(S) {
      cast(S); let t = 0; const targets = S.targets(); const struck = targets.map(() => false); let flashed = false;
      return {
        update(dt) {
          t += dt;
          if (t < 0.5) S.doShake(5); else if (t < 1.0) S.doShake(2.5);
          if (!flashed && t > 0.1) { flashed = true; S.doFlash(PAL.earth, .25); }
          targets.forEach((e, i) => {
            const at = 0.12 + i * 0.1;
            if (!struck[i] && t >= at) { struck[i] = true;
              for (let k = 0; k < 14; k++) { const a = -Math.PI / 2 + rnd(-0.8, 0.8); const s = rnd(60, 150); S.p({ x: e.x + rnd(-6, 6), y: S.groundY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 320, drag: 0.99, life: rnd(0.4, 0.9), max: 0.9, size: (rnd(1, 3) | 0) || 2, color: [PAL.earth, PAL.earthD, PAL.earthDk, PAL.dust][k % 4] }); }
              e.flinch = 4; e.tint = .5;
            }
          });
          if (t < 0.8 && Math.random() < 0.5) S.p({ x: rnd(S.W * 0.45, S.W), y: S.groundY - rnd(0, 4), vx: rnd(-10, 10), vy: -rnd(4, 14), life: rnd(0.5, 1), max: 1, size: 3, color: PAL.dust, shrink: true });
        },
        done: (tt) => tt > 1.4,
      };
    },
  };

  const META = [
    { id: 'firebolt', name: '화염 화살', mp: 3, kind: '단일 · 화염', el: 'fire', power: 11 },
    { id: 'firestorm', name: '화염 폭풍', mp: 7, kind: '전체 · 화염', el: 'fire', power: 9 },
    { id: 'ice_lance', name: '얼음 창', mp: 5, kind: '단일 · 냉기', el: 'ice', power: 16 },
    { id: 'thunderclap', name: '뇌격', mp: 8, kind: '전체 · 뇌전', el: 'thunder', power: 12 },
    { id: 'venom_shot', name: '독화살', mp: 5, kind: '단일 · 독', el: 'poison', power: 10 },
    { id: 'quake', name: '대지분쇄', mp: 9, kind: '전체 · 대지', el: 'earth', power: 14 },
    { id: 'smite', name: '심판의 빛', mp: 4, kind: '단일 · 신성', el: 'holy', power: 13 },
    { id: 'holy_nova', name: '성스러운 빛', mp: 8, kind: '전체 회복 · 신성', el: 'holy' },
    { id: 'heal', name: '치유', mp: 3, kind: '단일 회복', el: 'heal' },
    { id: 'cleanse', name: '정화', mp: 4, kind: '상태 해제', el: 'heal' },
    { id: 'warcry', name: '전투의 함성', mp: 4, kind: '버프 · 공격', el: 'buff' },
    { id: 'shield_wall', name: '방벽', mp: 6, kind: '버프 · 수비', el: 'shield' },
    { id: 'lullaby', name: '자장가', mp: 5, kind: '상태이상 · 수면', el: 'sleep' },
  ];
  const ALL_TARGET = new Set(['firestorm', 'thunderclap', 'quake']);

  window.SpellFXDefs = { DEFS, META, ALL_TARGET, PAL };
})();

/* ============================================================
   spellfx-warrior.js — 전사 확장 스킬 (근접 물리 · 분노/디버프/방어)
   전사 정체성: 저MP 근접 브루저. 단일 물리·디버프·방어 빈틈을 메움.
   window.SpellFXDefs.{DEFS,META,ALL_TARGET} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };
  const steel = '#dfe4f2', steelD = '#9aa3c8';
  const rageR = '#e25563', rageO = '#ff8a5a';

  // --- 분노(rage) 상태 -- 피의 갈증으로 진입. 지속 버프(소비 X). 근접 스킬이 [격노] 강화.
  const isRaged = (S) => !!S._rage;
  // 격노 표식 "≫" (붉은 분노 쐐기)
  function rageMark(g, x, y, a) { g.globalAlpha = a; g.fillStyle = rageR;
    for (let i = 0; i < 3; i++) { g.fillRect(x - 4 + i * 2, y - 4 + i, 2, 2); g.fillRect(x - 4 + i * 2, y + 4 - i, 2, 2); } g.globalAlpha = 1; }
  // 격노 강화 타격 버스트 (붉은 분노 + 흡혈 핏방울)
  function rageBurst(S, x, y) {
    burst(S, x, y, [rageO, rageR, '#fff'], 14, 130, { additive: true, size: 2, up: 6 });
    for (let i = 0; i < 5; i++) S.p({ x: x + rnd(-4, 4), y: y + rnd(-4, 4), vx: rnd(-30, 30), vy: -rnd(20, 50), g: 140, life: 0.5, max: 0.5, size: 2, color: '#9a1020' });
    S.floatSpr({ x, y: y - 18, vy: -14, life: 0.7, max: 0.7, draw: (g, s) => rageMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2)) });
  }

  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.25, 0.55), max: 0.55, size: o.size || 2, color: cols[i % cols.length], shrink: true, additive: o.additive }); }
  }
  // 하강 화살표(디버프 ↓) / 상승(버프 ↑) 표식
  function arrowMark(g, s, up) { g.globalAlpha = Math.min(1, s.life / s.max + 0.2); g.fillStyle = s.col;
    const d = up ? -1 : 1; const y = s.y;
    g.fillRect(s.x - 0.5, y - 4, 1, 8);
    g.fillRect(s.x - 2, y + d * 1, 1, 1); g.fillRect(s.x + 1, y + d * 1, 1, 1);
    g.fillRect(s.x - 1, y + d * 2, 1, 1); g.fillRect(s.x, y + d * 2, 1, 1);
    g.globalAlpha = 1; }

  const WAR = {
    /* 분쇄 강타 — 단일 물리. 내려찍기 → 지면 충격파. 분노 중: [격노] 강타 강화 */
    crushblow(S) {
      cast(S); const tgt = S.primary(); const rage = isRaged(S); let t = 0, hit = false;
      return {
        update(dt) {
          t += dt;
          if (t < 0.32) { S.caster.hop = 4; if (Math.random() < 0.5) S.p({ x: S.caster.x + rnd(-6, 6), y: S.caster.y - rnd(2, 16), vy: -rnd(14, 34), life: 0.3, max: 0.3, size: 2, color: rage ? rageR : (Math.random() < 0.5 ? steel : PAL.gold), additive: true, shrink: true }); }
          // 내려찍는 강철 빔 (분노 중엔 붉은 보조 빔)
          if (t >= 0.28 && t < 0.42) { S.beam({ x1: tgt.x, y1: tgt.y - 46, x2: tgt.x, y2: tgt.y - 2, color: steel, width: rnd(4, 7), jag: 0, life: 0.08, max: 0.08 });
            if (rage) S.beam({ x1: tgt.x, y1: tgt.y - 46, x2: tgt.x, y2: tgt.y - 2, color: rageR, width: rnd(7, 10), jag: 0, life: 0.07, max: 0.07 }); }
          if (!hit && t >= 0.4) { hit = true;
            S.doFlash(rage ? '#ffdcd0' : '#eef2ff', rage ? 0.7 : 0.55); S.doShake(rage ? 9 : 7); tgt.flinch = rage ? 6 : 5; tgt.tint = rage ? 1 : 0.7;
            for (let dir = -1; dir <= 1; dir += 2) for (let i = 0; i < (rage ? 13 : 9); i++) S.p({ x: tgt.x, y: S.groundY, vx: dir * rnd(60, rage ? 260 : 200), vy: -rnd(10, 60), g: 260, drag: 0.97, life: rnd(0.3, 0.7), max: 0.7, size: (rnd(1, 3) | 0) || 2, color: [PAL.dust, PAL.earth, steelD][i % 3] });
            burst(S, tgt.x, tgt.y - 8, rage ? [rageO, rageR, '#fff'] : [steel, '#ffffff', PAL.gold], rage ? 26 : 18, rage ? 170 : 130, { up: 12, additive: true, size: 3 });
            if (rage) rageBurst(S, tgt.x, tgt.y - 8);
          }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 회전베기 — 전체 물리. 강철 칼날이 원형으로 휩쓺. 분노 중: 붉은 이중 회전 */
    whirlwind(S) {
      const targets = S.targets(); cast(S); const rage = isRaged(S);
      let t = 0, spin = 0, swept = targets.map(() => false);
      const cx = S.caster.x, cy = S.caster.y - 9;
      return {
        update(dt) {
          t += dt;
          // 회전 칼날 궤적 (caster 주위)
          if (t < 0.6) { spin += dt * 26; for (let k = 0; k < (rage ? 3 : 2); k++) { const a = spin + k * (6.28 / (rage ? 3 : 2)); const r = 16 + t * 12;
            S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6, life: 0.16, max: 0.16, size: 2, color: rage ? (Math.random() < 0.5 ? rageR : '#fff') : (Math.random() < 0.5 ? steel : '#ffffff'), additive: true }); }
            if (Math.random() < 0.4) S.doShake(1.2);
          }
          // 확장 링 → 적 타격
          if (t >= 0.45) {
            const ringR = (t - 0.45) * 340;
            targets.forEach((e, i) => {
              const d = Math.abs((e.x - cx));
              if (!swept[i] && ringR >= d) { swept[i] = true;
                S.beam({ x1: e.x - 26, y1: e.y - 9, x2: e.x + 26, y2: e.y - 9, color: rage ? rageR : '#ffffff', width: rage ? 4 : 3, jag: 0, life: 0.14, max: 0.14 });
                burst(S, e.x, e.y - 9, rage ? [rageO, rageR, '#fff'] : [steel, '#ffffff', PAL.gold], rage ? 18 : 12, 110, { additive: true }); e.flinch = 4; e.tint = rage ? 0.85 : 0.6; S.doShake(2.5);
                if (rage) rageBurst(S, e.x, e.y - 9);
              }
            });
            const n = 22; for (let i = 0; i < n; i++) { if (Math.random() < 0.6) continue; const a = (i / n) * 6.28; S.p({ x: cx + Math.cos(a) * ringR, y: cy + Math.sin(a) * ringR * 0.6, life: 0.1, max: 0.1, size: 2, color: rage ? rageR : steel, additive: true }); }
          }
        },
        done: (tt) => tt > 1.3,
      };
    },

    /* 위협의 포효 — 전체 디버프(공격↓). 붉은 함성 파동 */
    warroar(S) {
      const targets = S.targets(); cast(S); S.tint('#2a0c0c', 0.18, 1.0);
      let t = 0, pulse = 0, marked = targets.map(() => false);
      const cx = S.caster.x, cy = S.caster.y - 11;
      return {
        update(dt) {
          t += dt; pulse += dt;
          if (Math.random() < 0.8) S.p({ x: cx + rnd(-8, 8), y: cy + rnd(-4, 6), vy: -rnd(16, 44), life: rnd(0.3, 0.6), max: 0.6, size: 2, color: Math.random() < 0.5 ? PAL.red : '#ff9a6a', additive: true, shrink: true });
          // 함성 파동 링 (3회)
          if (pulse > 0.2 && t < 0.8) { pulse = 0; S.floatSpr({ x: cx, y: cy, life: 0.5, max: 0.5, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = PAL.red; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 60, 0, 7); g.stroke(); g.globalAlpha = 1; } }); S.doShake(2.5); S.doFlash('#e25563', 0.14); }
          // 적 위축 + 공격↓ 표식
          targets.forEach((e, i) => { if (!marked[i] && t > 0.25 + i * 0.08) { marked[i] = true; e.flinch = 3; e.tint = 0.4;
            S.floatSpr({ x: e.x, y: e.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.red, draw: (g, s) => arrowMark(g, s, false) }); } });
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 갑옷 파괴 — 단일 디버프(방어↓). 강타 + 갑옷 파편. 분노 중: [격노] 강화 */
    sunder(S) {
      cast(S); const tgt = S.primary(); const rage = isRaged(S); let t = 0, hit = false;
      return {
        update(dt) {
          t += dt;
          if (t < 0.3) S.caster.hop = 4;
          if (t >= 0.26 && t < 0.4) { S.beam({ x1: tgt.x - 30, y1: tgt.y - 30, x2: tgt.x + 26, y2: tgt.y + 8, color: steel, width: rnd(3, 5), jag: 0, life: 0.08, max: 0.08 });
            if (rage) S.beam({ x1: tgt.x - 30, y1: tgt.y - 30, x2: tgt.x + 26, y2: tgt.y + 8, color: rageR, width: rnd(5, 8), jag: 0, life: 0.07, max: 0.07 }); }
          if (!hit && t >= 0.38) { hit = true; S.doFlash(rage ? '#ffdcd0' : '#e6ebff', rage ? 0.6 : 0.45); S.doShake(rage ? 7 : 5); tgt.flinch = rage ? 6 : 5; tgt.tint = rage ? 1 : 0.65;
            for (let i = 0; i < (rage ? 22 : 16); i++) { const a = -Math.PI / 2 + rnd(-1.3, 1.3), s = rnd(50, 150); S.p({ x: tgt.x, y: tgt.y - 9, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 280, drag: 0.97, life: rnd(0.4, 0.8), max: 0.8, size: (rnd(1, 3) | 0) || 2, color: [steel, steelD, PAL.mp][i % 3] }); }
            S.floatSpr({ x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.mp, draw: (g, s) => arrowMark(g, s, false) });
            if (rage) rageBurst(S, tgt.x, tgt.y - 9);
          }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 도발 — 자기 방어 버프 + 어그로. 방패 방어 태세 빛 */
    taunt(S) {
      cast(S); let t = 0, formed = false; const u = S.caster, cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt;
          if (!formed && t > 0.1) { formed = true; S.doFlash(PAL.shieldW, 0.28); }
          // 손짓(도발) 기류 — caster→적 방향 화살 기류
          if (t < 0.5 && Math.random() < 0.6) S.p({ x: cx + 10, y: cy + rnd(-4, 4), vx: rnd(40, 90), vy: rnd(-6, 6), life: 0.4, max: 0.4, size: 2, color: PAL.gold, additive: true, shrink: true });
          // 방어 오라 상승 + 확장 보호 링
          if (t < 0.9 && Math.random() < 0.7) S.p({ x: cx + rnd(-10, 10), y: u.y - rnd(0, 4), vy: -rnd(18, 44), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? PAL.shield : PAL.shieldW, additive: true, shrink: true });
          if (!u._tring) { u._tring = true; S.floatSpr({ x: cx, y: cy, life: 0.6, max: 0.6, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = (s.life / s.max) * 0.9; g.strokeStyle = PAL.shieldW; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 24, 0, 7); g.stroke(); g.globalAlpha = 1; } }); }
          // 방어↑ 표식
          if (Math.abs(t - 0.4) < dt) S.floatSpr({ x: cx, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.shieldW, draw: (g, s) => arrowMark(g, s, true) });
        },
        done: (tt) => { if (tt > 1.1) { S.caster._tring = false; return true; } return false; },
      };
    },

    /* 피의 갈증 — 자기 분노 버프(HP 소모 → 공격↑). 진홍 오라 폭발 */
    bloodlust(S) {
      cast(S); let t = 0, burst0 = false; const u = S.caster, cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt;
          if (!burst0 && t > 0.12) { burst0 = true; S.doFlash('#5a0a0a', 0.4); S.doShake(4); burst(S, cx, cy, [PAL.red, '#ff6a4a', PAL.fireDeep], 18, 110, { additive: true, up: 6 }); }
          if (t < 0.4) S.tint('#2a0606', 0.3, 0.4);
          // 진홍 오라 나선 상승
          if (t < 1.0 && Math.random() < 0.9) { const a = t * 8 + Math.random() * 6.28, r = rnd(6, 16); S.p({ x: cx + Math.cos(a) * r, y: cy + rnd(-4, 8), vx: Math.cos(a) * 8, vy: -rnd(26, 60), life: rnd(0.4, 0.9), max: 0.9, size: 2, color: Math.random() < 0.6 ? PAL.red : '#ff8a5a', additive: true, shrink: true }); }
          // HP 소모를 암시하는 하강 핏방울
          if (t < 0.6 && Math.random() < 0.3) S.p({ x: cx + rnd(-8, 8), y: cy - rnd(0, 8), vy: rnd(20, 50), g: 60, life: 0.5, max: 0.5, size: 2, color: '#9a1020', shrink: false });
          // 공격↑ 표식
          if (Math.abs(t - 0.5) < dt) S.floatSpr({ x: cx, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.red, draw: (g, s) => arrowMark(g, s, true) });
          // 분노 상태 진입 (지속 버프) — 이후 근접 스킬이 [격노] 강화
          if (!S._rage && t > 0.15) { S._rage = true; if (S.notifyState) S.notifyState(); }
        },
        done: (tt) => tt > 1.2,
      };
    },
  };

  const GRP = '전사 확장 · 근접/분노';
  const WAR_META = [
    { id: 'crushblow', name: '분쇄 강타', cost: 'MP 2', kind: '단일 · 물리', el: 'phys', grp: GRP, caster: 'warrior', enemy: 'golem', from: '내려찍기 → 지면 충격파', power: 14, rage: '격노 강타 (충격파↑)' },
    { id: 'whirlwind', name: '회전베기', cost: 'MP 5', kind: '전체 · 물리', el: 'phys', grp: GRP, caster: 'warrior', enemy: 'goblin', aoe: true, from: '강철 칼날 원형 휩쓺', power: 10, rage: '붉은 이중 회전' },
    { id: 'warroar', name: '위협의 포효', cost: 'MP 3', kind: '전체 · 디버프', el: 'phys', grp: GRP, caster: 'warrior', enemy: 'goblin', aoe: true, from: '붉은 함성 파동 · 공격↓', power: 0 },
    { id: 'sunder', name: '갑옷 파괴', cost: 'MP 3', kind: '단일 · 디버프', el: 'phys', grp: GRP, caster: 'warrior', enemy: 'golem', from: '강타 + 갑옷 파편 · 방어↓', power: 9, rage: '격노 강화 (파편↑)' },
    { id: 'taunt', name: '도발', cost: 'MP 2', kind: '자기 · 방어', el: 'shield', grp: GRP, caster: 'warrior', enemy: 'goblin', self: true, from: '방어 태세 + 어그로', power: 0 },
    { id: 'bloodlust', name: '피의 갈증', cost: 'HP 소모', kind: '자기 · 분노', el: 'phys', grp: GRP, caster: 'warrior', enemy: 'goblin', self: true, from: 'HP→공격↑ · 진홍 오라', power: 0, state: 'rage' },
  ];

  Object.assign(DEFS, WAR);
  WAR_META.forEach(m => { META.push(m); if (m.aoe) ALL_TARGET.add(m.id); });
  window.SpellFXDefs.WAR_META = WAR_META;
})();

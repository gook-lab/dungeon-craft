/* ============================================================
   spellfx-hunter.js — 사냥꾼 직업 재정립 (궁술/암살 · 물리 원거리)
   원소 마법은 마법사로 이관. 사냥꾼은 화살·급소·암살·함정·은신 물리기.
   window.SpellFXDefs.{DEFS,META,ALL_TARGET} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };
  const shaft = '#cfd8ec', shaftD = '#9aa3c8', head = '#fff0b8', wood = '#c98b2c', crit = '#ffd766', blood = '#9a1020';

  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.2, 0.5), max: 0.5, size: o.size || 2, color: cols[i % cols.length], shrink: true, additive: o.additive }); }
  }
  // 날아가는 화살 (caster→target), onHit
  function arrow(S, from, to, dur, onHit, arc) {
    let t = 0, done = false;
    return { update(dt) { t += dt; const k = Math.min(1, t / dur);
      const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * (arc || 0);
      const dx = to.x - from.x, dy = (to.y - from.y) - (arc ? Math.cos(k * Math.PI) * arc * 1.5 : 0), d = Math.hypot(dx, dy) || 1;
      S.p({ x, y, vx: dx / d * 300, vy: dy / d * 300, life: 0.12, max: 0.12, size: 1, color: shaft, streak: 10, head: true, headColor: head, fade: false });
      if (k >= 1 && !done) { done = true; onHit(x, y); } }, isDone: () => done };
  }
  // 조준 레티클
  function reticle(g, x, y, r, col, a) { g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(x - r - 3, y); g.lineTo(x - r + 2, y); g.moveTo(x + r - 2, y); g.lineTo(x + r + 3, y); g.moveTo(x, y - r - 3); g.lineTo(x, y - r + 2); g.moveTo(x, y + r - 2); g.lineTo(x, y + r + 3); g.stroke(); g.globalAlpha = 1; }
  function critMark(g, x, y, a) { g.globalAlpha = a; g.fillStyle = crit; g.fillRect(x - 1, y - 7, 2, 5); g.fillRect(x - 1, y, 2, 2); g.globalAlpha = 1; }

  // --- 은신 상태 ---------------------------------------------------------
  // 은신은 stage._stealth 플래그로 표현. 사냥꾼 강화 스킬이 시전 시 소비한다.
  const purp = '#b483f0', purpW = '#e6dcff';
  const consumeSneak = (S) => { const v = !!S._stealth; if (v) { S._stealth = false; if (S.notifyState) S.notifyState(); } return v; };
  // 기습 표식 "‼" (금+보라)
  function sneakMark(g, x, y, a) { g.globalAlpha = a; g.fillStyle = crit; g.fillRect(x - 3, y - 7, 2, 5); g.fillRect(x - 3, y, 2, 2);
    g.fillStyle = purpW; g.fillRect(x + 1, y - 7, 2, 5); g.fillRect(x + 1, y, 2, 2); g.globalAlpha = 1; }
  // 기습 잔상 버스트 (보라/금) — 강화 타격 순간
  function sneakBurst(S, x, y) {
    burst(S, x, y, [purpW, purp, crit, '#fff'], 16, 120, { additive: true, size: 2 });
    S.floatSpr({ x, y: y - 18, vy: -14, life: 0.8, max: 0.8, draw: (g, s) => sneakMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2)) });
    // 확장 보라 링
    S.floatSpr({ x, y, life: 0.4, max: 0.4, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = purp; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 22, 0, 7); g.stroke(); g.globalAlpha = 1; } });
  }

  const HUNT = {
    /* 정조준 — 단일 급소(치명타↑). 레티클 고정 → 일격. 은신 중: 헤드샷(추가 치명) */
    aimedshot(S) {
      cast(S); const tgt = S.primary(); const sneak = consumeSneak(S); let t = 0, shot = false, hit = false; const from = { x: S.caster.x + 7, y: S.caster.y - 12 };
      let proj = null;
      return {
        update(dt) {
          t += dt;
          // 조준 단계: 좁혀지는 레티클 (은신 중엔 보라)
          if (t < 0.5) { const k = t / 0.5; S.floatSpr({ x: tgt.x, y: tgt.y - 9, life: 0.05, max: 0.05, draw: (g, s) => reticle(g, s.x, s.y, 14 - k * 8, sneak ? purp : crit, 0.5 + k * 0.5) }); }
          if (!shot && t >= 0.5) { shot = true; proj = arrow(S, from, { x: tgt.x, y: tgt.y - 9 }, 0.14, (x, y) => { hit = true;
            S.doFlash('#fff6e0', sneak ? 0.7 : 0.5); S.doShake(sneak ? 7 : 5); tgt.flinch = sneak ? 6 : 5; tgt.tint = sneak ? 1 : 0.7;
            burst(S, x, y, [crit, head, '#fff', shaft], sneak ? 34 : 22, sneak ? 180 : 150, { additive: true, size: 3 });
            if (sneak) sneakBurst(S, x, y);
            else S.floatSpr({ x, y: y - 6, vy: -16, life: 0.7, max: 0.7, draw: (g, s) => critMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2)) });
          }); }
          if (proj && !hit) proj.update(dt);
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 연사 — 단일 다단. 화살 5연발. 은신 중: 기습 7연발 */
    multishot(S) {
      cast(S); const tgt = S.primary(); const sneak = consumeSneak(S); let t = 0, fired = 0, arrows = []; const from = { x: S.caster.x + 7, y: S.caster.y - 12 };
      const shots = sneak ? 7 : 5, gap = sneak ? 0.07 : 0.1;
      return {
        update(dt) {
          t += dt;
          if (fired < shots && t >= 0.2 + fired * gap) { fired++;
            arrows.push(arrow(S, { x: from.x, y: from.y + rnd(-3, 3) }, { x: tgt.x, y: tgt.y - 9 + rnd(-8, 8) }, 0.13, (x, y) => {
              burst(S, x, y, sneak ? [purpW, purp, crit] : [shaft, head, crit], 8, 100, { additive: true }); tgt.flinch = 3; tgt.tint = sneak ? 0.7 : 0.5; S.doShake(1.8);
            }));
            if (sneak && fired === shots) sneakBurst(S, tgt.x, tgt.y - 9);
          }
          arrows.forEach(a => { if (!a.isDone()) a.update(dt); });
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 관통 사격 — 단일(직선 관통). 은신 중: 이중 관통(보라+금) */
    piercingshot(S) {
      cast(S); const tgt = S.primary(); const sneak = consumeSneak(S); let t = 0, shot = false; const from = { x: S.caster.x + 7, y: S.caster.y - 11 };
      return {
        update(dt) {
          t += dt;
          if (t < 0.4 && Math.random() < 0.7) S.p({ x: from.x + rnd(-4, 4), y: from.y + rnd(-4, 4), vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.25, max: 0.25, size: 2, color: sneak ? purp : (Math.random() < 0.5 ? crit : head), additive: true, shrink: true });
          if (!shot && t >= 0.4) { shot = true;
            // 긴 관통 휘선 (은신 중엔 보라 빔 추가)
            S.beam({ x1: from.x, y1: from.y, x2: S.W + 10, y2: tgt.y - 9, color: head, width: 2, jag: 0, life: 0.2, max: 0.2 });
            S.beam({ x1: from.x, y1: from.y, x2: S.W + 10, y2: tgt.y - 9, color: '#ffffff', width: 1, jag: 0, life: 0.16, max: 0.16 });
            if (sneak) S.beam({ x1: from.x, y1: from.y, x2: S.W + 10, y2: tgt.y - 9, color: purp, width: 4, jag: 0, life: 0.18, max: 0.18 });
            S.doFlash('#fff6e0', sneak ? 0.65 : 0.45); S.doShake(sneak ? 6 : 4); tgt.flinch = sneak ? 6 : 5; tgt.tint = sneak ? 1 : 0.7;
            burst(S, tgt.x, tgt.y - 9, [crit, head, shaft, '#fff'], sneak ? 30 : 20, 140, { additive: true, size: 2 });
            if (sneak) sneakBurst(S, tgt.x, tgt.y - 9);
            S.p({ x: tgt.x, y: tgt.y - 9, vx: 320, vy: 0, life: 0.16, max: 0.16, size: 1, color: head, streak: 16, head: true, headColor: crit, fade: false });
          }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 그림자 일격 — 급소 암살(대형 단일). 은신 중: 즉시 발동 + 확정 치명(연출 강화) */
    assassinate(S) {
      cast(S); const tgt = S.primary(); const sneak = consumeSneak(S); let t = 0, vanished = false, struck = false;
      // 은신 중이면 이미 사라진 상태 → 차징 생략하고 즉시 급습
      const vanishEnd = sneak ? 0.0 : 0.45, strikeAt = sneak ? 0.12 : 0.6;
      if (sneak) S.caster.alpha = 0;
      return {
        update(dt) {
          t += dt;
          // (비은신) 은신 차징: 캐스터 연막 + 페이드아웃
          if (!sneak && t < 0.45) { S.caster.alpha = Math.max(0, 1 - t / 0.4);
            if (Math.random() < 0.7) S.p({ x: S.caster.x + rnd(-8, 8), y: S.caster.y - rnd(2, 16), vy: -rnd(8, 22), life: rnd(0.3, 0.6), max: 0.6, size: 3, color: Math.random() < 0.5 ? '#2a2438' : '#46506a', shrink: true }); }
          if (!vanished && t >= vanishEnd) { vanished = true; S.tint('#0a0612', 0.4, 0.35); }
          // 급습: 적 뒤(오른쪽)에서 교차 베기
          if (!struck && t >= strikeAt) { struck = true;
            const ex = tgt.x, ey = tgt.y - 9;
            S.beam({ x1: ex + 24, y1: ey - 22, x2: ex - 18, y2: ey + 10, color: '#ffffff', width: sneak ? 4 : 3, jag: 0, life: 0.16, max: 0.16 });
            S.beam({ x1: ex + 24, y1: ey + 10, x2: ex - 18, y2: ey - 22, color: sneak ? purpW : crit, width: sneak ? 3 : 2, jag: 0, life: 0.18, max: 0.18 });
            if (sneak) { S.beam({ x1: ex + 22, y1: ey - 8, x2: ex - 18, y2: ey - 8, color: purp, width: 2, jag: 0, life: 0.16, max: 0.16 }); }
            S.doFlash('#fff0e0', sneak ? 0.95 : 0.7); S.doShake(sneak ? 10 : 7); tgt.flinch = 6; tgt.tint = 1;
            burst(S, ex, ey, [crit, head, '#fff', blood], sneak ? 44 : 30, sneak ? 210 : 170, { additive: true, size: 3 });
            for (let i = 0; i < (sneak ? 10 : 6); i++) S.p({ x: ex + rnd(-4, 4), y: ey + rnd(-4, 4), vx: rnd(-40, 40), vy: rnd(20, 60), g: 120, life: 0.5, max: 0.5, size: 2, color: blood });
            if (sneak) sneakBurst(S, ex, ey);
            else S.floatSpr({ x: ex, y: ey - 16, vy: -16, life: 0.7, max: 0.7, draw: (g, s) => critMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2)) });
          }
          // 캐스터 복귀(페이드인)
          if (t > 0.85) S.caster.alpha = Math.min(1, (t - 0.85) / 0.3);
        },
        done: (tt) => { if (tt > 1.3) { S.caster.alpha = 1; return true; } return false; },
      };
    },

    /* 강철 덫 — 적 발밑에 덫 설치(이동/속도↓). 던지기 → 철컥 */
    snaretrap(S) {
      cast(S); const tgt = S.primary(); let t = 0, set = false, snap = false; const from = { x: S.caster.x + 7, y: S.caster.y - 10 };
      const trapY = () => S.groundY - 1;
      return {
        update(dt) {
          t += dt;
          // 덫 투척(포물선)
          if (t < 0.4) { const k = t / 0.4; const x = from.x + (tgt.x - from.x) * k, y = from.y + (trapY() - from.y) * k - Math.sin(k * Math.PI) * 24;
            S.p({ x, y, life: 0.12, max: 0.12, size: 3, color: shaftD, shrink: false }); }
          if (!set && t >= 0.4) { set = true; burst(S, tgt.x, trapY(), [shaftD, PAL.dust], 8, 50, { g: 40 }); }
          // 덫 표시(벌어진 톱니) — 지면
          if (t >= 0.4 && t < 0.95) S.floatSpr({ x: tgt.x, y: trapY(), life: 0.05, max: 0.05, draw: (g, s) => { g.globalAlpha = 0.9; g.fillStyle = shaft; for (let i = -3; i <= 3; i++) g.fillRect(s.x + i * 3, s.y - 2, 1, 3); g.fillRect(s.x - 9, s.y, 18, 1); g.globalAlpha = 1; } });
          // 철컥! 발동
          if (!snap && t >= 0.95) { snap = true; S.doShake(4); tgt.flinch = 4; tgt.tint = 0.5;
            S.floatSpr({ x: tgt.x, y: trapY(), life: 0.2, max: 0.2, draw: (g, s) => { const k = s.life / s.max; g.globalAlpha = k; g.fillStyle = shaft; for (let i = -3; i <= 3; i++) g.fillRect(s.x + i * 3, s.y - Math.round((1 - k) * 6), 1, 6); g.globalAlpha = 1; } });
            burst(S, tgt.x, trapY(), [shaft, shaftD, PAL.dust], 12, 90, { up: 8 });
            S.floatSpr({ x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.mp, draw: (g, s) => { g.globalAlpha = Math.min(1, s.life / s.max + .2); g.fillStyle = s.col; g.fillRect(s.x - 0.5, s.y - 4, 1, 8); g.fillRect(s.x - 2, s.y + 1, 1, 1); g.fillRect(s.x + 1, s.y + 1, 1, 1); g.fillRect(s.x - 1, s.y + 2, 1, 1); g.fillRect(s.x, s.y + 2, 1, 1); g.globalAlpha = 1; } });
          }
        },
        done: (tt) => tt > 1.4,
      };
    },

    /* 연막탄 — 자기 회피↑ + 적 명중↓. 회색 연막 + 은신 잔상 */
    smokebomb(S) {
      cast(S); let t = 0, popped = false; const u = S.caster, cx = u.x, cy = u.y - 9; const targets = S.targets();
      return {
        update(dt) {
          t += dt;
          if (!popped && t > 0.12) { popped = true; S.doShake(2);
            for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, s = rnd(30, 90); S.p({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 10, g: -10, drag: 0.9, life: rnd(0.6, 1.2), max: 1.2, size: (rnd(3, 6) | 0), color: Math.random() < 0.5 ? '#46506a' : '#2a2438', shrink: true }); }
          }
          // 지속 연막 뭉게뭉게
          if (t < 0.9 && Math.random() < 0.7) S.p({ x: cx + rnd(-14, 14), y: cy + rnd(-8, 10), vy: -rnd(4, 14), life: rnd(0.5, 1), max: 1, size: (rnd(3, 6) | 0), color: '#3a4160', shrink: true });
          // 캐스터 깜빡(회피 태세)
          if (t > 0.15 && t < 0.9) u.alpha = 0.4 + 0.4 * Math.sin(t * 18);
          // 적 명중↓
          if (Math.abs(t - 0.4) < dt) targets.forEach(e => { e.tint = 0.3; S.floatSpr({ x: e.x, y: e.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.mp, draw: (g, s) => { g.globalAlpha = Math.min(1, s.life / s.max + .2); g.fillStyle = s.col; g.fillRect(s.x - 0.5, s.y - 4, 1, 8); g.fillRect(s.x - 2, s.y + 1, 1, 1); g.fillRect(s.x + 1, s.y + 1, 1, 1); g.fillRect(s.x - 1, s.y + 2, 1, 1); g.fillRect(s.x, s.y + 2, 1, 1); g.globalAlpha = 1; } }); });
        },
        done: (tt) => { if (tt > 1.1) { S.caster.alpha = 1; return true; } return false; },
      };
    },

    /* 은신 — 상태 진입. 연막과 함께 모습을 감춤 → 다음 사냥꾼 스킬이 [기습] 강화됨 */
    stealth(S) {
      cast(S); let t = 0; const u = S.caster, cx = u.x, cy = u.y - 9;
      S._stealth = true; if (S.notifyState) S.notifyState(); // 즉시 은신 상태 진입
      return {
        update(dt) {
          t += dt;
          // 연막 퍼지며 페이드아웃
          if (t < 0.4) { u.alpha = Math.max(0.18, 1 - t / 0.45);
            if (Math.random() < 0.8) { const a = Math.random() * 6.28, s = rnd(20, 70); S.p({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 8, drag: 0.9, life: rnd(0.5, 1), max: 1, size: (rnd(3, 6) | 0), color: Math.random() < 0.5 ? '#46506a' : '#2a2438', shrink: true }); } }
          // 보라 잔상 + 은신 표식
          if (t < 0.9 && Math.random() < 0.5) S.p({ x: cx + rnd(-8, 8), y: u.y - rnd(0, 14), vy: -rnd(10, 26), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? purp : purpW, additive: true, shrink: true });
          if (!u._stmark) { u._stmark = true; S.floatSpr({ x: cx, y: u.y - 24, vy: -8, life: 1.0, max: 1.0, draw: (g, s) => { g.globalAlpha = Math.min(1, s.life / s.max); g.fillStyle = purpW; g.font = ''; // 눈 모양 은신 아이콘
        g.fillRect(s.x - 5, s.y, 10, 1); g.fillRect(s.x - 5, s.y, 1, -2); g.fillRect(s.x + 4, s.y, 1, -2); g.fillRect(s.x - 1, s.y - 3, 2, 2); g.globalAlpha = 1; } }); }
          // 은신 상태 유지 (즉시 진입됨, 다음 스킬이 소비)
        },
        // 은신은 캐스터를 반투명으로 유지(상태 지속 암시) — 다음 스킬/리셋 때 복원
        done: (tt) => { if (tt > 1.0) { u.alpha = S._stealth ? 0.35 : 1; return true; } return false; },
      };
    },
  };

  const GRP = '사냥꾼 · 궁술/암살';
  const HUNT_META = [
    { id: 'stealth', name: '은신', cost: 'MP 3', kind: '상태 · 은신', el: 'arrow', grp: GRP, caster: 'huntress', enemy: 'goblin', self: true, from: '모습 감춤 → 다음 스킬 [기습] 강화', power: 0, stealth: true },
    { id: 'aimedshot', name: '정조준', cost: 'MP 3', kind: '단일 · 급소', el: 'arrow', grp: GRP, caster: 'huntress', enemy: 'golem', from: '레티클 고정 → 치명 일격', power: 16, sneak: '헤드샷(추가 치명)' },
    { id: 'multishot', name: '연사', cost: 'MP 4', kind: '단일 · 다단', el: 'arrow', grp: GRP, caster: 'huntress', enemy: 'goblin', from: '화살 5연발', power: 6, sneak: '기습 7연발' },
    { id: 'piercingshot', name: '관통 사격', cost: 'MP 5', kind: '단일 · 관통', el: 'arrow', grp: GRP, caster: 'huntress', enemy: 'golem', from: '차징 → 일직선 관통', power: 18, sneak: '이중 관통(보라)' },
    { id: 'assassinate', name: '그림자 일격', cost: 'MP 6', kind: '단일 · 암살', el: 'arrow', grp: GRP, caster: 'huntress', enemy: 'skeleton_king', from: '은신 → 급소 암살', power: 26, sneak: '즉시 발동 + 확정 치명' },
    { id: 'snaretrap', name: '강철 덫', cost: 'MP 4', kind: '단일 · 속박', el: 'arrow', grp: GRP, caster: 'huntress', enemy: 'goblin', from: '덫 설치 → 속도↓', power: 8 },
    { id: 'smokebomb', name: '연막탄', cost: 'MP 3', kind: '자기 · 회피↑', el: 'arrow', grp: GRP, caster: 'huntress', enemy: 'goblin', self: true, from: '연막 → 회피↑·적 명중↓', power: 0 },
  ];

  Object.assign(DEFS, HUNT);
  HUNT_META.forEach(m => META.push(m));
  window.SpellFXDefs.HUNT_META = HUNT_META;
})();

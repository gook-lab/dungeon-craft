/* ============================================================
   spellfx-monster2.js — 확장 베스티어리용 몬스터 스킬 (2차, 11종)
   5지역 가족(undead·fire·icy·void·짐승)에 맞춰 역할 빈틈을 메움:
   광역 암흑·석화·속박·음파·다단·급강하·아군버프(군고)·석화방벽 등.
   window.SpellFXDefs.{DEFS,META,ALL_TARGET} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };
  const C = { void: '#b483f0', voidD: '#6a4fb0', voidDk: '#241a3a', voidW: '#e6dcff',
    stone: '#9a957c', stoneL: '#c4bda0', stoneD: '#5a5444', web: '#dfe4f2', webD: '#9aa3c8',
    sonic: '#cfe0ff', tongue: '#e86a8a', tongueD: '#b04060',
    fireDeep: '#7a1f0a', fireR: '#e25563', fireY: '#f0c44c', fireW: '#fff0b8',
    rally: '#e25563', rallyG: '#ffd766', claw: '#fff0b8', dust: '#b9b48f', red: '#e25563', heal: '#62c46a' };

  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.25, 0.6), max: 0.6, size: o.size || 2, color: cols[i % cols.length], shrink: o.shrink !== false, additive: o.additive }); }
  }
  function downMark(g, x, y, a, col) { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x - 0.5, y - 4, 1, 8); g.fillRect(x - 2, y + 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x - 1, y + 2, 1, 1); g.fillRect(x, y + 2, 1, 1); g.globalAlpha = 1; }
  function upMark(g, x, y, a, col) { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x - 0.5, y - 4, 1, 8); g.fillRect(x - 2, y - 3, 1, 1); g.fillRect(x + 1, y - 3, 1, 1); g.fillRect(x - 1, y - 4, 1, 1); g.fillRect(x, y - 4, 1, 1); g.globalAlpha = 1; }

  const MON2 = {
    /* 공허 폭발 — void 전체. 화면 중앙에서 암흑이 퍼져 파티 강타 */
    voidblast(S) {
      const targets = S.targets(); cast(S); S.tint('#0a0612', 0.5, 1.0);
      let t = 0, blown = false; const cx = S.W * 0.62, cy = S.groundY - 22;
      return {
        update(dt) {
          t += dt;
          // 수렴 차징
          if (t < 0.5) { for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = 36 - t * 50; S.p({ x: cx + Math.cos(a) * Math.max(4, r), y: cy + Math.sin(a) * Math.max(4, r), vx: -Math.cos(a) * 26, vy: -Math.sin(a) * 26, life: 0.25, max: 0.25, size: 2, color: Math.random() < 0.5 ? C.void : C.voidDk, additive: true, shrink: true }); } }
          if (!blown && t >= 0.5) { blown = true; S.doFlash('#1a0a2a', 0.8); S.doShake(7);
            burst(S, cx, cy, [C.voidW, C.void, C.voidD, C.voidDk], 40, 200, { additive: true, size: 3 });
            [0, 0.07].forEach(dl => S.floatSpr({ x: cx, y: cy, life: 0.5 - dl, max: 0.5, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = C.void; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 70, 0, 7); g.stroke(); g.globalAlpha = 1; } }));
            targets.forEach(e => { e.flinch = 4; e.tint = 0.8; e.tintColor = '#b483f0'; });
          }
        },
        done: (tt) => { if (tt > 1.2) { S.targets().forEach(e => e.tintColor = null); return true; } return false; },
      };
    },

    /* 그림자 화살 — dark 단일. 검은 구체 발사 → 암흑 폭발 */
    shadowbolt(S) {
      cast(S); const tgt = S.primary(); let hit = false, t = 0; const fx = S.caster.x + 7, fy = S.caster.y - 12;
      return {
        update(dt) {
          t += dt; const dur = 0.34, k = Math.min(1, t / dur);
          if (!hit) { const x = fx + (tgt.x - fx) * k, y = fy + (tgt.y - 9 - fy) * k;
            S.p({ x, y, life: 0.12, max: 0.12, size: 4, color: C.voidDk, additive: false });
            for (let i = 0; i < 2; i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), life: 0.3, max: 0.3, size: 2, color: Math.random() < 0.5 ? C.void : C.voidD, additive: true, shrink: true });
            if (k >= 1) { hit = true; S.doFlash('#1a0a2a', 0.4); S.doShake(3); tgt.flinch = 4; tgt.tint = 0.7; tgt.tintColor = '#b483f0';
              burst(S, x, y, [C.voidW, C.void, C.voidD, C.voidDk], 20, 130, { additive: true }); }
          }
        },
        done: (tt) => { if (tt > 1.0) { tgt.tintColor = null; return true; } return false; },
      };
    },

    /* 석화 — 메두사. 회색 석화가 대상을 덮음(행동불가) */
    petrify(S) {
      cast(S); const tgt = S.primary(); let t = 0, beam = false;
      return {
        update(dt) {
          t += dt;
          // 메두사 시선 광선
          if (!beam && t > 0.15) { beam = true; S.beam({ x1: S.caster.x + 7, y1: S.caster.y - 13, x2: tgt.x, y2: tgt.y - 10, color: C.stoneL, width: 2, jag: 0, life: 0.3, max: 0.3 }); S.doFlash(C.stoneL, 0.3); }
          // 석화 진행: 회색 틴트 점증 + 돌조각
          if (t > 0.2) { tgt.tintColor = C.stone; tgt.tint = Math.min(0.92, (t - 0.2) * 1.4);
            if (Math.random() < 0.4) S.p({ x: tgt.x + rnd(-8, 8), y: tgt.y - rnd(2, 18), vy: rnd(10, 30), g: 60, life: 0.5, max: 0.5, size: 2, color: Math.random() < 0.5 ? C.stone : C.stoneD }); }
          if (Math.abs(t - 0.6) < dt) { S.doShake(2); S.floatSpr({ x: tgt.x, y: tgt.y - 20, vy: -10, life: 0.9, max: 0.9, draw: (g, s) => downMark(g, s.x, s.y, Math.min(1, s.life / s.max), C.stoneL) }); }
        },
        done: (tt) => { if (tt > 1.3) { tgt.tint = 0; tgt.tintColor = null; return true; } return false; },
      };
    },

    /* 거미줄 — 거미/여왕. 흰 거미줄이 날아가 속박(속도↓) */
    webshot(S) {
      cast(S); const tgt = S.primary(); let t = 0, hit = false; const fx = S.caster.x + 6, fy = S.caster.y - 9;
      return {
        update(dt) {
          t += dt; const k = Math.min(1, t / 0.3);
          if (!hit) { const x = fx + (tgt.x - fx) * k, y = fy + (tgt.y - 9 - fy) * k - Math.sin(k * Math.PI) * 12;
            for (let i = 0; i < 3; i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), life: 0.2, max: 0.2, size: 2, color: C.web, shrink: true });
            if (k >= 1) { hit = true; S.doShake(2); tgt.flinch = 2;
              // 거미줄 그물 그림
              S.floatSpr({ x: tgt.x, y: tgt.y - 10, life: 0.9, max: 0.9, draw: (g, s) => { const a = Math.min(1, (s.max - s.life) * 4) * (s.life > 0.3 ? 1 : s.life / 0.3); g.globalAlpha = a * 0.9; g.strokeStyle = C.web; g.lineWidth = 1; for (let r = 5; r <= 14; r += 4) { g.beginPath(); g.arc(s.x, s.y, r, 0, 7); g.stroke(); } for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x + Math.cos(ang) * 14, s.y + Math.sin(ang) * 14); g.stroke(); } g.globalAlpha = 1; } });
              S.floatSpr({ x: tgt.x, y: tgt.y - 22, vy: -10, life: 0.8, max: 0.8, draw: (g, s) => downMark(g, s.x, s.y, Math.min(1, s.life / s.max), C.webD) });
            }
          }
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 음파 비명 — 박쥐떼/까마귀. 전체 약화(명중↓) */
    screech(S) {
      const targets = S.targets(); cast(S); let t = 0, pulse = 0, marked = targets.map(() => false);
      const cx = S.caster.x, cy = S.caster.y - 11;
      return {
        update(dt) {
          t += dt; pulse += dt;
          // 음파 호 (부채꼴 링)
          if (pulse > 0.16 && t < 0.85) { pulse = 0; S.floatSpr({ x: cx, y: cy, life: 0.45, max: 0.45, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = (s.life / s.max) * 0.8; g.strokeStyle = C.sonic; g.lineWidth = 1; const r = 4 + k * 70; g.beginPath(); g.arc(s.x, s.y, r, -0.7, 0.7); g.stroke(); g.beginPath(); g.arc(s.x, s.y, r - 3, -0.6, 0.6); g.stroke(); g.globalAlpha = 1; } }); S.doShake(1.2); }
          targets.forEach((e, i) => { if (!marked[i] && t > 0.25 + i * 0.08) { marked[i] = true; e.flinch = 2; e.tint = 0.3;
            S.floatSpr({ x: e.x, y: e.y - 20, vy: -10, life: 0.8, max: 0.8, draw: (g, s) => downMark(g, s.x, s.y, Math.min(1, s.life / s.max), C.sonic) }); } });
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 혀 채찍 — 거대 두꺼비. 단일 + 기절 */
    tonguelash(S) {
      cast(S); const tgt = S.primary(); let t = 0, hit = false; const fx = S.caster.x + 7, fy = S.caster.y - 9;
      return {
        update(dt) {
          t += dt;
          // 뻗는 혀
          if (t < 0.4) { const k = t / 0.3; S.floatSpr({ x: 0, y: 0, life: 0.04, max: 0.04, draw: (g) => { g.globalAlpha = 0.95; g.strokeStyle = C.tongue; g.lineWidth = 3; g.beginPath(); g.moveTo(fx, fy); const ex = fx + (tgt.x - fx) * Math.min(1, k); g.lineTo(ex, fy + (tgt.y - 9 - fy) * Math.min(1, k)); g.stroke(); g.strokeStyle = C.tongueD; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; } }); }
          if (!hit && t >= 0.32) { hit = true; S.doFlash('#ffd0dc', 0.4); S.doShake(5); tgt.flinch = 5; tgt.tint = 0.5;
            burst(S, tgt.x, tgt.y - 9, [C.tongue, C.tongueD, '#fff'], 14, 100, { additive: true });
            // 기절 별 (머리 위 도는 별)
            S.floatSpr({ x: tgt.x, y: tgt.y - 22, life: 0.9, max: 0.9, draw: (g, s) => { const k = (s.max - s.life) * 8; g.globalAlpha = Math.min(1, s.life / s.max + .2); for (let i = 0; i < 3; i++) { const a = k + i * 2.1; const x = s.x + Math.cos(a) * 7, y = s.y + Math.sin(a) * 3; g.fillStyle = C.rallyG; g.fillRect(x - 0.5, y - 1.5, 1, 3); g.fillRect(x - 1.5, y - 0.5, 3, 1); } g.globalAlpha = 1; } });
          }
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 전열 고무 — 전쟁 고수. 아군 몬스터 전체 공격·속도↑ (새 메커닉) */
    wardrum(S) {
      cast(S); let t = 0, beat = 0; const u = S.caster, cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt; beat += dt;
          // 북소리 충격파 (저음 큰 링) — 3박
          if (beat > 0.28 && t < 0.95) { beat = 0; S.doShake(3); S.doFlash(C.rally, 0.16);
            S.floatSpr({ x: cx, y: cy, life: 0.5, max: 0.5, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = (s.life / s.max) * 0.8; g.strokeStyle = C.rallyG; g.lineWidth = 2; g.beginPath(); g.arc(s.x, s.y, 4 + k * 50, 0, 7); g.stroke(); g.globalAlpha = 1; } });
            burst(S, cx, cy, [C.rally, C.rallyG], 10, 80, { up: 4, additive: true }); }
          // 상승 사기 입자 + 공격↑ 마크
          if (t < 1.0 && Math.random() < 0.7) S.p({ x: cx + rnd(-16, 16), y: u.y - rnd(0, 8), vy: -rnd(20, 50), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? C.rally : C.rallyG, additive: true, shrink: true });
          if (Math.abs(t - 0.5) < dt) { S.floatSpr({ x: cx - 14, y: u.y - 22, vy: -12, life: 0.9, max: 0.9, draw: (g, s) => upMark(g, s.x, s.y, Math.min(1, s.life / s.max), C.rally) }); S.floatSpr({ x: cx + 14, y: u.y - 22, vy: -12, life: 0.9, max: 0.9, draw: (g, s) => upMark(g, s.x, s.y, Math.min(1, s.life / s.max), C.rallyG) }); }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 석화 방벽 — 가고일/룬 수호상. 자기/아군 방어↑ */
    stoneskin(S) {
      cast(S); let t = 0, formed = false; const u = S.caster, cx = u.x, cy = u.y - 10;
      return {
        update(dt) {
          t += dt;
          if (!formed && t > 0.1) { formed = true; S.doFlash(C.stoneL, 0.28); S.doShake(2); }
          // 돌 비늘 솟아오름
          if (t < 0.9 && Math.random() < 0.7) S.p({ x: cx + rnd(-12, 12), y: u.y - rnd(0, 20), vy: -rnd(6, 18), life: rnd(0.4, 0.8), max: 0.8, size: (rnd(2, 4) | 0), color: Math.random() < 0.5 ? C.stone : C.stoneL, shrink: false });
          // 육각 돌 방벽 윤곽
          if (!u._sshex) { u._sshex = true; S.floatSpr({ x: cx, y: cy, life: 1.2, max: 1.2, draw: (g, s) => { const ap = Math.min(1, (s.max - s.life) * 4) * (s.life > 0.3 ? 1 : s.life / 0.3); g.globalAlpha = ap * 0.85; g.strokeStyle = C.stoneL; g.lineWidth = 1; g.beginPath(); const R = 16; for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3, px = s.x + Math.cos(a) * R * 0.8, py = s.y + Math.sin(a) * R; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.globalAlpha = ap * 0.18; g.fillStyle = C.stone; g.fill(); g.globalAlpha = 1; } }); }
          if (Math.abs(t - 0.5) < dt) S.floatSpr({ x: cx, y: u.y - 26, vy: -12, life: 0.9, max: 0.9, draw: (g, s) => upMark(g, s.x, s.y, Math.min(1, s.life / s.max), C.stoneL) });
        },
        done: (tt) => { if (tt > 1.2) { S.caster._sshex = false; return true; } return false; },
      };
    },

    /* 연속 할퀴기 — 들개/추적자. 단일 다단(3타) */
    flurry(S) {
      cast(S); const tgt = S.primary(); let t = 0, last = 0, count = 0;
      const ang = [[1, -1], [1, 1], [1, -0.3]];
      return {
        update(dt) {
          t += dt;
          if (t < 0.25) S.caster.hop = 4;
          if (t >= 0.25 && count < 3 && t >= 0.25 + count * 0.18) {
            const a = ang[count]; const len = 22;
            S.beam({ x1: tgt.x - a[0] * len, y1: tgt.y - 9 - a[1] * len, x2: tgt.x + a[0] * len, y2: tgt.y - 9 + a[1] * len, color: C.claw, width: 2, jag: 0, life: 0.14, max: 0.14 });
            S.beam({ x1: tgt.x - a[0] * len, y1: tgt.y - 6 - a[1] * len, x2: tgt.x + a[0] * len, y2: tgt.y - 6 + a[1] * len, color: '#fff', width: 1, jag: 0, life: 0.12, max: 0.12 });
            burst(S, tgt.x + rnd(-4, 4), tgt.y - 9, [C.claw, '#fff', C.rallyG], 7, 90, { additive: true });
            tgt.flinch = 3; tgt.tint = 0.6; S.doShake(2.2); count++;
          }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 급강하 — 까마귀/박쥐. 위에서 급강하 충돌(고배율) */
    divebomb(S) {
      cast(S); const tgt = S.primary(); let t = 0, hit = false; const sx = tgt.x - 30, sy = -14;
      return {
        update(dt) {
          t += dt;
          if (t < 0.2) S.caster.alpha = Math.max(0, 1 - t / 0.18); // 캐스터 도약(사라짐)
          // 급강하 궤적
          if (t >= 0.18 && t < 0.4) { const k = (t - 0.18) / 0.22; const x = sx + (tgt.x - sx) * k, y = sy + (tgt.y - 9 - sy) * k;
            for (let i = 0; i < 3; i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), life: 0.18, max: 0.18, size: 2, color: Math.random() < 0.5 ? C.sonic : '#fff', streak: 8, additive: true, fade: false, vx: (tgt.x - sx), vy: (tgt.y - 9 - sy) }); }
          if (!hit && t >= 0.38) { hit = true; S.doFlash('#fff', 0.5); S.doShake(6); tgt.flinch = 5; tgt.tint = 0.7;
            burst(S, tgt.x, tgt.y - 9, [C.sonic, '#fff', C.webD], 20, 150, { additive: true, size: 2 }); }
          if (t > 0.55) S.caster.alpha = Math.min(1, (t - 0.55) / 0.3); // 복귀
        },
        done: (tt) => { if (tt > 1.0) { S.caster.alpha = 1; return true; } return false; },
      };
    },

    /* 용암 분출 — 마그마 가족. 전체 화염(지면에서 솟구침) */
    eruption(S) {
      const targets = S.targets(); cast(S); S.tint(C.fireDeep, 0.28, 1.4);
      let t = 0; const next = targets.map(() => rnd(0.1, 0.5));
      return {
        update(dt) {
          t += dt;
          // 잿불 상승 (배경)
          if (Math.random() < 0.5) S.p({ x: rnd(0, S.W), y: rnd(S.groundY - 6, S.groundY), vy: -rnd(20, 50), life: rnd(0.6, 1.2), max: 1.2, size: (rnd(1, 3) | 0) || 1, color: [C.fireY, C.fireR, C.fireW][(rnd(0, 3) | 0)], additive: true, shrink: true });
          targets.forEach((e, i) => { next[i] -= dt; if (next[i] <= 0 && t < 1.3) { next[i] = rnd(0.35, 0.6);
            // 발밑 용암 기둥 솟구침
            for (let k = 0; k < 8; k++) S.p({ x: e.x + rnd(-5, 5), y: S.groundY, vy: -rnd(120, 240), g: 240, life: rnd(0.4, 0.7), max: 0.7, size: (rnd(2, 4) | 0), color: [C.fireW, C.fireY, C.fireR, C.fireDeep][k % 4], additive: true });
            S.doFlash(C.fireY, 0.2); S.doShake(3); e.flinch = 4; e.tint = 0.6; e.tintColor = '#e25563';
          } });
        },
        done: (tt) => { if (tt > 1.6) { S.targets().forEach(e => e.tintColor = null); return true; } return false; },
      };
    },
  };

  const GRP = '몬스터 스킬 · 확장 베스티어리';
  const MON2_META = [
    { id: 'voidblast', name: '공허 폭발', cost: '적', kind: '전체 · 암흑', el: 'dark', grp: GRP, caster: 'reaper', enemy: 'knight', mon: true, family: 'void', users: '사신·망령·군주', aoe: true, power: 16, from: '암흑 수렴 → 광역 폭발' },
    { id: 'shadowbolt', name: '그림자 화살', cost: '적', kind: '단일 · 암흑', el: 'dark', grp: GRP, caster: 'necromancer', enemy: 'knight', mon: true, family: 'void', users: '강령술사·망령', power: 14, from: '검은 구체 → 암흑 폭발' },
    { id: 'petrify', name: '석화', cost: '적', kind: '단일 · 석화', el: 'earth', grp: GRP, caster: 'medusa', enemy: 'warrior', mon: true, family: '짐승', users: '메두사', from: '시선 → 석화(행동불가)' },
    { id: 'webshot', name: '거미줄', cost: '적', kind: '단일 · 속박', el: 'phys', grp: GRP, caster: 'spider', enemy: 'huntress', mon: true, family: '벌레', users: '거미·여왕', power: 4, from: '거미줄 → 속도↓' },
    { id: 'screech', name: '음파 비명', cost: '적', kind: '전체 · 약화', el: 'wind', grp: GRP, caster: 'crow', enemy: 'mage', mon: true, family: '비행', users: '박쥐·까마귀·말벌', aoe: true, from: '음파 → 파티 명중↓' },
    { id: 'tonguelash', name: '혀 채찍', cost: '적', kind: '단일 · 기절', el: 'phys', grp: GRP, caster: 'frog', enemy: 'mage', mon: true, family: '짐승', users: '거대 두꺼비', power: 12, from: '혀 → 기절' },
    { id: 'wardrum', name: '전열 고무', cost: '적', kind: '아군 강화', el: 'phys', grp: GRP, caster: 'war_drummer', enemy: 'knight', mon: true, family: '언데드', users: '전쟁 고수', self: true, from: '북소리 → 아군 공격·속도↑' },
    { id: 'stoneskin', name: '석화 방벽', cost: '적', kind: '자기/아군 · 방어', el: 'earth', grp: GRP, caster: 'gargoyle', enemy: 'knight', mon: true, family: '석상', users: '가고일·룬 수호상', self: true, from: '돌 비늘 → 방어↑' },
    { id: 'flurry', name: '연속 할퀴기', cost: '적', kind: '단일 · 다단', el: 'phys', grp: GRP, caster: 'wolf', enemy: 'mage', mon: true, family: '짐승', users: '들개·추적자·늑대', power: 6, from: '발톱 3연타' },
    { id: 'divebomb', name: '급강하', cost: '적', kind: '단일 · 공중', el: 'phys', grp: GRP, caster: 'crow', enemy: 'warrior', mon: true, family: '비행', users: '까마귀·화염 박쥐', power: 17, from: '급강하 충돌(고배율)' },
    { id: 'eruption', name: '용암 분출', cost: '적', kind: '전체 · 화염', el: 'fire', grp: GRP, caster: 'magma_golem', enemy: 'knight', mon: true, family: 'fire', users: '마그마 골렘·드레이크', aoe: true, power: 13, from: '지면 용암 기둥' },
  ];

  Object.assign(DEFS, MON2);
  MON2_META.forEach(m => { META.push(m); if (m.aoe) ALL_TARGET.add(m.id); });
  window.SpellFXDefs.MON2_META = MON2_META;
})();

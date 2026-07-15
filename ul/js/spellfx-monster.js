/* ============================================================
   spellfx-monster.js — 몬스터 스킬 (난이도용 적 전용기)
   현재 적은 기본 공격(+보스 heavy)만 함. 가족(family)별 스킬을 부여해
   전투에 위협·변수를 더한다. 미리보기: 몬스터=시전자(좌), 영웅=대상(우).
   window.SpellFXDefs.{DEFS,META,ALL_TARGET} 에 병합.
   ============================================================ */
(function () {
  const { DEFS, META, ALL_TARGET, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cast = (S) => { S.caster.hop = 4; };
  const F = { fireDeep: '#7a1f0a', fireR: '#e25563', fireY: '#f0c44c', fireW: '#fff0b8',
    ice: '#56a8e8', iceW: '#eaf6ff', poison: '#9ad94f', poisonD: '#6fae2e',
    void: '#b483f0', voidD: '#6a4fb0', voidDk: '#241a3a', shock: '#fff0b8', shockB: '#9ad6ff',
    red: '#e25563', heal: '#62c46a', healW: '#eafbe8', bone: '#e8e4d0', boneD: '#9a957c', dust: '#b9b48f' };

  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.25, 0.6), max: 0.6, size: o.size || 2, color: cols[i % cols.length], shrink: o.shrink !== false, additive: o.additive }); }
  }
  // 디버프 하강 화살표
  function downMark(g, x, y, a, col) { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x - 0.5, y - 4, 1, 8); g.fillRect(x - 2, y + 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x - 1, y + 2, 1, 1); g.fillRect(x, y + 2, 1, 1); g.globalAlpha = 1; }
  // 작은 해골(소환) 픽셀
  function skull(g, x, y, a) { g.globalAlpha = a; g.fillStyle = F.bone; g.fillRect(x - 3, y - 6, 6, 5); g.fillRect(x - 2, y - 1, 4, 2);
    g.fillStyle = F.voidDk; g.fillRect(x - 2, y - 4, 1, 2); g.fillRect(x + 1, y - 4, 1, 2); g.globalAlpha = 1; }

  const MON = {
    /* 화염 브레스 — 드레이크/임프. 부채꼴 화염을 영웅(파티)에 분사 */
    firebreath(S) {
      cast(S); const tgt = S.primary(); let t = 0; const fx = S.caster.x + 8, fy = S.caster.y - 12;
      return {
        update(dt) {
          t += dt;
          if (t < 0.7) { for (let i = 0; i < 5; i++) { const a = rnd(-0.4, 0.4); const sp = rnd(120, 300);
            S.p({ x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 30, drag: 0.95, life: rnd(0.3, 0.7), max: 0.7, size: (rnd(2, 4) | 0), color: [F.fireW, F.fireY, F.fireR, F.fireDeep][(rnd(0, 4) | 0)], additive: true }); }
            if (Math.random() < 0.4) S.doFlash(F.fireY, 0.12); S.doShake(2); }
          if (Math.abs(t - 0.5) < dt) { S.doFlash(F.fireY, 0.4); tgt.flinch = 4; tgt.tint = 0.7;
            burst(S, tgt.x, tgt.y - 9, [F.fireW, F.fireY, F.fireR], 18, 120, { additive: true, up: 10 }); }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 맹독 분사 — 마녀/거미. 독 거품을 뱉어 중독 */
    venomspit(S) {
      cast(S); const tgt = S.primary(); let t = 0, hit = false; const fx = S.caster.x + 7, fy = S.caster.y - 11;
      return {
        update(dt) {
          t += dt;
          if (t < 0.35) { const k = t / 0.35, x = fx + (tgt.x - fx) * k, y = fy + (tgt.y - 9 - fy) * k - Math.sin(k * Math.PI) * 20;
            for (let i = 0; i < 2; i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), life: 0.25, max: 0.25, size: 3, color: Math.random() < 0.5 ? F.poison : F.poisonD, additive: true, shrink: true }); }
          if (!hit && t >= 0.35) { hit = true; S.doShake(2); tgt.flinch = 3; tgt.tint = 0.5;
            burst(S, tgt.x, tgt.y - 9, [F.poison, F.poisonD, F.healW], 16, 90, { additive: true, up: 8 });
            for (let i = 0; i < 5; i++) S.p({ x: tgt.x + rnd(-8, 8), y: tgt.y - rnd(2, 16), vy: -rnd(8, 18), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: F.poison, additive: true, shrink: true });
            S.floatSpr({ x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, draw: (g, s) => downMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2), F.poison) }); }
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 대지 강타 — 골렘/괴인. 내려찍어 지면 충격(방어 무시 느낌) */
    monslam(S) {
      cast(S); const tgt = S.primary(); let t = 0, hit = false;
      return {
        update(dt) {
          t += dt;
          if (t < 0.34) S.caster.hop = 5;
          if (!hit && t >= 0.34) { hit = true; S.doFlash('#d8c0a0', 0.5); S.doShake(8); tgt.flinch = 5; tgt.tint = 0.6;
            for (let dir = -1; dir <= 1; dir += 2) for (let i = 0; i < 9; i++) S.p({ x: tgt.x, y: S.groundY, vx: dir * rnd(60, 200), vy: -rnd(10, 60), g: 280, drag: 0.97, life: rnd(0.3, 0.7), max: 0.7, size: (rnd(1, 3) | 0) || 2, color: [F.dust, '#c98b2c', F.boneD][i % 3] });
            burst(S, tgt.x, tgt.y - 8, [F.dust, '#fff', '#c98b2c'], 14, 120, { up: 12, additive: true }); }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 영혼 흡수 — 망령/사신. 영웅 HP를 빨아들여 자신 회복 */
    lifedrain(S) {
      cast(S); const tgt = S.primary(); let t = 0; const cx = S.caster.x, cy = S.caster.y - 10;
      return {
        update(dt) {
          t += dt;
          if (t > 0.15 && t < 0.85) {
            // 영웅 → 몬스터로 흐르는 보라 영혼 줄기
            if (Math.random() < 0.9) { const k = Math.random(); S.p({ x: tgt.x + (cx - tgt.x) * k + rnd(-3, 3), y: (tgt.y - 9) + (cy - (tgt.y - 9)) * k + rnd(-3, 3), life: 0.2, max: 0.2, size: 2, color: Math.random() < 0.5 ? F.void : F.voidD, additive: true, shrink: true }); }
            tgt.tint = 0.5;
          }
          if (Math.abs(t - 0.2) < dt) S.beam({ x1: tgt.x, y1: tgt.y - 9, x2: cx, y2: cy, color: F.void, width: 2, jag: 3, life: 0.4, max: 0.4 });
          // 몬스터 회복 반짝
          if (t > 0.3 && Math.random() < 0.5) S.p({ x: cx + rnd(-6, 6), y: cy + rnd(-4, 4), vy: -rnd(16, 36), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: F.heal, additive: true, shrink: true });
          if (Math.abs(t - 0.5) < dt) { tgt.flinch = 3; S.floatSpr({ x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, draw: (g, s) => downMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2), F.void) }); }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 감전 — 도깨비불/유령. 노란 번개로 마비 */
    monshock(S) {
      cast(S); const tgt = S.primary(); let t = 0, hit = false;
      return {
        update(dt) {
          t += dt;
          if (!hit && t >= 0.25) { hit = true;
            S.beam({ x1: S.caster.x + 6, y1: S.caster.y - 12, x2: tgt.x, y2: tgt.y - 9, color: F.shock, width: 2, jag: 7, life: 0.18, max: 0.18 });
            S.beam({ x1: S.caster.x + 6, y1: S.caster.y - 12, x2: tgt.x, y2: tgt.y - 9, color: F.shockB, width: 4, jag: 9, life: 0.12, max: 0.12 });
            S.doFlash('#fffbe0', 0.5); S.doShake(4); tgt.flinch = 4; tgt.tint = 0.8;
            burst(S, tgt.x, tgt.y - 9, [F.shock, F.shockB, '#fff'], 16, 110, { additive: true });
            S.floatSpr({ x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, draw: (g, s) => downMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2), F.shockB) }); }
          // 지직거리는 잔류 스파크
          if (hit && t < 0.9 && Math.random() < 0.4) S.p({ x: tgt.x + rnd(-8, 8), y: tgt.y - rnd(2, 16), life: 0.12, max: 0.12, size: 2, color: F.shock, additive: true });
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 결빙 숨결 — 얼음 골렘/서리. 냉기로 동결 */
    frostbreath(S) {
      cast(S); const tgt = S.primary(); let t = 0; const fx = S.caster.x + 8, fy = S.caster.y - 11;
      return {
        update(dt) {
          t += dt;
          if (t < 0.6) { for (let i = 0; i < 4; i++) { const a = rnd(-0.35, 0.35), sp = rnd(90, 230);
            S.p({ x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.94, life: rnd(0.4, 0.8), max: 0.8, size: (rnd(1, 3) | 0) || 2, color: [F.iceW, F.ice, '#bfe6ff'][(rnd(0, 3) | 0)], additive: true, shrink: true }); } }
          if (Math.abs(t - 0.45) < dt) { S.doFlash(F.iceW, 0.4); S.doShake(2); tgt.flinch = 3; tgt.tint = 0.8;
            // 동결 결정
            for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2), sp = rnd(30, 90); S.p({ x: tgt.x, y: tgt.y - 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 120, life: rnd(0.4, 0.7), max: 0.7, size: 2, color: F.iceW }); }
            S.floatSpr({ x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, draw: (g, s) => downMark(g, s.x, s.y, Math.min(1, s.life / s.max + .2), F.ice) }); }
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 사령 소환 — 강령술사. 해골 졸개를 일으킴(난이도 급상승) */
    summon(S) {
      cast(S); let t = 0; const cx = S.caster.x, cy = S.caster.y - 9; const spots = [];
      for (let i = 0; i < 3; i++) spots.push({ x: cx + rnd(20, 70), born: false, at: 0.25 + i * 0.18 });
      return {
        update(dt) {
          t += dt;
          // 시전 암흑 오라
          if (t < 0.5 && Math.random() < 0.8) { const a = Math.random() * 6.28, r = rnd(8, 20); S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 2, vy: -Math.sin(a) * r * 2, life: 0.3, max: 0.3, size: 2, color: Math.random() < 0.5 ? F.void : F.voidDk, additive: true, shrink: true }); }
          if (Math.abs(t - 0.2) < dt) S.doFlash(F.voidD, 0.3);
          // 해골 솟아오름
          spots.forEach(sp => { if (!sp.born && t >= sp.at) { sp.born = true; S.doShake(2);
            burst(S, sp.x, S.groundY, [F.voidDk, F.boneD, F.dust], 8, 60, { up: 6 });
            S.floatSpr({ x: sp.x, y: S.groundY, vy: 0, life: 1.2, max: 1.2, draw: (g, s) => { const rise = Math.min(10, (s.max - s.life) * 30); skull(g, s.x, s.y - rise, Math.min(1, (s.max - s.life) * 3)); } });
          } });
        },
        done: (tt) => tt > 1.5,
      };
    },

    /* 저주 — 마녀/군주. 암흑 저주로 파티 다중 약화 (전체) */
    curse(S) {
      const targets = S.targets(); cast(S); S.tint('#0a0612', 0.4, 1.0);
      let t = 0, marked = targets.map(() => false); const cx = S.caster.x, cy = S.caster.y - 10;
      return {
        update(dt) {
          t += dt;
          if (t < 0.5 && Math.random() < 0.8) S.p({ x: cx + rnd(-8, 8), y: cy + rnd(-6, 6), vy: -rnd(10, 30), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: Math.random() < 0.5 ? F.void : F.voidD, additive: true, shrink: true });
          if (Math.abs(t - 0.25) < dt) S.doFlash(F.voidD, 0.35);
          targets.forEach((e, i) => { if (!marked[i] && t > 0.3 + i * 0.1) { marked[i] = true; e.tint = 0.6; e.flinch = 2;
            // 저주 고리
            S.floatSpr({ x: e.x, y: e.y - 9, life: 0.5, max: 0.5, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = F.void; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 3 + k * 16, 0, 7); g.stroke(); g.globalAlpha = 1; } });
            S.floatSpr({ x: e.x, y: e.y - 18, vy: -8, life: 0.9, max: 0.9, draw: (g, s) => downMark(g, s.x, s.y, Math.min(1, s.life / s.max), F.void) }); } });
        },
        done: (tt) => tt > 1.2,
      };
    },

    /* 광폭화 — 보스 자기 강화. 붉은 분노 오라 (공격↑·속도↑) */
    frenzy(S) {
      cast(S); let t = 0, burst0 = false; const u = S.caster, cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt;
          if (!burst0 && t > 0.12) { burst0 = true; S.doFlash('#5a0a0a', 0.45); S.doShake(5); burst(S, cx, cy, [F.red, '#ff6a4a', F.fireDeep], 20, 120, { additive: true, up: 6 }); }
          if (t < 0.4) S.tint('#2a0606', 0.32, 0.4);
          if (t < 1.0 && Math.random() < 0.9) { const a = t * 8 + Math.random() * 6.28, r = rnd(6, 18); S.p({ x: cx + Math.cos(a) * r, y: cy + rnd(-4, 8), vx: Math.cos(a) * 8, vy: -rnd(26, 64), life: rnd(0.4, 0.9), max: 0.9, size: 2, color: Math.random() < 0.6 ? F.red : '#ff8a5a', additive: true, shrink: true }); }
          // 공격↑ 표식 (상승)
          if (Math.abs(t - 0.5) < dt) S.floatSpr({ x: cx, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, draw: (g, s) => { g.globalAlpha = Math.min(1, s.life / s.max + .2); g.fillStyle = F.red; g.fillRect(s.x - 0.5, s.y - 4, 1, 8); g.fillRect(s.x - 2, s.y - 3, 1, 1); g.fillRect(s.x + 1, s.y - 3, 1, 1); g.fillRect(s.x - 1, s.y - 4, 1, 1); g.fillRect(s.x, s.y - 4, 1, 1); g.globalAlpha = 1; } });
        },
        done: (tt) => tt > 1.1,
      };
    },

    /* 재생 — 트롤/마녀 자기 회복. 녹색 생명력 */
    monregen(S) {
      cast(S); let t = 0, em = 0; const u = S.caster, cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt; em += dt;
          if (em > 0.04 && t < 1.0) { em = 0; S.p({ x: cx + rnd(-8, 8), y: u.y - rnd(0, 4), vy: -rnd(16, 40), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: Math.random() < 0.5 ? F.heal : F.healW, additive: true, shrink: true }); }
          if (t > 0.1 && !u._rgf) { u._rgf = true; S.doFlash(F.healW, 0.28); }
          if (t > 0.1 && t < 0.5 && Math.random() < 0.4) S.floatSpr({ x: cx + rnd(-8, 8), y: cy - rnd(4, 18), life: 0.3, max: 0.3, draw: (g, s) => { g.globalAlpha = s.life / s.max; g.fillStyle = F.healW; g.fillRect(s.x - 0.5, s.y - 3, 1, 6); g.fillRect(s.x - 3, s.y - 0.5, 6, 1); g.globalAlpha = 1; } });
        },
        done: (tt) => { if (tt > 1.2) { S.caster._rgf = false; return true; } return false; },
      };
    },
  };

  const GRP = '몬스터 스킬 · 적 전용';
  // caster=몬스터 스프라이트, enemy=영웅 대상. family는 게임 부여 가이드.
  const MON_META = [
    { id: 'firebreath', name: '화염 브레스', cost: '적', kind: '전체 · 화염', el: 'fire', grp: GRP, caster: 'magma_drake', enemy: 'knight', mon: true, family: 'fire', users: '드레이크·임프', from: '부채꼴 화염 분사' },
    { id: 'venomspit', name: '맹독 분사', cost: '적', kind: '단일 · 독', el: 'poison', grp: GRP, caster: 'bog_witch', enemy: 'huntress', mon: true, family: 'poison', users: '마녀·거미·키메라', from: '독 거품 → 중독' },
    { id: 'monslam', name: '대지 강타', cost: '적', kind: '단일 · 물리', el: 'phys', grp: GRP, caster: 'brute', enemy: 'mage', mon: true, family: '거구', users: '골렘·괴인·가고일', from: '내려찍기 → 충격파' },
    { id: 'lifedrain', name: '영혼 흡수', cost: '적', kind: '단일 · 흡혈', el: 'dark', grp: GRP, caster: 'reaper', enemy: 'knight', mon: true, family: 'void', users: '망령·사신·군주', from: 'HP 흡수 → 자가 회복' },
    { id: 'monshock', name: '감전', cost: '적', kind: '단일 · 마비', el: 'thunder', grp: GRP, caster: 'reaper', enemy: 'warrior', mon: true, family: '영체', users: '도깨비불·유령 위병', from: '번개 → 마비(행동불가)' },
    { id: 'frostbreath', name: '결빙 숨결', cost: '적', kind: '단일 · 냉기', el: 'ice', grp: GRP, caster: 'magma_drake', enemy: 'warrior', mon: true, family: 'icy', users: '얼음 골렘·서리', from: '냉기 → 동결' },
    { id: 'summon', name: '사령 소환', cost: '적', kind: '소환 · 증원', el: 'dark', grp: GRP, caster: 'necromancer', enemy: 'knight', mon: true, family: 'void', users: '강령술사', from: '해골 졸개 3체 소환' },
    { id: 'curse', name: '저주', cost: '적', kind: '전체 · 디버프', el: 'dark', grp: GRP, caster: 'bog_witch', enemy: 'mage', mon: true, family: 'void', users: '마녀·군주', aoe: true, from: '암흑 저주 → 파티 약화' },
    { id: 'frenzy', name: '광폭화', cost: '적', kind: '자기 · 강화', el: 'phys', grp: GRP, caster: 'werewolf', enemy: 'knight', mon: true, family: '보스', from: '붉은 분노 → 공격·속도↑' },
    { id: 'monregen', name: '재생', cost: '적', kind: '자기 · 회복', el: 'heal', grp: GRP, caster: 'bog_witch', enemy: 'knight', mon: true, family: '보스', from: '생명력 → 자가 회복' },
  ];

  Object.assign(DEFS, MON);
  MON_META.forEach(m => { META.push(m); if (m.aoe) ALL_TARGET.add(m.id); });
  window.SpellFXDefs.MON_META = MON_META;
})();

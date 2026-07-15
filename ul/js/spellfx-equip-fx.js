/* ============================================================
   spellfx-equip.js — 장비 패시브 발동 이펙트 (전투 트리거)
   착용 장비의 특이효과가 발동할 때 유닛 위에 뜨는 시각 신호.
   대상=장착 유닛(caster 위치). 짧고 명료한 트리거 연출.
   window.SpellFXDefs.{DEFS,META} 에 병합. (스킬 아님 → ALL_TARGET 제외)
   ============================================================ */
(function () {
  const { DEFS, META, PAL } = window.SpellFXDefs;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const steel = '#dfe4f2', steelD = '#9aa3c8', gold = '#ffd766', goldW = '#fff0b8',
    heal = '#62c46a', healW = '#eafbe8', guard = '#56a8e8', guardW = '#cfe0ff',
    thorn = '#e25563', poison = '#9ad94f';

  function burst(S, x, y, cols, n, spd, o) {
    o = o || {};
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
      S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g || 0, drag: 0.92, life: rnd(0.2, 0.5), max: 0.5, size: o.size || 2, color: cols[i % cols.length], shrink: o.shrink !== false, additive: o.additive }); }
  }
  // 떠오르는 라벨 텍스트 (패시브 발동 표기)
  function popLabel(S, x, y, text, col) {
    S.floatSpr({ x, y, vy: -22, life: 0.9, max: 0.9, draw: (g, s) => {
      g.globalAlpha = Math.min(1, s.life / s.max + 0.2);
      g.font = '700 11px Galmuri11, monospace'; g.textAlign = 'center';
      g.fillStyle = '#05060f'; g.fillText(text, s.x + 1, s.y + 1);
      g.fillStyle = col; g.fillText(text, s.x, s.y);
      g.globalAlpha = 1; g.textAlign = 'start';
    } });
  }
  // 상태이상 아이콘이 깨지는 연출 (저항)
  function shatterIcon(S, x, y, col) {
    for (let i = 0; i < 10; i++) { const a = rnd(0, 6.28), sp = rnd(40, 110);
      S.p({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, g: 160, drag: 0.95, life: rnd(0.3, 0.6), max: 0.6, size: 2, color: i % 2 ? col : '#fff' }); }
  }

  const EQUIP = {
    /* 반격 — 군주의 도끼/가시 갑옷. 피격 직후 붉은 반격 슬래시 */
    eq_counter(S) {
      const u = S.caster; let t = 0, struck = false, riposte = false; const cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt;
          // 피격 섬광 (받음)
          if (!struck && t >= 0.05) { struck = true; u.hop = 3; S.doShake(2);
            burst(S, cx, cy, [thorn, '#ff8a6a', '#fff'], 8, 70, { additive: true }); }
          // 반격 슬래시 (되돌려줌)
          if (!riposte && t >= 0.32) { riposte = true; S.doFlash('#ffd8d0', 0.4); S.doShake(4);
            S.beam({ x1: cx - 6, y1: cy - 16, x2: cx + 40, y2: cy + 6, color: '#fff', width: 3, jag: 0, life: 0.16, max: 0.16 });
            S.beam({ x1: cx - 6, y1: cy - 12, x2: cx + 40, y2: cy + 10, color: thorn, width: 2, jag: 0, life: 0.18, max: 0.18 });
            burst(S, cx + 30, cy, [thorn, '#ff8a6a', '#fff'], 14, 130, { additive: true });
            popLabel(S, cx, cy - 26, '반격!', thorn); }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* 크리티컬 — 대마법사 지팡이/집중의 띠. 공격이 치명타로 터짐(골드) */
    eq_crit(S) {
      const u = S.caster; const tgt = S.primary(); let t = 0, hit = false;
      return {
        update(dt) {
          t += dt;
          // 충전 글린트 (무기에)
          if (t < 0.25 && Math.random() < 0.7) S.p({ x: u.x + rnd(2, 12), y: u.y - rnd(8, 18), life: 0.2, max: 0.2, size: 2, color: Math.random() < 0.5 ? gold : goldW, additive: true });
          if (!hit && t >= 0.25) { hit = true; S.doFlash(goldW, 0.55); S.doShake(5); tgt.flinch = 5; tgt.tint = 0.8;
            // 골드 십자 치명 폭발
            S.beam({ x1: tgt.x - 28, y1: tgt.y - 9, x2: tgt.x + 28, y2: tgt.y - 9, color: goldW, width: 2, jag: 0, life: 0.16, max: 0.16 });
            S.beam({ x1: tgt.x, y1: tgt.y - 30, x2: tgt.x, y2: tgt.y + 10, color: goldW, width: 2, jag: 0, life: 0.16, max: 0.16 });
            burst(S, tgt.x, tgt.y - 9, [goldW, gold, '#fff', PAL.gold || gold], 24, 160, { additive: true, size: 3 });
            popLabel(S, tgt.x, tgt.y - 26, 'CRITICAL!', goldW); }
        },
        done: (tt) => tt > 1.0,
      };
    },

    /* HP 재생 — 불사조 갑옷/부적. 매턴 녹색 생명력 회복 + 불사조 깃털 */
    eq_regen(S) {
      const u = S.caster; let t = 0, em = 0; const cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt; em += dt;
          if (t > 0.05 && !u._eqrf) { u._eqrf = true; S.doFlash(healW, 0.2); }
          // 상승 생명력 입자
          if (em > 0.05 && t < 0.9) { em = 0; S.p({ x: cx + rnd(-9, 9), y: u.y - rnd(0, 4), vy: -rnd(16, 38), life: rnd(0.5, 1), max: 1, size: 2, color: Math.random() < 0.5 ? heal : healW, additive: true, shrink: true }); }
          // 십자 회복 반짝
          if (t > 0.1 && t < 0.5 && Math.random() < 0.4) S.floatSpr({ x: cx + rnd(-7, 7), y: cy - rnd(4, 18), life: 0.3, max: 0.3, draw: (g, s) => { g.globalAlpha = s.life / s.max; g.fillStyle = healW; g.fillRect(s.x - 0.5, s.y - 3, 1, 6); g.fillRect(s.x - 3, s.y - 0.5, 6, 1); g.globalAlpha = 1; } });
          if (Math.abs(t - 0.3) < dt) popLabel(S, cx, cy - 22, '재생 +HP', heal);
        },
        done: (tt) => { if (tt > 1.0) { S.caster._eqrf = false; return true; } return false; },
      };
    },

    /* 상태이상 저항 — 독아 단검/수호 판금. 들어온 상태이상이 깨져 무효화 */
    eq_resist(S) {
      const u = S.caster; let t = 0, broke = false; const cx = u.x, cy = u.y - 11;
      return {
        update(dt) {
          t += dt;
          // 들어오는 독/저주 기운 (위에서 내려옴)
          if (t < 0.3 && Math.random() < 0.7) S.p({ x: cx + rnd(-8, 8), y: cy - rnd(10, 24), vy: rnd(40, 80), life: 0.25, max: 0.25, size: 2, color: poison, additive: true, shrink: true });
          // 방어막이 막아 깨짐
          if (!broke && t >= 0.3) { broke = true; S.doFlash(guardW, 0.35); S.doShake(2);
            // 청색 보호 링
            S.floatSpr({ x: cx, y: cy, life: 0.4, max: 0.4, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = guardW; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 6 + k * 18, 0, 7); g.stroke(); g.globalAlpha = 1; } });
            shatterIcon(S, cx, cy - 4, poison);
            popLabel(S, cx, cy - 20, '저항!', guardW); }
        },
        done: (tt) => tt > 0.95,
      };
    },

    /* 피해 감소 — 무쇠 브로치. 피격이 청색 가드로 경감됨 */
    eq_guard(S) {
      const u = S.caster; let t = 0, hit = false; const cx = u.x, cy = u.y - 9;
      return {
        update(dt) {
          t += dt;
          if (!hit && t >= 0.08) { hit = true; u.hop = 2; S.doShake(2);
            // 청색 6각 가드 플래시
            S.floatSpr({ x: cx + 4, y: cy, life: 0.4, max: 0.4, draw: (g, s) => { const ap = s.life / s.max; g.globalAlpha = ap * 0.9; g.strokeStyle = guardW; g.lineWidth = 1; g.beginPath(); const R = 15; for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3, px = s.x + Math.cos(a) * R * 0.8, py = s.y + Math.sin(a) * R; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.globalAlpha = ap * 0.18; g.fillStyle = guard; g.fill(); g.globalAlpha = 1; } });
            burst(S, cx, cy, [guardW, guard, '#fff'], 10, 80, { additive: true });
            popLabel(S, cx, cy - 22, '피해 경감', guardW); }
        },
        done: (tt) => tt > 0.95,
      };
    },
  };

  const GRP = '장비 패시브 · 발동 이펙트';
  const EQUIP_META = [
    { id: 'eq_counter', name: '반격', cost: '패시브', kind: '피격 시 발동 · 반격', el: 'phys', grp: GRP, equip: true, caster: 'warrior', enemy: 'goblin', src: '군주의 도끼 · 가시 갑옷', from: '피격 직후 반격 슬래시' },
    { id: 'eq_crit', name: '크리티컬', cost: '패시브', kind: '공격 시 발동 · 치명타', el: 'holy', grp: GRP, equip: true, caster: 'mage', enemy: 'golem', src: '대마법사 지팡이 · 집중의 띠', from: '치명타 골드 폭발' },
    { id: 'eq_regen', name: 'HP 재생', cost: '패시브', kind: '매턴 발동 · 회복', el: 'heal', grp: GRP, equip: true, caster: 'knight', enemy: 'goblin', self: true, src: '불사조 갑옷 · 부적', from: '매턴 생명력 회복' },
    { id: 'eq_resist', name: '상태이상 저항', cost: '패시브', kind: '피격 시 발동 · 무효', el: 'shield', grp: GRP, equip: true, caster: 'knight', enemy: 'bog_witch', self: true, src: '독아 단검 · 수호 판금', from: '상태이상 깨뜨려 무효화' },
    { id: 'eq_guard', name: '피해 감소', cost: '패시브', kind: '피격 시 발동 · 경감', el: 'shield', grp: GRP, equip: true, caster: 'warrior', enemy: 'goblin', self: true, src: '무쇠 브로치', from: '청색 가드로 피해 경감' },
  ];

  Object.assign(DEFS, EQUIP);
  EQUIP_META.forEach(m => META.push(m));
  window.SpellFXDefs.EQUIP_META = EQUIP_META;
})();

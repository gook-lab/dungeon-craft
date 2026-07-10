/* ============================================================
   demo.js — 전투 HUD 데모 + 상태/이펙트 쇼케이스 + 인터랙티브 전투
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  /* ---------- 떠오르는 데미지/회복 팝업 ---------- */
  function popup(host, x, y, text, kind) {
    const p = el('div', `popup ${kind} anim num`, text);
    p.style.left = x + 'px'; p.style.top = y + 'px';
    host.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }

  /* ============ 전투 HUD 데모 스테이지 ============ */
  function buildCombatStage() {
    const stage = $('#combatStage'); if (!stage) return;
    const units = [
      { name: '기사', side: 'hero', hp: 30, max: 30, x: 18, y: 60, spr: 'knight' },
      { name: '사냥꾼', side: 'hero', hp: 24, max: 24, x: 18, y: 175, spr: 'huntress' },
      { name: '골렘', side: 'enemy', hp: 60, max: 60, x: 70, y: 50, tags: ['weaken'], spr: 'golem' },
      { name: '독거미', side: 'enemy', hp: 12, max: 12, x: 76, y: 175, tags: ['poison'], spr: 'spider' },
    ];
    function render() {
      stage.innerHTML = '';
      units.forEach((u, i) => {
        const frac = u.hp / u.max;
        const wrap = el('div', 'ui');
        wrap.style.cssText = `position:absolute;left:${u.x}%;top:${u.y}px;transform:translateX(-50%)`;
        const tags = (u.tags || []).map(k => window.Components.tag(k, { poison: '독', sleep: '잠', weaken: '약' }[k])).join('');
        const flip = u.side === 'hero' ? '' : '';
        wrap.innerHTML =
          `<div class="unit-bar">
            <img class="spr" src="assets/${u.spr}.png" style="height:${u.side==='enemy'&&u.spr==='golem'?80:60}px;image-rendering:pixelated;${u.hp<=0?'opacity:.2;filter:grayscale(1)':''}">
            <div class="unit-name ${u.side}">${u.name}</div>
            ${window.Components.hpbar(frac)}
            <div class="tags">${tags}</div>
          </div>`;
        wrap.dataset.idx = i;
        stage.appendChild(wrap);
      });
    }
    render();
    function hitRandom(kind) {
      const pool = units.filter(u => kind === 'heal' ? u.side === 'hero' : u.side === 'enemy');
      const u = pool[Math.floor(Math.random() * pool.length)];
      const bars = stage.querySelectorAll('.unit-bar');
      const idx = units.indexOf(u);
      const node = stage.children[idx];
      const rect = node.getBoundingClientRect(); const sr = stage.getBoundingClientRect();
      const px = rect.left - sr.left + rect.width / 2, py = rect.top - sr.top;
      if (kind === 'heal') {
        const amt = 8 + Math.floor(Math.random() * 8);
        u.hp = Math.min(u.max, u.hp + amt);
        popup(stage, px, py, '+' + amt, 'heal');
        spawnFx(stage, px, py - 10, 'spark');
      } else {
        const crit = kind === 'crit';
        const amt = (crit ? 18 : 6) + Math.floor(Math.random() * 8);
        u.hp = Math.max(0, u.hp - amt);
        popup(stage, px + (Math.random() * 20 - 10), py, (crit ? '' : '') + amt, crit ? 'crit' : 'dmg');
        spawnFx(stage, px, py + 6, crit ? 'fire' : 'slash');
        node.animate([{ transform: node.style.transform + ' translateX(0)' },
        { transform: node.style.transform + ' translateX(6px)' },
        { transform: node.style.transform + ' translateX(-4px)' },
        { transform: node.style.transform + ' translateX(0)' }], { duration: 220 });
      }
      render();
    }
    function reset() { units.forEach(u => u.hp = u.max); render(); }
    $('#dmgBtn').onclick = () => hitRandom('dmg');
    $('#critBtn').onclick = () => hitRandom('crit');
    $('#healBtn').onclick = () => hitRandom('heal');
    $('#resetHp').onclick = reset;
  }

  function spawnFx(host, x, y, kind) {
    const cv = window.Pixel.fx(kind, 6);
    cv.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);pointer-events:none`;
    host.appendChild(cv);
    cv.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1.15)' },
    { opacity: 0, transform: 'translate(-50%,-50%) scale(1.3)' }], { duration: 420, easing: 'ease-out' });
    setTimeout(() => cv.remove(), 430);
  }

  /* ============ 상태이상 / 스킬 이펙트 쇼케이스 ============ */
  function buildStatusShowcase() {
    const root = $('#statusShowcase'); if (!root) return;
    const statuses = [['poison', '독', 'DoT 3턴 · 독성 녹색'], ['sleep', '수면', '행동 불가 · 라일락'], ['weaken', '약화', '공격 -30% · 녹슨 주황']];
    const fxs = [['slash', '베기'], ['fire', '화염'], ['ice', '냉기'], ['spark', '회복']];
    const stWrap = el('div');
    stWrap.innerHTML = `<div class="sw-group" style="margin-top:0">상태이상 — 색 + 픽셀 아이콘 (a11y: 라벨 동반)</div>`;
    const grid = el('div'); grid.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-top:10px';
    statuses.forEach(([k, label, desc]) => {
      const card = el('div', 'frame-bevel ui');
      card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 16px';
      const ico = window.Pixel.statusIcon(k, 5);
      card.appendChild(ico);
      const txt = el('div'); txt.innerHTML = `<div class="tag ${k}" style="font-size:var(--t-label)">${label}</div><div class="mute" style="font-size:15px;margin-top:6px">${desc}</div>`;
      card.appendChild(txt);
      grid.appendChild(card);
    });
    stWrap.appendChild(grid);

    const fxWrap = el('div');
    fxWrap.innerHTML = `<div class="sw-group">스킬 타격 이펙트 — 클릭해 재생</div>`;
    const fgrid = el('div'); fgrid.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-top:10px';
    fxs.forEach(([k, label]) => {
      const card = el('div', 'frame-bevel ui');
      card.style.cssText = 'position:relative;width:120px;height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer';
      const ico = window.Pixel.fx(k, 5); card.appendChild(ico);
      card.appendChild(el('div', 'soft', label));
      card.onclick = () => spawnFx(card, card.clientWidth / 2, card.clientHeight / 2 - 8, k);
      fgrid.appendChild(card);
    });
    fxWrap.appendChild(fgrid);
    root.append(stWrap, fxWrap);
  }

  /* ============ 인터랙티브 전투 데모 ============ */
  function buildInteractive() {
    const stage = $('#demoStage'); if (!stage) return;
    const state = {
      hero: { name: '기사', hp: 30, max: 30, mp: 8 },
      enemy: { name: '고블린', hp: 22, max: 22, weak: false },
      phase: 'command', idx: 0, msg: '고블린이 나타났다!',
      sub: null, subIdx: 0,
    };
    const CMDS = [
      { k: 'attack', label: '공격' },
      { k: 'spell', label: '주문' },
      { k: 'item', label: '아이템' },
      { k: 'mercy', label: '자비', mercy: true },
      { k: 'defend', label: '방어' },
      { k: 'flee', label: '도망' },
    ];

    function render() {
      stage.innerHTML = '';
      // 적
      const ef = state.enemy.hp / state.enemy.max;
      const enemy = el('div', 'ui');
      enemy.style.cssText = 'position:absolute;left:74%;top:50px;transform:translateX(-50%);text-align:center';
      enemy.innerHTML = `<img src="assets/goblin.png" style="height:84px;image-rendering:pixelated;margin-bottom:6px;${state.enemy.hp <= 0 ? 'opacity:.2;filter:grayscale(1)' : ''}">
        <div class="unit-bar" style="margin:0 auto"><div class="unit-name enemy">${state.enemy.name}${state.enemy.weak ? ' <span class="gold" style="font-size:15px">약화</span>' : ''}</div>${window.Components.hpbar(ef)}</div>`;
      stage.appendChild(enemy);
      // 아군
      const hf = state.hero.hp / state.hero.max;
      const hero = el('div', 'ui');
      hero.style.cssText = 'position:absolute;left:22%;top:64px;transform:translateX(-50%);text-align:center';
      hero.innerHTML = `<img src="assets/knight.png" style="height:78px;image-rendering:pixelated;margin-bottom:6px">
        <div class="unit-bar" style="margin:0 auto"><div class="unit-name hero active">${state.hero.name}</div>${window.Components.hpbar(hf)}</div>`;
      stage.appendChild(hero);

      // 하단 패널
      const panel = el('div', 'frame-bevel ui');
      panel.style.cssText = 'position:absolute;left:0;right:0;bottom:0;border-radius:0;min-height:120px';
      if (state.phase === 'message') {
        panel.innerHTML = `<div class="dialog-body">${state.msg}</div><div class="dialog-hint">▼ <span class="blink">Z</span></div>`;
      } else if (state.phase === 'command') {
        const rows = CMDS.map((c, i) => {
          const dis = c.mercy && !state.enemy.weak;
          const cls = ['menu-row']; if (i === state.idx) cls.push('sel'); if (dis) cls.push('disabled'); if (c.mercy) cls.push('mercy');
          const reason = dis ? '<span class="reason">— 적을 약하게</span>' : '';
          return `<div class="${cls.join(' ')}"><span class="cursor">▶</span><span class="lbl">${c.label}</span>${reason}</div>`;
        }).join('');
        panel.innerHTML = `<div class="menu" style="display:grid;grid-template-columns:1fr 1fr;gap:2px 30px;max-width:380px;margin:0 auto">${rows}</div>`;
      } else if (state.phase === 'mercy') {
        const opts = ['살려주기', '영입하기', '← 뒤로'];
        panel.innerHTML = `<div class="menu" style="max-width:240px;margin:0 auto">` + opts.map((o, i) =>
          `<div class="menu-row ${i === state.subIdx ? 'sel' : ''}"><span class="cursor">▶</span><span class="lbl">${o}</span></div>`).join('') + `</div>`;
      }
      stage.appendChild(panel);
    }

    function message(txt, then) {
      state.phase = 'message'; state.msg = txt; state._then = then || null; render();
    }
    function enemyTurn() {
      if (state.enemy.hp <= 0) { message('고블린을 쓰러뜨렸다! 승리!', () => resetBattle()); return; }
      const dmg = 4 + Math.floor(Math.random() * 5);
      state.hero.hp = Math.max(0, state.hero.hp - dmg);
      const sr = stage.getBoundingClientRect();
      message(`고블린의 공격! 기사에게 ${dmg} 피해`, () => {
        if (state.hero.hp <= 0) { message('기사가 쓰러졌다… 패배', () => resetBattle()); return; }
        state.phase = 'command'; state.idx = 0; render();
      });
      setTimeout(() => { popup(stage, sr.width * 0.22, 96, String(dmg), 'dmg'); spawnFx(stage, sr.width * 0.22, 100, 'slash'); }, 60);
    }
    function resetBattle() {
      state.hero.hp = state.hero.max; state.enemy.hp = state.enemy.max; state.enemy.weak = false;
      state.phase = 'command'; state.idx = 0; message('고블린이 나타났다!', () => { state.phase = 'command'; render(); });
    }

    function doCommand(c) {
      const sr = stage.getBoundingClientRect();
      if (c.k === 'attack') {
        const dmg = 6 + Math.floor(Math.random() * 6);
        state.enemy.hp = Math.max(0, state.enemy.hp - dmg);
        if (state.enemy.hp <= state.enemy.max * 0.35) state.enemy.weak = true;
        setTimeout(() => { popup(stage, sr.width * 0.74, 70, String(dmg), 'dmg'); spawnFx(stage, sr.width * 0.74, 80, 'slash'); }, 40);
        message(`기사의 공격! 고블린에게 ${dmg} 피해`, enemyTurn);
      } else if (c.k === 'spell') {
        if (state.hero.mp < 4) { message('MP가 부족하다!', () => { state.phase = 'command'; render(); }); return; }
        state.hero.mp -= 4; const dmg = 10 + Math.floor(Math.random() * 6);
        state.enemy.hp = Math.max(0, state.enemy.hp - dmg);
        if (state.enemy.hp <= state.enemy.max * 0.35) state.enemy.weak = true;
        setTimeout(() => { popup(stage, sr.width * 0.74, 70, String(dmg), 'crit'); spawnFx(stage, sr.width * 0.74, 80, 'fire'); }, 40);
        message(`기사는 파이어볼! 고블린에게 ${dmg} 피해`, enemyTurn);
      } else if (c.k === 'item') {
        const heal = 12; state.hero.hp = Math.min(state.hero.max, state.hero.hp + heal);
        setTimeout(() => { popup(stage, sr.width * 0.22, 90, '+' + heal, 'heal'); spawnFx(stage, sr.width * 0.22, 90, 'spark'); }, 40);
        message(`약초를 썼다. HP가 ${heal} 회복!`, enemyTurn);
      } else if (c.k === 'mercy') {
        if (!state.enemy.weak) return;
        state.phase = 'mercy'; state.subIdx = 0; render();
      } else if (c.k === 'defend') {
        message('기사는 방어 태세!', enemyTurn);
      } else if (c.k === 'flee') {
        message(Math.random() < 0.5 ? '도망쳤다!' : '도망치지 못했다!', enemyTurn);
      }
    }

    function key(e) {
      const k = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'z', 'Z', 'x', 'X', ' '].includes(k)) e.preventDefault();
      if (state.phase === 'message') {
        if (k === 'z' || k === 'Z' || k === ' ') { const t = state._then; state._then = null; if (t) t(); else { state.phase = 'command'; render(); } }
        return;
      }
      if (state.phase === 'command') {
        if (k === 'ArrowUp') state.idx = (state.idx + CMDS.length - 1) % CMDS.length;
        else if (k === 'ArrowDown') state.idx = (state.idx + 1) % CMDS.length;
        else if (k === 'ArrowLeft') state.idx = (state.idx + CMDS.length - 2) % CMDS.length;
        else if (k === 'ArrowRight') state.idx = (state.idx + 2) % CMDS.length;
        else if (k === 'z' || k === 'Z') { const c = CMDS[state.idx]; if (c.mercy && !state.enemy.weak) { message('아직 자비를 베풀 수 없다. 적을 더 약하게.', () => { state.phase = 'command'; render(); }); return; } doCommand(c); return; }
        render(); return;
      }
      if (state.phase === 'mercy') {
        const n = 3;
        if (k === 'ArrowUp') state.subIdx = (state.subIdx + n - 1) % n;
        else if (k === 'ArrowDown') state.subIdx = (state.subIdx + 1) % n;
        else if (k === 'x' || k === 'X') { state.phase = 'command'; render(); return; }
        else if (k === 'z' || k === 'Z') {
          if (state.subIdx === 2) { state.phase = 'command'; render(); return; }
          if (state.subIdx === 0) message(`고블린을 살려주었다. 안식을…`, () => resetBattle());
          else message(`고블린이 마음을 열었다 — 동료가 되었다!`, () => resetBattle());
          return;
        }
        render(); return;
      }
    }
    stage.addEventListener('keydown', key);
    stage.addEventListener('click', () => stage.focus());
    render();
  }

  window.Demo = { buildCombatStage, buildStatusShowcase, buildInteractive };
})();

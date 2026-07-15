/* ============================================================
   spellfx-page.js — 주문 이펙트 연구소 페이지 와이어링
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const { DEFS, META, ALL_TARGET } = window.SpellFXDefs;

  const ENEMY_BY_EL = {
    fire: 'goblin', ice: 'golem', thunder: 'skeleton_king', poison: 'spider',
    earth: 'golem', holy: 'skeleton_king', heal: 'goblin', buff: 'goblin', shield: 'spider', sleep: 'goblin', arrow: 'goblin',
    wind: 'goblin', dark: 'skeleton_king', arcane: 'goblin', mana: 'goblin', phys: 'golem', star: 'skeleton_king',
  };
  // 직업 재정립: 원소 마법 = 마법사, 활/암살 = 사냥꾼, 물리 = 전사, 신성/회복 = 기사
  const CASTER_BY_EL = {
    fire: 'mage', ice: 'mage', thunder: 'mage', poison: 'mage', earth: 'mage', wind: 'mage', dark: 'mage',
    sleep: 'mage', arcane: 'mage', mana: 'mage',
    arrow: 'huntress', star: 'huntress',
    phys: 'warrior', buff: 'warrior',
    holy: 'knight', heal: 'knight', shield: 'knight',
  };

  let stage, current = null, autoplay = true, autoTimer = null, idx = 0, stageHost = null;

  async function setupStage() {
    const host = $('#fxStage');
    stageHost = host;
    stage = new window.SpellFX.Stage(host, { onMsg: () => {} });
    stage.notifyState = updateStates;
  
    await Promise.all([
      stage.loadSprite('knight', 'assets/knight.png', 26),
      stage.loadSprite('warrior', 'assets/warrior.png', 26),
      stage.loadSprite('huntress', 'assets/huntress.png', 26),
      stage.loadSprite('mage', 'assets/mage.png', 27),
      stage.loadSprite('goblin', 'assets/goblin.png', 24),
      stage.loadSprite('golem', 'assets/golem.png', 30),
      stage.loadSprite('spider', 'assets/spider.png', 22),
      stage.loadSprite('skeleton_king', 'assets/skeleton_king.png', 30),
      stage.loadSprite('magma_drake', 'assets/magma_drake.png', 32),
      stage.loadSprite('bog_witch', 'assets/bog_witch.png', 30),
      stage.loadSprite('necromancer', 'assets/necromancer.png', 28),
      stage.loadSprite('reaper', 'assets/reaper.png', 28),
      stage.loadSprite('brute', 'assets/brute.png', 30),
      stage.loadSprite('werewolf', 'assets/werewolf.png', 32),
      stage.loadSprite('imp', 'assets/imp.png', 24),
      stage.loadSprite('medusa', 'assets/medusa.png', 26),
      stage.loadSprite('war_drummer', 'assets/war_drummer.png', 28),
      stage.loadSprite('gargoyle', 'assets/gargoyle.png', 30),
      stage.loadSprite('chimera', 'assets/chimera.png', 30),
      stage.loadSprite('magma_golem', 'assets/magma_golem.png', 30),
      stage.loadSprite('wolf', 'assets/wolf.png', 24),
      stage.loadSprite('crow', 'assets/crow.png', 24),
      stage.loadSprite('frog', 'assets/frog.png', 26),
      stage.loadSprite('duelist', 'assets/duelist.png', 26),
    ]);
  }

  // 원소 계열 (마법사가 충전 시 [과부하] 추가 부여 대상)
  const ELEM_OVERLOAD = new Set(['fire', 'ice', 'thunder', 'poison', 'earth', 'wind', 'dark', 'sleep']);
  const rnd = (a, b) => a + Math.random() * (b - a);
  // 과부하 표식 (금/보라 별폭발) — 페이지 측 복제
  function overMarkPage(g, x, y, a) { g.globalAlpha = a; for (const c of [['#fff0b8', 7], ['#b483f0', 4]]) { g.fillStyle = c[0]; const r = c[1]; g.fillRect(x - 0.5, y - r, 1, r * 2); g.fillRect(x - r, y - 0.5, r * 2, 1); g.fillRect(x - r * 0.7, y - r * 0.7, 1, 1); g.fillRect(x + r * 0.7 - 1, y + r * 0.7 - 1, 1, 1); } g.globalAlpha = 1; }
  // 원소 주문 위에 덧씌우는 과부하 레이어 — base 효과 + 금/보라 증폭
  function composeOverload(base) {
    return (S) => {
      const eff = base(S); const tgt = S.primary(); let t = 0, started = false, em = 0;
      return {
        update(dt, tt) {
          if (eff.update) eff.update(dt, tt);
          t += dt;
          if (!started) { started = true; S.doFlash('#fff0b8', 0.42); S.doShake(3);
            S.floatSpr({ x: tgt.x, y: tgt.y - 9, life: 0.45, max: 0.45, draw: (g, s) => { const k = 1 - s.life / s.max; g.globalAlpha = s.life / s.max; g.strokeStyle = '#fff0b8'; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 4 + k * 34, 0, 7); g.stroke(); g.globalAlpha = 1; } });
            S.floatSpr({ x: tgt.x, y: tgt.y - 24, vy: -12, life: 0.95, max: 0.95, draw: (g, s) => overMarkPage(g, s.x, s.y, Math.min(1, s.life / s.max)) });
          }
          // 타겟 주위로 수렴하는 금/보라 마력 (지속 증폭)
          em += dt; if (em > 0.05 && t < 0.95) { em = 0; const a = Math.random() * 6.28, r = rnd(12, 26);
            S.p({ x: tgt.x + Math.cos(a) * r, y: tgt.y - 9 + Math.sin(a) * r, vx: -Math.cos(a) * 22, vy: -Math.sin(a) * 22, life: 0.32, max: 0.32, size: 2, color: Math.random() < 0.5 ? '#fff0b8' : '#b483f0', additive: true, shrink: true }); }
        },
        done: (tt) => eff.done ? eff.done(tt) : tt > 1.2,
      };
    };
  }

  // === FP(운명) 게이지 ===
  let fp = 4; const FP_CAP = 6;
  function updateFp() { const n = $('#fpNow'); if (n) n.textContent = fp; const c = $('#fpCap'); if (c) c.textContent = FP_CAP; if (current) { const m = META.find(x => x.id === current); if (m) renderSkillInfo(m, m.caster || CASTER_BY_EL[m.el] || 'mage', m.enemy || ENEMY_BY_EL[m.el] || 'goblin', false); } }
  function wireFp() { document.querySelectorAll('.fp-btn').forEach(b => b.onclick = () => { fp = Math.max(0, Math.min(FP_CAP, fp + (+b.dataset.fp))); updateFp(); }); }
  // 운명 비용 파싱 ('운명 2' → 2)
  function fpCost(meta) { const m = /운명\s*(\d+)/.exec(meta.cost || ''); return m ? +m[1] : 0; }

  // === 스킬 정보 툴팁 데이터 ===
  const ELEM_NAME = { fire: '화염', ice: '냉기', thunder: '뇌전', poison: '독', earth: '대지', wind: '바람', dark: '암흑', holy: '신성', heal: '회복', arcane: '비전', mana: '마나', arrow: '궁술·물리', star: '천궁', phys: '물리', shield: '보호' };
  const FAMILY_NAME = { undead: '언데드', icy: '냉기', fire: '화염', fiery: '화염', void: '공허' };
  // 시전 대상(우측 적/영웅) 스프라이트 → 가족(family)
  const SPRITE_FAMILY = { golem: 'icy', skeleton_king: 'undead', magma_drake: 'fire', reaper: 'void', necromancer: 'void', bog_witch: 'void', werewolf: '', brute: '', imp: 'fire', goblin: '', spider: '' };
  // 속성 → 대상 가족별 상성 (weak=약점/추가피해, resist=반감)
  const AFFINITY = {
    fire: { weak: ['icy'], resist: ['fire', 'fiery'] },
    ice: { weak: ['fire', 'fiery'], resist: ['icy'] },
    holy: { weak: ['undead', 'void'], resist: [] },
    dark: { weak: [], resist: ['void'] },
    poison: { weak: [], resist: ['undead', 'void'] },
    thunder: { weak: [], resist: [] }, earth: { weak: [], resist: [] }, wind: { weak: [], resist: [] }, arcane: { weak: [], resist: [] },
  };
  function fmtType(meta) {
    if (meta.self) return '자기/아군 대상';
    if (meta.aoe || ALL_TARGET.has(meta.id)) return '전체 (복수 대상)';
    if (meta.hits || /다단|연발/.test(meta.from || '')) return '단일 · 다단히트';
    return '단일 대상';
  }
  function dmgEstimate(meta) {
    const p = meta.power;
    if (!p) return null;
    const hits = meta.id === 'multishot' ? 5 : 1;
    const lo = Math.round(p * 0.85) * hits, hi = Math.round(p * 1.2) * hits;
    return hits > 1 ? `약 ${lo}–${hi} (${Math.round(p * 0.85)}–${Math.round(p * 1.2)} × ${hits}타)` : `약 ${lo}–${hi}`;
  }
  function effectTags(meta) {
    const t = [];
    const f = meta.from || '', k = meta.kind || '';
    if (/독|poison/.test(f) || meta.el === 'poison') t.push(['독 부여', 'var(--c-poison)']);
    if (/화상|burn/.test(f)) t.push(['화상', '#e25563']);
    if (/출혈|bleed|난자/.test(f)) t.push(['출혈', '#c0303a']);
    if (/동결|freeze|결빙/.test(f)) t.push(['동결', 'var(--c-mp)']);
    if (/마비|감전|shock/.test(f)) t.push(['마비', '#fff0b8']);
    if (/약화|weaken|저주/.test(f) || /디버프/.test(k)) t.push(['약화', '#d98446']);
    if (/회복|heal|치유|재생/.test(f) || k.includes('회복')) t.push(['회복', 'var(--c-hp-high)']);
    if (/방어|보호|흡수/.test(f) || k.includes('보호')) t.push(['피해 흡수', 'var(--c-mp)']);
    if (/속도|가속/.test(f)) t.push(['속도↑', 'var(--c-mp)']);
    if (/소환|증원/.test(f)) t.push(['적 증원', 'var(--c-xp)']);
    if (/흡혈|흡수/.test(f) && meta.el === 'dark') t.push(['흡혈', 'var(--c-xp)']);
    if (meta.sneak) t.push(['기습 강화', '#b483f0']);
    if (meta.rage) t.push(['격노 강화', '#e25563']);
    if (meta.charge) t.push(['과부하 강화', '#fff0b8']);
    if (meta.state === 'stealth') t.push(['은신 진입', '#b483f0']);
    if (meta.state === 'rage') t.push(['분노 진입', '#e25563']);
    if (meta.state === 'charge') t.push(['충전 진입', '#fff0b8']);
    return t;
  }
  function renderSkillInfo(meta, caster, enemySpr, overload) {
    const box = $('#skillInfo'); if (!box) return;
    const byName = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사', magma_drake: '마그마 드레이크', bog_witch: '늪의 마녀', necromancer: '강령술사', reaper: '사신', werewolf: '늑대인간 왕', brute: '괴인', imp: '임프' }[caster] || (meta.mon ? '몬스터' : caster);
    const elName = ELEM_NAME[meta.el] || meta.el;
    const dmg = dmgEstimate(meta);
    const tags = effectTags(meta);
    // 비용 충분 여부 (운명/FP)
    const fpc = fpCost(meta);
    let costHtml = meta.cost || ('MP ' + (meta.mp ?? '—'));
    if (fpc > 0) costHtml += fp >= fpc ? ` <span class="si-fp-ok">✓ 충분 (보유 ${fp}/${FP_CAP})</span>` : ` <span class="si-fp-no">✗ 부족 (보유 ${fp}/${FP_CAP})</span>`;
    // 상성
    let matchHtml = '';
    if (dmg && AFFINITY[meta.el] && !meta.self) {
      const fam = SPRITE_FAMILY[enemySpr] || '';
      const aff = AFFINITY[meta.el];
      if (fam && aff.weak.includes(fam)) matchHtml = `<div class="si-match si-weak">▲ 약점! 대상(${FAMILY_NAME[fam]})이 ${elName}에 약함 — 추가 피해</div>`;
      else if (fam && aff.resist.includes(fam)) matchHtml = `<div class="si-match si-resist">▼ 반감 — 대상(${FAMILY_NAME[fam]})이 ${elName}에 저항 — 피해 감소</div>`;
      else matchHtml = `<div class="si-match si-neutral">● 상성 보통 ${aff.weak.length ? `· <span class="si-weak">${aff.weak.map(f => FAMILY_NAME[f]).join('/')}</span>에 강함` : ''}${aff.resist.length ? ` · <span class="si-resist">${aff.resist.map(f => FAMILY_NAME[f]).join('/')}</span>이 저항` : ''}</div>`;
    }
    box.innerHTML = `
      <div class="si-head"><span class="el-dot el-${meta.el}"></span><span class="si-name">${meta.name}${overload ? ' <span style="font-size:14px;color:#fff0b8">[과부하]</span>' : ''}</span><span class="si-by">${byName}</span></div>
      <dl class="si-rows">
        <dt>속성</dt><dd>${elName}</dd>
        <dt>형식</dt><dd>${fmtType(meta)}</dd>
        <dt>소모</dt><dd>${costHtml}</dd>
        <dt>예상 피해</dt><dd>${dmg ? `<span class="num">${dmg}</span>` : '<span class="si-neutral">— (피해 없음)</span>'}</dd>
        ${tags.length ? `<dt>효과</dt><dd>${tags.map(([n, c]) => `<span class="si-tag" style="color:${c}">${n}</span>`).join('')}</dd>` : ''}
      </dl>${matchHtml}`;
  }

  function castSpell(meta) {
    current = meta.id;
    const enemySpr = meta.enemy || ENEMY_BY_EL[meta.el] || 'goblin';
    const caster = meta.caster || CASTER_BY_EL[meta.el] || 'mage';
    const enemies = ALL_TARGET.has(meta.id) ? [enemySpr, 'goblin', 'spider'] : [enemySpr];
    stage.setScene(caster, enemies);
    // 마력 충전 + 원소 주문 → [과부하] 추가 부여 (충전 소비)
    let factory = DEFS[meta.id];
    const elementalOverload = stage._charge && caster === 'mage' && ELEM_OVERLOAD.has(meta.el);
    if (elementalOverload) { stage._charge = false; updateStates(); factory = composeOverload(DEFS[meta.id]); }
    // 클래스 필살기(1인) / 인연공격(2인) → 컷신 후 임팩트에 이펙트 시작
    const cutscene = (meta.cls || meta.bond) && window.SpellCutscene && stageHost;
    if (cutscene) {
      window.SpellCutscene.play(stageHost, {
        title: meta.name, el: meta.el, kind: meta.bond ? 'bond' : 'ult',
        portraits: meta.bond && meta.pair ? meta.pair : [caster],
        onImpact: () => stage.play(factory),
      });
    } else {
      stage.play(factory);
    }
    // UI 상태
    $('#fxName').textContent = meta.name;
    $('#fxKind').textContent = meta.kind + (elementalOverload ? ' · 과부하' : '');
    $('#fxMp').textContent = meta.cost || ('MP ' + meta.mp);
    document.querySelectorAll('.spell-card').forEach(c => c.classList.toggle('on', c.dataset.id === meta.id));
    // 캐스트 메시지
    const casterName = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' }[caster] || '기사';
    $('#fxMsg').innerHTML = `<span class="gold">${casterName}</span>는 <span class="gold">${meta.name}</span>!` + (elementalOverload ? ' <span style="color:#fff0b8">[과부하]</span>' : '');
    renderSkillInfo(meta, caster, enemySpr, elementalOverload);
  }

  function buildGrid() {
    const grid = $('#spellGrid');
    let lastGroup = '__base__';
    const groupOf = (m) => m.grp || (m.cls ? '클래스 필살기 · 단일' : (m.rec ? '환경 연동 전체기 · 추천' : '__base__'));
    META.forEach((m) => {
      const grp = groupOf(m);
      if (grp !== lastGroup && grp !== '__base__') {
        lastGroup = grp;
        grid.appendChild(el('div', 'grid-divider', `<span class="ln"></span><span>${grp}</span><span class="ln"></span>`));
      }
      const card = el('div', 'spell-card', '');
      card.dataset.id = m.id;
      card.dataset.el = m.el;
      const tag = m.cls ? `<span class="sc-cls">${m.cls}</span>` : (m.from ? `<span class="sc-from">↻ ${m.from}</span>` : '');
      const badge = m.cls ? '<span class="rec-badge" style="background:var(--c-gold-glow)">필살</span>' : (m.rec ? '<span class="rec-badge">추천</span>' : '');
      card.innerHTML = `${badge}<span class="el-dot el-${m.el}"></span>
        <div class="sc-name">${m.name} ${tag}</div>
        <div class="sc-meta"><span class="sc-kind">${m.kind}</span><span class="sc-mp num">${m.cost || ('MP ' + m.mp)}</span></div>`;
      card.onclick = () => { stopAuto(); castSpell(m); };
      grid.appendChild(card);
    });
  }

  function startAuto() {
    autoplay = true; $('#autoBtn').classList.add('on'); $('#autoBtn').textContent = '⏸ 자동재생 중';
    const tick = () => {
      const m = META[idx % META.length]; castSpell(m); idx++;
      autoTimer = setTimeout(tick, (m.cls || m.bond) ? 3600 : 2400);
    };
    tick();
  }
  function stopAuto() {
    autoplay = false; clearTimeout(autoTimer); autoTimer = null;
    $('#autoBtn').classList.remove('on'); $('#autoBtn').textContent = '▶ 자동재생';
  }

  // --- 상태 토글 (은신/분노/충전) ---
  const STATE_FLAG = { stealth: '_stealth', rage: '_rage', charge: '_charge' };
  function updateStates() {
    Object.keys(STATE_FLAG).forEach(name => {
      const on = !!(stage && stage[STATE_FLAG[name]]);
      const chip = document.querySelector(`.state-chip[data-state="${name}"]`);
      if (chip) chip.classList.toggle('on', on);
    });
  }
  function wireStates() {
    document.querySelectorAll('.state-chip').forEach(chip => {
      chip.onclick = () => {
        const name = chip.dataset.state, flag = STATE_FLAG[name];
        stage[flag] = !stage[flag];
        updateStates();
      };
    });
  }

  async function init() {
    buildGrid();
    await setupStage();
    $('#replayBtn').onclick = () => { if (current) castSpell(META.find(m => m.id === current)); };
    $('#autoBtn').onclick = () => { if (autoplay) stopAuto(); else startAuto(); };
    wireStates();
    wireFp(); updateFp();
    // 시작: 화염 화살 1회 후 자동재생
    idx = 0;
    startAuto();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

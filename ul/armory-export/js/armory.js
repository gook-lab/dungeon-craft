/* ============================================================
   armory.js — 상점/대장간 UI · 특색 장비 · 아티팩트 시스템
   전부 tokens.css/ui.css 토큰 사용. 아이콘은 코드 생성.
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const RARC = { common: '#a7b0d8', rare: '#56a8e8', legend: '#ffd766' };
  const RARK = { common: '일반', rare: '희귀', legend: '전설' };
  const EL_COL = { fire: '#e25563', ice: '#56a8e8', arcane: '#b483f0', dark: '#8a7bc8', holy: '#ffd766', earth: '#c98b2c', thunder: '#f0d24c', poison: '#9ad94f' };

  /* ---- 픽셀 장비 아이콘 (12x12) ---- */
  const GI = {
    sword: ['......ss....', '.....sWs....', '....sWs.....', '...sWs......', '..sWs.......', '.sWs........', 'gWg.........', 'ggg.........', '.h..........', '.h..........', '............', '............'],
    axe:   ['....ss......', '...sWWs.ss..', '..sWWWsWWs..', '..sWWWWWWs..', '...sWWWWs...', '....shs.s...', '.....h......', '.....h......', '.....h......', '.....h......', '............', '............'],
    bow:   ['...c........', '..c.c.......', '.c...c...W..', 'c.....c.WW..', 'c......cW...', 'c.....cWW...', 'c....c..W...', '.c...c...W..', '..c.c.......', '...c........', '............', '............'],
    gun:   ['............', '.mmmmmmm....', '.mMMMMMm.W..', '.mmmmmmmWW..', '....m..WW...', '...mm.......', '..hm........', '.hh.........', 'hh..........', '............', '............', '............'],
    armor: ['...mmmm.....', '..mMMMMm....', '.mMllllMm...', 'mMl.cc.lMm..', 'mMl.cc.lMm..', 'mMl....lMm..', '.mMlllMm....', '..mMMMm.....', '...mmm......', '............', '............', '............'],
    cloak: ['...dddd.....', '..dddddd....', '.dd.dd.dd...', '.d..dd..d...', '.d..dd..d...', '....dd......', '...dddd.....', '..dd..dd....', '.dd....dd...', '............', '............', '............'],
    ring:  ['....yyyy....', '...y....y...', '..y..dd..y..', '.y..dWWd..y.', '.y..dWWd..y.', '..y..dd..y..', '...y....y...', '....yyyy....', '............', '............', '............', '............'],
    amulet:['....hh......', '...h..h.....', '..h....h....', '..h.dd.h....', '...ddWd.....', '...dWWd.....', '....dd......', '............', '............', '............', '............', '............'],
  };
  const GPAL = {
    sword: { s: '#cfd8ec', W: '#fff0b8', g: '#c98b2c', h: '#7a5224' },
    axe: { s: '#cfd8ec', W: '#eaf1ff', h: '#7a5224' },
    bow: { c: '#c98b2c', W: '#fff0b8' },
    gun: { m: '#5a6790', M: '#8a97c4', W: '#f0c44c', h: '#7a5224' },
    armor: { m: '#5a6790', M: '#8a97c4', l: '#cfe0ff', c: '#ffd766' },
    cloak: { d: '#6a5c8a' },
    ring: { y: '#ffd766', d: '#c98b2c', W: '#fff0b8' },
    amulet: { h: '#c98b2c', d: '#7fded0', W: '#eafffb' },
  };
  function gicon(kind, scale) { return window.Pixel.pix(GI[kind] || GI.ring, GPAL[kind] || GPAL.ring, scale || 3); }

  /* =========================================================
     1) 상점 / 대장간 UI
     ========================================================= */
  const SHOP_STOCK = {
    buy: [
      { id: 'iron_sword', nm: '강철검', kind: 'sword', slot: '무기', rar: 'common', price: 120, atk: 8, eff: '기본 강철검. 안정적인 근접 무기.' },
      { id: 'frost_edge', nm: '서리검', kind: 'sword', slot: '무기', rar: 'rare', price: 340, atk: 8, el: 'ice', eff: '냉기 속성. 적중 시 20% 확률 <b>둔화</b>. 냉기 약점에 특효.' },
      { id: 'venom_gun', nm: '독무 권총', kind: 'gun', slot: '무기', rar: 'rare', price: 300, atk: 8, el: 'poison', eff: '탄환에 독 도포. 적중 시 <b>중독</b> 부여. 쌍검사 전용.' },
      { id: 'chain_bow', nm: '연쇄 석궁', kind: 'bow', slot: '무기', rar: 'rare', price: 320, atk: 7, eff: '<b>3연발</b> 다단 히트. 크리 연동. 사냥꾼 전용.' },
      { id: 'chain_armor', nm: '사슬 갑옷', kind: 'armor', slot: '방어구', rar: 'common', price: 100, def: 5, eff: '기본 사슬 갑옷.' },
      { id: 'dragon_plate', nm: '용린 갑주', kind: 'armor', slot: '방어구', rar: 'legend', price: 780, def: 11, eff: '<b>화염 저항 50%</b>. 용암 권역 필수 방어구.' },
      { id: 'sage_amulet', nm: '현자의 부적', kind: 'amulet', slot: '악세', rar: 'rare', price: 260, mp: 10, eff: '최대 MP +10. 주문 클래스 핵심.' },
    ],
    sell: [
      { id: 'bronze_sword', nm: '청동검', kind: 'sword', slot: '무기', rar: 'common', price: 15, atk: 3, eff: '초반 무기. 팔면 골드 15.', owned: true },
      { id: 'leather_vest', nm: '가죽 조끼', kind: 'armor', slot: '방어구', rar: 'common', price: 10, def: 2, eff: '낡은 방어구. 팔면 골드 10.', owned: true },
    ],
    upgrade: [
      { id: 'iron_sword', nm: '강철검 +1', kind: 'sword', slot: '무기', rar: 'common', price: 150, atk: 8, enh: 1, eff: '강화 재료로 공격력 상승. 현재 +1 → +2.', owned: true },
      { id: 'chain_armor', nm: '사슬 갑옷', kind: 'armor', slot: '방어구', rar: 'common', price: 130, def: 5, enh: 0, eff: '강화 재료로 방어력 상승. 현재 +0 → +1.', owned: true },
    ],
  };
  const EQUIPPED = { 무기: { nm: '강철검', atk: 8, def: 0, mp: 0 }, 방어구: { nm: '사슬 갑옷', atk: 0, def: 5, mp: 0 }, 악세: { nm: '없음', atk: 0, def: 0, mp: 0 } };

  function buildShop() {
    const host = $('#shopDemo'); if (!host) return;
    let tab = 'buy', sel = 0, gold = 420;
    function render() {
      const list = SHOP_STOCK[tab]; if (sel >= list.length) sel = 0;
      host.innerHTML = '';
      // head
      const head = el('div', 'shop-head');
      head.innerHTML = `<div class="keeper"><img src="assets/knight.png" style="height:40px;image-rendering:pixelated" onerror="this.replaceWith(document.createTextNode('🔨'))"></div>
        <div><h3>${tab === 'upgrade' ? '대장간' : '잡화 상점'}</h3><div class="line">${tab === 'buy' ? '무엇을 사겠나?' : tab === 'sell' ? '팔 물건이 있나?' : '무기를 벼려주지.'}</div></div>
        <div class="gold">◆ <span>${gold}</span></div>`;
      host.appendChild(head);
      // tabs
      const tabs = el('div', 'shop-tabs');
      [['buy', '구매'], ['sell', '판매'], ['upgrade', '강화']].forEach(([k, t]) => {
        const b = el('div', 't' + (tab === k ? ' on' : ''), t); b.onclick = () => { tab = k; sel = 0; render(); }; tabs.appendChild(b);
      });
      host.appendChild(tabs);
      // body
      const body = el('div', 'shop-body');
      const listEl = el('div', 'shop-list');
      list.forEach((it, i) => {
        const row = el('div', `srow rarity-${it.rar}` + (i === sel ? ' sel' : '') + (it.owned ? ' owned' : ''));
        const cant = tab === 'buy' && it.price > gold;
        row.appendChild(gicon(it.kind, 3));
        row.innerHTML += `<div class="nm">${it.nm}<small>${RARK[it.rar]} · ${it.slot}</small></div>
          <div class="price ${cant ? 'cant' : ''}">◆${it.price}</div>`;
        row.onclick = () => { sel = i; render(); };
        listEl.appendChild(row);
      });
      body.appendChild(listEl);
      // detail
      const it = list[sel];
      const det = el('div', `shop-detail rarity-${it.rar}`);
      const eqv = EQUIPPED[it.slot] || { atk: 0, def: 0, mp: 0, nm: '없음' };
      const cmpRow = (k, cur, nv) => {
        if (!nv && !cur) return '';
        const d = nv - cur; const cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
        return `<div class="r"><span class="k">${k}</span><span class="v">${cur} <span class="${cls}">▸ ${nv}${d ? ` (${d > 0 ? '+' : ''}${d})` : ''}</span></span></div>`;
      };
      let cmp = '';
      if (tab !== 'sell') {
        cmp = `<div class="cmp"><div class="r"><span class="k">장착 중</span><span class="v" style="color:var(--c-text-soft)">${eqv.nm}</span></div>
          ${it.atk != null ? cmpRow('공격', eqv.atk, it.atk + (it.enh || 0)) : ''}
          ${it.def != null ? cmpRow('수비', eqv.def, it.def + (it.enh || 0)) : ''}
          ${it.mp != null ? cmpRow('MP', eqv.mp, it.mp) : ''}</div>`;
      }
      let enh = '';
      if (tab === 'upgrade') {
        const lvl = it.enh || 0, max = 5;
        enh = '<div class="enh">' + Array.from({ length: max }, (_, i) => `<div class="pip ${i < lvl ? 'on' : ''} ${i === lvl ? '' : ''}"></div>`).join('') + '</div>';
      }
      const cant = tab === 'buy' && it.price > gold;
      const btnLabel = tab === 'buy' ? '구매' : tab === 'sell' ? '판매' : '강화';
      det.innerHTML = `<h4>${it.nm}</h4><div class="kd">${RARK[it.rar]} · ${it.slot}${it.el ? ` · ${it.el}` : ''}</div>
        <div class="eff">${it.eff}</div>${cmp}${enh}
        <button class="buy ${cant ? 'cant' : ''}">${btnLabel} <span class="c">◆ ${it.price}</span></button>`;
      det.querySelector('.buy').onclick = () => {
        if (cant) return;
        if (tab === 'buy') gold -= it.price; else gold += it.price;
        const b = det.querySelector('.buy'); b.textContent = tab === 'sell' ? '판매됨!' : tab === 'upgrade' ? '강화 완료!' : '구매됨!';
        setTimeout(render, 550);
      };
      body.appendChild(det);
      host.appendChild(body);
    }
    render();
  }

  /* =========================================================
     2) 특색 장비 카탈로그
     ========================================================= */
  const GEAR = {
    무기: [
      { nm: '흡혈검', kind: 'sword', rar: 'rare', neu: true, eff: '가한 피해의 <b>10% HP 흡수</b>. 장기전 자력 유지.', tags: ['생존'], el: 'dark' },
      { nm: '처형 도끼', kind: 'axe', rar: 'legend', neu: true, eff: 'HP 30% 이하 적에게 <b>피해 +50%</b>. 마무리 특화.', tags: ['처형'], el: 'earth' },
      { nm: '서리검', kind: 'sword', rar: 'rare', eff: '냉기 속성 · 적중 시 <b>둔화</b>. 냉기 약점 특효.', tags: ['상성'], el: 'ice' },
      { nm: '화염낙인검', kind: 'sword', rar: 'rare', eff: '화염 속성 · <b>화상</b> 지속딜. 물리 클래스의 상성 진입로.', tags: ['상성'], el: 'fire' },
      { nm: '룬검', kind: 'sword', rar: 'legend', eff: '비전 속성 · 장착 시 <b>주문 위력 +10%</b>. 마검사 빌드.', tags: ['상성'], el: 'arcane' },
      { nm: '뇌명 석궁', kind: 'bow', rar: 'rare', neu: true, eff: '뇌전 속성 · <b>금속·비행형 특효</b>. 크리 +12%.', tags: ['상성'], el: 'thunder' },
    ],
    방어구: [
      { nm: '가시 갑옷', kind: 'armor', rar: 'rare', neu: true, eff: '피격 시 <b>받은 피해 15% 반사</b>. 탱커·어그로 시너지.', tags: ['반사'] },
      { nm: '그림자 망토', kind: 'cloak', rar: 'rare', neu: true, eff: '회피 +8% · <b>은신 지속 +1턴</b>. 사냥꾼 암살 빌드.', tags: ['회피'] },
      { nm: '성기사 판금', kind: 'armor', rar: 'legend', neu: true, eff: '수비 +11 · 아군이 받는 치명타를 <b>1회 대신 흡수</b>.', tags: ['보호'], el: 'holy' },
      { nm: '용린 갑주', kind: 'armor', rar: 'legend', eff: '<b>화염 저항 50%</b>. 용암 권역 생존 필수.', tags: ['저항'], el: 'fire' },
    ],
    악세사리: [
      { nm: '현자의 부적', kind: 'amulet', rar: 'rare', eff: '최대 MP +10. 주문 캐스터 핵심.', tags: ['자원'] },
      { nm: '광전사 반지', kind: 'ring', rar: 'rare', neu: true, eff: '<b>공격 +25% / 수비 −15%</b>. 하이리스크 딜러.', tags: ['극딜'] },
      { nm: '운명석 목걸이', kind: 'amulet', rar: 'legend', neu: true, eff: '<b>운명(FP) 획득 +25%</b>. 인연기·필살기 회전율.', tags: ['운명'] },
      { nm: '저주의 성물', kind: 'ring', rar: 'rare', eff: '크리 +12% · 독 저항. <b>처단 루트 전용</b> 보상.', tags: ['카르마'], el: 'dark' },
    ],
  };
  function buildGearCat() {
    const host = $('#gearCat'); if (!host) return;
    Object.entries(GEAR).forEach(([cat, items]) => {
      host.appendChild(el('div', 'sw-group', cat));
      const grid = el('div', 'cat-grid');
      items.forEach(it => {
        const c = el('div', `gcard rarity-${it.rar}` + (it.neu ? ' new' : ''));
        const top = el('div', 'top'); top.appendChild(gicon(it.kind, 3));
        top.appendChild(el('div', '', `<div class="nm">${it.nm}</div><div class="slot">${RARK[it.rar]} · ${cat}</div>`));
        c.appendChild(top);
        c.appendChild(el('div', 'eff', it.eff));
        const tags = el('div', 'tags');
        (it.tags || []).forEach(t => tags.appendChild(el('span', 'chip', t)));
        if (it.el) { const e = el('span', 'el', it.el); e.style.color = EL_COL[it.el]; e.style.boxShadow = `inset 0 0 0 1px ${EL_COL[it.el]}`; tags.appendChild(e); }
        c.appendChild(tags);
        grid.appendChild(c);
      });
      host.appendChild(grid);
    });
  }

  /* =========================================================
     3) 아티팩트 시스템 — 데이터
     ========================================================= */
  const ARTIFACTS = [
    { id: 'rearward', nm: '후열의 부적', rar: 'common', cat: '지속', eff: '전투 종료 시 HP 5% 회복', src: '상점(마을)' },
    { id: 'manashard', nm: '마나석 조각', rar: 'common', cat: '지속', eff: '전투 종료 시 MP +3', src: '상점(마을)' },
    { id: 'swiftfeather', nm: '신속의 깃털', rar: 'common', cat: '자원', eff: '속도 +4 · 선제 확률 상승', src: '어둠숲 상자' },
    { id: 'lens', nm: '정밀 렌즈', rar: 'rare', cat: '공격', eff: '치명타 확률 +12%', aff: 'huntress', src: '설원 보상' },
    { id: 'catalyst', nm: '원소 촉매', rar: 'rare', cat: '공격', eff: '약점(▲) 공격 피해 +15%', aff: 'mage', src: '늪 보상' },
    { id: 'berserk_seal', nm: '광전사의 인장', rar: 'rare', cat: '공격', eff: 'HP 50% 이하 시 공격 +25%', aff: 'warrior', src: '지하 묘지' },
    { id: 'wardrune', nm: '수호룬', rar: 'rare', cat: '생존', eff: '전투당 첫 치명타 피해 무효', src: '제국 상자' },
    { id: 'clawgrip', nm: '연격의 발톱', rar: 'rare', cat: '공격', eff: '20% 확률로 추가타 1회', aff: 'duelist', src: '항구 상점' },
    { id: 'lifedrink', nm: '흡정의 목걸이', rar: 'rare', cat: '지속', eff: '가한 피해의 10% HP 흡수', src: '대성채' },
    { id: 'mercy_relic', nm: '자비의 성물', rar: 'rare', cat: '카르마', eff: '영입 확률↑ · 자비 카르마 강화', src: '자비 루트' },
    { id: 'brand', nm: '처단자의 낙인', rar: 'rare', cat: '카르마', eff: '처치 시 골드 +30% · 처단 카르마 강화', src: '처단 루트' },
    { id: 'sage_eye', nm: '현자의 눈', rar: 'legend', cat: '공격', eff: '주문 피해 +18% · 주문 MP −1', aff: 'mage', src: '황좌 보스' },
    { id: 'unbroken', nm: '불굴의 문장', rar: 'legend', cat: '생존', eff: '치명상 시 HP1로 1회 생존(전투당)', aff: 'knight', src: '대성채 은닉' },
    { id: 'fatestone', nm: '운명석', rar: 'legend', cat: '자원', eff: '운명(FP) 획득 +25%', src: '용암 화구' },
  ];
  const ART_BY = {}; ARTIFACTS.forEach(a => ART_BY[a.id] = a);
  const CAT_ICON = { 지속: 'heart', 공격: 'blade', 생존: 'shield', 자원: 'drop', 카르마: 'scale' };
  const CLS_KR = { knight: '나이트', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };
  const CLS_SPR = { knight: 'knight', warrior: 'warrior', huntress: 'huntress', mage: 'huntress', duelist: 'warrior' };

  /* ---- 아티팩트 장착 패널 (인터랙티브) ---- */
  function buildArtPanel() {
    const host = $('#artPanel'); if (!host) return;
    const CHARS = [
      { id: 'knight', slots: 3, eq: ['unbroken', 'wardrune', null] },
      { id: 'warrior', slots: 3, eq: ['berserk_seal', 'lifedrink', null] },
      { id: 'huntress', slots: 2, eq: ['lens', null] },
      { id: 'mage', slots: 3, eq: ['sage_eye', 'catalyst', 'manashard'] },
    ];
    let cur = 0, hover = null;
    function render() {
      host.innerHTML = '';
      const ch = CHARS[cur];
      // LEFT
      const left = el('div', 'art-left');
      const chead = el('div', 'char-head');
      chead.innerHTML = `<div class="por"><img src="assets/${CLS_SPR[ch.id]}.png" style="height:42px;image-rendering:pixelated" onerror="this.replaceWith(document.createTextNode('🛡'))"></div>
        <div><div class="nm">${CLS_KR[ch.id]}</div><div class="cls">아티팩트 ${ch.eq.filter(Boolean).length}/${ch.slots} 장착</div></div>`;
      left.appendChild(chead);
      const ctabs = el('div', 'char-tabs');
      CHARS.forEach((c, i) => { const t = el('div', 'ct' + (i === cur ? ' on' : ''), CLS_KR[c.id]); t.onclick = () => { cur = i; hover = null; render(); }; ctabs.appendChild(t); });
      left.appendChild(ctabs);
      const slots = el('div', 'slots');
      for (let i = 0; i < ch.slots; i++) {
        const aid = ch.eq[i]; const a = aid ? ART_BY[aid] : null;
        const row = el('div', 'slot-row ' + (a ? `filled rarity-${a.rar}` : 'empty'));
        const gem = el('div', 'gem'); row.appendChild(gem);
        row.appendChild(el('div', 'si', a
          ? `<div class="t">${a.nm}${a.aff === ch.id ? ' <span style="color:var(--c-gold);font-size:12px">✦친화</span>' : ''}</div><div class="e">${a.eff}</div>`
          : `<div class="t">— 빈 슬롯 —</div><div class="e">오른쪽에서 아티팩트를 장착</div>`));
        if (a) { const rm = el('div', 'rm', '✕'); rm.onclick = (e) => { e.stopPropagation(); ch.eq[i] = null; render(); }; row.appendChild(rm); }
        slots.appendChild(row);
      }
      left.appendChild(slots);
      if (ch.slots < 3) left.appendChild(el('div', 'setbonus', `<b>슬롯 ${ch.slots}/3</b> — 남은 슬롯은 레벨 성장으로 개방됩니다.`));
      // 세트 보너스 감지 (같은 cat 2개+)
      const cats = {}; ch.eq.filter(Boolean).forEach(id => { const c = ART_BY[id].cat; cats[c] = (cats[c] || 0) + 1; });
      const setC = Object.entries(cats).find(([, n]) => n >= 2);
      if (setC) left.appendChild(el('div', 'setbonus', `<b>세트: ${setC[0]} ×${setC[1]}</b> — 계열 보너스 발동 (해당 계열 효과 +20%).`));
      host.appendChild(left);
      // RIGHT — 인벤토리
      const right = el('div', 'art-right');
      const equippedAll = new Set([].concat(...CHARS.map(c => c.eq)).filter(Boolean));
      right.innerHTML = `<div class="h"><span class="ttl">보유 아티팩트</span><span class="hint">클릭해 빈 슬롯에 장착</span></div>`;
      const inv = el('div', 'inv');
      ARTIFACTS.forEach(a => {
        const onThis = ch.eq.includes(a.id);
        const row = el('div', `inv-row rarity-${a.rar}` + (onThis ? ' equipped' : ''));
        row.appendChild(el('div', 'gem'));
        row.appendChild(el('div', 'ii', `<div class="t">${a.nm}${a.aff ? ` <span class="aff">✦${CLS_KR[a.aff]}</span>` : ''}${onThis ? ' <span class="st">장착중</span>' : ''}</div><div class="e">${a.eff} · <span style="color:var(--c-text-off)">${a.src}</span></div>`));
        row.onclick = () => {
          if (onThis) { ch.eq[ch.eq.indexOf(a.id)] = null; render(); return; }
          const empty = ch.eq.indexOf(null);
          if (empty === -1) { flash(row, '슬롯이 가득 참'); return; }
          ch.eq[empty] = a.id; render();
        };
        inv.appendChild(row);
      });
      right.appendChild(inv);
      const leg = el('div', 'rar-legend');
      leg.innerHTML = `<span><i style="background:#a7b0d8"></i>일반</span><span><i style="background:#56a8e8"></i>희귀</span><span><i style="background:#ffd766"></i>전설</span>`;
      right.appendChild(leg);
      host.appendChild(right);
    }
    function flash(row, msg) { const o = row.querySelector('.e').textContent; const e = row.querySelector('.e'); e.textContent = '⚠ ' + msg; e.style.color = 'var(--c-warn)'; setTimeout(() => { e.textContent = o; e.style.color = ''; }, 900); }
    render();
  }

  /* ---- 아티팩트 도감 ---- */
  function buildArtCat() {
    const host = $('#artCat'); if (!host) return;
    const grid = el('div', 'cat-grid'); grid.style.marginTop = '18px';
    ARTIFACTS.forEach(a => {
      const c = el('div', `gcard rarity-${a.rar}`);
      const top = el('div', 'top');
      const gem = el('div'); gem.style.cssText = `width:26px;height:26px;transform:rotate(45deg);background:${RARC[a.rar]};box-shadow:inset 0 0 0 2px rgba(0,0,0,.35);flex:none`;
      top.appendChild(gem);
      top.appendChild(el('div', '', `<div class="nm">${a.nm}</div><div class="slot">${RARK[a.rar]} · ${a.cat}${a.aff ? ` · ✦${CLS_KR[a.aff]}` : ''}</div>`));
      c.appendChild(top);
      c.appendChild(el('div', 'eff', a.eff));
      const tags = el('div', 'tags');
      tags.appendChild(el('span', 'chip', a.cat));
      const s = el('span', 'chip'); s.textContent = a.src; s.style.color = 'var(--c-text-mute)'; s.style.boxShadow = 'inset 0 0 0 1px var(--c-frame-shadow)'; tags.appendChild(s);
      c.appendChild(tags);
      grid.appendChild(c);
    });
    host.appendChild(grid);
  }

  function init() { buildShop(); buildGearCat(); buildArtPanel(); buildArtCat(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

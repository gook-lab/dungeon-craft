/* ============================================================
   equip.js — JRPG 장비 · 인벤토리 · 스테이터스 풀 메뉴
   3열: 스테이터스 / 장비 슬롯(+증감 미리보기) / 인벤토리(탭)
   window.Components.buildEquip 로 등록
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  /* ---- 픽셀 장비 아이콘 (12x12) ---- */
  const ICONS = {
    weapon: ['............', '......ss....', '.....sWs....', '....sWs.....', '...sWs..g...', '..sWs..gWg..', '.sWs..gg.g..', 'hWs...g.....', 'Hh..........', 'hH..........', '.h..........', '............'],
    armor: ['...mmmm.....', '..mMMMMm....', '.mMllllMm...', 'mMl....lMm..', 'mMl.cc.lMm..', 'mMl.cc.lMm..', 'mMl....lMm..', '.mMlllMm....', '..mMMMm.....', '...mmm......', '............', '............'],
    accessory: ['....yyyy....', '...y....y...', '..y..dd..y..', '.y..dWWd..y.', '.y..dWWd..y.', '..y..dd..y..', '...y....y...', '....yyyy....', '............', '............', '............', '............'],
    potion: ['....rr......', '....rr......', '...pppp.....', '..pPWWPp....', '..pPWWPp....', '..pPWWPp....', '..pppppp....', '...pppp.....', '............', '............', '............', '............'],
  };
  const IPAL = {
    weapon: { s: '#cfd8ec', W: '#fff0b8', g: '#c98b2c', h: '#7a5224', H: '#5a3c18' },
    armor: { m: '#5a6790', M: '#8a97c4', l: '#cfe0ff', c: '#ffd766' },
    accessory: { y: '#ffd766', d: '#c98b2c', W: '#fff0b8' },
    potion: { r: '#9aa3c8', p: '#6fae2e', P: '#9ad94f', W: '#eafbe8' },
  };
  function icon(kind, scale) { return window.Pixel.pix(ICONS[kind] || ICONS.potion, IPAL[kind] || IPAL.potion, scale || 3); }

  /* ---- 데이터 ---- */
  const BASE = { 힘: 14, 수비: 9, 민첩: 11, 'HP최대': 30, 'MP최대': 16 };
  const GEAR = {
    weapon: [
      { id: 'w_steel', name: '강철검', mods: { 힘: 6 }, icon: 'weapon' },
      { id: 'w_flame', name: '화염도', mods: { 힘: 9, 민첩: -2 }, icon: 'weapon' },
      { id: 'w_dagger', name: '단검', mods: { 힘: 3, 민첩: 5 }, icon: 'weapon' },
    ],
    armor: [
      { id: 'a_chain', name: '사슬갑옷', mods: { 수비: 5 }, icon: 'armor' },
      { id: 'a_plate', name: '판금갑옷', mods: { 수비: 9, 민첩: -3 }, icon: 'armor' },
    ],
    accessory: [
      { id: 'c_ring', name: '수호의 반지', mods: { 수비: 3, 'HP최대': 8 }, icon: 'accessory' },
      { id: 'c_amulet', name: '마력 부적', mods: { 'MP최대': 10 }, icon: 'accessory' },
    ],
    consumable: [
      { id: 'p_herb', name: '약초', qty: 5, icon: 'potion', desc: 'HP 25 회복' },
      { id: 'p_ether', name: '마력초', qty: 2, icon: 'potion', desc: 'MP 15 회복' },
      { id: 'p_antidote', name: '해독초', qty: 3, icon: 'potion', desc: '독 치료' },
    ],
  };
  const SLOTS = [['weapon', '무기'], ['armor', '방어구'], ['accessory', '악세사리']];

  function buildEquip() {
    const stage = $('#equipStage'); if (!stage) return;
    let frame = 'frame-bevel';
    const equipped = { weapon: GEAR.weapon[0], armor: GEAR.armor[0], accessory: null };
    let tab = 'weapon';     // 인벤토리 카테고리
    let hover = null;       // 미리보기 대상 아이템

    function totals(preview) {
      const t = { ...BASE };
      const add = (g) => { if (g) for (const k in g.mods) t[k] = (t[k] || 0) + g.mods[k]; };
      add(equipped.weapon); add(equipped.armor); add(equipped.accessory);
      // 미리보기: hover 아이템이 같은 슬롯의 현재 장비를 대체
      const prev = { ...t };
      if (preview && hover && hover.slot && hover.slot !== 'consumable') {
        const p = { ...BASE };
        const cur = { ...equipped, [hover.slot]: hover.item };
        const add2 = (g) => { if (g) for (const k in g.mods) p[k] = (p[k] || 0) + g.mods[k]; };
        add2(cur.weapon); add2(cur.armor); add2(cur.accessory);
        return { now: prev, next: p };
      }
      return { now: prev, next: prev };
    }

    function statRows() {
      const { now, next } = totals(true);
      return Object.keys(BASE).map(k => {
        const a = now[k], b = next[k];
        let val = `<span class="num">${a}</span>`;
        if (b !== a) {
          const up = b > a;
          val += ` <span class="num" style="color:${up ? 'var(--c-hp-high)' : 'var(--c-hp-low)'}">▸ ${b}</span>`;
        }
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(57,64,110,.3)">
          <span class="soft" style="font-size:var(--t-stat)">${k}</span><span style="font-size:var(--t-stat)">${val}</span></div>`;
      }).join('');
    }

    function render() {
      stage.innerHTML = '';
      const box = el('div', `${frame} ui`);
      box.style.cssText = 'display:grid;grid-template-columns:1fr 1.1fr 1.2fr;gap:0;padding:0;overflow:hidden';

      /* --- 1. 스테이터스 --- */
      const col1 = el('div'); col1.style.cssText = 'padding:18px 18px;border-right:1px solid var(--c-frame-shadow)';
      col1.innerHTML =
        `<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="width:48px;height:48px;background:var(--c-ink-700);box-shadow:inset 0 0 0 3px var(--c-frame);display:flex;align-items:center;justify-content:center;border-radius:5px;overflow:hidden"><img src="assets/knight.png" style="height:42px;image-rendering:pixelated"></div>
          <div><div style="font-size:var(--t-label);color:var(--c-gold)">기사</div>
          <div class="mute" style="font-size:15px">나이트 · Lv.5</div></div></div>
        <div class="soft" style="font-size:15px;letter-spacing:1px;margin-bottom:4px">능력치</div>
        ${statRows()}
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:15px"><span class="soft">HP</span><span class="num">24 / ${totals().now['HP최대']}</span></div>
          ${window.Components.hpbar(24 / totals().now['HP최대'])}
          <div style="display:flex;justify-content:space-between;font-size:15px;margin-top:8px"><span class="soft">MP</span><span class="num">8 / ${totals().now['MP최대']}</span></div>
          <div class="hpbar"><div class="fill" style="width:${8 / totals().now['MP최대'] * 100}%;background:var(--c-mp)"></div></div>
        </div>`;

      /* --- 2. 장비 슬롯 --- */
      const col2 = el('div'); col2.style.cssText = 'padding:18px 18px;border-right:1px solid var(--c-frame-shadow)';
      col2.innerHTML = `<div class="soft" style="font-size:15px;letter-spacing:1px;margin-bottom:10px">장비</div>`;
      SLOTS.forEach(([slot, label]) => {
        const g = equipped[slot];
        const row = el('div', 'menu-row');
        const sel = tab === slot;
        row.style.cssText = 'align-items:center;gap:10px;padding:9px 8px;cursor:pointer;border-radius:5px' + (sel ? ';background:rgba(255,215,102,.1);box-shadow:inset 2px 0 0 var(--c-gold)' : '');
        row.innerHTML = `<span style="width:13px;font-size:var(--t-caption);color:var(--c-text-mute)">${label[0]}</span>`;
        const ic = icon(g ? g.icon : slot, 3); ic.style.opacity = g ? '1' : '.3';
        row.appendChild(ic);
        const nm = el('span', '', `<span style="font-size:var(--t-body);color:${g ? 'var(--c-text)' : 'var(--c-text-off)'}">${g ? g.name : '— 비어있음 —'}</span>`);
        nm.style.flex = '1'; row.appendChild(nm);
        if (g) { const unq = el('span', 'mute', '✕'); unq.style.cssText = 'font-size:15px;padding:0 4px'; unq.title = '해제';
          unq.onclick = (e) => { e.stopPropagation(); equipped[slot] = null; render(); }; row.appendChild(unq); }
        row.onclick = () => { tab = slot; hover = null; render(); };
        col2.appendChild(row);
      });
      // 슬롯 설명
      const cur = equipped[tab];
      const tip = el('div'); tip.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid var(--c-frame-shadow)';
      if (SLOTS.some(s => s[0] === tab)) {
        tip.innerHTML = `<div class="mute" style="font-size:15px">${SLOTS.find(s => s[0] === tab)[1]} 슬롯 — 오른쪽 목록에서 장착</div>` +
          (cur ? `<div class="soft" style="font-size:15px;margin-top:8px">현재: ${cur.name} ${Object.entries(cur.mods).map(([k, v]) => `<span class="num" style="color:${v > 0 ? 'var(--c-hp-high)' : 'var(--c-hp-low)'}">${k}${v > 0 ? '+' : ''}${v}</span>`).join(' ')}</div>` : '');
      } else {
        tip.innerHTML = `<div class="mute" style="font-size:15px">소비 아이템은 장착 대상이 없습니다.</div>`;
      }
      col2.appendChild(tip);

      /* --- 3. 인벤토리 --- */
      const col3 = el('div'); col3.style.cssText = 'padding:18px 18px';
      const tabs = [['weapon', '무기'], ['armor', '방어구'], ['accessory', '악세'], ['consumable', '소비']];
      const tabBar = el('div'); tabBar.style.cssText = 'display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap';
      tabs.forEach(([k, label]) => {
        const b = el('button', 'btn', label);
        b.style.cssText = 'font-size:15px;padding:4px 10px';
        if (tab === k) b.classList.add('on');
        b.onclick = () => { tab = k; hover = null; render(); };
        tabBar.appendChild(b);
      });
      col3.appendChild(tabBar);
      const list = el('div', 'menu');
      (GEAR[tab] || []).forEach((item, i) => {
        const row = el('div', 'menu-row');
        row.style.cssText = 'align-items:center;gap:10px;padding:8px 8px;cursor:pointer;border-radius:5px';
        const equippedHere = (tab !== 'consumable') && equipped[tab] && equipped[tab].id === item.id;
        if (equippedHere) row.style.background = 'rgba(98,196,106,.1)';
        row.appendChild(icon(item.icon, 3));
        const right = item.qty != null ? `<span class="meta num">x${item.qty}</span>`
          : `<span class="meta" style="font-size:14px">${Object.entries(item.mods).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join(' ')}</span>`;
        row.innerHTML += `<span class="lbl" style="flex:1;font-size:var(--t-body)">${item.name}${equippedHere ? ' <span class="gold" style="font-size:14px">장착중</span>' : ''}</span>${right}`;
        row.onmouseenter = () => { if (tab !== 'consumable') { hover = { slot: tab, item }; updatePreview(); } };
        row.onmouseleave = () => { hover = null; updatePreview(); };
        row.onclick = () => {
          if (tab === 'consumable') { return; }
          equipped[tab] = equippedHere ? null : item; hover = null; render();
        };
        list.appendChild(row);
      });
      col3.appendChild(list);
      if (tab === 'consumable') col3.appendChild(el('p', 'mute', '소비 아이템은 메뉴/전투에서 사용 (여기선 보관 목록).')).style.cssText = 'font-size:14px;margin-top:10px';
      else col3.appendChild(el('p', 'mute', '항목에 마우스를 올리면 왼쪽 능력치에 증감이 미리보기됩니다. 클릭해 장착/해제.')).style.cssText = 'font-size:14px;margin-top:10px';

      box.append(col1, col2, col3);
      stage.appendChild(box);
    }
    // 미리보기만 갱신 (스탯 열 다시 그림) — 전체 render 호출로 단순화
    function updatePreview() { render(); }

    render();

    // 프레임 전환 버튼
    document.querySelectorAll('[data-eqframe]').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('[data-eqframe]').forEach(b => b.classList.remove('on'));
      btn.classList.add('on'); frame = btn.dataset.eqframe; render();
    }));

    // 노트
    const notes = $('#equipNotes');
    if (notes) notes.innerHTML = `
      <div class="variant"><div class="vh"><span class="vlabel">3열 구조</span><span class="vtag">레이아웃</span></div>
        <p class="vnote">스테이터스 ↔ 장비 슬롯 ↔ 인벤토리. 시선이 왼쪽(결과) → 가운데(슬롯) → 오른쪽(선택)으로 흐릅니다.</p></div>
      <div class="variant"><div class="vh"><span class="vlabel">증감 미리보기</span><span class="vtag">상호작용</span></div>
        <p class="vnote">항목을 가리키면 능력치가 <span style="color:var(--c-hp-high)">▸상승</span>/<span style="color:var(--c-hp-low)">▸하락</span>으로 즉시 비교. JRPG의 핵심 UX.</p></div>
      <div class="variant"><div class="vh"><span class="vlabel">카테고리 탭</span><span class="vtag">인벤토리</span></div>
        <p class="vnote">무기·방어구·악세·소비 탭. 장착중 항목은 녹색 배경 + "장착중" 라벨로 표시.</p></div>`;
  }

  // Components에 등록 (components.js가 먼저 로드됨)
  if (window.Components) window.Components.buildEquip = buildEquip;
})();

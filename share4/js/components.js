/* ============================================================
   components.js — 보드 콘텐츠 생성
   색상 스와치 · 타입 견본 · 화면별 변형 목업
   ============================================================ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag);
    if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ===================== 색상 스와치 ===================== */
  const COLORS = [
    ['바탕 · Surfaces', [
      ['--c-ink-900', '#0a0b16', '0x0a0b16', '레터박스'],
      ['--c-ink-800', '#12152e', '0x12152e', '창 바탕 (구 0a0a2a)'],
      ['--c-ink-700', '#1b2046', '0x1b2046', '돋움 패널'],
      ['--c-ink-600', '#2a3160', '0x2a3160', '선택 행 / 비활성'],
    ]],
    ['테두리 · Frame', [
      ['--c-frame', '#f3edda', '0xf3edda', '양피지 (구 ffffff)'],
      ['--c-frame-dim', '#b9b48f', '0xb9b48f', '보조 테두리'],
      ['--c-frame-shadow', '#39406e', '0x39406e', '베벨 음영'],
    ]],
    ['글자 · Text', [
      ['--c-text', '#f3edda', '0xf3edda', '주 텍스트'],
      ['--c-text-soft', '#a7b0d8', '0xa7b0d8', '보조 (구 aab)'],
      ['--c-text-mute', '#6770a0', '0x6770a0', '3차'],
      ['--c-text-off', '#555b80', '0x555b80', '비활성 (구 6a6a72)'],
    ]],
    ['골드 · Accent', [
      ['--c-gold', '#ffd766', '0xffd766', '선택/강조 (구 ffe066)'],
      ['--c-gold-deep', '#c98b2c', '0xc98b2c', '음영/장식'],
      ['--c-gold-glow', '#fff0b8', '0xfff0b8', '치명타/글로우'],
    ]],
    ['활력 · Vitals', [
      ['--c-hp-high', '#62c46a', '0x62c46a', 'HP>50%'],
      ['--c-hp-mid', '#f0c44c', '0xf0c44c', 'HP 25-50%'],
      ['--c-hp-low', '#e25563', '0xe25563', 'HP<25%'],
      ['--c-mp', '#56a8e8', '0x56a8e8', 'MP'],
      ['--c-xp', '#b483f0', '0xb483f0', '경험치'],
    ]],
    ['자비(시그니처) · 상태이상', [
      ['--c-mercy', '#ffd766', '0xffd766', '영입'],
      ['--c-spare', '#cfe0ff', '0xcfe0ff', '살려주기'],
      ['--c-poison', '#9ad94f', '0x9ad94f', '독'],
      ['--c-sleep', '#b59cff', '0xb59cff', '수면'],
      ['--c-weaken', '#d98446', '0xd98446', '약화'],
    ]],
    ['피드백 · Feedback', [
      ['--c-info', '#7fded0', '0x7fded0', '정보 (구 cfe)'],
      ['--c-danger', '#e25563', '0xe25563', '위험'],
      ['--c-warn', '#f0c44c', '0xf0c44c', '경고'],
    ]],
  ];
  function buildSwatches() {
    const root = $('#swatches'); if (!root) return;
    COLORS.forEach(([group, items]) => {
      root.appendChild(el('div', 'sw-group', group));
      const grid = el('div', 'swatches');
      items.forEach(([name, hex, pixi, use]) => {
        const sw = el('div', 'swatch');
        const dark = ['#0a0b16', '#12152e', '#1b2046', '#2a3160', '#39406e', '#555b80', '#6770a0', '#c98b2c'].includes(hex);
        sw.innerHTML =
          `<div class="chip" style="background:${hex}"></div>
           <div class="meta"><div class="nm">${use}</div>
           <div class="hex"><span>${hex}</span><span class="pixi">${pixi}</span></div>
           <div class="hex" style="margin-top:2px"><span class="mute">${name}</span></div></div>`;
        grid.appendChild(sw);
      });
      root.appendChild(grid);
    });
  }

  /* ===================== 타입 견본 ===================== */
  const TYPES = [
    ['--t-display', 'Galmuri14 · 30px', '던전크래프트 · 플레이어 턴', 'var(--f-display)', '30px', '타이틀·페이즈 배너 (구 30px)'],
    ['--t-command', 'Galmuri11 · 24px', '공격  주문  아이템  자비', 'var(--f-ui)', '24px', '명령바 (구 22px)'],
    ['--t-body', 'Galmuri11 · 24px', '마수가 나타났다! 기사의 공격으로 24 피해를 입혔다.', 'var(--f-ui)', '24px', '메시지·대화 본문 (구 20·18px)'],
    ['--t-label', 'Galmuri9 · 20px', '기사  Lv.5  ·  상태: 독', 'var(--f-small)', '20px', '이름표·상태명 (구 17px)'],
    ['--t-num', 'GalmuriMono11 · 24px', 'HP 24/30   MP 8   골드 120   123', 'var(--f-mono)', '24px', 'HP/MP/데미지 수치'],
    ['--t-caption', 'Galmuri9 · 18px', '방향키 이동 · Z 조사/대화 · X 메뉴', 'var(--f-small)', '18px', '힌트·캡션 (구 14·12px)'],
  ];
  function buildTypes() {
    const root = $('#typespecimens'); if (!root) return;
    TYPES.forEach(([tk, label, sample, fam, size, use]) => {
      const row = el('div', 'type-row');
      row.innerHTML =
        `<div class="tk">${tk}<b>${label}</b><small>${use}</small></div>
         <div style="font-family:${fam};font-size:${size};color:var(--c-text);line-height:1.5">${sample}</div>`;
      root.appendChild(row);
    });
  }

  /* ===================== 공통: HP바 마크업 ===================== */
  function hpbar(frac, cls) {
    cls = cls || (frac > 0.5 ? 'high' : frac > 0.25 ? 'mid' : 'low');
    return `<div class="hpbar"><div class="fill ${cls}" style="width:${frac * 100}%"></div></div>`;
  }
  function tag(kind, label) {
    return `<span class="tag ${kind}"><img class="ico" src="${window.Pixel.statusURL(kind, 2)}">${label}</span>`;
  }

  /* ===================== NPC 대화창 변형 ===================== */
  function buildDialog() {
    const root = $('#dialogVariants'); if (!root) return;
    // A — classic 말풍선 (필드 위)
    const a = el('div', 'variant');
    a.innerHTML = `<div class="vh"><span class="vlabel">정통 말풍선</span><span class="vtag">A · classic</span></div>
      <div class="vstage field" style="align-items:flex-end;position:relative">
        <img src="assets/elder.png" style="position:absolute;top:18px;left:50%;transform:translateX(-50%);height:64px;image-rendering:pixelated">
        <div class="ui" style="width:100%">
          <span class="speaker-tag">마을 장로</span>
          <div class="frame-classic bubble" style="margin-top:0">
            <div class="dialog-body">길을 잃었나, 젊은이. 동쪽 숲에 마수가 들끓는다네.</div>
            <div class="dialog-hint">▼ <span class="blink">Space</span></div>
          </div>
        </div></div>
      <p class="vnote">현 구조의 정련판. 이름표가 창에 물려 붙고, 진행 화살표가 깜빡입니다. 친숙·안전.</p>`;
    // B — bevel 풀폭 하단
    const b = el('div', 'variant');
    b.innerHTML = `<div class="vh"><span class="vlabel">양각 하단바</span><span class="vtag">B · bevel</span></div>
      <div class="vstage field" style="align-items:flex-end">
        <div class="ui" style="width:100%">
          <span class="speaker-tag bevel">마을 장로</span>
          <div class="frame-bevel" style="margin-top:0">
            <div class="dialog-body">길을 잃었나, 젊은이. 동쪽 숲에 마수가 들끓는다네.</div>
            <div class="dialog-hint">▼ <span class="blink">Space</span></div>
          </div>
        </div></div>
      <p class="vnote">SNES풍 입체 하단바. 화자 칩도 베벨로 통일. 픽셀 질감이 가장 강함.</p>`;
    // C — gilded + 톤 분기 색
    const c = el('div', 'variant');
    c.innerHTML = `<div class="vh"><span class="vlabel">톤 분기 · 길디드</span><span class="vtag">C · gilded</span></div>
      <div class="vstage field" style="align-items:flex-end">
        <div class="ui" style="width:100%">
          <span class="speaker-tag gilded">해골 왕</span>
          <div class="frame-gilded" style="margin-top:0">
            <div class="dialog-body" style="color:var(--c-spare)">…네 자비가, 이 땅을 바꾸었다.</div>
            <div class="dialog-hint">▼ <span class="blink">Space</span></div>
          </div>
        </div></div>
      <p class="vnote">자비로운/무자비 톤 분기를 본문 색으로 은근히 암시(청백=자비, 적색=무자비).
        메터 없이 Undertale식 함의 유지.</p>`;
    root.append(a, b, c);
  }

  /* ===================== 전투 명령창 변형 ===================== */
  function cmdRow(label, opts) {
    opts = opts || {};
    const cls = ['menu-row'];
    if (opts.sel) cls.push('sel');
    if (opts.disabled) cls.push('disabled');
    if (opts.mercy) cls.push('mercy');
    let meta = opts.meta ? `<span class="meta">${opts.meta}</span>` : '';
    let sig = opts.sig ? `<span class="sig">시그니처</span>` : '';
    let reason = opts.reason ? `<span class="reason">${opts.reason}</span>` : '';
    return `<div class="${cls.join(' ')}"><span class="cursor">▶</span><span class="lbl">${label}</span>${sig}${reason}${meta}</div>`;
  }
  function buildCommand() {
    const root = $('#commandVariants'); if (!root) return;
    // A — 세로 컬럼 (bevel)
    const a = el('div', 'variant');
    a.innerHTML = `<div class="vh"><span class="vlabel">세로 명령 컬럼</span><span class="vtag">A · bevel</span></div>
      <div class="vstage" style="background:linear-gradient(180deg,#1a2438,#0e1122)">
        <div class="frame-bevel ui" style="width:280px">
          <div class="menu">
            ${cmdRow('공격', { sel: true })}
            ${cmdRow('주문')}
            ${cmdRow('아이템')}
            ${cmdRow('자비', { mercy: true, disabled: true, reason: '— 적을 약하게' })}
            ${cmdRow('방어')}
            ${cmdRow('도망')}
          </div>
        </div></div>
      <p class="vnote">현 구조와 동일한 세로 컬럼. 자비는 회색+사유 노출(색만 의존 X). 가장 이식 쉬움.</p>`;
    // B — 2열 그리드 + 자비 강조
    const b = el('div', 'variant');
    b.innerHTML = `<div class="vh"><span class="vlabel">자비 승격 헤더</span><span class="vtag">B · bevel</span></div>
      <div class="vstage" style="background:linear-gradient(180deg,#1a2438,#0e1122)">
        <div class="frame-bevel ui filled" style="width:300px">
          <div class="menu filled">
            ${cmdRow('자비', { mercy: true, sel: true, sig: true, meta: '영입 가능' })}
          </div>
          <div style="height:1px;background:var(--c-frame-shadow);margin:8px 0"></div>
          <div class="menu filled" style="display:grid;grid-template-columns:1fr 1fr;gap:2px 14px">
            ${cmdRow('공격')}${cmdRow('주문')}
            ${cmdRow('아이템')}${cmdRow('방어')}
            ${cmdRow('운명', { meta: '✦2' })}${cmdRow('도망')}
          </div>
        </div></div>
      <p class="vnote">자비가 조건 충족 시 상단으로 승격되며 "영입 가능" 배지. 나머지는 2열로 압축.
        시그니처를 시각적으로 최우선화.</p>`;
    // C — 가로 명령바 (하단 패널 풀폭)
    const c = el('div', 'variant');
    c.innerHTML = `<div class="vh"><span class="vlabel">가로 명령바</span><span class="vtag">C · classic</span></div>
      <div class="vstage" style="background:linear-gradient(180deg,#1a2438,#0e1122);align-items:stretch;padding:0">
        <div style="width:100%;align-self:flex-end">
          <div class="frame-classic ui" style="border-radius:0;display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap">
            <span class="menu-row sel" style="padding:5px 12px"><span class="cursor">▶</span><span class="lbl">공격</span></span>
            <span class="menu-row" style="padding:5px 12px">주문</span>
            <span class="menu-row" style="padding:5px 12px">아이템</span>
            <span class="menu-row mercy" style="padding:5px 12px">자비</span>
            <span class="menu-row" style="padding:5px 12px">방어</span>
            <span class="menu-row" style="padding:5px 12px">도망</span>
          </div>
        </div></div>
      <p class="vnote">하단 풀폭 가로바. 화면 상단을 비워 전투 연출에 집중. 좁은 화면에선 줄바꿈.</p>`;
    root.append(a, b, c);
  }

  /* ===================== 필드 HUD 변형 ===================== */
  function buildField() {
    const root = $('#fieldVariants'); if (!root) return;
    const party = [['기사', 'Lv.5', 0.8, 0.5], ['전사', 'Lv.5', 0.45, 0.2], ['사냥꾼', 'Lv.4', 1, 0.9]];
    // A — classic 정렬
    const rowsA = party.map(([n, lv, hp, mp]) =>
      `<div class="hud-row"><div class="hud-name">${n} <span class="mute">${lv}</span></div>
        <div class="hud-vit">${hpbar(hp)}<div class="mpbar hpbar"><div class="fill" style="width:${mp * 100}%;background:var(--c-mp)"></div></div></div></div>`).join('');
    const a = el('div', 'variant');
    a.innerHTML = `<div class="vh"><span class="vlabel">정렬 패널</span><span class="vtag">A · classic</span></div>
      <div class="vstage field" style="align-items:flex-start;justify-content:flex-start">
        <div class="frame-classic ui" style="width:230px">${rowsA}
          <div class="hud-foot"><span class="badge gold">◆ 골드 120</span><span class="badge fate">✦ 운명 2</span></div>
        </div></div>
      <p class="vnote">이름·HP·MP를 그리드로 정렬해 스캔성↑. 골드/운명을 하단 바로 분리.</p>`;
    // B — 컴팩트 바 only
    const rowsB = party.map(([n, lv, hp, mp]) =>
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:var(--t-caption);width:54px">${n}</span>${hpbar(hp)}</div>`).join('');
    const b = el('div', 'variant');
    b.innerHTML = `<div class="vh"><span class="vlabel">컴팩트</span><span class="vtag">B · bevel</span></div>
      <div class="vstage field" style="align-items:flex-start;justify-content:flex-start">
        <div class="frame-bevel ui" style="width:200px">${rowsB}
          <div class="hud-foot"><span class="badge gold">◆ 120</span><span class="badge fate">✦ 2</span></div>
        </div></div>
      <p class="vnote">탐험 중엔 화면을 가리지 않게 최소화. HP만 표시, MP는 메뉴에서. 미니 베벨.</p>`;
    // C — 아바타 칩
    const sprByName = { '기사': 'knight', '전사': 'warrior', '사냥꾼': 'huntress' };
    const rowsC = party.map(([n, lv, hp, mp], i) =>
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <span style="width:32px;height:32px;background:var(--c-ink-700);box-shadow:inset 0 0 0 2px var(--c-frame);display:inline-flex;align-items:center;justify-content:center;border-radius:4px;overflow:hidden"><img src="assets/${sprByName[n]}.png" style="height:30px;image-rendering:pixelated"></span>
        <div style="flex:1"><div style="font-size:15px" class="soft">${n} ${lv}</div>${hpbar(hp)}</div></div>`).join('');
    const c = el('div', 'variant');
    c.innerHTML = `<div class="vh"><span class="vlabel">아바타 칩</span><span class="vtag">C · gilded</span></div>
      <div class="vstage field" style="align-items:flex-start;justify-content:flex-start">
        <div class="frame-gilded ui" style="width:226px">${rowsC}
          <div class="hud-foot"><span class="badge gold">◆ 골드 120</span><span class="badge fate">✦ 2</span></div>
        </div></div>
      <p class="vnote">초상 칩으로 누가 누군지 즉시 파악(픽셀 초상 슬롯). 길디드로 약간의 고급감.</p>`;
    root.append(a, b, c);
  }

  /* ===================== 메뉴 상태창 변형 ===================== */
  function buildMenu() {
    const root = $('#menuVariants'); if (!root) return;
    const card = (frame) =>
      `<div class="${frame} ui" style="width:330px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-size:var(--t-label);color:var(--c-gold)">기사</span>
          <span class="num soft" style="font-size:var(--t-stat)">Lv.5</span></div>
        <div style="display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;align-items:center;margin-top:10px">
          <span class="soft" style="font-size:var(--t-stat)">HP</span>${hpbar(0.8)}<span class="num" style="font-size:var(--t-stat)">24/30</span>
          <span class="soft" style="font-size:var(--t-stat)">MP</span><div class="hpbar"><div class="fill" style="width:50%;background:var(--c-mp)"></div></div><span class="num" style="font-size:var(--t-stat)">8/16</span>
          <span class="soft" style="font-size:var(--t-stat)">EXP</span><div class="hpbar"><div class="fill" style="width:65%;background:var(--c-xp)"></div></div><span class="num" style="font-size:var(--t-stat)">65%</span>
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
          <span class="tag" style="color:var(--c-text-soft);box-shadow:inset 0 0 0 1px var(--c-frame-shadow)">⚔ 강철검</span>
          <span class="tag" style="color:var(--c-text-soft);box-shadow:inset 0 0 0 1px var(--c-frame-shadow)">🛡 사슬갑옷</span>
          <span class="tag" style="color:var(--c-text-soft);box-shadow:inset 0 0 0 1px var(--c-frame-shadow)">◇ 없음</span>
        </div></div>`;
    const a = el('div', 'variant');
    a.innerHTML = `<div class="vh"><span class="vlabel">스탯 정렬</span><span class="vtag">A · classic</span></div>
      <div class="vstage">${card('frame-classic')}</div>
      <p class="vnote">HP/MP/EXP를 라벨·바·수치 3열 그리드로 정렬. 장비는 슬롯 칩(⚔🛡◇).</p>`;
    const b = el('div', 'variant');
    b.innerHTML = `<div class="vh"><span class="vlabel">양각 카드</span><span class="vtag">B · bevel</span></div>
      <div class="vstage">${card('frame-bevel')}</div>
      <p class="vnote">동일 레이아웃, 베벨 프레임. 파티원당 1카드로 세로 나열.</p>`;
    const c = el('div', 'variant');
    c.innerHTML = `<div class="vh"><span class="vlabel">길디드 카드</span><span class="vtag">C · gilded</span></div>
      <div class="vstage">${card('frame-gilded')}</div>
      <p class="vnote">상태창은 머무는 화면이라 길디드의 고급감이 잘 맞습니다.</p>`;
    root.append(a, b, c);
  }

  /* ===================== 미니맵 · 페이즈 ===================== */
  function buildMinimap() {
    const root = $('#minimapVariants'); if (!root) return;
    // 미니맵 canvas 생성
    function mm() {
      const c = document.createElement('canvas'); c.width = 140; c.height = 140;
      c.style.imageRendering = 'pixelated'; c.style.width = '140px';
      const g = c.getContext('2d'); const cell = 10;
      for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
        const wall = (x === 0 || y === 0 || x === 13 || y === 13 || ((x % 3 === 0) && (y % 2 === 0) && x > 1 && x < 12));
        g.fillStyle = wall ? '#15131d' : '#46506a';
        g.fillRect(x * cell, y * cell, cell - 1, cell - 1);
      }
      const mark = (x, y, col) => { g.fillStyle = col; g.fillRect(x * cell, y * cell, cell - 1, cell - 1); };
      mark(12, 1, '#7fded0'); // portal cyan
      mark(11, 11, '#e25563'); // boss
      mark(2, 10, '#62c46a'); // npc
      mark(8, 5, '#ffd766'); // chest gold
      // player
      g.fillStyle = '#ffd766'; g.beginPath(); g.arc(5.5 * cell, 6.5 * cell, 5, 0, 7); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
      return c;
    }
    const legend = `<div style="display:grid;grid-template-columns:auto auto;gap:4px 14px;font-size:var(--t-caption);margin-top:12px">
      <span style="color:var(--c-info)">■ 포탈</span><span style="color:var(--c-danger)">■ 보스</span>
      <span style="color:var(--c-hp-high)">■ NPC</span><span style="color:var(--c-gold)">■ 상자/플레이어</span></div>`;
    const a = el('div', 'variant');
    a.innerHTML = `<div class="vh"><span class="vlabel">미니맵 범례</span><span class="vtag">색 통합</span></div>
      <div class="vstage" style="flex-direction:column;gap:10px"><div class="frame-bevel" style="padding:8px"></div></div>
      <p class="vnote">마커 색을 새 의미 체계와 통합(포탈=정보 청록, 보스=위험 적, NPC=녹, 상자/플레이어=골드).</p>`;
    a.querySelector('.frame-bevel').appendChild(mm());
    const leg = el('div'); leg.innerHTML = legend; a.querySelector('.vstage').appendChild(leg.firstElementChild);
    // 페이즈 배너 둘
    const b = el('div', 'variant');
    b.innerHTML = `<div class="vh"><span class="vlabel">페이즈 배너</span><span class="vtag">턴 전환</span></div>
      <div class="vstage" style="flex-direction:column;gap:12px;padding:24px">
        <div class="phase-banner hero" style="width:100%">플레이어 턴</div>
        <div class="phase-banner enemy" style="width:100%">적의 턴</div></div>
      <p class="vnote">기존 청/적 배너 유지하되 Galmuri14 + 자간으로 임팩트↑. 0.7초 페이드.</p>`;
    const c = el('div', 'variant');
    c.innerHTML = `<div class="vh"><span class="vlabel">보스 등장 배너</span><span class="vtag">특수</span></div>
      <div class="vstage dungeon" style="flex-direction:column;padding:24px">
        <div class="frame-gilded ui" style="text-align:center;width:90%">
          <div style="font-size:var(--t-display);color:var(--c-gold-glow)">해골 왕</div>
          <div class="soft" style="font-size:var(--t-body);margin-top:6px">가 가로막는다!</div>
        </div></div>
      <p class="vnote">보스전 진입 시 길디드 모달 + 골드 글로우 네임. 일반 인카운터와 차별화.</p>`;
    root.append(a, b, c);
  }

  window.Components = { buildSwatches, buildTypes, buildDialog, buildCommand, buildField, buildMenu, buildMinimap, hpbar, tag };
})();

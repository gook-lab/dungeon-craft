/* ============================================================
   spellfx-cutscene.js — 스킬 컷신 (화면 중앙 시네마틱 오버레이)
   클래스 필살기(1인) + 인연공격(2인)에 공용으로 쓰는 연출.
   레터박스 → 대각 슬래시 스윕 → 포트레이트 슬라이드인 → 스킬명 슬램 → 임팩트 플래시.
   onImpact 콜백에서 실제 스펠 이펙트를 시작한다.
   window.SpellCutscene.play(host, opts) → 총 길이(ms) 반환.
   ============================================================ */
(function () {
  const EL_COLOR = {
    fire: '#e25563', ice: '#56a8e8', thunder: '#fff0b8', poison: '#9ad94f', earth: '#c98b2c',
    wind: '#a8e6c8', dark: '#b483f0', holy: '#ffd766', heal: '#62c46a', arcane: '#b483f0',
    mana: '#56a8e8', phys: '#e25563', physical: '#e25563', star: '#9ad6ff', shield: '#56a8e8',
  };
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  function play(host, opts) {
    opts = opts || {};
    const { title, by, portraits = [], el: elem = 'arcane', kind = 'ult', onImpact } = opts;
    const color = EL_COLOR[elem] || '#b483f0';
    const bond = kind === 'bond';
    const DUR = bond ? 1500 : 1300;
    const IMPACT = Math.round(DUR * 0.52);

    // 기존 컷신 제거 (중복 방지)
    host.querySelectorAll('.cutscene').forEach(n => n.remove());

    const ov = el('div', 'cutscene');
    ov.style.setProperty('--cs-col', color);
    const barT = el('div', 'cs-bar cs-bar-top');
    const barB = el('div', 'cs-bar cs-bar-bot');
    const slash = el('div', 'cs-slash');
    const flash = el('div', 'cs-flash');
    const n = portraits.length;
    const pwrap = el('div', 'cs-portraits' + (bond ? ' duo' : '') + (n >= 3 ? ' multi n' + n : ''));
    portraits.slice(0, 4).forEach((key, i) => {
      const side = n <= 2 ? (i === 0 ? 'from-left' : 'from-right') : (i < n / 2 ? 'from-left' : 'from-right');
      const fr = el('div', 'cs-pframe ' + side);
      fr.style.setProperty('--cs-delay', (i * 70) + 'ms');
      const im = new Image(); im.src = 'assets/' + key + '.png'; im.className = 'cs-portrait';
      fr.appendChild(im); pwrap.appendChild(fr);
    });
    const center = el('div', 'cs-center');
    if (bond) center.appendChild(el('div', 'cs-bondmark', n >= 4 ? '✦✦✦✦' : n === 3 ? '✦✦✦' : '✦'));
    const tag = el('div', 'cs-tag', n >= 4 ? '쿼드 인연기' : n === 3 ? '트리플 인연기' : bond ? '인연공격' : '필살기');
    const nm = el('div', 'cs-name', title);
    center.append(tag, nm);
    ov.append(barT, barB, slash, pwrap, center, flash);
    host.appendChild(ov);

    const A = (node, frames, dur, opt) => node.animate(frames, Object.assign({ duration: dur, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }, opt || {}));

    // 레터박스 슬라이드인
    A(barT, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], 200);
    A(barB, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], 200);
    // 대각 슬래시 스윕
    A(slash, [{ transform: 'translateX(-130%) skewX(-18deg)', opacity: 0 },
      { transform: 'translateX(-20%) skewX(-18deg)', opacity: 1, offset: 0.4 },
      { transform: 'translateX(130%) skewX(-18deg)', opacity: 0 }], Math.round(DUR * 0.55), { delay: 120, easing: 'ease-in' });
    // 포트레이트 슬라이드인 (다인은 순차 등장)
    pwrap.querySelectorAll('.cs-pframe').forEach((fr, i) => {
      const left = fr.classList.contains('from-left');
      A(fr, [{ transform: `translateX(${left ? -60 : 60}px)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 }], 320, { delay: 180 + i * 70 });
    });
    // 스킬명 슬램
    A(tag, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], 200, { delay: 300 });
    A(nm, [{ opacity: 0, transform: 'scale(1.6)', filter: 'blur(4px)' },
      { opacity: 1, transform: 'scale(1)', filter: 'blur(0)', offset: 0.6 },
      { opacity: 1, transform: 'scale(1)' }], 360, { delay: 320 });
    // 임팩트 플래시
    setTimeout(() => { A(flash, [{ opacity: 0 }, { opacity: 0.85, offset: 0.15 }, { opacity: 0 }], 360); if (onImpact) onImpact(); }, IMPACT);
    // 퇴장 (레터박스 후퇴 + 페이드)
    const OUT = DUR - 260;
    A(barT, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], 240, { delay: OUT });
    A(barB, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], 240, { delay: OUT });
    A(pwrap, [{ opacity: 1 }, { opacity: 0 }], 220, { delay: OUT });
    A(center, [{ opacity: 1 }, { opacity: 0 }], 220, { delay: OUT });
    setTimeout(() => ov.remove(), DUR);
    return DUR;
  }

  window.SpellCutscene = { play, EL_COLOR };
})();

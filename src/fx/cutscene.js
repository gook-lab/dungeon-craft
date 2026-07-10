// cutscene.js — 스킬 컷신 (화면 중앙 시네마틱 오버레이). 클래스 필살기(1인) +
// 인연공격/필살기(2~4인) 공용. share4/js/spellfx-cutscene.js(DOM/WAAPI 프로토타입)를
// PixiJS로 포팅 — 동일 타임라인을 단일 elapsed `t`로 구동(spellFx DEFS와 같은 방식).
//   레터박스 IN → 대각 슬래시 스윕 → 포트레이트 순차 슬라이드인 → 태그+스킬명 슬램 →
//   IMPACT(플래시 + onImpact()) → 레터박스 OUT + 페이드 → onDone().
// onImpact(전체의 ~52%)에서 실제 데미지/spellFx를 시작해 컷신과 타격을 연결한다.
// COSMETIC ONLY — battle.js state/save 미접근. 렌더러가 있을 때만 생성된다.

import * as PIXI from 'pixi.js';
import { makeSprite } from '../engine/renderer.js';
import { label } from '../ui/uikit.js';
import { FONT } from '../ui/tokens.js';

// element → accent colour (PIXI tint). Mirrors the prototype EL_COLOR.
const EL_COLOR = {
  fire: 0xe25563, ice: 0x56a8e8, thunder: 0xfff0b8, poison: 0x9ad94f, earth: 0xc98b2c,
  wind: 0xa8e6c8, dark: 0xb483f0, holy: 0xffd766, heal: 0x62c46a, arcane: 0xb483f0,
  physical: 0xe25563, phys: 0xe25563,
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);   // cubic ease-out
const ramp = (t, a, b) => clamp01((t - a) / (b - a));      // 0→1 across [a,b]
const pulse = (t, a, b) => Math.sin(clamp01((t - a) / (b - a)) * Math.PI); // 0→1→0

export class Cutscene {
  constructor({ screen }) {
    this.screen = screen;        // live { w, h } (game.renderer.screen)
    this.root = new PIXI.Container();
    this.root.visible = false;
    this._t = 0; this.dur = 0; this.impactAt = 0; this._impacted = false;
    this.onImpact = null; this.onDone = null; this._els = null;
  }

  get active() { return this.root.visible; }

  // opts: { title, element, count, portraits:[imageUrl...] }  (URLs, not class keys —
  // the scene resolves hero vs ally art so a recruited monster ally can appear too)
  play(opts, onImpact, onDone) {
    const { w, h } = this.screen;
    const color = EL_COLOR[opts.element] || 0xb483f0;
    const n = opts.count || (opts.portraits ? opts.portraits.length : 1);
    const bond = n >= 2;
    this.dur = n >= 3 ? 1.5 : 1.3;
    this.impactAt = this.dur * 0.52;
    this._t = 0; this._impacted = false;
    this.onImpact = onImpact; this.onDone = onDone;

    this.root.removeChildren();
    this.root.visible = true;
    const barH = Math.round(h * 0.17);

    // 포트레이트 (중앙 밴드) — 다인은 좌/우에서 순차 등장.
    const pSize = n >= 4 ? 150 : n === 3 ? 180 : 210;
    const gap = pSize * 0.86;
    const totalW = gap * (n - 1);
    const frames = [];
    (opts.portraits || []).slice(0, 4).forEach((url, i) => {
      const fr = new PIXI.Container();
      const sp = makeSprite(url, { anchorX: 0.5, anchorY: 0.5 });
      sp.scale.set(pSize / 68); // south art ~68px native
      fr.addChild(sp);
      fr._fromLeft = n <= 2 ? i === 0 : i < n / 2;
      fr._delay = 0.18 + i * 0.07;
      fr._baseX = w / 2 - totalW / 2 + gap * i;
      fr.y = h / 2;
      this.root.addChild(fr);
      frames.push(fr);
    });

    // 중앙 텍스트 — 태그 + 스킬명 (+ 인연 ✦ 마크).
    const center = new PIXI.Container();
    const tagStr = n >= 4 ? '쿼드 인연기' : n === 3 ? '트리플 인연기' : bond ? '인연공격' : '필살기';
    const markStr = bond ? (n >= 4 ? '✦✦✦✦' : n === 3 ? '✦✦✦' : '✦') : '';
    const markT = markStr ? label(markStr, 22, color, { font: FONT.ui }) : null;
    const tagT = label(tagStr, 18, 0xffffff, { font: FONT.ui });
    const nameT = label(opts.title || '', 52, color, { font: FONT.ui });
    for (const t of [markT, tagT, nameT]) if (t) t.anchor = { x: 0.5, y: 0.5 };
    if (markT) { markT.y = -56; center.addChild(markT); }
    tagT.y = -28; center.addChild(tagT);
    nameT.y = 12; center.addChild(nameT);
    center.x = w / 2; center.y = h * 0.7;
    this.root.addChild(center);

    // 레터박스 바 (포트레이트 위 — 위/아래를 시네마틱하게 가린다) + 색 엣지 라인.
    const barT = new PIXI.Graphics().rect(0, 0, w, barH).fill({ color: 0x000000 });
    barT.rect(0, barH - 2, w, 2).fill({ color });
    const barB = new PIXI.Graphics().rect(0, 0, w, barH).fill({ color: 0x000000 });
    barB.rect(0, 0, w, 2).fill({ color });
    this.root.addChild(barT, barB);

    // 대각 슬래시 (additive — 화면을 한 번 베고 지나간다).
    const slash = new PIXI.Graphics();
    slash.blendMode = 'add';
    const sw = w * 0.42, skew = h * 0.16;
    slash.poly([0, 0, sw, 0, sw - skew, h, -skew, h]).fill({ color });
    slash.pivot.set(sw / 2, h / 2); slash.y = h / 2; slash.alpha = 0;
    this.root.addChild(slash);

    // 임팩트 플래시 (최상단, 풀스크린).
    const flash = new PIXI.Graphics().rect(0, 0, w, h).fill({ color: 0xffffff });
    flash.alpha = 0;
    this.root.addChild(flash);

    this._els = { barT, barB, slash, center, tagT, nameT, frames, flash, barH, w, h };
  }

  update(dt) {
    if (!this.active) return;
    this._t += dt;
    const t = this._t, D = this.dur, e = this._els;
    const { w, h, barH } = e;
    const inK = easeOut(t / 0.2);
    const outStart = D - 0.26;
    const outK = t > outStart ? easeOut((t - outStart) / 0.24) : 0;

    // 레터박스: 슬라이드인 → (퇴장 시) 후퇴.
    e.barT.y = -barH * (1 - inK) - barH * outK;
    e.barB.y = (h - barH) + barH * (1 - inK) + barH * outK;

    // 슬래시 스윕.
    const sp = ramp(t, 0.12, 0.12 + 0.55 * D);
    e.slash.x = (-w * 0.9 + w * 1.8 * sp) + w / 2;
    e.slash.alpha = (sp > 0 && sp < 1) ? pulse(t, 0.12, 0.12 + 0.55 * D) * 0.9 : 0;

    // 포트레이트: 각자 delay 후 슬라이드인, 퇴장 시 페이드.
    for (const fr of e.frames) {
      const k = easeOut((t - fr._delay) / 0.32);
      fr.x = fr._baseX + (fr._fromLeft ? -60 : 60) * (1 - k);
      fr.alpha = clamp01(k) * (1 - outK);
    }

    // 중앙 텍스트: 태그 페이드 + 스킬명 슬램(스케일 1.6→1).
    e.tagT.alpha = ramp(t, 0.3, 0.46);
    e.nameT.alpha = ramp(t, 0.32, 0.5);
    const ns = 1.6 - 0.6 * easeOut((t - 0.32) / 0.36);
    e.nameT.scale.set(Math.max(1, ns));
    e.center.alpha = 1 - outK;

    // 임팩트 플래시 + 콜백.
    e.flash.alpha = pulse(t, this.impactAt, this.impactAt + 0.36) * 0.85;
    if (!this._impacted && t >= this.impactAt) { this._impacted = true; const cb = this.onImpact; if (cb) cb(); }

    // 종료.
    if (t >= D) {
      this.root.visible = false;
      this.root.removeChildren();
      this._els = null;
      const done = this.onDone; this.onDone = null; this.onImpact = null;
      if (done) done();
    }
  }

  // 연출 스킵 — 임팩트가 아직이면 즉시 발동시키고 종료로 점프(다음 tick에 onDone).
  skip() {
    if (!this.active) return;
    if (!this._impacted) { this._impacted = true; const cb = this.onImpact; if (cb) cb(); }
    this._t = this.dur;
  }

  destroy() {
    if (this.root && !this.root.destroyed) this.root.destroy({ children: true });
    this._els = null;
  }
}

// Title scene — opaque. Save-slot picker: choose one of N slots, then 이어하기 /
// 새로 시작 / 삭제 for a filled slot (an empty slot starts a new game directly).
//
// v3 리터치 (2026-07-15): 슬롯이 텍스트 한 줄 → 리치 카드 — 리더 스프라이트 +
// 파티 초상 칩 + Lv/골드/위치/플레이타임. 배경은 은은한 그라데이션 + 산 실루엣
// 패럴랙스 2겹 + 떠오르는 불씨(embers) — 크립트의 밤 무드.

import * as PIXI from 'pixi.js';
import { label, menuList, frame } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { heroUrl } from '../util/assets.js';
import { makeSprite } from '../engine/renderer.js';
import { getMap } from '../content/maps/index.js';
import { createWeather } from '../ui/weather.js';

const HERO_KR = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };

function fmtPlaytime(sec) {
  const m = Math.floor((sec || 0) / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}시간 ${m % 60}분` : `${m}분`;
}

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    // Static backdrop (built once) + re-rendered menu layer.
    this.backdrop = new PIXI.Container();
    this.layer = new PIXI.Container();
    this.container.addChild(this.backdrop, this.layer);
    this.mode = 'slots'; // 'slots' | 'action'
    this.index = 0;
    this.slot = 1;
    this._ridges = []; // {g, factor} 패럴랙스 실루엣
    this._driftT = 0;
    this.weather = null;
  }

  enter() { this.mode = 'slots'; this.index = 0; this.buildBackdrop(); this.render(); }

  // 밤하늘 그라데이션 + 산 실루엣 2겹(느린 수평 드리프트) + 불씨 파티클.
  buildBackdrop() {
    this.backdrop.removeChildren();
    this._ridges = [];
    if (this.weather) { this.weather.destroy(); this.weather = null; }
    const { w, h } = this.game.renderer.screen;

    const sky = new PIXI.Graphics();
    const top = 0x0a0b16, bot = 0x1a1428;
    const B = 14;
    for (let i = 0; i < B; i++) {
      const t = i / (B - 1);
      const c = ((Math.round(((top >> 16) & 255) * (1 - t) + ((bot >> 16) & 255) * t) << 16)
        | (Math.round(((top >> 8) & 255) * (1 - t) + ((bot >> 8) & 255) * t) << 8)
        | Math.round((top & 255) * (1 - t) + (bot & 255) * t));
      sky.rect(0, (h * i) / B, w, h / B + 1).fill({ color: c });
    }
    this.backdrop.addChild(sky);

    // 산 실루엣 2겹 — 화면보다 넓게 그려 두고 update가 x를 흘린다.
    const ridges = [
      { color: 0x141020, baseY: h * 0.66, amp: h * 0.10, freq: 2.1, factor: 4 },
      { color: 0x0e0c18, baseY: h * 0.78, amp: h * 0.08, freq: 3.1, factor: 9 },
    ];
    const W2 = w * 2;
    for (const r of ridges) {
      const g = new PIXI.Graphics();
      g.moveTo(0, h);
      const SEG = 40;
      for (let s = 0; s <= SEG; s++) {
        const x = (W2 * s) / SEG;
        const yy = r.baseY - r.amp * (0.6 * Math.sin((s / SEG) * Math.PI * 2 * r.freq) + 0.4 * Math.sin((s / SEG) * Math.PI * 2 * r.freq * 0.53 + 1.7));
        g.lineTo(x, yy);
      }
      g.lineTo(W2, h).lineTo(0, h).fill({ color: r.color, alpha: 0.95 });
      this.backdrop.addChild(g);
      this._ridges.push({ g, factor: r.factor, span: w });
    }

    // 떠오르는 불씨 — 크립트의 잔불 (weather 엔진 재사용).
    this.weather = createWeather({ width: w, height: h });
    this.weather.setKind('embers');
    this.weather.container.alpha = 0.55;
    this.backdrop.addChild(this.weather.container);
  }

  // 카드 본문: 리더 스프라이트 + 파티 칩 + 요약 두 줄.
  slotCard(slot, summary, y, selected, cardW, cardH) {
    const { w } = this.game.renderer.screen;
    const x = w / 2 - cardW / 2;
    const box = frame(cardW, cardH, { style: 'bevel' });
    box.x = x; box.y = y;
    if (!selected) box.alpha = 0.72;
    this.layer.addChild(box);
    if (selected) {
      const hl = new PIXI.Graphics();
      hl.roundRect(x - 3, y - 3, cardW + 6, cardH + 6, 6).stroke({ color: NUM.gold, width: 2, alpha: 0.9 });
      this.layer.addChild(hl);
    }

    const cap = label(`슬롯 ${slot}`, FS.caption, selected ? HEX.gold : HEX.textMute);
    cap.anchor = { x: 1, y: 0 };
    cap.x = x + cardW - 14; cap.y = y + 8;
    this.layer.addChild(cap);

    if (!summary) {
      const t = label('비어있음 — 새로운 여정을 시작한다', FS.body, HEX.textSoft);
      t.x = x + 14; t.y = y + cardH / 2 + 2; t.anchor = { x: 0, y: 0.5 };
      this.layer.addChild(t);
      return;
    }

    // 리더 스프라이트 (남향 스틸) — 카드 좌측.
    const lead = summary.party[0];
    const sp = makeSprite(heroUrl(lead, 'south'), { anchorX: 0.5, anchorY: 1 });
    sp.x = x + 42; sp.y = y + cardH - 12;
    sp.scale.set(1.7);
    this.layer.addChild(sp);

    // 동료 초상 칩 — 리더 오른쪽에 작게 줄지어.
    const members = (summary.members || []).slice(1, 5);
    members.forEach((m, i) => {
      const chip = makeSprite(heroUrl(m.id, 'south'), { anchorX: 0.5, anchorY: 1 });
      chip.x = x + 82 + i * 26; chip.y = y + cardH - 14;
      chip.scale.set(1.1);
      chip.alpha = 0.9;
      this.layer.addChild(chip);
    });

    const leadName = HERO_KR[lead] || lead;
    const extra = summary.party.length > 1 ? ` 외 ${summary.party.length - 1}인` : '';
    const line1 = label(`${leadName}${extra} · Lv.${summary.level}`, FS.body, selected ? HEX.text : HEX.textSoft, { font: FONT.ui });
    line1.x = x + 190; line1.y = y + 26;
    this.layer.addChild(line1);

    const place = getMap(summary.mapId)?.name || summary.mapId;
    const line2 = label(`${summary.gold}G · ${place} · ${fmtPlaytime(summary.playtime)}`, FS.caption, HEX.textMute, { font: FONT.ui });
    line2.x = x + 190; line2.y = y + 50;
    this.layer.addChild(line2);
  }

  render() {
    this.layer.removeChildren();
    const { w, h } = this.game.renderer.screen;

    const title = label('드래곤 크립트', FS.display, HEX.gold, { font: FONT.display });
    title.anchor = { x: 0.5, y: 0.5 }; title.x = w / 2; title.y = h * 0.18; this.layer.addChild(title);
    const sub = label('베어 끝낼 것인가, 길 잃은 영혼을 구할 것인가', 18, HEX.textSoft);
    sub.anchor = { x: 0.5, y: 0.5 }; sub.x = w / 2; sub.y = h * 0.18 + FS.display + 8; this.layer.addChild(sub);

    this.summaries = this.game.slotSummaries(); // [{slot, summary}]

    // 슬롯 리치 카드 3장 — 두 모드 공통으로 그린다 (action 모드는 선택 카드 강조 유지).
    const cardW = Math.min(560, w - 80), cardH = 86, gap = 14;
    const cardsTop = h * 0.34;
    this.summaries.forEach(({ slot, summary }, i) => {
      const selected = this.mode === 'slots' ? i === this.index : slot === this.slot;
      this.slotCard(slot, summary, cardsTop + i * (cardH + gap), selected, cardW, cardH);
    });
    const cardsBottom = cardsTop + this.summaries.length * (cardH + gap);

    let hint;
    if (this.mode === 'slots') {
      this.options = this.summaries.map(({ slot }) => `슬롯 ${slot}`); // 커서 길이용
      hint = '↑↓ 슬롯 선택 · Z 확인';
    } else {
      this.options = ['이어하기', '새로 시작', '삭제', '취소'];
      hint = `슬롯 ${this.slot} · Z 확인 · X 뒤로`;
      const m = menuList(this.options, { width: 300, frameStyle: 'bevel' });
      m.container.x = w / 2 - m.width / 2; m.container.y = cardsBottom + 8;
      this.layer.addChild(m.container);
      this.menu = m; this.index = Math.min(this.index, this.options.length - 1); m.setIndex(this.index);
    }

    const ht = label(hint, FS.caption, HEX.textMute);
    ht.anchor = { x: 0.5, y: 0.5 }; ht.x = w / 2; ht.y = h - 32; this.layer.addChild(ht);
  }

  update(dt) {
    // 배경 생동 — 불씨 + 산 실루엣의 느린 드리프트 (모듈로 랩).
    this.weather?.update(dt);
    this._driftT += dt;
    for (const r of this._ridges) {
      r.g.x = -((this._driftT * r.factor) % r.span);
    }

    const input = this.game.input;
    const n = this.options.length;
    if (input.pressed('up')) { this.index = (this.index + n - 1) % n; this.mode === 'slots' ? this.render() : this.menu.setIndex(this.index); }
    if (input.pressed('down')) { this.index = (this.index + 1) % n; this.mode === 'slots' ? this.render() : this.menu.setIndex(this.index); }
    if (input.pressed('cancel') && this.mode === 'action') { this.mode = 'slots'; this.index = this.slot - 1; this.render(); return; }
    if (!input.pressed('confirm')) return;

    if (this.mode === 'slots') {
      this.slot = this.index + 1;
      const sum = this.summaries[this.index].summary;
      if (!sum) { this.game.startGame(true, this.slot); return; } // empty → new game
      this.mode = 'action'; this.index = 0; this.render(); // filled → action menu
      return;
    }
    // action mode
    const choice = this.options[this.index];
    if (choice === '이어하기') this.game.startGame(false, this.slot);
    else if (choice === '새로 시작') this.game.startGame(true, this.slot);
    else if (choice === '삭제') { this.game.deleteSlot(this.slot); this.mode = 'slots'; this.index = this.slot - 1; this.render(); }
    else { this.mode = 'slots'; this.index = this.slot - 1; this.render(); } // 취소
  }
}

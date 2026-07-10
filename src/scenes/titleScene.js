// Title scene — opaque. Save-slot picker: choose one of N slots, then 이어하기 /
// 새로 시작 / 삭제 for a filled slot (an empty slot starts a new game directly).

import * as PIXI from 'pixi.js';
import { label, menuList } from '../ui/uikit.js';
import { HEX, FS, FONT } from '../ui/tokens.js';

const HERO_KR = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.layer = new PIXI.Container();
    this.container.addChild(this.layer);
    this.mode = 'slots'; // 'slots' | 'action'
    this.index = 0;
    this.slot = 1;
  }

  enter() { this.mode = 'slots'; this.index = 0; this.render(); }

  slotLabel(slot, summary) {
    if (!summary) return `슬롯 ${slot} — 비어있음`;
    const lead = HERO_KR[summary.party[0]] || summary.party[0] || '?';
    const extra = summary.party.length > 1 ? ` 외 ${summary.party.length - 1}인` : '';
    return `슬롯 ${slot} — ${lead}${extra} · Lv.${summary.level} · ${summary.gold}G`;
  }

  render() {
    this.layer.removeChildren();
    const { w, h } = this.game.renderer.screen;
    const bg = new PIXI.Graphics(); bg.rect(0, 0, w, h).fill({ color: 0x0a0b16 }); this.layer.addChild(bg);

    const title = label('드래곤 크립트', FS.display, HEX.gold, { font: FONT.display });
    title.anchor = { x: 0.5, y: 0.5 }; title.x = w / 2; title.y = h * 0.22; this.layer.addChild(title);
    const sub = label('베어 끝낼 것인가, 길 잃은 영혼을 구할 것인가', 18, HEX.textSoft);
    sub.anchor = { x: 0.5, y: 0.5 }; sub.x = w / 2; sub.y = h * 0.22 + FS.display + 8; this.layer.addChild(sub);

    this.summaries = this.game.slotSummaries(); // [{slot, summary}]

    let options, hint;
    if (this.mode === 'slots') {
      options = this.summaries.map(({ slot, summary }) => this.slotLabel(slot, summary));
      hint = '↑↓ 슬롯 선택 · Z 확인';
    } else {
      options = ['이어하기', '새로 시작', '삭제', '취소'];
      hint = `슬롯 ${this.slot} · Z 확인 · X 뒤로`;
    }

    const m = menuList(options, { width: 360, frameStyle: 'bevel' });
    m.container.x = w / 2 - m.width / 2; m.container.y = h * 0.5;
    this.layer.addChild(m.container);
    this.menu = m; this.index = Math.min(this.index, options.length - 1); m.setIndex(this.index);
    this.options = options;

    const ht = label(hint, FS.caption, HEX.textMute);
    ht.anchor = { x: 0.5, y: 0.5 }; ht.x = w / 2; ht.y = h - 40; this.layer.addChild(ht);
  }

  update() {
    const input = this.game.input;
    const n = this.options.length;
    if (input.pressed('up')) { this.index = (this.index + n - 1) % n; this.menu.setIndex(this.index); }
    if (input.pressed('down')) { this.index = (this.index + 1) % n; this.menu.setIndex(this.index); }
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

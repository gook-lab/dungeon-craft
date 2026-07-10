// Character select — opaque. Shown on a new game (before the field) to pick the
// LEADER hero. The run starts solo with that hero; the other base heroes join as
// town recruits, and further companions (mage / monsters) swap into the active
// lineup later (field menu → 편성). Confirm → game.beginGame(leaderId).

import * as PIXI from 'pixi.js';
import { label, menuList, windowBox } from '../ui/uikit.js';
import { HEX, FS, FONT } from '../ui/tokens.js';
import { PARTY_MEMBERS } from '../content/party.js';
import { heroUrl } from '../util/assets.js';

// Selectable leaders + a one-line identity blurb (the class rework's role tags).
// All 5 heroes are choosable; whichever you don't pick joins later via a recruit
// NPC (town: 기사/전사/사냥꾼 · empire 야영지: 마법사 · 쌍검사: 별도 세션 작업 중).
const LEADERS = [
  { id: 'knight', blurb: '성기사 — 단단한 탱커이자 치유·정화·방벽의 버팀목.', focus: '높은 HP·방어. 초보자 추천.' },
  { id: 'warrior', blurb: '전사 — 분노로 싸우는 근접 딜러. 강타와 위협의 포효.', focus: '높은 공격. 정면 돌파형.' },
  { id: 'huntress', blurb: '사냥꾼 — 은신과 암살의 원거리 물리 딜러. 가장 빠르다.', focus: '높은 속도·치명타. 기교형.' },
  { id: 'mage', blurb: '마법사 — 비전·원소 마법의 포격수. 깊은 마나로 주문이 가장 세다.', focus: '최고 마법 화력, 최저 HP·방어. 유리대포 (솔로 시작 어려움).' },
  { id: 'duelist', blurb: '쌍검사 — 총·폭탄·표창의 쾌속 딜러. 다단 히트와 출혈.', focus: '높은 공격·속도, 얇은 HP·MP. 유리대포 (솔로 시작 어려움).' },
];

const STAT_ROWS = [
  ['HP', 'maxHp'], ['MP', 'maxMp'], ['공격', 'atk'], ['방어', 'def'], ['속도', 'spd'],
];

export class CharacterSelectScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.layer = new PIXI.Container();
    this.container.addChild(this.layer);
    this.index = 0;
  }

  enter() { this.index = 0; this.render(); }

  render() {
    this.layer.removeChildren();
    const { w, h } = this.game.renderer.screen;
    const bg = new PIXI.Graphics(); bg.rect(0, 0, w, h).fill({ color: 0x0a0b16 }); this.layer.addChild(bg);

    const title = label('시작할 영웅을 선택하라', FS.display, HEX.gold, { font: FONT.display });
    title.anchor = { x: 0.5, y: 0.5 }; title.x = w / 2; title.y = h * 0.16; this.layer.addChild(title);
    const sub = label('나머지 영웅은 모험 중에 동료로 합류한다 (최대 4인 출전)', 16, HEX.textSoft);
    sub.anchor = { x: 0.5, y: 0.5 }; sub.x = w / 2; sub.y = h * 0.16 + FS.display + 6; this.layer.addChild(sub);

    // Left: the hero list.
    const options = LEADERS.map((l) => PARTY_MEMBERS[l.id].name);
    const m = menuList(options, { width: 240, frameStyle: 'bevel' });
    m.container.x = w * 0.5 - 320; m.container.y = h * 0.36;
    this.layer.addChild(m.container);
    this.menu = m; m.setIndex(this.index);

    // Right: the selected hero's detail card (portrait + blurb + base stats).
    this.detail = new PIXI.Container();
    this.detail.x = w * 0.5 - 40; this.detail.y = h * 0.34;
    this.layer.addChild(this.detail);
    this.renderDetail();

    const ht = label('↑↓ 선택 · Z 확정 · X 뒤로', FS.caption, HEX.textMute);
    ht.anchor = { x: 0.5, y: 0.5 }; ht.x = w / 2; ht.y = h - 40; this.layer.addChild(ht);
  }

  renderDetail() {
    this.detail.removeChildren();
    const sel = LEADERS[this.index];
    const mem = PARTY_MEMBERS[sel.id];
    const W = 360, H = 280;
    const box = windowBox(W, H, 'classic'); this.detail.addChild(box);

    // Portrait (south still) — large, top-left of the card.
    try {
      const spr = this.game.renderer.sprite(heroUrl(sel.id, 'south'), { anchorX: 0.5, anchorY: 0 });
      spr.x = 64; spr.y = 24; spr.scale.set(1.6); this.detail.addChild(spr);
    } catch { /* sprite missing — skip portrait */ }

    const name = label(mem.name, 22, HEX.gold, { font: FONT.display });
    name.x = 130; name.y = 28; this.detail.addChild(name);
    const blurb = label(sel.blurb, 13, HEX.text); blurb.x = 130; blurb.y = 60; blurb.style.wordWrap = true; blurb.style.wordWrapWidth = W - 150; this.detail.addChild(blurb);
    const focus = label(sel.focus, 12, HEX.textSoft); focus.x = 130; focus.y = 110; focus.style.wordWrap = true; focus.style.wordWrapWidth = W - 150; this.detail.addChild(focus);

    // Base stats (level 1).
    STAT_ROWS.forEach(([kr, key], i) => {
      const row = label(`${kr}`, 14, HEX.textSoft); row.x = 24; row.y = 168 + i * 22; this.detail.addChild(row);
      const val = label(`${mem.base[key]}`, 14, HEX.text); val.x = 110; val.y = 168 + i * 22; this.detail.addChild(val);
    });
  }

  update() {
    const input = this.game.input;
    const n = LEADERS.length;
    if (input.pressed('up')) { this.index = (this.index + n - 1) % n; this.menu.setIndex(this.index); this.renderDetail(); }
    if (input.pressed('down')) { this.index = (this.index + 1) % n; this.menu.setIndex(this.index); this.renderDetail(); }
    if (input.pressed('cancel')) { this.game.scenes.pop(); return; } // back to title
    if (input.pressed('confirm')) { this.game.beginGame(LEADERS[this.index].id); }
  }
}

// 도감(Compendium) — opaque overlay. One tabbed reference for 몬스터 / 장비 /
// 상태이상. ◀▶ switches tab, ▲▼ scrolls the list, X closes. Monsters are gated by
// save.seen (faced in battle); 장비·상태이상 are full references. Reuses the
// renderer sprite bridge + monster/item/status data; no new art.

import * as PIXI from 'pixi.js';
import { frame, label, divider } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { MONSTERS } from '../content/monsters.js';
import { getMonsterSkill } from '../content/monsterSkills.js';
import { ITEMS, getItem, itemSummary, itemKindKR } from '../content/items.js';
import { STATUS_ORDER, STATUS_KR, STATUS_DESC } from '../content/statusInfo.js';
import { iconTexture, iconKindForItem } from '../ui/pixelIcons.js';
import { enemyUrl } from '../util/assets.js';

const FAMILY_KR = { undead: '언데드', icy: '냉기', fiery: '화염', fire: '화염', void: '공허', poison: '독' };
const TABS = ['몬스터', '장비', '상태이상'];
const EQUIP_KINDS = new Set(['weapon', 'armor', 'accessory']);

export class CompendiumScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.tab = 0;
    this.index = 0;
  }

  enter() { this.tab = 0; this.index = 0; this.render(); }

  ids() {
    if (this.tab === 0) return Object.keys(MONSTERS);
    if (this.tab === 1) return Object.keys(ITEMS).filter((id) => EQUIP_KINDS.has(ITEMS[id].kind));
    return STATUS_ORDER;
  }

  seenSet() { return new Set(this.game.runtime.seen || []); }
  recruitedSet() { return new Set((this.game.runtime.allies || []).map((a) => a.refId)); }

  update() {
    const input = this.game.input;
    const list = this.ids();
    const n = list.length;
    if (input.pressed('left')) { this.tab = (this.tab + TABS.length - 1) % TABS.length; this.index = 0; this.render(); return; }
    if (input.pressed('right')) { this.tab = (this.tab + 1) % TABS.length; this.index = 0; this.render(); return; }
    if (input.pressed('up')) { this.index = (this.index + n - 1) % n; this.render(); }
    if (input.pressed('down')) { this.index = (this.index + 1) % n; this.render(); }
    if (input.pressed('cancel')) { this.game.scenes.pop(); } // back to the menu
  }

  render() {
    this.container.removeChildren();
    const { w, h } = this.game.renderer.screen;
    const bg = new PIXI.Graphics(); bg.rect(0, 0, w, h).fill({ color: NUM.ink900 }); this.container.addChild(bg);

    // Title + tab bar.
    const title = label('도감', FS.display, HEX.text, { font: FONT.display });
    title.x = 40; title.y = 22; this.container.addChild(title);
    let tx = 150;
    TABS.forEach((name, i) => {
      const on = i === this.tab;
      const t = label(name, FS.label, on ? HEX.ink900 : HEX.textSoft);
      const bgw = t.width + 24;
      const g = new PIXI.Graphics();
      g.roundRect(0, 0, bgw, 30, 6).fill({ color: on ? NUM.gold : NUM.ink700 });
      g.roundRect(0, 0, bgw, 30, 6).stroke({ color: on ? NUM.gold : NUM.frameShadow, width: 1 });
      const chip = new PIXI.Container(); t.x = 12; t.y = 6; chip.addChild(g, t);
      chip.x = tx; chip.y = 26; this.container.addChild(chip);
      tx += bgw + 8;
    });

    const bw = Math.min(w - 60, 1060), bh = Math.min(h - 130, 540);
    const bx = (w - bw) / 2, by = 88;
    const board = frame(bw, bh, 'bevel'); board.x = bx; board.y = by; this.container.addChild(board);
    const listW = Math.round(bw * 0.42);
    const d = divider(bh - 24, NUM.frameShadow); d.rotation = Math.PI / 2; d.x = bx + listW; d.y = by + 12;
    this.container.addChild(d);

    this.boardH = bh;
    this.renderList(bx + 18, by + 16, listW - 36);
    this.renderDetail(bx + listW + 18, by + 16, bw - listW - 36);

    let foot = '◀▶ 분류  ·  ▲▼ 선택  ·  X 닫기';
    if (this.tab === 0) foot = `◀▶ 분류  ·  ▲▼ 선택  ·  X 닫기   (${this.seenSet().size}/${this.ids().length} 발견)`;
    const hint = label(foot, FS.caption, HEX.textMute);
    hint.x = bx; hint.y = by + bh + 10; this.container.addChild(hint);
  }

  renderList(x, y, w) {
    const list = this.ids();
    const seen = this.tab === 0 ? this.seenSet() : null;
    const recruited = this.tab === 0 ? this.recruitedSet() : null;
    const rowH = 30;
    const visN = Math.max(4, Math.floor((this.boardH - 20) / rowH));
    const n = list.length;
    let scroll = Math.max(0, Math.min(this.index - Math.floor(visN / 2), n - visN));
    scroll = Math.max(0, scroll);
    for (let v = 0; v < visN && scroll + v < n; v++) {
      const i = scroll + v;
      const id = list[i];
      const sel = i === this.index;
      const yy = y + v * rowH;
      if (sel) {
        const hl = new PIXI.Graphics();
        hl.rect(x - 6, yy - 2, w + 12, rowH - 2).fill({ color: NUM.gold, alpha: 0.16 });
        hl.rect(x - 6, yy - 2, 3, rowH - 2).fill({ color: NUM.gold });
        this.container.addChild(hl);
      }
      let text, col;
      if (this.tab === 0) {
        const m = MONSTERS[id]; const isSeen = seen.has(id);
        const mark = m.boss ? '♛ ' : (recruited.has(id) ? '◆ ' : '');
        text = isSeen ? mark + m.name : '??? ';
        col = !isSeen ? HEX.textOff : (sel ? HEX.gold : (recruited.has(id) ? HEX.hpHigh : HEX.text));
      } else if (this.tab === 1) {
        text = getItem(id).name; col = sel ? HEX.gold : HEX.text;
      } else {
        text = STATUS_KR[id]; col = sel ? HEX.gold : HEX.text;
      }
      const t = label(text, FS.label, col); t.x = x; t.y = yy; this.container.addChild(t);
    }
    if (scroll > 0) { const up = label('▲', FS.caption, HEX.textMute); up.x = x + w - 10; up.y = y - 4; this.container.addChild(up); }
    if (scroll + visN < n) { const dn = label('▼', FS.caption, HEX.textMute); dn.x = x + w - 10; dn.y = y + visN * rowH - 8; this.container.addChild(dn); }
  }

  renderDetail(x, y, w) {
    if (this.tab === 0) return this.renderMonster(x, y, w);
    if (this.tab === 1) return this.renderEquip(x, y, w);
    return this.renderStatus(x, y, w);
  }

  renderMonster(x, y, w) {
    const id = this.ids()[this.index];
    const m = MONSTERS[id];
    if (!this.seenSet().has(id)) {
      const q = label('???', FS.display, HEX.textMute, { font: FONT.display }); q.x = x; q.y = y + 20; this.container.addChild(q);
      const s = label('아직 만나지 못한 마물이다.', FS.label, HEX.textMute); s.x = x; s.y = y + 64; this.container.addChild(s);
      return;
    }
    const spr = this.game.renderer.sprite(enemyUrl(m.sprite), { anchorX: 0.5, anchorY: 0.5 });
    if (spr) { const sc = (96 / 68) * (m.spriteScale || 1); spr.scale.set(sc); spr.x = x + 56; spr.y = y + 56; spr.tint = m.tint || 0xd4d4d4; this.container.addChild(spr); }
    const nm = label(m.name, FS.display, HEX.gold, { font: FONT.display }); nm.x = x + 120; nm.y = y + 8; this.container.addChild(nm);
    const recruited = this.recruitedSet().has(id);
    const tag = m.boss ? '보스' : (recruited ? '영입함 ◆' : (m.recruitable !== false ? '영입 가능' : '영입 불가'));
    const tg = label(tag, FS.label, m.boss ? HEX.danger : (recruited ? HEX.hpHigh : HEX.textSoft)); tg.x = x + 120; tg.y = y + 44; this.container.addChild(tg);
    if (m.family) { const fl = label(`족속: ${FAMILY_KR[m.family] || m.family}`, FS.caption, HEX.textMute); fl.x = x + 120; fl.y = y + 70; this.container.addChild(fl); }
    let yy = y + 116;
    const line = (txt, col) => { const t = label(txt, FS.stat, col || HEX.text); t.x = x; t.y = yy; this.container.addChild(t); yy += 28; };
    line(`HP ${m.maxHp}   공격 ${m.atk}   방어 ${m.def}   속도 ${m.spd}`, HEX.text);
    const skills = (m.skills || []).map((s) => { const k = getMonsterSkill(s.id); return k ? k.name : s.id; });
    line('스킬: ' + (skills.length ? skills.join(', ') : '기본 공격뿐'), HEX.textSoft);
    if (m.inflict && m.inflict.status) line(`상태부여: ${STATUS_KR[m.inflict.status] || m.inflict.status} (${Math.round((m.inflict.chance || 0) * 100)}%)`, HEX.textSoft);
    if (m.phase2) line('격노: 50% HP에서 광폭화', HEX.danger);
    line(`보상: ${m.xp} 경험치 · ${m.gold} G`, HEX.textMute);
  }

  renderEquip(x, y, w) {
    const it = getItem(this.ids()[this.index]);
    if (!it) return;
    const spr = new PIXI.Sprite(iconTexture(iconKindForItem(it.kind), 4));
    spr.x = x; spr.y = y; this.container.addChild(spr);
    const nm = label(it.name, FS.display, HEX.gold, { font: FONT.display }); nm.x = x + 64; nm.y = y + 6; this.container.addChild(nm);
    const kd = label(itemKindKR(it), FS.label, HEX.textSoft); kd.x = x + 64; kd.y = y + 42; this.container.addChild(kd);
    let yy = y + 96;
    const line = (txt, col) => { const t = label(txt, FS.stat, col || HEX.text); t.x = x; t.y = yy; this.container.addChild(t); yy += 28; };
    line('효과: ' + itemSummary(it), HEX.text);
    if (it.price) line(`가격: ${it.price} G  (판매 ${Math.max(1, Math.floor(it.price / 2))} G)`, HEX.textMute);
    if (it.kind === 'weapon' || it.kind === 'armor') line('강화: 대장간에서 +5까지', HEX.textSoft);
    else if (it.kind === 'accessory') line('강화: 보석상에서 +5까지', HEX.textSoft);
  }

  renderStatus(x, y, w) {
    const id = this.ids()[this.index];
    const nm = label(STATUS_KR[id], FS.display, HEX.gold, { font: FONT.display }); nm.x = x; nm.y = y + 8; this.container.addChild(nm);
    const desc = label(STATUS_DESC[id] || '', FS.label, HEX.text, { font: FONT.ui, wordWrap: true, wordWrapWidth: w });
    desc.x = x; desc.y = y + 60; this.container.addChild(desc);
    const tip = label('치유: 정화 주문 / 해당 소모품으로 해제', FS.caption, HEX.textMute);
    tip.x = x; tip.y = y + 110; this.container.addChild(tip);
  }
}

// Equip board — opaque full-screen 장비·인벤토리·스테이터스 menu, ported from the
// design board (share/js/equip.js) to keyboard-driven PixiJS. Three columns:
//   1) 스테이터스  — portrait, level, ability scores (with live ▸증감 preview)
//   2) 장비 슬롯   — 무기 / 방어구 / 악세사리, selected slot drives the inventory
//   3) 인벤토리    — owned items for the selected slot's category
// Navigation: ←/→ move focus between columns (영웅 ⇄ 슬롯 ⇄ 인벤토리); ↑/↓ move
// within the focused column (cycle hero / slot / item); Z equip/unequip; X backs
// out one column, or closes the board. The stat-delta preview (the JRPG core UX)
// shows while the inventory column is focused. Equipment bonuses fold into battle
// units via progression.buildHeroUnit; persistence is save.party[].equip.

import * as PIXI from 'pixi.js';
import { frame, label, numLabel, divider, bar } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { iconTexture, iconKindForItem } from '../ui/pixelIcons.js';
import { getItem, EQUIP_STATS, equipBonus as gearBonus, itemSummary, itemKindKR } from '../content/items.js';
import { statsAtLevel } from '../systems/progression.js';
import { magicScale } from '../systems/battle.js';
import { heroUrl } from '../util/assets.js';

const SLOTS = [['weapon', '무기'], ['armor', '방어구'], ['accessory', '악세사리']];
const TABS = [['weapon', '무기'], ['armor', '방어구'], ['accessory', '악세'], ['consumable', '소비']];
const STAT_ORDER = ['atk', 'def', 'spd', 'maxHp', 'maxMp'];
const STAT_KR = { atk: '힘', def: '수비', spd: '민첩', maxHp: 'HP최대', maxMp: 'MP최대' };
const HERO_KR = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };
const HERO_CLASS = { knight: '나이트', warrior: '워리어', huntress: '헌터', mage: '메이지', duelist: '듀얼리스트' };
// Per-class build guidance shown on the equip screen — which stat to favour.
// 마법사's 주문 위력은 MP최대(=지능)로 스케일하므로 MP최대 장비를 권장.
const STAT_FOCUS = {
  knight: '수비 · HP최대 — 버티고 아군을 지키는 성기사',
  warrior: '힘 — 근접 화력. atk 장비 우선',
  huntress: '민첩 · 힘 — 속도/암살. spd·atk 우선',
  mage: '지능(MP최대) — 주문 위력 스케일. MP최대 우선',
};

export class EquipScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
  }

  enter() {
    this.heroIdx = 0;
    // Start on the hero/class selector so switching who you're equipping is the
    // first thing in focus — previously this opened on 'slots' and the hero
    // selector was hidden behind a ← press, so players couldn't find it.
    this.zone = 'hero'; // 'hero' | 'slots' | 'inv'
    this.slotIdx = 0;
    this.invIdx = 0;
    this.render();
  }

  // --- data helpers ---
  get party() { return this.game.runtime.party; }
  get hero() { return this.party[this.heroIdx]; }
  get cat() { return SLOTS[this.slotIdx][0]; }

  equipBonus(equip) { return gearBonus(equip); } // canonical (incl. 강화 levels)

  totals(equip) {
    const base = statsAtLevel(this.hero.refId, this.hero.level).stats;
    const bonus = this.equipBonus(equip);
    const t = {};
    for (const k of STAT_ORDER) t[k] = base[k] + bonus[k];
    return t;
  }

  // Owned items for the current slot category (count > 0).
  ownedForCat() {
    const inv = this.game.runtime.inventory;
    return Object.keys(inv).filter((id) => {
      const it = getItem(id);
      return it && it.kind === this.cat && inv[id] > 0;
    });
  }

  // How many party heroes currently wear `id` in this slot category. Equipment
  // ids are slot-unique by kind, so the same id only ever sits in one slot.
  equippedAcrossParty(id) {
    return this.party.reduce((n, p) => n + (p.equip && p.equip[this.cat] === id ? 1 : 0), 0);
  }

  // Free (un-equipped) copies of `id` available to put on a hero — total owned
  // minus copies already worn across the party. Gates double-equipping a single
  // owned copy across multiple heroes (a bought sword arms ONE hero, not all).
  freeCopies(id) {
    return (this.game.runtime.inventory[id] || 0) - this.equippedAcrossParty(id);
  }

  // Can the focused hero equip `id`? Either a free copy exists, or it's already
  // the hero's equipped item (so the row stays actionable as a toggle-off).
  canEquip(id) {
    return this.freeCopies(id) > 0 || (this.hero.equip || {})[this.cat] === id;
  }

  // The item currently under the inventory cursor, or null on the 해제 row.
  hoveredItem() {
    if (this.zone !== 'inv') return null;
    const list = this.ownedForCat();
    if (this.invIdx >= list.length) return null; // 해제 row
    return list[this.invIdx];
  }

  // --- input ---
  update() {
    const inp = this.game.input;
    if (inp.pressed('cancel')) return this.back();
    if (inp.pressed('left')) return this.shiftZone(-1);
    if (inp.pressed('right')) return this.shiftZone(1);
    if (inp.pressed('up')) return this.move(-1);
    if (inp.pressed('down')) return this.move(1);
    if (inp.pressed('confirm')) return this.confirm();
  }

  shiftZone(d) {
    const order = ['hero', 'slots', 'inv'];
    const i = Math.max(0, Math.min(order.length - 1, order.indexOf(this.zone) + d));
    if (order[i] === this.zone) return;
    this.zone = order[i];
    if (this.zone === 'inv') this.invIdx = 0;
    this.render();
  }

  move(d) {
    if (this.zone === 'hero') {
      this.heroIdx = (this.heroIdx + d + this.party.length) % this.party.length;
      this.slotIdx = 0; this.invIdx = 0;
    } else if (this.zone === 'slots') {
      this.slotIdx = (this.slotIdx + d + SLOTS.length) % SLOTS.length;
    } else {
      const n = this.ownedForCat().length + 1; // +1 해제 row
      this.invIdx = (this.invIdx + d + n) % n;
    }
    this.render();
  }

  confirm() {
    if (this.zone === 'hero') { this.zone = 'slots'; return this.render(); }
    if (this.zone === 'slots') { this.zone = 'inv'; this.invIdx = 0; return this.render(); }
    // zone === 'inv' → equip / unequip
    const list = this.ownedForCat();
    const p = this.hero;
    p.equip = p.equip || { weapon: null, armor: null, accessory: null };
    p.equip.plus = p.equip.plus || { weapon: 0, armor: 0, accessory: 0 };
    const prev = p.equip[this.cat];
    if (this.invIdx >= list.length) {
      p.equip[this.cat] = null; // 해제
    } else {
      const id = list[this.invIdx];
      if (p.equip[this.cat] === id) {
        p.equip[this.cat] = null; // toggle off the currently-worn item
      } else if (this.freeCopies(id) > 0) {
        p.equip[this.cat] = id; // a free copy exists → equip it
      } else {
        this.game.audio?.play('menu_cancel'); // all copies worn by others — block
        return;
      }
    }
    // Upgrade level is slot-bound: changing the slot's item resets its 강화.
    if (p.equip[this.cat] !== prev) p.equip.plus[this.cat] = 0;
    this.game.saveNow();
    this.render();
  }

  back() {
    if (this.zone === 'inv') { this.zone = 'slots'; return this.render(); }
    this.game.scenes.pop();
  }

  // --- render ---
  render() {
    this.container.removeChildren();
    const { w, h } = this.game.renderer.screen;

    // backdrop
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, w, h).fill({ color: NUM.ink900 });
    this.container.addChild(bg);

    const bw = Math.min(w - 60, 1060);
    const bh = Math.min(h - 60, 600);
    const bx = (w - bw) / 2;
    const by = (h - bh) / 2;

    // title above the board
    const title = label('장비 · 인벤토리 · 스테이터스', FS.display, HEX.text, { font: FONT.display });
    title.x = bx; title.y = Math.max(8, by - 44);
    this.container.addChild(title);

    const board = frame(bw, bh, 'bevel');
    board.x = bx; board.y = by;
    this.container.addChild(board);

    const c1 = Math.round(bw * 0.30);
    const c2 = Math.round(bw * 0.33);
    const c3 = bw - c1 - c2;
    // column separators
    const d1 = divider(bh - 24, NUM.frameShadow); d1.rotation = Math.PI / 2;
    d1.x = bx + c1; d1.y = by + 12; this.container.addChild(d1);
    const d2 = divider(bh - 24, NUM.frameShadow); d2.rotation = Math.PI / 2;
    d2.x = bx + c1 + c2; d2.y = by + 12; this.container.addChild(d2);

    this.renderStatus(bx + 18, by + 16, c1 - 36);
    this.renderSlots(bx + c1 + 18, by + 16, c2 - 36);
    this.renderInventory(bx + c1 + c2 + 18, by + 16, c3 - 36);

    // Effect tooltip for the cursored inventory item (consistent vocabulary with
    // the battle item menu + shop). Shown while the inventory column is focused.
    const hov = this.hoveredItem();
    if (hov) {
      const it = getItem(hov);
      const tip = label(`${it.name} — ${itemKindKR(it)} · ${itemSummary(it)}`, FS.caption, HEX.text, { font: FONT.ui });
      tip.x = bx; tip.y = by + bh + 10;
      this.container.addChild(tip);
    }

    // footer hint
    const hint = label('◀▶ 칸: 영웅·장비·인벤  ·  ▲▼ 선택  ·  Z 장착/해제  ·  X 닫기', FS.caption, HEX.textMute);
    hint.x = bx; hint.y = by + bh + (hov ? 30 : 10);
    this.container.addChild(hint);
  }

  renderStatus(x, y, w) {
    const hero = this.hero;
    const cur = this.totals(hero.equip);
    const hov = this.hoveredItem();
    let next = cur;
    if (hov) {
      // 이미 장착 중인 항목에 커서 → "해제 시" 비교 (− 방향 프리뷰); 그 외엔 교체 비교.
      const wearing = (hero.equip || {})[this.cat] === hov;
      const trial = { ...(hero.equip || {}), [this.cat]: wearing ? null : hov };
      next = this.totals(trial);
    }

    // portrait box + name. The class selector is always visible (gold + ▲▼ hint
    // when focused, muted otherwise) so players can discover hero switching.
    const heroActive = this.zone === 'hero';
    if (heroActive) {
      const sel = new PIXI.Graphics();
      sel.rect(x - 4, y - 4, 60, 60).stroke({ color: NUM.gold, width: 2, alignment: 0 });
      this.container.addChild(sel);
    }
    const pf = frame(52, 52, 'classic'); pf.x = x; pf.y = y; this.container.addChild(pf);
    // Front (south) portrait — the hero sprite sets are now a consistent 4-dir
    // character (PixelLab), so the front view matches the in-game east/west art.
    const spr = this.game.renderer.sprite(heroUrl(hero.refId, 'south'), { anchorX: 0.5, anchorY: 0.5 });
    spr.x = x + 26; spr.y = y + 26; spr.scale.set(1.4); this.container.addChild(spr);
    const nm = label(HERO_KR[hero.refId] || hero.refId, FS.label, HEX.gold);
    nm.x = x + 64; nm.y = y + 4; this.container.addChild(nm);
    const cls = label(`${HERO_CLASS[hero.refId] || ''} · Lv.${hero.level}`, FS.caption, HEX.textMute);
    cls.x = x + 64; cls.y = y + 30; this.container.addChild(cls);
    const swap = label(heroActive ? `▲▼ 영웅 변경 (${this.heroIdx + 1}/${this.party.length})` : '◀ 영웅 선택',
      FS.caption, heroActive ? HEX.gold : HEX.textMute);
    swap.x = x + 64; swap.y = y + 52; this.container.addChild(swap);

    let yy = y + 72;
    const head = label('능력치', FS.stat, HEX.textSoft); head.x = x; head.y = yy; this.container.addChild(head);
    yy += 26;
    for (const k of STAT_ORDER) {
      const kl = label(STAT_KR[k], FS.stat, HEX.textSoft); kl.x = x; kl.y = yy; this.container.addChild(kl);
      const a = cur[k], b = next[k];
      const av = numLabel(String(a), FS.stat, HEX.text); av.anchor.set(1, 0);
      if (b !== a) {
        av.x = x + w - 64; av.y = yy; this.container.addChild(av);
        const up = b > a;
        const bv = numLabel(`▸ ${b}`, FS.stat, up ? HEX.hpHigh : HEX.hpLow);
        bv.anchor.set(1, 0); bv.x = x + w; bv.y = yy; this.container.addChild(bv);
      } else {
        av.x = x + w; av.y = yy; this.container.addChild(av);
      }
      const line = divider(w, 0x2a3050); line.x = x; line.y = yy + 24; this.container.addChild(line);
      yy += 30;
    }

    // HP / MP bars
    yy += 6;
    const hp = hero.hp != null ? hero.hp : cur.maxHp;
    const mp = hero.mp != null ? hero.mp : cur.maxMp;
    const hl = label('HP', FS.caption, HEX.textSoft); hl.x = x; hl.y = yy; this.container.addChild(hl);
    const hv = numLabel(`${hp} / ${cur.maxHp}`, FS.caption, HEX.text); hv.anchor.set(1, 0); hv.x = x + w; hv.y = yy;
    this.container.addChild(hv);
    const hb = bar(hp / cur.maxHp, { w, h: 12, color: NUM.hpHigh }); hb.x = x; hb.y = yy + 22;
    this.container.addChild(hb);
    yy += 44;
    const ml = label('MP', FS.caption, HEX.textSoft); ml.x = x; ml.y = yy; this.container.addChild(ml);
    const mv = numLabel(`${mp} / ${cur.maxMp}`, FS.caption, HEX.text); mv.anchor.set(1, 0); mv.x = x + w; mv.y = yy;
    this.container.addChild(mv);
    const mb = bar(cur.maxMp ? mp / cur.maxMp : 0, { w, h: 12, color: NUM.mp }); mb.x = x; mb.y = yy + 22;
    this.container.addChild(mb);
    yy += 44;

    // 지능(주문력): the caster lever. Magic damage/heal scales with MP최대 via
    // magicScale (battle.js) — there is no separate INT stat; MP최대 IS the mage's
    // intelligence. Shown as the spell-power multiplier (×N.N) so the design is
    // legible, with a ▸preview when the hovered item changes MP최대.
    const intCur = magicScale({ maxMp: cur.maxMp });
    const intNext = magicScale({ maxMp: next.maxMp });
    const il = label('지능 (주문력)', FS.caption, HEX.textSoft); il.x = x; il.y = yy; this.container.addChild(il);
    const iv = numLabel(`×${intCur.toFixed(1)}`, FS.caption, HEX.text); iv.anchor.set(1, 0);
    if (Math.abs(intNext - intCur) > 0.001) {
      iv.x = x + w - 56; iv.y = yy; this.container.addChild(iv);
      const up = intNext > intCur;
      const iv2 = numLabel(`▸ ×${intNext.toFixed(1)}`, FS.caption, up ? HEX.hpHigh : HEX.hpLow);
      iv2.anchor.set(1, 0); iv2.x = x + w; iv2.y = yy; this.container.addChild(iv2);
    } else {
      iv.x = x + w; iv.y = yy; this.container.addChild(iv);
    }
    yy += 30;

    // 추천 특성 — per-class build guidance (which stat to favour when equipping).
    const focus = STAT_FOCUS[hero.refId];
    if (focus) {
      const fl = label('추천 특성', FS.caption, HEX.gold); fl.x = x; fl.y = yy; this.container.addChild(fl);
      yy += 20;
      const ft = label(focus, FS.caption, HEX.textSoft, { wordWrap: true, wordWrapWidth: w });
      ft.x = x; ft.y = yy; this.container.addChild(ft);
    }
  }

  renderSlots(x, y, w) {
    const head = label('장비', FS.stat, HEX.textSoft); head.x = x; head.y = y; this.container.addChild(head);
    let yy = y + 30;
    SLOTS.forEach(([slot, lbl], i) => {
      const id = (this.hero.equip || {})[slot];
      const it = getItem(id);
      const sel = i === this.slotIdx;
      const active = sel && this.zone === 'slots';
      if (sel) {
        const hl = new PIXI.Graphics();
        hl.rect(x - 6, yy - 4, w + 12, 40).fill({ color: NUM.gold, alpha: active ? 0.16 : 0.06 });
        hl.rect(x - 6, yy - 4, 3, 40).fill({ color: NUM.gold });
        this.container.addChild(hl);
      }
      const tag = label(lbl[0], FS.caption, HEX.textMute); tag.x = x; tag.y = yy + 6; this.container.addChild(tag);
      const ic = new PIXI.Sprite(iconTexture(it ? iconKindForItem(it.kind) : slot, 2));
      ic.x = x + 22; ic.y = yy; ic.alpha = it ? 1 : 0.3; this.container.addChild(ic);
      const plus = (this.hero.equip && this.hero.equip.plus && this.hero.equip.plus[slot]) || 0;
      const nmText = it ? (plus > 0 ? `${it.name} +${plus}` : it.name) : '— 비어있음 —';
      const nm = label(nmText, FS.label, it ? (plus > 0 ? HEX.gold : HEX.text) : HEX.textOff);
      nm.x = x + 22 + 28; nm.y = yy + 4; this.container.addChild(nm);
      yy += 46;
    });

    // selected slot detail
    const ln = divider(w); ln.x = x; ln.y = yy + 2; this.container.addChild(ln);
    yy += 14;
    const slot = this.cat;
    const cur = getItem((this.hero.equip || {})[slot]);
    const t1 = label(`${SLOTS[this.slotIdx][1]} 슬롯 — 오른쪽 목록에서 장착`, FS.caption, HEX.textMute);
    t1.x = x; t1.y = yy; this.container.addChild(t1);
    if (cur) {
      yy += 26;
      const t2 = label('현재:', FS.caption, HEX.textSoft); t2.x = x; t2.y = yy; this.container.addChild(t2);
      const bonus = statStr(cur);
      const t3 = label(bonus || '효과 없음', FS.caption, HEX.hpHigh); t3.x = x + 46; t3.y = yy; this.container.addChild(t3);
    }
  }

  renderInventory(x, y, w) {
    // category tabs (active = current slot category)
    let tx = x;
    TABS.forEach(([k, lbl]) => {
      const on = k === this.cat;
      const chip = new PIXI.Container();
      const t = label(lbl, FS.caption, on ? HEX.ink900 : HEX.textSoft);
      const padX = 8;
      const bgw = t.width + padX * 2;
      const g = new PIXI.Graphics();
      g.roundRect(0, 0, bgw, 24, 5).fill({ color: on ? NUM.gold : NUM.ink700 });
      g.roundRect(0, 0, bgw, 24, 5).stroke({ color: on ? NUM.gold : NUM.frameShadow, width: 1 });
      t.x = padX; t.y = 3;
      chip.addChild(g, t);
      chip.x = tx; chip.y = y;
      this.container.addChild(chip);
      tx += bgw + 5;
    });

    let yy = y + 38;
    const list = this.ownedForCat();
    const equippedId = (this.hero.equip || {})[this.cat];
    const equippedItem = getItem(equippedId); // delta-preview comparison base
    const rows = [...list, '__unequip__'];
    rows.forEach((id, i) => {
      const isUnequip = id === '__unequip__';
      const focus = this.zone === 'inv' && i === this.invIdx;
      const equippedHere = !isUnequip && id === equippedId;
      if (focus) {
        const hl = new PIXI.Graphics();
        hl.rect(x - 6, yy - 4, w + 12, 38).fill({ color: NUM.gold, alpha: 0.16 });
        hl.rect(x - 6, yy - 4, 3, 38).fill({ color: NUM.gold });
        this.container.addChild(hl);
      } else if (equippedHere) {
        const hl = new PIXI.Graphics();
        hl.rect(x - 6, yy - 4, w + 12, 38).fill({ color: NUM.hpHigh, alpha: 0.1 });
        this.container.addChild(hl);
      }
      if (isUnequip) {
        const nm = label('— 해제 —', FS.label, focus ? HEX.gold : HEX.textMute);
        nm.x = x + 4; nm.y = yy + 2; this.container.addChild(nm);
        // 해제 시 잃는 스탯을 델타로 표시 (장착품이 있을 때만).
        if (equippedItem) this.renderDeltaInline(x + w, yy + 2, null, equippedItem);
      } else {
        const it = getItem(id);
        // Every owned copy worn by OTHER heroes → no free copy to equip here.
        // Show it greyed + tagged so the player sees they own it but can't
        // double-equip the same copy (no 중복 착용).
        const locked = !equippedHere && this.freeCopies(id) <= 0;
        const ic = new PIXI.Sprite(iconTexture(iconKindForItem(it.kind), 2));
        ic.x = x; ic.y = yy; ic.alpha = locked ? 0.4 : 1; this.container.addChild(ic);
        const nameColor = locked ? HEX.textOff : (focus ? HEX.gold : HEX.text);
        const nm = label(it.name, FS.label, nameColor);
        nm.x = x + 28; nm.y = yy + 2; this.container.addChild(nm);
        if (equippedHere) {
          const eq = label('장착중', FS.caption, HEX.hpHigh); eq.x = x + 28 + nm.width + 8; eq.y = yy + 6;
          this.container.addChild(eq);
        } else if (locked) {
          const tag = label('타 영웅', FS.caption, HEX.textMute); tag.x = x + 28 + nm.width + 8; tag.y = yy + 6;
          this.container.addChild(tag);
        }
        const meta = numLabel(statStr(it), FS.stat, locked ? HEX.textOff : (focus ? HEX.goldGlow : HEX.textSoft));
        meta.anchor.set(1, 0); meta.x = x + w; meta.y = yy + 2; this.container.addChild(meta);
        // 현재 장착품 대비 델타 (장착 중이 아니고, 비교 대상이 있을 때) — 호버 없이
        // 한눈에 교체 손익을 읽게 해줌. 좌측 능력치 칸의 ▸프리뷰는 포커스 항목만 보임.
        if (!equippedHere && !locked && equippedItem) this.renderDeltaInline(x + w, yy + 20, it, equippedItem);
      }
      yy += 40;
    });

    if (!list.length) {
      const empty = label('보유한 장비가 없습니다.', FS.caption, HEX.textMute);
      empty.x = x; empty.y = y + 38 + rows.length * 40 + 4; this.container.addChild(empty);
    }
  }

  // Per-stat swap delta vs the slot's currently-equipped item (eqItem), right-
  // aligned at rightX. Green ▲ for gains, red ▼ for losses; sign is explicit so
  // direction reads even in greyscale. `it` null = the 해제 row (all losses).
  // Distinct from the absolute stat line above it: shorter vocab (공/방/속/체/마)
  // + colour + arrow mark it as "what changes if you swap."
  renderDeltaInline(rightX, y, it, eqItem) {
    const DELTA_KR = { atk: '공', def: '방', spd: '속', maxHp: '체', maxMp: '마' };
    const parts = [];
    for (const k of STAT_ORDER) {
      const d = ((it && it[k]) || 0) - ((eqItem && eqItem[k]) || 0);
      if (d !== 0) parts.push({ k, d });
    }
    if (!parts.length) {
      const same = label('교체: 변화 없음', FS.stat, HEX.textMute);
      same.anchor.set(1, 0); same.x = rightX; same.y = y; this.container.addChild(same);
      return;
    }
    // Lay out right-to-left so segments read left-to-right in STAT_ORDER.
    let cx = rightX;
    for (let i = parts.length - 1; i >= 0; i--) {
      const { k, d } = parts[i];
      const up = d > 0;
      const seg = numLabel(`${DELTA_KR[k]}${up ? '+' : ''}${d}${up ? '▲' : '▼'}`, FS.stat, up ? HEX.hpHigh : HEX.hpLow);
      seg.anchor.set(1, 0); seg.x = cx; seg.y = y; this.container.addChild(seg);
      cx -= seg.width + 6;
    }
  }
}

// Compact stat-bonus string for an equipment item, e.g. "힘+6 민첩-2".
function statStr(it) {
  if (!it) return '';
  return EQUIP_STATS.filter((k) => it[k]).map((k) => `${STAT_KR[k]}${it[k] > 0 ? '+' : ''}${it[k]}`).join(' ');
}

// Shop scene — overlay. Buy consumables and gear with gold, or SELL items you
// own back at 50% of their price. Cancel closes and resumes the field.

import * as PIXI from 'pixi.js';
import { windowBox, label, numLabel, menuList, frame } from '../ui/uikit.js';
import { HEX, FS, FONT } from '../ui/tokens.js';
import { ITEMS, getItem, MAX_UPGRADE, upgradeCost, itemSummary, itemKindKR } from '../content/items.js';

const HERO_KR = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };
const heroKR = (refId) => HERO_KR[refId] || refId;

// Specialized merchants — each NPC opens the shop with `shop: <key>` (dialog
// action 'shop'). Default 'general' = the original all-rounder town shop.
export const SHOPS = {
  general: {
    title: '잡화점',
    stock: [
      'herb', 'mana_drop', 'antidote', 'awakening', 'return_scroll',
      'bronze_sword', 'iron_sword', 'hunters_bow',
      'cloth_robe', 'leather_armor', 'studded_leather', 'chain_armor', 'plate_armor', 'knight_plate', 'dragon_scale',
      'power_ring', 'swift_boots', 'sage_amulet', 'ward_amulet',
    ],
  },
  smith: { // 대장장이 — weapons + armor (+ 강화)
    title: '대장간',
    stock: [
      'bronze_sword', 'iron_dagger', 'iron_sword', 'hunters_bow', 'battle_spear',
      'assassin_dagger', 'crystal_staff', 'venom_fang', 'berserker_axe', 'paladin_mace',
      'runeblade', 'guardian_greatsword', 'marksman_longbow', 'warlords_axe', 'archmage_staff',
      'twin_fang_pistols', 'duelist_gunblade', 'hollowpoint_revolver',
      'stone_maul', 'storm_crossbow', 'blessed_flail', 'umbral_dagger', 'gale_bow', // 원소 무기(물리 상성)
      'leather_armor', 'padded_vest', 'studded_leather', 'scale_mail', 'mage_robe', 'chain_armor',
      'spiked_armor', 'plate_armor', 'warded_plate', 'knight_plate', 'phoenix_mail', 'dragon_scale',
    ],
    // BUY mode splits into 무기/방어구 category tabs (◀▶) — the smith carries a long
    // mixed stock. Each tab filters `stock` by item kind; the list scrolls if long.
    tabs: [{ key: 'weapon', label: '무기' }, { key: 'armor', label: '방어구' }],
    upgradeSlots: ['weapon', 'armor'],
  },
  jeweler: { // 보석상 — accessories (+ 강화)
    title: '보석상',
    stock: ['power_ring', 'swift_boots', 'sage_amulet', 'ward_amulet', 'antitoxin_charm', 'regen_ring', 'thorn_band', 'lucky_charm', 'aegis_pendant', 'berserker_ring', 'focus_band', 'iron_brooch', 'phoenix_charm'],
    upgradeSlots: ['accessory'],
  },
  alchemist: { // 연금술사 — consumables
    title: '연금술사',
    stock: ['herb', 'mana_drop', 'antidote', 'awakening', 'return_scroll', 'cloth_robe'],
  },
};

export class ShopScene {
  constructor(game) {
    this.game = game;
    this.opaque = false;
    this.container = new PIXI.Container();
    this.layer = new PIXI.Container();
    this.container.addChild(this.layer);
    this.index = 0;
  }

  enter(args = {}) {
    this.shopDef = SHOPS[args.shop] || SHOPS.general;
    this.stock = this.shopDef.stock;
    // Modes cycle on the toggle row: buy → sell → (upgrade, if this merchant
    // upgrades gear) → buy. Smith upgrades weapon/armor, jeweler accessories.
    this.modes = ['buy', 'sell', ...((this.shopDef.upgradeSlots || []).length ? ['upgrade'] : [])];
    this.mode = 'buy';
    this.tab = 0;          // active category tab (buy mode, shops with `tabs`)
    this.index = 0;
    this.confirm = null;
    this.render();
  }

  // Whether the current view shows category tabs (buy mode + a `tabs` shop).
  hasTabs() { return this.mode === 'buy' && Array.isArray(this.shopDef.tabs) && this.shopDef.tabs.length > 1; }

  // Buy-mode stock, filtered to the active category tab when the shop has tabs.
  buyStock() {
    if (!this.hasTabs()) return this.stock;
    const key = this.shopDef.tabs[this.tab].key;
    return this.stock.filter((id) => getItem(id) && getItem(id).kind === key);
  }

  // Upgradeable equipped gear across the party for this merchant's slots:
  // { heroIdx, slot, item, plus, cost } for each item below the +5 cap.
  upgradeList() {
    const slots = this.shopDef.upgradeSlots || [];
    const out = [];
    this.game.runtime.party.forEach((p, heroIdx) => {
      const eq = p.equip || {};
      const plusMap = eq.plus || {};
      for (const slot of slots) {
        const it = getItem(eq[slot]);
        if (!it) continue;
        const plus = plusMap[slot] || 0;
        if (plus >= MAX_UPGRADE) continue; // already maxed
        out.push({ heroIdx, slot, item: it, plus, cost: upgradeCost(it, plus) });
      }
    });
    return out;
  }

  // Sell price = half the buy price, floored (min 1).
  sellPrice(id) { const it = getItem(id); return Math.max(1, Math.floor((it.price || 0) / 2)); }

  // Items in the bag that can be sold: a positive price + at least one FREE copy
  // (inventory count minus copies a party hero is currently wearing — the equip
  // pool is by-reference, so a worn item isn't really free to sell).
  sellList() {
    const inv = this.game.runtime.inventory || {};
    return Object.keys(inv).filter((id) => {
      const it = getItem(id);
      if (!it || !it.price || inv[id] <= 0) return false;
      const worn = this.game.runtime.party.reduce((n, p) => n + Object.values(p.equip || {}).filter((e) => e === id).length, 0);
      return inv[id] - worn > 0;
    });
  }

  // The currently-listed item ids (stock or sellable bag) for the active mode.
  listIds() { return this.mode === 'sell' ? this.sellList() : this.stock; }

  render() {
    this.layer.removeChildren();
    const { w, h } = this.game.renderer.screen;
    const inv = this.game.runtime.inventory || {};
    const MODE_KR = { buy: '구매', sell: '판매', upgrade: '강화' };

    // Title + gold display
    const gold = frame(220, 50, 'bevel');
    gold.x = 30; gold.y = 20;
    const gt = label(`${this.shopDef.title || '잡화점'} — ${MODE_KR[this.mode]}`, FS.label, HEX.gold);
    gt.x = 44; gt.y = 28;
    const goldNum = numLabel(`${this.game.runtime.gold} G`, FS.num, HEX.gold);
    goldNum.x = 46; goldNum.y = 44;
    this.layer.addChild(gold, gt, goldNum);

    // Build rows + record how many are selectable item/entry rows (itemsLen).
    let rows;
    this.entries = null;
    if (this.mode === 'upgrade') {
      this.entries = this.upgradeList();
      rows = this.entries.length
        ? this.entries.map((e) => `${heroKR(this.game.runtime.party[e.heroIdx].refId)} ${e.item.name} +${e.plus}→+${e.plus + 1}  ${e.cost}G`)
        : ['(강화할 장비가 없다)'];
      this.itemsLen = this.entries.length;
    } else if (this.mode === 'sell') {
      const ids = this.sellList(); this.curIds = ids;
      rows = ids.length ? ids.map((id) => `${getItem(id).name} x${inv[id]}  +${this.sellPrice(id)}G`) : ['(팔 수 있는 물건이 없다)'];
      this.itemsLen = ids.length;
    } else {
      this.curIds = this.buyStock();
      rows = this.curIds.length
        ? this.curIds.map((id) => { const it = getItem(id); return `${it.name}  ${it.price}G`; })
        : ['(이 분류의 상품이 없다)'];
      this.itemsLen = this.curIds.length;
    }
    // Toggle cycles to the NEXT available mode (buy→sell→[upgrade]→buy).
    const next = this.modes[(this.modes.indexOf(this.mode) + 1) % this.modes.length];
    const options = [...rows, `↪ ${MODE_KR[next]}하기`, '나가기'];
    this.toggleIdx = rows.length;   // toggle row index (placeholder counts as a row)
    this.exitIdx = this.toggleIdx + 1;
    if (this.index >= options.length) this.index = options.length - 1;
    this.options = options;

    // Category tabs (무기/방어구 …) above the list — only in buy mode for a `tabs` shop.
    let listY = 90;
    if (this.hasTabs()) {
      const tabsRow = new PIXI.Container();
      let tx = 0;
      this.shopDef.tabs.forEach((t, i) => {
        const on = i === this.tab;
        const lab = label(`${on ? '▸' : ' '}${t.label}`, FS.label, on ? HEX.gold : HEX.textMute);
        lab.x = tx; tabsRow.addChild(lab); tx += lab.width + 28;
      });
      const hint = label('◀▶ 분류', FS.caption, HEX.textOff);
      hint.x = tx + 6; hint.y = 3; tabsRow.addChild(hint);
      tabsRow.x = w / 2 - 150; tabsRow.y = 84;
      this.layer.addChild(tabsRow);
      listY = 118;
    }

    // Scroll window: cap visible rows to what fits above the bottom-panel/tip, and
    // slide the window with the cursor (▲/▼ markers when more is off-screen). Keeps
    // a long mixed stock (smith) usable without overflowing the screen.
    const itemH = 30;
    const maxVisible = Math.max(5, Math.floor((h * 0.86 - listY - 60) / itemH));
    let winStart = 0;
    if (options.length > maxVisible) {
      winStart = Math.min(Math.max(0, this.index - Math.floor(maxVisible / 2)), options.length - maxVisible);
    }
    const winEnd = Math.min(options.length, winStart + maxVisible);
    const visible = options.slice(winStart, winEnd);
    this.winStart = winStart;

    const m = menuList(visible, { width: 300 });
    const mx = w / 2 - m.width / 2;
    m.container.x = mx; m.container.y = listY;
    this.layer.addChild(m.container);
    this.menu = m; m.setIndex(this.index - winStart);

    // ▲/▼ scroll markers.
    if (winStart > 0) { const up = label('▲', FS.caption, HEX.gold); up.anchor = { x: 0.5, y: 1 }; up.x = mx + m.width / 2; up.y = listY - 2; this.layer.addChild(up); }
    if (winEnd < options.length) { const dn = label('▼', FS.caption, HEX.gold); dn.anchor = { x: 0.5, y: 0 }; dn.x = mx + m.width / 2; dn.y = listY + m.height + 2; this.layer.addChild(dn); }

    const tip = this.mode === 'upgrade' ? 'Z 강화 (+20%/단계, 최대 +5) · X 나가기'
      : this.mode === 'sell' ? 'Z 판매(가격 50%) · X 나가기' : 'Z 구매 · X 나가기';
    const info = label(tip, FS.caption, HEX.textSoft);
    info.x = mx; info.y = listY + m.height + 10;
    this.layer.addChild(info);

    // Effect tooltip for the cursored item (consistent with battle menu + equip).
    this.tipLabel = label('', FS.caption, HEX.text, { font: FONT.ui });
    this.tipLabel.x = mx; this.tipLabel.y = listY + m.height + 30;
    this.layer.addChild(this.tipLabel);
    this.updateTip();
  }

  // Set the tooltip to the cursored item's effect (blank on toggle/exit/placeholder).
  updateTip() {
    if (!this.tipLabel) return;
    let it = null;
    if (this.index < this.itemsLen) {
      it = this.mode === 'upgrade'
        ? (this.entries[this.index] && this.entries[this.index].item)
        : getItem(this.curIds[this.index]);
    }
    this.tipLabel.text = it ? `${it.name} — ${itemKindKR(it)} · ${itemSummary(it)}` : '';
  }

  update() {
    const input = this.game.input;
    if (this.confirm) return this.updateConfirm(input);
    const n = this.options.length;
    // up/down re-render so the scroll window slides with the cursor (+ retints tabs).
    if (input.pressed('up')) { this.index = (this.index + n - 1) % n; this.render(); }
    if (input.pressed('down')) { this.index = (this.index + 1) % n; this.render(); }
    // ◀▶ switch category tab (buy mode, tabbed shops) — reset to the first row.
    if (this.hasTabs() && (input.pressed('left') || input.pressed('right'))) {
      const t = this.shopDef.tabs.length;
      this.tab = (this.tab + (input.pressed('left') ? t - 1 : 1)) % t;
      this.index = 0; this.game.audio?.play('menu_cursor'); this.render(); return;
    }
    if (input.pressed('cancel')) return this.close();
    if (input.pressed('confirm')) {
      if (this.index === this.exitIdx) return this.close();
      if (this.index === this.toggleIdx) {
        this.mode = this.modes[(this.modes.indexOf(this.mode) + 1) % this.modes.length];
        this.index = 0; this.render(); return;
      }
      if (this.index >= this.itemsLen) return; // placeholder row
      this.askConfirm();
    }
  }

  // Safety prompt before any gold transaction (buy / 강화 / 판매). Pre-checks
  // affordability so we never prompt for a purchase the player can't make.
  askConfirm() {
    if (this.mode === 'upgrade') {
      const e = this.entries[this.index];
      if (!e) return;
      if (this.game.runtime.gold < e.cost) { this.flash('골드가 부족하다!'); return; }
      const name = `${heroKR(this.game.runtime.party[e.heroIdx].refId)} ${e.item.name}`;
      this.openConfirm('upgrade', e, `${name} +${e.plus}→+${e.plus + 1}\n${e.cost}G — 강화할까?`);
    } else if (this.mode === 'sell') {
      const id = this.curIds[this.index]; const it = getItem(id);
      if (!it) return;
      this.openConfirm('sell', id, `${it.name}\n+${this.sellPrice(id)}G — 판매할까?`);
    } else {
      const id = this.curIds[this.index]; const it = getItem(id);
      if (!it) return;
      if (this.game.runtime.gold < it.price) { this.flash('골드가 부족하다!'); return; }
      this.openConfirm('buy', id, `${it.name}\n${it.price}G — 정말 구매할까?`);
    }
  }

  openConfirm(kind, payload, msg) {
    this.confirm = { kind, payload };
    this.confirmIndex = 0; // default to 예 (Z to confirm, X to cancel)
    this.renderConfirm(msg);
    this.game.audio?.play('menu_confirm');
  }

  renderConfirm(msg) {
    const { w, h } = this.game.renderer.screen;
    const scrim = new PIXI.Graphics();
    scrim.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.5 });
    this.layer.addChild(scrim);
    const box = windowBox(380, 150);
    box.x = w / 2 - 190; box.y = h / 2 - 78;
    this.layer.addChild(box);
    const q = label(msg, FS.label, HEX.text, { align: 'center' });
    q.anchor = { x: 0.5, y: 0 };
    q.x = w / 2; q.y = h / 2 - 56;
    this.layer.addChild(q);
    const cm = menuList(['예', '아니오'], { width: 150 });
    cm.container.x = w / 2 - cm.width / 2; cm.container.y = h / 2 + 18;
    this.layer.addChild(cm.container);
    this.confirmMenu = cm; cm.setIndex(this.confirmIndex);
  }

  updateConfirm(input) {
    if (input.pressed('up') || input.pressed('down')) {
      this.confirmIndex ^= 1; this.confirmMenu.setIndex(this.confirmIndex);
      this.game.audio?.play('menu_cursor');
    }
    if (input.pressed('cancel')) { this.confirm = null; this.render(); return; }
    if (input.pressed('confirm')) {
      const yes = this.confirmIndex === 0;
      const c = this.confirm; this.confirm = null;
      if (!yes) { this.game.audio?.play('menu_cancel'); this.render(); return; }
      if (c.kind === 'upgrade') this.doUpgrade(c.payload);
      else if (c.kind === 'sell') this.sell(c.payload);
      else this.buy(c.payload);
    }
  }

  // Spend gold to raise an equipped item's slot upgrade by +1 (≤5).
  doUpgrade(e) {
    if (!e) return;
    if (this.game.runtime.gold < e.cost) { this.flash('골드가 부족하다!'); return; }
    const p = this.game.runtime.party[e.heroIdx];
    p.equip.plus = p.equip.plus || { weapon: 0, armor: 0, accessory: 0 };
    this.game.runtime.gold -= e.cost;
    p.equip.plus[e.slot] = (p.equip.plus[e.slot] || 0) + 1;
    this.game.saveNow();
    this.flash(`${e.item.name} 강화! +${p.equip.plus[e.slot]}`);
    this.render();
  }

  buy(id) {
    const it = getItem(id);
    if (this.game.runtime.gold < it.price) { this.flash('골드가 부족하다!'); return; }
    this.game.runtime.gold -= it.price;
    this.game.runtime.inventory[id] = (this.game.runtime.inventory[id] || 0) + 1;
    this.game.saveNow();
    this.flash(`${it.name} 구매!`);
    this.render();
  }

  sell(id) {
    const it = getItem(id);
    const value = this.sellPrice(id);
    this.game.runtime.gold += value;
    this.game.runtime.inventory[id] = Math.max(0, (this.game.runtime.inventory[id] || 0) - 1);
    if (this.game.runtime.inventory[id] === 0) delete this.game.runtime.inventory[id];
    this.game.saveNow();
    this.flash(`${it.name} 판매! +${value}G`);
    this.render();
  }

  flash(msg) {
    const { w } = this.game.renderer.screen;
    const t = label(msg, FS.label, HEX.info);
    t.x = 270; t.y = 35;
    this.layer.addChild(t);
    setTimeout(() => { if (t && !t.destroyed) t.destroy(); }, 900);
  }

  close() { this.game.scenes.pop(); this.game.resumeField(); }
}

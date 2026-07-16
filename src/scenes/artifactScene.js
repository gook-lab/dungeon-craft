// Artifact manager — opaque scene (pushed from the field menu). Equip collectible
// artifacts into per-character slots (1/8/16 → 1/2/3 by level). Artifacts are a
// FINITE POOL: each owned relic can be equipped on at most ONE hero (mirrors the
// gear pool, Gotcha #7). Nav: ◀▶ switch hero · ↑↓ owned list · Z equip/unequip ·
// X close (saves). Effects fold in at battle start (battleScene.buildHeroWithArtifacts).

import * as PIXI from 'pixi.js';
import { windowBox, label, numLabel, frame, divider } from '../ui/uikit.js';
import { HEX, FS, NUM, FONT } from '../ui/tokens.js';
import { ARTIFACTS, getArtifact, artifactSlotCount, computeSetBonus } from '../content/artifacts.js';

const HERO_KR = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };
const heroKR = (r) => HERO_KR[r] || r;
const RAR_KR = { common: '일반', rare: '희귀', legend: '전설' };
const RAR_COL = { common: HEX.textMute, rare: HEX.info, legend: HEX.gold };

export class ArtifactScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.layer = new PIXI.Container();
    this.container.addChild(this.layer);
    this.heroIdx = 0;
    this.sel = 0;
  }

  enter() {
    const rt = this.game.runtime;
    if (!rt.artifacts) rt.artifacts = { owned: [], equipped: {} };
    if (!rt.artifacts.equipped) rt.artifacts.equipped = {};
    this.render();
  }

  heroes() { return this.game.runtime.party; }
  curHero() { return this.heroes()[this.heroIdx]; }
  owned() { return (this.game.runtime.artifacts.owned || []).filter((id) => ARTIFACTS[id]); }

  // Normalized equipped slot array (length = slot count for the hero's level).
  slotsFor(p) {
    const eq = this.game.runtime.artifacts.equipped;
    const n = artifactSlotCount(p.level);
    const cur = (eq[p.refId] || []).slice(0, n);
    while (cur.length < n) cur.push(null);
    eq[p.refId] = cur;
    return cur;
  }

  // Which hero (refId) currently has artifact `id` equipped, or null.
  equippedOn(id) {
    const eq = this.game.runtime.artifacts.equipped;
    for (const p of this.heroes()) if ((eq[p.refId] || []).includes(id)) return p.refId;
    return null;
  }

  // Toggle: if equipped on the current hero → unequip; else if owner is another
  // hero → blocked; else fill the first empty slot (or report full).
  toggle(id) {
    const p = this.curHero();
    const slots = this.slotsFor(p);
    const at = slots.indexOf(id);
    if (at >= 0) { slots[at] = null; this.msg = ''; this.game.audio?.play('menu_cursor'); return; }
    const owner = this.equippedOn(id);
    if (owner && owner !== p.refId) { this.msg = `${heroKR(owner)} 장착 중 — 먼저 해제`; return; }
    const free = slots.indexOf(null);
    if (free < 0) { this.msg = '슬롯이 가득 찼다 (해제 후 장착)'; return; }
    slots[free] = id; this.msg = ''; this.game.audio?.play('buy');
  }

  update() {
    const input = this.game.input;
    if (input.pressed('cancel')) { this.game.saveNow(); this.game.scenes.pop(); return; }
    const list = this.owned();
    if (input.pressed('left')) { this.heroIdx = (this.heroIdx + this.heroes().length - 1) % this.heroes().length; this.msg = ''; this.game.audio?.play('menu_cursor'); this.render(); return; }
    if (input.pressed('right')) { this.heroIdx = (this.heroIdx + 1) % this.heroes().length; this.msg = ''; this.game.audio?.play('menu_cursor'); this.render(); return; }
    if (!list.length) return;
    if (input.pressed('up')) { this.sel = (this.sel + list.length - 1) % list.length; this.game.audio?.play('menu_cursor'); this.render(); return; }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % list.length; this.game.audio?.play('menu_cursor'); this.render(); return; }
    if (input.pressed('confirm')) { this.toggle(list[Math.min(this.sel, list.length - 1)]); this.render(); return; }
  }

  render() {
    this.layer.removeChildren();
    const { w, h } = this.game.renderer.screen;
    const p = this.curHero();
    const slots = this.slotsFor(p);
    const setMul = computeSetBonus(slots.filter(Boolean));

    const title = label('✦ 유물', FS.title, HEX.gold);
    title.x = 40; title.y = 26; this.layer.addChild(title);
    const hint = label('◀▶ 영웅 · ↑↓ 선택 · Z 장착/해제 · X 닫기', FS.caption, HEX.textMute);
    hint.x = 40; hint.y = h - 34; this.layer.addChild(hint);

    // --- Hero panel (left): selector + slot gems + set/affinity badges ---
    const box = windowBox(360, 300); box.x = 40; box.y = 66; this.layer.addChild(box);
    const hn = label(`◀ ${heroKR(p.refId)}  Lv.${p.level} ▶`, FS.label, HEX.gold);
    hn.x = box.x + 20; hn.y = box.y + 18; this.layer.addChild(hn);
    const sc = label(`아티팩트 슬롯 ${slots.length}칸 (Lv8·16에 개방)`, FS.caption, HEX.textMute);
    sc.x = box.x + 20; sc.y = box.y + 44; this.layer.addChild(sc);
    slots.forEach((id, i) => {
      const gy = box.y + 78 + i * 52;
      const gem = frame(320, 44, 'bevel'); gem.x = box.x + 20; gem.y = gy; this.layer.addChild(gem);
      const a = id && getArtifact(id);
      if (a) {
        const nm = label(a.name, FS.label, RAR_COL[a.rarity]); nm.x = gem.x + 12; nm.y = gy + 6; this.layer.addChild(nm);
        const aff = a.affinity === p.refId ? '  ✦친화' : '';
        const meta = label(`${a.cat}${aff}`, FS.caption, a.affinity === p.refId ? HEX.gold : HEX.textMute); meta.x = gem.x + 12; meta.y = gy + 26; this.layer.addChild(meta);
      } else {
        const e = label('— 빈 슬롯 —', FS.label, HEX.textMute); e.x = gem.x + 12; e.y = gy + 12; this.layer.addChild(e);
      }
    });
    // Set bonus badge
    const setCats = Object.keys(setMul).filter((c) => setMul[c] > 1);
    const setTxt = setCats.length ? setCats.map((c) => `${c} ×${setMul[c]}`).join(' · ') : '세트 보너스 없음 (같은 계열 2+)';
    const sb = label(`세트: ${setTxt}`, FS.caption, setCats.length ? HEX.goldGlow : HEX.textMute);
    sb.x = box.x + 20; sb.y = box.y + 78 + 3 * 52 + 6; this.layer.addChild(sb);

    // --- Owned list (right) ---
    const list = this.owned();
    const rx = 430, rw = w - rx - 40;
    const rbox = windowBox(rw, 380); rbox.x = rx; rbox.y = 66; this.layer.addChild(rbox);
    const oh = label(`보유 유물 (${list.length})`, FS.label, HEX.textSoft); oh.x = rx + 20; oh.y = 82; this.layer.addChild(oh);
    if (!list.length) {
      const none = label('아직 발견한 유물이 없다. (상자·보상)', FS.caption, HEX.textMute); none.x = rx + 20; none.y = 118; this.layer.addChild(none);
    }
    const maxVis = 9;
    const start = Math.max(0, Math.min(this.sel - 4, list.length - maxVis));
    list.slice(start, start + maxVis).forEach((id, k) => {
      const i = start + k;
      const a = getArtifact(id);
      const ry = 116 + k * 30;
      const owner = this.equippedOn(id);
      if (i === this.sel) { const cur = frame(rw - 40, 28, 'bevel'); cur.x = rx + 12; cur.y = ry - 4; this.layer.addChild(cur); }
      const mark = owner === p.refId ? '● ' : owner ? '○ ' : '  ';
      const aff = a.affinity === p.refId ? ' ✦' : '';
      const t = label(`${mark}${a.name}${aff}`, FS.command, i === this.sel ? HEX.gold : HEX.text); t.x = rx + 22; t.y = ry; this.layer.addChild(t);
      const meta = label(`${RAR_KR[a.rarity]}·${a.cat}${owner && owner !== p.refId ? ` (${heroKR(owner)})` : ''}`, FS.caption, RAR_COL[a.rarity]);
      meta.anchor.set(1, 0); meta.x = rx + rw - 24; meta.y = ry + 2; this.layer.addChild(meta);
    });
    // Selected artifact detail + toast
    if (list.length) {
      const a = getArtifact(list[Math.min(this.sel, list.length - 1)]);
      const d = label(artifactDesc(a), FS.caption, HEX.textSoft); d.x = rx + 20; d.y = 66 + 380 - 54; this.layer.addChild(d);
      const src = label(`획득: ${a.source}`, FS.caption, HEX.textMute); src.x = rx + 20; src.y = 66 + 380 - 34; this.layer.addChild(src);
    }
    if (this.msg) { const m = label(this.msg, FS.caption, HEX.warn); m.x = rx + 20; m.y = 66 + 380 + 8; this.layer.addChild(m); }
  }
}

// Human-readable effect summary from the schema (mirrors armory eff text).
function artifactDesc(a) {
  const parts = [];
  const p = a.passive || {}, m = a.mods || {}, t = a.trigger || {};
  const pct = (v) => `${Math.round(v * 100)}%`;
  if (p.crit) parts.push(`치명 +${pct(p.crit)}`);
  if (p.lifesteal) parts.push(`흡혈 ${pct(p.lifesteal)}`);
  if (p.weaknessDmg) parts.push(`약점 피해 +${pct(p.weaknessDmg)}`);
  if (p.hpBelow50) parts.push(`HP50%↓ 공격 +${pct(p.hpBelow50)}`);
  if (p.execute) parts.push(`처형 +${pct(p.execute)}`);
  if (p.dmgReduce) parts.push(`피해 감소 ${pct(p.dmgReduce)}`);
  if (p.spellDmg) parts.push(`주문 +${pct(p.spellDmg)}${p.spellMpCut ? ` · MP−${p.spellMpCut}` : ''}`);
  if (p.survive1hp) parts.push('치명상 1회 생존');
  if (m.spd) parts.push(`속도 +${m.spd}`);
  if (t.hpRegenEnd) parts.push(`전투 후 HP ${pct(t.hpRegenEnd)}`);
  if (t.mpRegenEnd) parts.push(`전투 후 MP +${t.mpRegenEnd}`);
  if (t.goldBonus) parts.push(`처치 골드 +${pct(t.goldBonus)}`);
  if (t.fpGain) parts.push(`운명 획득 +${pct(t.fpGain)}`);
  if (t.recruitBonus) parts.push(`영입 확률 +${pct(t.recruitBonus)}`);
  return parts.join(' · ') || '수집 유물';
}

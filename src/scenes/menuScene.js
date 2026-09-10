// Party menu — overlay. Shows party status (level/HP/MP/XP) and routes to the
// sub-screens: 아이템 (use consumables), 장비 (opens EquipScene), 편성 (pick the
// active battle lineup — heroes + recruited allies, ≤MAX_ACTIVE), 유대 (bond web).
// Cancel closes and resumes the field.
// Equipment bonuses are folded by progression.buildHeroUnit at battle start.

import * as PIXI from 'pixi.js';
import { label, numLabel, menuList, frame, bar, hpbar, divider } from '../ui/uikit.js';
import { HEX, FS, NUM, FONT } from '../ui/tokens.js';
import { MAX_ACTIVE } from '../data/save.js';
import { getItem, itemSummary, itemKindKR } from '../content/items.js';
import { statsAtLevel } from '../systems/progression.js';
import { xpToReach } from '../systems/progression.js';
import { getMonster } from '../content/monsters.js';
import { getMap } from '../content/maps/index.js';
import { getQuest, questProgress } from '../content/quests.js';
import { QUESTLINES, questlineState, questlineUnlocked } from '../content/questlines.js';
import { EMOTION_KR, NEGATIVE_EMOTIONS, bondStrength, emotionCount, pairsFor } from '../systems/bonds.js';
import { toneBand } from '../content/dialog.js';
import { ALLY_COMBOS } from '../content/bondSkills.js';
import { EquipScene } from './equipScene.js';
import { SettingsScene } from './settingsScene.js';
import { CompendiumScene } from './compendiumScene.js';
import { ArtifactScene } from './artifactScene.js';

export class MenuScene {
  constructor(game) {
    this.game = game;
    this.opaque = false;
    this.container = new PIXI.Container();
    this.statusLayer = new PIXI.Container();
    this.menuLayer = new PIXI.Container();
    this.container.addChild(this.statusLayer, this.menuLayer);
    this.mode = 'root';
    this.index = 0;
    this.wasTop = false;
    this.rosterMsg = '';
  }

  enter(args = {}) {
    this.mode = args.mode || 'root'; this.index = 0; this.render(); this.wasTop = true;
    // Hide the field's top-left party HUD while the menu is open — its own status
    // cards sit in the same spot and would overlap. resumeField → buildFieldHud
    // restores it on close.
    if (this.game.field) this.game.field.fieldHud.visible = false;
  }

  update() {
    const isTop = this.game.scenes.top === this;
    // If we just became the top scene again (child was popped), refresh the
    // status line so equipment changes are reflected.
    if (isTop && !this.wasTop) {
      this.render();
    }
    this.wasTop = isTop;
    if (!isTop) return;
    const input = this.game.input;
    const n = this.options.length;
    if (input.pressed('up')) { this.index = (this.index + n - 1) % n; this.moveCursor(); }
    if (input.pressed('down')) { this.index = (this.index + 1) % n; this.moveCursor(); }
    if (input.pressed('cancel')) return this.back();
    if (input.pressed('confirm')) return this.confirm();
  }

  render() {
    this.renderStatus();
    this.renderMenu();
  }

  // 커서 이동 후처리: 긴 리스트는 창이 밀리므로 renderMenu 재호출, 짧은 리스트는
  // 기존처럼 setIndex만 (윈도잉 도입 전과 동일 비용).
  moveCursor() {
    if (this.longList) this.renderMenu();
    else this.menu.setIndex(this.index);
    this.updateTip();
  }

  renderStatus() {
    this.statusLayer.removeChildren();
    const { h } = this.game.renderer.screen;
    const party = this.game.runtime.party;
    // Cards are laid out at a fixed step; on a short/wide window (or a 4-unit
    // party) the stack can exceed screen height and the bottom card clips. Scale
    // the whole status column down uniformly so every card always fits on-screen.
    const TOP = 30, CARD_H = 140, STEP = 148;
    const stackH = TOP + party.length * STEP - (STEP - CARD_H) + 12;
    const fit = Math.min(1, h / stackH);
    this.statusLayer.scale.set(fit);
    party.forEach((p, i) => {
      const box = frame(300, 140, 'bevel');
      box.x = 30; box.y = 30 + i * 148;

      // Header: name + Lv
      const nm = label(`${memberName(p.refId)}`, FS.label, HEX.gold);
      nm.x = box.x + 14; nm.y = box.y + 10;
      const lv = numLabel(`Lv.${p.level}`, FS.stat, HEX.textSoft);
      lv.anchor.set(1, 0);
      lv.x = box.x + 286; lv.y = box.y + 12;

      // Stats
      const st = statsAtLevel(p.refId, p.level).stats;
      const hp = p.hp != null ? p.hp : st.maxHp;
      const mp = p.mp != null ? p.mp : st.maxMp;
      const next = xpToReach(p.level + 1);
      const xp = p.xp;
      const hpFrac = hp / st.maxHp;
      const mpFrac = mp / st.maxMp;
      const xpFrac = Math.min(1, xp / next);

      // Row 1: HP
      const hpLabel = label('HP', FS.label, HEX.textSoft);
      hpLabel.x = box.x + 14; hpLabel.y = box.y + 32;
      const hpBar = hpbar(hpFrac, { w: 150, h: 14 });
      hpBar.x = box.x + 52; hpBar.y = box.y + 32;
      const hpNum = numLabel(`${hp}/${st.maxHp}`, FS.stat, HEX.text);
      hpNum.anchor.set(1, 0);
      hpNum.x = box.x + 286; hpNum.y = box.y + 34;

      // Row 2: MP
      const mpLabel = label('MP', FS.label, HEX.textSoft);
      mpLabel.x = box.x + 14; mpLabel.y = box.y + 50;
      const mpBar = bar(mpFrac, { w: 150, h: 14, color: NUM.mp });
      mpBar.x = box.x + 52; mpBar.y = box.y + 50;
      const mpNum = numLabel(`${mp}/${st.maxMp}`, FS.stat, HEX.text);
      mpNum.anchor.set(1, 0);
      mpNum.x = box.x + 286; mpNum.y = box.y + 52;

      // Row 3: EXP
      const xpLabel = label('EXP', FS.label, HEX.textSoft);
      xpLabel.x = box.x + 14; xpLabel.y = box.y + 68;
      const xpBar = bar(xpFrac, { w: 150, h: 14, color: NUM.xp });
      xpBar.x = box.x + 52; xpBar.y = box.y + 68;
      const xpNum = numLabel(`${xp}/${next}`, FS.stat, HEX.text);
      xpNum.anchor.set(1, 0);
      xpNum.x = box.x + 286; xpNum.y = box.y + 70;

      // Equipment line (below divider). Kept to ONE line and auto-shrunk
      // horizontally to fit the card width (300 box − 28 padding = 272), so long
      // item names neither clip at the right edge nor wrap past the card's bottom
      // border. Horizontal squash reads fine for this secondary status text.
      const d = divider(300 - 28, NUM.frameShadow);
      d.x = box.x + 14; d.y = box.y + 92;
      const eq = label(
        `무기 ${itemName(p.equip?.weapon)} · 방어 ${itemName(p.equip?.armor)} · 장신구 ${itemName(p.equip?.accessory)}`,
        FS.caption, HEX.textSoft,
      );
      const eqMax = 300 - 28;
      if (eq.width > eqMax) eq.scale.x = eqMax / eq.width;
      eq.x = box.x + 14; eq.y = box.y + 100;

      this.statusLayer.addChild(box, nm, lv, hpLabel, hpBar, hpNum, mpLabel, mpBar, mpNum, xpLabel, xpBar, xpNum, d, eq);
    });
  }

  renderMenu() {
    this.menuLayer.removeChildren();
    const { w, h } = this.game.renderer.screen;
    let options;
    if (this.mode === 'root') options = ['아이템', '장비', '편성', '유대', '퀘스트', '도감', '유물', '빠른 이동', '설정', '메인으로', '닫기'];
    else if (this.mode === 'quests') options = [...this.questLines(), '← 뒤로'];
    else if (this.mode === 'bonds') options = [...this.bondLines(), '← 뒤로'];
    else if (this.mode === 'item') options = [...this.consumables().map(formatItem), '← 뒤로'];
    else if (this.mode === 'pickAlly') options = [...this.game.runtime.party.map((p) => memberName(p.refId)), '← 뒤로'];
    else if (this.mode === 'roster') options = [...this.rosterLabels(), '← 뒤로'];
    this.index = Math.min(this.index, options.length - 1);
    // 긴 리스트 윈도잉 (퀘스트 15종 + 퀘스트라인 체크리스트가 화면 높이를 넘을 수
    // 있음 — battleScene.panelMenu/shop 스크롤과 같은 패턴): 커서 주변 maxVis 행만
    // 잘라 그리고, 커서 이동 시 update()가 renderMenu를 다시 불러 창을 민다.
    // this.options는 항상 풀 리스트 (confirm의 index 시맨틱 불변).
    const maxVis = Math.max(6, Math.floor((h - 130) / 30));
    this.longList = options.length > maxVis;
    this._winStart = this.longList
      ? Math.min(Math.max(0, this.index - Math.floor(maxVis / 2)), options.length - maxVis)
      : 0;
    const display = this.longList ? options.slice(this._winStart, this._winStart + maxVis) : options;
    const m = menuList(display, { width: 240 });
    // Right-anchor: a widened box (long bond rows) grows leftward and stays
    // on-screen instead of overflowing the right edge.
    m.container.x = Math.max(20, w - m.width - 30); m.container.y = 40;
    this.menuLayer.addChild(m.container);
    if (this.longList) { // ▲/▼ 더-있음 마커 (프레임 위·아래)
      if (this._winStart > 0) {
        const up = label('▲', FS.caption, HEX.textMute);
        up.anchor = { x: 0.5, y: 1 }; up.x = m.container.x + m.width / 2; up.y = 38;
        this.menuLayer.addChild(up);
      }
      if (this._winStart + maxVis < options.length) {
        const dn = label('▼', FS.caption, HEX.textMute);
        dn.anchor = { x: 0.5, y: 0 }; dn.x = m.container.x + m.width / 2; dn.y = 42 + m.height;
        this.menuLayer.addChild(dn);
      }
    }
    this.menu = m; m.setIndex(this.index - this._winStart);
    this.options = options;

    // Item-effect tooltip below the list (consistent with battle/shop/equip).
    this.tipLabel = null;
    if (this.mode === 'item') {
      const tip = label('', FS.caption, HEX.text, { font: FONT.ui, align: 'right' });
      tip.anchor = { x: 1, y: 0 };
      tip.x = m.container.x + m.width; tip.y = 40 + m.height + 8;
      this.menuLayer.addChild(tip);
      this.tipLabel = tip;
      this.updateTip();
    }
    // 편성 caption: current 출전 count (+ a transient '가득 참' / '최소 1명' note).
    if (this.mode === 'roster') {
      const n = (this.game.runtime.active || []).length;
      const base = `출전 ${n}/${MAX_ACTIVE} · Z 출전/벤치 전환`;
      const cap = label(this.rosterMsg ? `${base}\n${this.rosterMsg}` : base, FS.caption, this.rosterMsg ? HEX.warn : HEX.textSoft, { font: FONT.ui, align: 'right' });
      cap.anchor = { x: 1, y: 0 };
      cap.x = m.container.x + m.width; cap.y = 40 + m.height + 8;
      this.menuLayer.addChild(cap);
    } else {
      this.rosterMsg = '';
    }
  }

  // Set the item tooltip to the cursored consumable's effect (blank on 뒤로).
  updateTip() {
    if (!this.tipLabel) return;
    const list = this.consumables();
    const it = this.index < list.length ? getItem(list[this.index]) : null;
    this.tipLabel.text = it ? `${it.name} — ${itemKindKR(it)} · ${itemSummary(it)}` : '';
  }

  // Quest log — 위: 퀘스트라인(메인 스토리, 스테이지 체크리스트 ▣완료/▶현재/▢미래),
  // 아래: 수락한 일반 퀘스트 (✓ done · · active). 신규 씬 없음 — 행 추가만.
  questLines() {
    const rt = this.game.runtime;
    const out = [];
    for (const ql of Object.values(QUESTLINES)) {
      if (!questlineUnlocked(rt, ql)) continue; // 선행 막 미완 → 로그에 숨김 (스포일러 방지)
      const st = questlineState(rt, ql.id);
      out.push(st.status === 'done' ? `✓ ${ql.name} (완료)` : `★ ${ql.name}`);
      if (st.status !== 'done') {
        ql.stages.forEach((s, i) => {
          const mark = i < st.stage ? '▣' : i === st.stage ? '▶' : '▢';
          out.push(`  ${mark} ${s.desc}`);
        });
      }
    }
    const qs = rt.quests || {};
    for (const id of Object.keys(qs)) {
      const q = getQuest(id);
      if (!q) continue;
      out.push(qs[id] === 'done' ? `✓ ${q.name} (완료)` : `· ${q.name} — ${questProgress(q, rt)}`);
    }
    return out.length ? out : ['수락한 퀘스트가 없다', '(마을 NPC에게 말을 걸어보자)'];
  }

  // Read-only bond web: each pair's emotions. Two-pole legend (자비 / 잔혹) below.
  // A 성향(playstyle-tone) header sits on top — mid-run feedback that the run's
  // mercy/slaughter choices are accumulating (raw ratio stays implicit unless
  // the run has committed; see dialog.toneBand).
  bondLines() {
    const band = toneBand(this.game.runtime.flags || {});
    const head = [`성향 — ${band.label}`];
    if (band.formed) head.push(`  자비 ${band.mercied} · 처단 ${band.slain}`);
    const bonds = this.game.runtime.bonds || {};
    const keys = Object.keys(bonds).filter((k) => (bonds[k] || []).length);
    if (!keys.length) return [...head, '', '아직 맺어진 유대가 없다', '(함께 생존·부활·위기를 넘어라)'];
    const lines = keys.map((k) => {
      const [a, b] = k.split('|');
      const emos = bonds[k].map((e) => {
        const kr = EMOTION_KR[e] || e;
        return NEGATIVE_EMOTIONS.includes(e) ? `${kr}†` : kr; // † marks a ruthless pole
      });
      return `${memberName(a)}↔${memberName(b)}: ${emos.join('·')}`;
    });
    // V2b: make the silent bond stat-fold legible — per-hero CURRENT combat
    // bonus, computed with the same formulas battleScene.enter folds at battle
    // start (positive: +3%HP/pt cap15 · loyalty+2방 · admiration+2공;
    // negative glass-cannon: contempt+3공 · mistrust+6%공, NO HP).
    const effect = this.bondEffectLines(bonds);
    lines.push('자비 존경+공 충성+방 애정위기');
    lines.push('잔혹† 멸시+공 불신+공% 증오사망');
    return [...head, '', ...lines, ...(effect.length ? ['', '─ 현재 전투 보정 ─', ...effect] : [])];
  }

  // Per-hero folded bond bonus (mirrors battleScene.enter). Skips heroes with
  // no bonds. Positive poles stack HP/def/atk; negative poles are offense-only.
  bondEffectLines(bonds) {
    const out = [];
    for (const p of (this.game.runtime.party || [])) {
      const rid = p.refId;
      if (!pairsFor(bonds, rid).length) continue;
      const posStr = Math.min(bondStrength(bonds, rid), 5);
      const parts = [];
      if (posStr > 0) parts.push(`HP+${3 * posStr}%`);
      const def = 2 * emotionCount(bonds, rid, 'loyalty');
      if (def) parts.push(`방+${def}`);
      const atk = 2 * emotionCount(bonds, rid, 'admiration') + 3 * emotionCount(bonds, rid, 'contempt');
      if (atk) parts.push(`공+${atk}`);
      const mis = emotionCount(bonds, rid, 'mistrust');
      if (mis) parts.push(`공+${6 * mis}%`);
      if (emotionCount(bonds, rid, 'affection')) parts.push('위기분기');
      if (emotionCount(bonds, rid, 'hatred')) parts.push('사망격노');
      if (parts.length) out.push(`  ${memberName(rid)}: ${parts.join(' ')}`);
    }
    return out;
  }

  consumables() {
    return Object.keys(this.game.runtime.inventory)
      .filter((id) => getItem(id) && getItem(id).kind === 'consumable' && this.game.runtime.inventory[id] > 0);
  }
  // The full owned roster (party heroes first, then recruited allies) as
  // { refId, name, level, kind } — the source list the 편성 screen toggles.
  rosterMembers() {
    const party = (this.game.runtime.party || []).map((p) => ({
      refId: p.refId, name: memberName(p.refId), level: p.level || 1, kind: 'hero',
    }));
    const allies = (this.game.runtime.allies || []).map((a) => ({
      refId: a.refId, name: getMonster(a.refId)?.name || a.refId, level: a.level || 1, kind: 'ally',
    }));
    return [...party, ...allies];
  }
  // 편성 list labels — each owned member with a 출전중/벤치 marker.
  rosterLabels() {
    const active = this.game.runtime.active || [];
    return this.rosterMembers().map((mb) => {
      const mark = active.includes(mb.refId) ? '  ◀ 출전중' : '  · 벤치';
      // V2a: make the recruit→build payoff legible. A recruited ally either
      // carries a species-specific 인연공격 (the 5 setpiece allies, ★) or the
      // generic 공생 연격 — surfaced here so players hunt the special ones.
      let tag = '';
      if (mb.kind === 'ally') {
        const combo = ALLY_COMBOS[mb.refId];
        tag = combo ? ` ★${combo.name}` : ' 공생 연격';
      }
      return `${mb.name} Lv.${mb.level}${tag}${mark}`;
    });
  }
  back() {
    if (this.mode === 'root') { this.game.scenes.pop(); this.game.resumeField(); return; }
    // Step back from a sub-menu; everything else → root.
    const up = { pickAlly: 'item' };
    this.mode = up[this.mode] || 'root';
    this.index = 0; this.renderMenu();
  }

  confirm() {
    if (this.mode === 'root') {
      if (this.index === 0) { this.mode = 'item'; }
      else if (this.index === 1) { this.game.scenes.push(new EquipScene(this.game)); return; }
      else if (this.index === 2) { this.mode = 'roster'; }
      else if (this.index === 3) { this.mode = 'bonds'; }
      else if (this.index === 4) { this.mode = 'quests'; }
      else if (this.index === 5) { this.game.scenes.push(new CompendiumScene(this.game)); return; }
      else if (this.index === 6) { this.game.scenes.push(new ArtifactScene(this.game)); return; }  // 유물
      else if (this.index === 7) { this.game.scenes.pop(); this.game.openFastTravel(); return; }   // 빠른 이동
      else if (this.index === 8) { this.game.scenes.push(new SettingsScene(this.game)); return; }  // 설정
      else if (this.index === 9) { this.game.saveNow(); this.game.toTitle(); return; }             // 메인으로 (저장 후 타이틀)
      else { this.game.scenes.pop(); this.game.resumeField(); return; }
      this.index = 0; this.renderMenu(); return;
    }
    if (this.mode === 'bonds') { this.mode = 'root'; this.index = 0; this.renderMenu(); return; }
    if (this.mode === 'quests') { this.mode = 'root'; this.index = 0; this.renderMenu(); return; }
    if (this.mode === 'roster') {
      const members = this.rosterMembers();
      if (this.index >= members.length) { this.mode = 'root'; this.index = 0; this.renderMenu(); return; } // ← 뒤로
      const refId = members[this.index].refId;
      if (!Array.isArray(this.game.runtime.active)) this.game.runtime.active = [];
      const active = this.game.runtime.active;
      const at = active.indexOf(refId);
      if (at >= 0) {
        // Bench it — but never empty the lineup (≥1 fighter required).
        if (active.length > 1) { active.splice(at, 1); this.rosterMsg = ''; }
        else this.rosterMsg = '최소 1명은 출전해야 한다.';
      } else if (active.length < MAX_ACTIVE) {
        active.push(refId); this.rosterMsg = '';
      } else {
        this.rosterMsg = `출전 인원이 가득 찼다 (최대 ${MAX_ACTIVE}명).`;
      }
      this.game.saveNow();
      this.renderMenu();
      return;
    }
    if (this.mode === 'item') {
      const list = this.consumables();
      if (this.index >= list.length) { this.mode = 'root'; this.index = 0; this.renderMenu(); return; }
      this.pendingItem = list[this.index];
      this.mode = 'pickAlly'; this.index = 0; this.renderMenu(); return;
    }
    if (this.mode === 'pickAlly') {
      const party = this.game.runtime.party;
      if (this.index >= party.length) { this.mode = 'item'; this.index = 0; this.renderMenu(); return; }
      this.applyTo(party[this.index]);
    }
  }

  // Apply the pending consumable to hero p. Equipment is handled by EquipScene,
  // so this path only ever sees consumables (item flow → pickAlly → applyTo).
  applyTo(p) {
    const item = getItem(this.pendingItem);
    // Return scroll (warp consumable): consume, close the whole menu, and warp
    // the party to the target map's spawn. Target hero `p` is irrelevant here.
    if (item.kind === 'consumable' && item.effect.warp) {
      this.game.runtime.inventory[item.id] -= 1;
      this.game.saveNow();
      this.game.scenes.pop(); // close the menu overlay
      const dest = getMap(item.effect.warp);
      const sp = (dest && dest.spawn) || { x: 7, y: 9 };
      this.game.reloadFieldTo(item.effect.warp, sp.x, sp.y);
      return;
    }
    if (item.kind === 'consumable') {
      const st = statsAtLevel(p.refId, p.level).stats;
      if (item.effect.hp) p.hp = Math.min(st.maxHp, (p.hp != null ? p.hp : st.maxHp) + item.effect.hp);
      if (item.effect.mp) p.mp = Math.min(st.maxMp, (p.mp != null ? p.mp : st.maxMp) + item.effect.mp);
      // 운명의 모래시계: refill a party-shared Fabula Point (cap 6, matches save clamp).
      if (item.effect.fabula) this.game.runtime.fabula = Math.min(6, (this.game.runtime.fabula || 0) + item.effect.fabula);
      this.game.runtime.inventory[item.id] -= 1;
    }
    this.game.saveNow();
    this.mode = 'root'; this.index = 0; this.render();
  }
}

function memberName(refId) { return { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' }[refId] || refId; }
function itemName(id) { return id ? (getItem(id)?.name || '-') : '없음'; }
function formatItem(id) {
  const it = getItem(id);
  return it ? it.name : id;
}

// Battle scene — side-view layout (party on the LEFT facing right, enemies on
// the RIGHT facing left) with an HP bar above every unit, per the requested
// reference. Drives the pure systems/battle.js resolver; renders command/spell/
// target menus + message box. Heroes play their attack-frame animation + a
// lunge when they strike; enemies lunge. Opaque scene pushed over the field;
// main.endBattle() handles spoils + consequences and pops it.

import * as PIXI from 'pixi.js';
import {
  createBattle, currentActor, advanceTurn, isOver, resolveAction,
  enemyChooseAction, buildEnemyUnit, living, findUnit, enrageBosses,
  tickStatus, cureStatus, canMercy, canRecruit,
  skillDamage, magicDamage, magicScale, physicalDamage, effectiveDef, CHARGE_MULT, CRIT_MULT,
} from '../systems/battle.js';
import { affinityKind } from '../systems/affinity.js';
import { buildHeroUnit, buildAllyUnit } from '../systems/progression.js';
import { bondStrength, emotionCount, partnersWithEmotion } from '../systems/bonds.js';
import { availableBondStrikes, bondModForCombo } from '../content/bondSkills.js';
import { getSpell } from '../content/spells.js';
import { getMonsterSkill } from '../content/monsterSkills.js';
import { getMonster } from '../content/monsters.js';
import { getItem, equipBonus as gearBonus, equipPassives as gearPassives, itemSummary, itemKindKR } from '../content/items.js';
import { statusDesc } from '../content/statusInfo.js';
import { enemyUrl, heroUrl, heroWalkUrl, heroAttackUrl, structureUrl, ATTACK_FRAMES } from '../util/assets.js';
import { makeSprite, swapTexture, preload, loadSheet, shadowTexture } from '../engine/renderer.js';
import { windowBox, label, menuList, frame, hpbar, bar as statBar } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { statusTexture, fxTexture, statTexture } from '../ui/pixelIcons.js';
import { createWeather, createEmberAura } from '../ui/weather.js';
import { SpellFx, LO as FX_LO, hasSpellFx } from '../fx/spellFx.js';
import { Cutscene } from '../fx/cutscene.js';

const MSG_TIME = 0.85;
const ATK_DUR = 0.55;   // hero attack animation length
const LUNGE = 26;       // px a unit lunges toward its target when acting
const STATUS_KR = { poison: '독', sleep: '수면', weaken: '약화', burn: '화상', shock: '감전', freeze: '동상', atkdown: '위협', defdown: '방어약화', slow: '둔화', petrify: '석화', stun: '기절', blind: '실명', bleed: '출혈' };
const STATUS_TAG = { poison: '독', sleep: '잠', weaken: '약', burn: '화', shock: '감', freeze: '동', atkdown: '위', defdown: '방', slow: '둔', petrify: '석', stun: '기', blind: '실', bleed: '출' };
// Bestiary-2: target-sprite recolour while a monster skill resolves (the element
// read the FX particles also carry). Keyed by skill id; restored ~1s after cast.
const SKILL_TINT = { petrify: 0x9a957c, voidblast: 0xb483f0, shadowbolt: 0x8a6fd0, eruption: 0xe2553f, screech: 0xcfe0ff };
// Buff-stat + combat-state labels for battle messages (the class rework).
const BUFF_KR = { atk: '공격력', def: '방어력', spd: '속도', shield: '방어막', eva: '회피' };
const STATE_KR = { stealth: '은신했다', rage: '분노에 휩싸였다', charge: '마력을 충전했다' };
// Skill-info panel maps: element → [color, 한글 이름], target → 형식 한글.
const ELEM_INFO = {
  fire: ['#e25563', '화염'], ice: ['#56a8e8', '냉기'], thunder: ['#f0c44c', '뇌전'],
  holy: ['#fff0b8', '신성'], poison: ['#9ad94f', '독'], wind: ['#a8e6c8', '바람'],
  dark: ['#b483f0', '암흑'], earth: ['#c98b2c', '대지'], arcane: ['#b483f0', '비전'],
  physical: ['#cfd8ec', '물리'],
};
const TARGET_KR = { one: '단일', allEnemies: '적 전체', self: '자신', oneAlly: '아군 1인', allAllies: '아군 전체' };
const PANEL_FRAC = 0.24; // bottom command/message panel height as fraction of screen
const FABULA_CAP = 6;   // 운명(Fabula Point) party-shared pool cap (matches save clamp)

// Biome → weather kind mapping
const BIOME_WEATHER = {
  swamp: 'rain',
  frost: 'snow',
  dungeon: 'embers',
  wild: 'clear',
  town: 'clear',
};

export class BattleScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.bg = new PIXI.Graphics();              // sky gradient
    this.backdrop = new PIXI.Container();        // ground tiles + props + vignette
    this.backdrop.sortableChildren = true;
    this.fieldLayer = new PIXI.Container();      // unit sprites + HP bars
    this.fieldLayer.sortableChildren = true;
    this.panelBg = new PIXI.Container();         // persistent full-width bottom panel
    this.menuLayer = new PIXI.Container();       // command bar / submenus
    this.msgLayer = new PIXI.Container();        // message text (in the panel)
    this.weather = null;                          // weather controller (initialized in enter)
    this.container.addChild(this.bg, this.backdrop, this.fieldLayer, this.panelBg, this.menuLayer, this.msgLayer);

    this.viewOf = new Map(); // unitId -> { unit, root, sprite, hpFill, hpText, nameT, baseX, facing, anim }
    this.msgQueue = [];
    this.msgTimer = 0;
    this.onMsgDone = null;
    this.phase = 'idle';
    this.menuIndex = 0;
  }

  enter(args = {}) {
    this.isBoss = !!args.isBoss;
    this.bossObj = args.bossObj || null;
    this.biome = args.biome || 'wild';
    // The hero side is the ACTIVE lineup (출전 명단, ≤4): each entry resolves to a
    // party hero (built with equip + passives) or a recruited monster ally. Field
    // menu → 편성 picks who's deployed; benched members don't fight (or earn XP).
    const rt = this.game.runtime;
    const active = (rt.active && rt.active.length) ? rt.active : rt.party.map((p) => p.refId);
    this.heroUnits = [];
    for (const refId of active.slice(0, 4)) {
      const p = rt.party.find((m) => m.refId === refId);
      if (p) {
        this.heroUnits.push(buildHeroUnit(p.refId, p.level, { id: p.refId, hp: p.hp, mp: p.mp, equip: equipBonus(p), passives: gearPassives(p.equip) }));
        continue;
      }
      const a = (rt.allies || []).find((x) => x.refId === refId);
      if (a) {
        const allyUnit = buildAllyUnit(a.refId, a.level || 1, { id: `ally_${a.refId}`, hp: a.hp, mp: a.mp });
        if (allyUnit) this.heroUnits.push(allyUnit);
      }
    }
    // Safety net: never start a battle with an empty hero side (stale active list).
    if (!this.heroUnits.length && rt.party[0]) {
      const p = rt.party[0];
      this.heroUnits.push(buildHeroUnit(p.refId, p.level, { id: p.refId, hp: p.hp, mp: p.mp, equip: equipBonus(p), passives: gearPassives(p.equip) }));
    }
    // Bonds → max-HP fold: +3% per bond point (cap +15% at str 5). A save-
    // progression buff; the balance harness models it separately. Nerfed
    // 2026-05-29 (was +5%/cap+25%) — bonds were the dominant driver of the
    // mercy-build boss ceiling (a zero-attrition free pass). See TODOS.
    const bonds = rt.bonds || {};
    for (const u of this.heroUnits) {
      // Merciful (positive) bonds — sustain: +max HP + def/atk from loyalty/존경.
      const str = bondStrength(bonds, u.refId); // positive-only (see bonds.js)
      if (str > 0) {
        const full = u.hp >= u.maxHp;
        u.maxHp = Math.floor(u.maxHp * (1 + 0.03 * Math.min(str, 5)));
        if (full) u.hp = u.maxHp;
        u.def += 2 * emotionCount(bonds, u.refId, 'loyalty');   // 충성 → 방어
        u.atk += 2 * emotionCount(bonds, u.refId, 'admiration'); // 존경 → 공격
      }
      // Ruthless (negative) bonds — glass cannon: offense only, NO HP cushion.
      u.atk += 3 * emotionCount(bonds, u.refId, 'contempt');     // 멸시 → 공격(존경보다 큼)
      const mistrust = emotionCount(bonds, u.refId, 'mistrust'); // 불신 → 공격% (홀로 싸운다)
      if (mistrust) u.atkBuff = (u.atkBuff || 0) + 0.06 * mistrust;
      // 증오(hatred) is a death-rage surge applied live in checkDeathRage().
    }
    // Fabula Crisis bank: each hero grants +1 FP the first time it drops to ≤50%
    // HP this battle (tracked here, banked into runtime.fabula).
    this.crisisAwarded = new Set();
    this.deathRaged = new Set(); // 증오 death-rage, once per fallen ally
    this.flawAwarded = new Set(); // per-hero flaw FP, once per battle (Trait→FP)
    const enemies = (args.monsters || ['goblin']).map((id) => buildEnemyUnit(id));
    // 회차+ (NG+) 적 스케일: 회차당 HP +25% / atk +15%. bonds 버프처럼 씬 레이어에서
    // 유닛에 폴드 — 리졸버·밸런스 해니스는 1회차 기준 그대로 (스케일 비접촉).
    const ng = this.game.runtime.ngPlus || 0;
    if (ng > 0) {
      for (const u of enemies) {
        u.maxHp = Math.round(u.maxHp * (1 + 0.25 * ng));
        u.hp = u.maxHp;
        u.atk = Math.round(u.atk * (1 + 0.15 * ng));
      }
    }
    this.state = createBattle(this.heroUnits, enemies);
    this.curPhase = null; // so the first player-phase banner shows

    // Prewarm hero attack frames so the first swing doesn't stutter.
    for (const u of this.heroUnits) {
      const n = ATTACK_FRAMES[u.sprite] || 3;
      for (let f = 0; f < n; f++) preload(heroAttackUrl(u.sprite, 'east', f));
    }

    this.layout();

    // Initialize weather layer: insert after backdrop, before fieldLayer units.
    // 필드의 현재 날씨(game.currentWeather — 맵 오버라이드/로테이션 결과)를 그대로
    // 승계한다; 필드 정보가 없을 때만 바이옴 기본값으로 폴백.
    const { w, h } = this.game.renderer.screen;
    this.weather = createWeather({ width: w, height: h });
    let weatherKind = this.game.currentWeather ?? (BIOME_WEATHER[this.biome] || 'clear');
    if (this.isBoss && weatherKind === 'rain') weatherKind = 'storm'; // boss battles in swamp → storm
    this.weather.setKind(weatherKind);
    const backdropIndex = this.container.children.indexOf(this.backdrop);
    this.container.addChildAt(this.weather.container, backdropIndex + 1);

    // Ember buff-aura: warm shimmer over the field (above units, below the panel)
    // that breathes while any hero carries an active buff (고무/warcry/애정/불굴).
    this.buffAura = createEmberAura({ width: w, height: h });
    const fieldIndex = this.container.children.indexOf(this.fieldLayer);
    this.container.addChildAt(this.buffAura.container, fieldIndex + 1);

    // Spell FX engine: a scaled particle/beam layer that lives INSIDE fieldLayer
    // (so it shakes with the units) plus full-screen tint+flash overlays inserted
    // just below the bottom panel (above units, beneath the readable UI). Ported
    // from the share2 spellfx prototype; runs in low-res logical space ×FX_LO.
    this.spellFxLayer = new PIXI.Container();
    this.spellFxLayer.scale.set(FX_LO);
    this.spellFxLayer.zIndex = 9999;
    this.fieldLayer.addChild(this.spellFxLayer);
    const fxTintG = new PIXI.Graphics();
    const fxFlashG = new PIXI.Graphics();
    this.spellOverlay = new PIXI.Container();
    this.spellOverlay.addChild(fxTintG, fxFlashG);
    const panelIndex = this.container.children.indexOf(this.panelBg);
    this.container.addChildAt(this.spellOverlay, panelIndex);
    this.spellFx = new SpellFx({
      fxLayer: this.spellFxLayer, tintG: fxTintG, flashG: fxFlashG,
      screen: { w, h },
      shake: (mag, ms) => this.shake(ms, mag),
      audio: (name) => this.game.audio?.play(name),
    });

    // 스킬 컷신 (필살기/인연기 전용) — full-screen cinematic overlay, TOPMOST child so
    // its letterbox sits above the panel/messages. Preload party portraits so they
    // slide in instantly (battle sprites use 'east'; the cutscene uses 'south').
    this.cutscene = new Cutscene({ screen: this.game.renderer.screen });
    this.container.addChild(this.cutscene.root);
    for (const u of this.heroUnits) preload(this.portraitUrl(u));

    this.game.audio.setMusic(this.isBoss ? 'boss' : 'battle');
    this.game.audio.play('encounter_start');
    const bossName = this.state.units.find((u) => u.side === 'enemy' && u.boss)?.name || '강대한 적';
    this.queueMsg(this.isBoss ? `${bossName}이(가) 가로막는다!` : '마수가 나타났다!');
    this.onMsgDone = () => this.nextTurn();
  }

  // Layered battle backdrop (art-direction spec): banded sky gradient + tiled
  // ground + tinted silhouette props + edge vignette. Forest kit by default,
  // dungeon kit for boss fights. Reuses existing tiles/props (no new art).
  buildBackdrop(w, h) {
    // Backdrop kit follows the region biome (forest / dungeon / frost).
    const KITS = {
      forest: { sky: [0x3c5132, 0x39492a, 0x4c6038], groundUrl: '/tilesets/town_ground.png', tilePx: 32, tile: 12, groundTint: 0x88a86a, props: [['prop_oak_tree', 0.13, 0.5, 0.62, 0x33502f], ['prop_oak_tree', 0.88, 0.46, 0.55, 0x33502f]], vig: 0.4 },
      dungeon: { sky: [0x2a2a3a, 0x39394c, 0x4a4a5e], groundUrl: '/tilesets/dungeon_stone.png', tilePx: 32, tile: 12, groundTint: 0x9090a0, props: [['prop_broken_brazier', 0.18, 0.56, 0.55, 0x9a6a3a], ['prop_mossy_shrine', 0.84, 0.58, 0.5, 0x6a7a6a]], vig: 0.5 },
      frost: { sky: [0x2a3a52, 0x3e5474, 0x6a86a8], groundUrl: '/tilesets/frost_ice.png', tilePx: 32, tile: 12, groundTint: 0xcfe0f0, props: [['prop_oak_tree', 0.13, 0.5, 0.6, 0x9ab4d0], ['prop_oak_tree', 0.88, 0.46, 0.52, 0x9ab4d0]], vig: 0.42 },
      swamp: { sky: [0x232b1c, 0x32402a, 0x47583a], groundUrl: '/tilesets/swamp_mud.png', tilePx: 32, tile: 12, groundTint: 0x9aae72, props: [['prop_oak_tree', 0.13, 0.5, 0.6, 0x3c4a30], ['prop_oak_tree', 0.88, 0.46, 0.52, 0x3c4a30]], vig: 0.5 },
    };
    const biomeKit = this.biome === 'dungeon' ? 'dungeon' : this.biome === 'frost' ? 'frost' : this.biome === 'swamp' ? 'swamp' : 'forest';
    const kit = KITS[biomeKit];
    const horizon = h * 0.6;

    // Banded vertical sky gradient (robust — no FillGradient API dependency).
    this.bg.clear();
    const lerp = (a, b, t) => {
      const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
      const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
      return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t);
    };
    const bands = 20;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const col = t < 0.5 ? lerp(kit.sky[0], kit.sky[1], t * 2) : lerp(kit.sky[1], kit.sky[2], (t - 0.5) * 2);
      this.bg.rect(0, (h * i) / bands, w, h / bands + 1).fill({ color: col });
    }

    this.backdrop.removeChildren();
    // Ground band base + tiled floor.
    const gb = new PIXI.Graphics();
    gb.rect(0, horizon, w, h - horizon).fill({ color: kit.sky[2] });
    gb.zIndex = 0; this.backdrop.addChild(gb);
    const ts = 48;
    loadSheet(kit.groundUrl, kit.tilePx).then((tiles) => {
      if (!tiles.length || this.container.destroyed) return;
      const cont = new PIXI.Container(); cont.zIndex = 1; cont.tint = kit.groundTint;
      const cols = Math.ceil(w / ts) + 1, rows = Math.ceil((h - horizon) / ts) + 1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const sp = new PIXI.Sprite(tiles[kit.tile % tiles.length]);
        sp.x = c * ts; sp.y = horizon + r * ts; sp.width = ts; sp.height = ts;
        cont.addChild(sp);
      }
      this.backdrop.addChild(cont);
    });
    // Silhouette / mid-ground props.
    for (const [ref, fx, fy, sc, tint] of kit.props) {
      const sp = makeSprite(structureUrl(ref), { anchorX: 0.5, anchorY: 0.9 });
      sp.x = w * fx; sp.y = h * fy; sp.alpha = 0.55; sp.tint = tint;
      sp.scale.set(((h * 0.7) / 192) * sc); sp.zIndex = 2;
      this.backdrop.addChild(sp);
    }
    // Edge vignette (top + bottom darkening bands).
    const vig = new PIXI.Graphics(); vig.zIndex = 3;
    const vbands = 10, vh = h * 0.22;
    for (let i = 0; i < vbands; i++) {
      const a = kit.vig * (1 - i / vbands);
      vig.rect(0, (vh * i) / vbands, w, vh / vbands + 1).fill({ color: 0x000000, alpha: a });
      vig.rect(0, h - vh + (vh * i) / vbands, w, vh / vbands + 1).fill({ color: 0x000000, alpha: kit.vig * (i / vbands) });
    }
    this.backdrop.addChild(vig);
  }

  layout() {
    const { w, h } = this.game.renderer.screen;
    this.buildBackdrop(w, h);

    this.fieldLayer.removeChildren(); this.viewOf.clear();
    const heroes = this.state.units.filter((u) => u.side === 'hero');
    const enemies = this.state.units.filter((u) => u.side === 'enemy');
    const hScale = Math.min(h / 720, 1.2);

    // Units sit in a feet-band that leaves clear headroom under the top edge
    // (each unit's name + HP stack rises ~targetH above its feet) and a gap above
    // the bottom panel. Each column's stack is vertically CENTERED in that band
    // so units never hug the top edge.
    const heroH = 108 * hScale;
    const enemyMax = enemies.length ? Math.max(...enemies.map((u) => (u.boss ? 180 : 106) * hScale)) : 106;
    // headRoom clears the FULL above-feet stack: sprite + name + HP/MP bars + the
    // enemy stat badge (which sits ~27px ABOVE the name). 96 keeps the topmost
    // unit's name off the top edge on tall windows (was 64 → 임프/사냥꾼 names clipped).
    const headRoom = Math.max(heroH, enemyMax) + 96; // sprite + name/HP/badge rise above feet
    const panelTop = h * 0.66;                        // bottom command panel edge
    const bandTop = headRoom + h * 0.03;
    const bandBottom = panelTop - 28;
    const place = (count, i) => {
      const usable = Math.max(0, bandBottom - bandTop);
      const gap = count > 1 ? Math.min(160, usable / (count - 1)) : 0;
      // Center the stack within the band so a short column never hugs the top edge.
      const start = bandTop + Math.max(0, (usable - gap * (count - 1)) / 2);
      return start + i * gap;
    };
    // Formation: ≤3 units = one vertically-centered column (fits without clipping);
    // 4+ = two columns so a big party/horde never overflows the band. The BACK
    // column holds up to 3; the overflow forms a FRONT column shifted toward center
    // (4 → 1/3, 5 → 2/3, 6 → 3/3). Each column is centered for its own count.
    const placeSide = (units, sideX, dir, flip, sizeOf) => {
      const cols = units.length <= 3 ? [units] : [units.slice(0, 3), units.slice(3)];
      cols.forEach((col, ci) => {
        const colX = sideX + dir * ci * 96 * hScale; // front column advances toward center
        col.forEach((u, ri) => {
          this.makeUnitView(u, colX + dir * ri * 8 * hScale, place(col.length, ri), flip, sizeOf(u));
        });
      });
    };
    placeSide(heroes, w * 0.17, +1, false, () => heroH);
    placeSide(enemies, w * 0.83, -1, true, (u) => (u.boss ? 180 : 106) * hScale);

    this.buildPanel(w, h);
    this.buildMenuPlaceholder();
    this.entering = true; this.enterT = 0; // walk-in entrance
  }

  makeUnitView(unit, x, y, flip, targetH) {
    const root = new PIXI.Container();
    // Start off-screen for the walk-in entrance; tickJuice slides to baseX.
    const startX = flip ? (this.game.renderer.screen.w + 180) : -180;
    root.x = startX; root.y = y; root.zIndex = y;
    // Recruited monster allies are side:'hero' but carry a MONSTER sprite — draw them
    // from /enemies (heroUrl would 404 → blank). Real heroes use the hero art.
    const url = unit.ally ? enemyUrl(unit.sprite) : (unit.side === 'hero' ? heroUrl(unit.sprite, 'east') : enemyUrl(unit.sprite));
    const sprite = makeSprite(url, { anchorX: 0.5, anchorY: 0.95 });
    // 68px native art → scale to targetH; flip x to face left for enemies.
    // Palette-swap variants carry a spriteScale multiplier (e.g. a giant spider).
    const sc = (targetH / 68) * (unit.spriteScale || 1);
    sprite.scale.set(flip ? -sc : sc, sc);
    // Enemy art is lifted from its naturally-dark palette; a variant's `tint`
    // recolours it instead (icy-blue wolf, sickly-green zombie, …).
    if (unit.side === 'enemy') sprite.tint = unit.tint || 0xd4d4d4;
    root.addChild(sprite);

    // HP bar container above head with name and status.
    const bar = new PIXI.Container();
    bar.y = -targetH - 16;

    // Unit name (hero cyan, enemy red, active turn gold).
    const nameT = label(unit.name, FS.label, HEX.text, { font: FONT.ui });
    nameT.anchor = { x: 0.5, y: 1 };
    nameT.x = 0; nameT.y = -3;
    bar.addChild(nameT);

    // Pixel-tick HP bar (auto-color by fraction via hpbar()).
    const hpBarObj = hpbar(unit.hp / unit.maxHp, { w: 76, h: 11 });
    hpBarObj.x = -38; hpBarObj.y = 2;
    bar.addChild(hpBarObj);

    // MP bar under HP — spell-casters (maxMp > 0) only, so the player can read the
    // mana they spend on skills (was missing in battle; only HP showed). Distinct
    // from the party-shared 운명/Fabula gauge.
    let mpBarObj = null;
    if (unit.maxMp > 0) {
      mpBarObj = statBar(unit.mp / unit.maxMp, { w: 76, h: 6, color: NUM.mp, tick: 7 });
      mpBarObj.x = -38; mpBarObj.y = 15;
      bar.addChild(mpBarObj);
    }

    // Status chips container (poison/sleep/weaken icons + text). Sits below the MP
    // bar when one is present, else just under HP.
    const statusCont = new PIXI.Container();
    statusCont.x = -38; statusCont.y = mpBarObj ? 25 : 16;
    bar.addChild(statusCont);

    // Enemy combat-stat badge (공격력/방어력) above the name: a scythe(낫) icon for
    // a dangerous attacker / sword(검) for a milder one + the atk number, then a
    // shield + def number. Updated live in refreshUnits (reflects buffs/debuffs).
    let statBadge = null;
    if (unit.side === 'enemy') {
      statBadge = new PIXI.Container();
      statBadge.y = -27; // sit clear above the name
      bar.addChild(statBadge);
    }

    // Target-preview overlays: a band over the HP bar showing the HP a pending hit
    // would shave off (enemy, red) or a heal would restore (ally, green), a ±range
    // label, and a skull (enemies only) when a hit would KILL. Driven by
    // showTargetPreview during target-select; hidden otherwise.
    const dmgPreviewG = new PIXI.Graphics();
    dmgPreviewG.x = -38; dmgPreviewG.y = 2; dmgPreviewG.visible = false;
    bar.addChild(dmgPreviewG);
    const previewLabel = label('', FS.caption, HEX.text, { font: FONT.ui });
    previewLabel.anchor = { x: 0.5, y: 0.5 }; previewLabel.x = 0; previewLabel.y = 7; previewLabel.visible = false;
    bar.addChild(previewLabel);
    let killIcon = null;
    if (unit.side === 'enemy') {
      const sk = statTexture('skull', 2);
      if (sk) {
        killIcon = new PIXI.Sprite(sk);
        killIcon.anchor.set(0.5, 1);
        killIcon.x = 0; killIcon.y = -46; killIcon.visible = false;
        bar.addChild(killIcon);
      }
    }

    // Active-turn glow ring at a hero's feet (behind the sprite) — a strong "it's
    // this character's turn" cue. Pulsed in tickJuice; hidden when not active.
    let footRing = null;
    if (unit.side === 'hero') {
      footRing = new PIXI.Graphics();
      // Bold double ring at the feet — a soft gold disc + a bright rim, sized to
      // the character, sitting just under the body so it reads as "selected".
      footRing.ellipse(0, -6, targetH * 0.42, targetH * 0.18).fill({ color: 0xffcf4d, alpha: 0.30 });
      footRing.ellipse(0, -6, targetH * 0.42, targetH * 0.18).stroke({ color: 0xfff0b0, width: 3, alpha: 1 });
      footRing.ellipse(0, -6, targetH * 0.30, targetH * 0.12).stroke({ color: 0xffe9a0, width: 2, alpha: 0.8 });
      footRing.visible = false;
      root.addChildAt(footRing, 0); // behind the sprite
    }

    // Soft ground shadow under EVERY unit (hero + enemy) so none looks like it
    // floats. Sprite anchorY is 0.95 → the feet sit ≈ root origin; the shadow is
    // a flat ellipse there, behind the sprite (and behind the hero foot-ring).
    const shadow = new PIXI.Sprite(shadowTexture());
    shadow.anchor.set(0.5);
    const shW = targetH * 0.95 * (unit.spriteScale || 1);
    shadow.width = shW; shadow.height = shW * 0.34;
    shadow.x = 0; shadow.y = -3;
    root.addChildAt(shadow, 0); // bottom-most → under foot-ring + sprite

    root.addChild(bar);
    this.fieldLayer.addChild(root);

    const view = {
      unit, root, sprite, nameT, hpBarObj, mpBarObj, statusCont, statBadge,
      dmgPreviewG, previewLabel, killIcon, footRing, baseX: x, baseY: y, startX,
      bobPhase: this.viewOf.size * 0.7, shownHp: unit.hp,
      facing: flip ? -1 : 1, targetH, anim: null,
    };
    this.viewOf.set(unit.id, view);
    this.drawHp(view);
    this.drawStatBadge(view);
    return view;
  }

  // Draw/refresh an enemy's 공격력/방어력 badge. Threat tier (scythe vs sword) =
  // the enemy's expected basic hit on the median living hero vs that hero's maxHp,
  // so the icon tracks REAL danger to the current party (and current buffs). Pure
  // display — reads effective atk/def the same way the resolver does.
  drawStatBadge(view) {
    const cont = view.statBadge;
    if (!cont) return;
    cont.removeChildren();
    const u = view.unit;
    if (!u.alive) { cont.visible = false; return; }
    cont.visible = true;

    const atk = Math.max(1, Math.round(u.atk * (1 + (u.atkBuff || 0))));
    const def = Math.round(effectiveDef(u));
    const heroes = living(this.state, 'hero');
    const ref = heroes.length
      ? heroes.slice().sort((a, b) => a.maxHp - b.maxHp)[Math.floor(heroes.length / 2)]
      : null;
    const dangerous = ref ? physicalDamage(u, ref, null) >= ref.maxHp * 0.18 : atk >= 30;

    const ICON_H = 15;
    let x = 0;
    const addPair = (iconKind, value, color) => {
      const tex = statTexture(iconKind, 2);
      if (tex) {
        const spr = new PIXI.Sprite(tex);
        const sc = ICON_H / tex.height;
        spr.scale.set(sc); spr.x = x; spr.y = -ICON_H;
        cont.addChild(spr);
        x += tex.width * sc + 1;
      }
      const t = label(String(value), FS.label, color, { font: FONT.ui });
      t.anchor = { x: 0, y: 1 }; t.x = x; t.y = 0;
      cont.addChild(t);
      x += t.width + 8;
    };
    addPair(dangerous ? 'scythe' : 'sword', atk, dangerous ? '#ff9a9a' : '#e8eefc');
    addPair('shield', def, '#bcd0ff');
    cont.x = -x / 2; // center the row over the unit
  }

  // Approximate damage a pending action would deal to `target` (average roll, no
  // crit/stealth nuance) — for the target-select HP preview. Display only.
  predictDamage(actor, target, action) {
    if (!actor || !target) return 0;
    let d;
    if (action.type === 'attack') {
      d = physicalDamage(actor, target, null);
    } else if (action.type === 'spell') {
      const spell = getSpell(action.spellId);
      if (!spell || spell.kind !== 'damage') return 0;
      const hits = spell.hits || 1;
      let base = spell.physical ? skillDamage(spell, actor, target, null) : magicDamage(spell, target, null, actor);
      if (!spell.physical && actor.charge) base = Math.floor(base * CHARGE_MULT);
      d = base * hits;
    } else return 0;
    // 은신 기습: a stealthed attacker's next damaging hit is a guaranteed crit.
    if (actor.stealth) d = Math.floor(d * CRIT_MULT);
    return d;
  }

  // During target-select, paint the pending hit onto the hovered enemy's HP bar (a
  // bright band over the slice it would remove) + a skull above when it's lethal.
  showTargetPreview() {
    this.clearTargetPreview();
    const a = this.targetForAction;
    if (this.phase !== 'target' || !a) return;
    const target = findUnit(this.state, this.targetGlowId);
    const view = target && this.viewOf.get(target.id);
    if (!target || !view || !view.dmgPreviewG) return;
    const spell = a.type === 'spell' ? getSpell(a.spellId) : null;
    const W = 76;
    const curFrac = Math.max(0, target.hp) / target.maxHp;
    const g = view.dmgPreviewG;

    // Heal preview: a GREEN band for the HP a heal would restore + a +N label.
    if (spell && spell.kind === 'heal') {
      const heal = Math.floor((spell.power || 0) * magicScale(this.actor));
      if (heal <= 0) return;
      const newFrac = Math.min(target.maxHp, target.hp + heal) / target.maxHp;
      g.clear();
      g.rect(W * curFrac, 0, Math.max(1, W * (newFrac - curFrac)), 11).fill({ color: 0x5ad06a, alpha: 0.85 });
      g.visible = true; view._previewing = true;
      this.setPreviewLabel(view, `+${heal}`, 0x9af0a8);
      return;
    }

    // Damage preview: RED band for HP removed, a ±range label, kill skull if lethal.
    const damaging = a.type === 'attack' || (spell && spell.kind === 'damage');
    if (!damaging) return;
    const dmg = this.predictDamage(this.actor, target, a);
    if (dmg <= 0) return;
    const newFrac = Math.max(0, target.hp - dmg) / target.maxHp;
    g.clear();
    g.rect(W * newFrac, 0, Math.max(1, W * (curFrac - newFrac)), 11).fill({ color: 0xff5566, alpha: 0.85 });
    g.visible = true; view._previewing = true;
    const lo = Math.max(1, Math.floor(dmg * 0.9)), hi = Math.ceil(dmg * 1.1);
    this.setPreviewLabel(view, lo === hi ? `-${lo}` : `-${lo}~${hi}`, 0xffd0d0);
    if (target.hp - dmg <= 0 && view.killIcon) view.killIcon.visible = true;
  }

  setPreviewLabel(view, text, color) {
    const t = view.previewLabel;
    if (!t) return;
    t.text = text; t.style.fill = color; t.visible = true;
  }

  clearTargetPreview() {
    for (const v of this.viewOf.values()) {
      if (v.dmgPreviewG) { v.dmgPreviewG.visible = false; v._previewing = false; }
      if (v.previewLabel) v.previewLabel.visible = false;
      if (v.killIcon) v.killIcon.visible = false;
    }
  }

  drawHp(view) {
    const u = view.unit;
    const hp = view.shownHp != null ? view.shownHp : u.hp;
    const frac = Math.max(0, hp) / u.maxHp;
    const col = frac > 0.5 ? NUM.hpHigh : frac > 0.25 ? NUM.hpMid : NUM.hpLow;
    view.hpBarObj.setFrac(frac, col);
    if (view.mpBarObj && u.maxMp > 0) view.mpBarObj.setFrac(Math.max(0, u.mp) / u.maxMp, NUM.mp);
  }

  refreshUnits() {
    for (const view of this.viewOf.values()) {
      this.drawHp(view);
      const dead = !view.unit.alive;
      view.root.alpha = dead ? 0.18 : 1;
      const active = view.unit.id === this.activeId;
      // Active-turn unit: gold; else hero cyan, enemy pink.
      view.nameT.style.fill = active ? HEX.gold : (view.unit.side === 'hero' ? HEX.info : '#ffb3b3');

      // Update status chips.
      view.statusCont.removeChildren();
      const s = view.unit.status || {};
      const activeStatuses = Object.keys(s).filter((k) => s[k] > 0);
      let xOff = 0;
      for (const kind of activeStatuses) {
        const tex = statusTexture(kind, 2);
        if (tex) {
          const spr = new PIXI.Sprite(tex);
          spr.x = xOff;
          view.statusCont.addChild(spr);
          xOff += tex.width + 4;
        }
      }

      // Keep the enemy atk/def badge current (buffs/debuffs change it).
      this.drawStatBadge(view);
    }
    this.checkCrisisFP();
    this.checkDeathRage();
  }

  // ---- attack/lunge animation ----
  animateActor(actorId, kind) {
    const view = this.viewOf.get(actorId);
    if (!view) return;
    if (kind === 'attack') this.game.audio.play('attack_whoosh');
    view.anim = { t: 0, dur: kind === 'attack' && view.unit.side === 'hero' ? ATK_DUR : 0.32, kind };
  }

  tickJuice(dt) {
    // Pulsing glow on the currently-selected target.
    if (this.phase === 'target' && this.targetGlowId) {
      const v = this.viewOf.get(this.targetGlowId);
      if (v && !v.anim) {
        const p = 0.5 + 0.5 * Math.sin(this.elapsed * 8);
        const c = NUM.gold;
        v.sprite.tint = c;
        v.root.scale.set(1 + 0.08 * p);
      }
    }
    // Active-character cue: a pulsing gold ring at the active hero's feet during
    // their turn (command/menu/target phases) — a strong "you control this one" mark.
    const playerTurn = this.phase === 'command' || this.phase === 'target'
      || (typeof this.phase === 'string' && this.phase.startsWith('menu'));
    for (const v of this.viewOf.values()) {
      if (!v.footRing) continue;
      const on = playerTurn && v.unit.id === this.activeId && v.unit.alive;
      v.footRing.visible = on;
      if (on) {
        const p = 0.5 + 0.5 * Math.sin(this.elapsed * 6);
        v.footRing.alpha = 0.75 + 0.25 * p;
        v.footRing.scale.set(1 + 0.08 * p);
      }
      // Pulse the pending-damage band + lethal skull on the hovered target.
      if (v._previewing && v.dmgPreviewG && v.dmgPreviewG.visible) {
        v.dmgPreviewG.alpha = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(this.elapsed * 10));
      }
      if (v.killIcon && v.killIcon.visible) {
        v.killIcon.y = -46 - 3 * (0.5 + 0.5 * Math.sin(this.elapsed * 6));
      }
    }
    // Walk-in entrance: slide units from off-screen to their spots; heroes
    // cycle their walk frames, enemies just slide. ~0.6s, eased.
    if (this.entering) {
      this.enterT += dt;
      const k = Math.min(1, this.enterT / 0.6);
      const ease = 1 - Math.pow(1 - k, 3);
      for (const view of this.viewOf.values()) {
        view.root.x = view.startX + (view.baseX - view.startX) * ease;
        if (view.unit.side === 'hero' && k < 1) {
          swapTexture(view.sprite, heroWalkUrl(view.unit.sprite, 'east', Math.floor(this.enterT * 12)));
        }
      }
      if (k >= 1) {
        this.entering = false;
        for (const view of this.viewOf.values()) {
          view.root.x = view.baseX;
          if (view.unit.side === 'hero') swapTexture(view.sprite, heroUrl(view.unit.sprite, 'east'));
        }
      }
    }
    // Screen shake (jitter fieldLayer, decay to rest).
    if (this._shake) {
      this._shake.t += dt;
      const p = this._shake.t / this._shake.dur;
      if (p >= 1) { this.fieldLayer.x = 0; this.fieldLayer.y = 0; this._shake = null; }
      else {
        const m = this._shake.mag * (1 - p);
        this.fieldLayer.x = Math.sin(this.elapsed * 90) * m;
        this.fieldLayer.y = Math.cos(this.elapsed * 75) * m;
      }
    }
    // Damage popups float up + fade.
    if (this._popups) {
      for (const p of this._popups) {
        p.age += dt;
        const k = Math.min(1, p.age / 0.8);
        p.t.y = p.y0 - 50 * k;
        p.t.alpha = k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1;
      }
      this._popups = this._popups.filter((p) => { const dead = p.age >= 0.8; if (dead && !p.t.destroyed) p.t.destroy(); return !dead; });
    }
    // Hit effect sprites scale + fade.
    if (this._fx) {
      for (const f of this._fx) {
        f.age += dt;
        const k = Math.min(1, f.age / f.dur);
        f.sprite.scale.set(0.5 + 0.7 * k); // scale 0.5 → 1.2
        f.sprite.alpha = 1 - k; // alpha 1 → 0
      }
      this._fx = this._fx.filter((f) => { const dead = f.age >= f.dur; if (dead && !f.sprite.destroyed) f.sprite.destroy(); return !dead; });
    }
    // HP bar smooth lerp toward actual hp.
    for (const view of this.viewOf.values()) {
      if (view.shownHp == null) view.shownHp = view.unit.hp;
      if (view.shownHp !== view.unit.hp) {
        view.shownHp += (view.unit.hp - view.shownHp) * Math.min(1, dt * 8);
        if (Math.abs(view.shownHp - view.unit.hp) < 0.5) view.shownHp = view.unit.hp;
        this.drawHp(view);
      }
    }
  }

  tickAnims(dt) {
    for (const view of this.viewOf.values()) {
      const a = view.anim;
      // Enemy idle breathing bob when not animating.
      if (!a && view.unit.side === 'enemy' && view.unit.alive) {
        view.root.y = view.baseY + Math.sin(this.elapsed * 2 + view.bobPhase) * 2;
      }
      if (!a) continue;
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);
      if (a.kind === 'charge') {
        // boss charge-up telegraph: swell + hold the red tint, no lunge
        view.root.scale.set(1 + Math.sin(p * Math.PI) * 0.18);
        if (p >= 1) { view.root.scale.set(1); view.sprite.tint = view.unit.tint || 0xd4d4d4; view.anim = null; }
        continue;
      }
      if (a.kind === 'recruit') {
        // DD2: recruited enemy glows and slides LEFT toward the party side, fading.
        view.root.x = view.baseX - p * 220;
        view.root.alpha = 1 - p * 0.85;
        if (p >= 1) { view.anim = null; view.root.alpha = 1; }
        continue;
      }
      if (a.kind === 'spare') {
        // DD2: spared enemy drifts up and fades (peaceful), NOT the death dissolve.
        view.root.y = view.baseY - p * 36;
        view.root.alpha = 1 - p;
        if (p >= 1) { view.anim = null; view.root.alpha = 1; }
        continue;
      }
      // lunge out and back toward the opponent side
      const dir = view.facing; // heroes +1 (right), enemies -1 (left)
      view.root.x = view.baseX + Math.sin(p * Math.PI) * LUNGE * dir;
      // hero attack: cycle attack frames across the animation
      if (a.kind === 'attack' && view.unit.side === 'hero') {
        const n = ATTACK_FRAMES[view.unit.sprite] || 3;
        const frame = Math.min(n - 1, Math.floor(p * n));
        swapTexture(view.sprite, heroAttackUrl(view.unit.sprite, 'east', frame));
      }
      if (p >= 1) {
        view.root.x = view.baseX;
        if (a.kind === 'attack' && view.unit.side === 'hero') swapTexture(view.sprite, heroUrl(view.unit.sprite, 'east'));
        view.anim = null;
      }
    }
  }

  flashFromEvents(events) {
    let shook = false;
    for (const ev of events) {
      const tid = ev.targetId || ev.unitId;
      const v = this.viewOf.get(tid);
      // When the ported spell-FX engine is driving this spell's visuals, it owns
      // the impact burst + shake — so skip the legacy single fxTexture sprite and
      // the extra shake to avoid doubling. The red flash + damage number stay
      // (they're gameplay-readable and the engine doesn't draw unit sprites).
      const fxOwned = this.spellFx && (
        ((ev.type === 'spellHit' || ev.type === 'monsterSkillHit' || ev.type === 'heal') && ev.spellId && hasSpellFx(ev.spellId))
        || (ev.type === 'bondHit' && ev.comboId && hasSpellFx(ev.comboId)));
      if (v && (ev.type === 'attack' || ev.type === 'spellHit' || ev.type === 'monsterSkillHit' || ev.type === 'bondHit')) {
        const restTint = v.unit.side === 'enemy' ? (v.unit.tint || 0xd4d4d4) : 0xffffff;
        v.sprite.tint = NUM.danger;
        setTimeout(() => { if (v.sprite && !v.sprite.destroyed) v.sprite.tint = restTint; }, 140);
        // damage number popup (crit → big gold number, like heavy strikes)
        if (typeof ev.amount === 'number') this.spawnDamageNumber(tid, ev.amount, ev.heavy || ev.crit);
        if (ev.crit) this.tintPulse(tid, 0xffe28a, 120); // 치명타 골드 글린트 (장신구 crit 포함)
        if (!fxOwned) {
          // hit effect sprite (slash for attack, fire/ice/spark for spells)
          this.spawnHitFx(tid, this.fxKindForEvent(ev));
          if (!shook) { this.shake(140, 3); shook = true; }
        }
      } else if (v && ev.type === 'heal') {
        // heal FX on the target ally (engine handles it when it owns the spell)
        if (!fxOwned) this.spawnHitFx(tid, 'spark');
      }
      if (ev.type === 'attack') this.game.audio.play(this.viewOf.get(ev.targetId)?.unit.side === 'hero' ? 'player_hurt' : 'hit_physical');
      else if (ev.type === 'spellHit' || ev.type === 'monsterSkillHit' || ev.type === 'bondHit') {
        // 원소별 임팩트음 (asset) — 없거나 미로드면 기존 ZzFX hit_magic 폴백.
        const def = ev.type === 'monsterSkillHit' ? getMonsterSkill(ev.spellId) : getSpell(ev.spellId);
        if (!this.game.audio.playElement?.('impact', def && def.element)) this.game.audio.play('hit_magic');
      } else if (ev.type === 'heal') {
        if (!this.game.audio.playElement?.('impact', 'heal')) this.game.audio.play('heal_chime');
      } else if (ev.type === 'death') this.game.audio.play('enemy_death');
    }
  }

  // Floating damage number above a unit, rising + fading over ~0.8s.
  // Crit: larger, goldGlow; normal dmg: body size, frame text.
  spawnDamageNumber(unitId, amount, crit) {
    const view = this.viewOf.get(unitId);
    if (!view) return;
    const size = crit ? 40 : FS.num;
    const color = crit ? HEX.goldGlow : HEX.text;
    const t = label(String(amount), size, color, { font: FONT.mono });
    t.anchor = { x: 0.5, y: 0.5 };
    t.x = view.baseX; t.y = view.root.y - view.targetH - 26;
    this.fieldLayer.addChild(t);
    this._popups = this._popups || [];
    this._popups.push({ t, age: 0, x: view.baseX, y0: t.y });
  }

  // Floating TEXT label above a unit (장비 패시브 발동 신호: 반격!/저항!/재생/경감 등).
  // Reuses the damage-number rise/fade pool (_popups) — no separate text system. Sits
  // a little higher than the damage number so a counter's "반격!" + number don't overlap.
  spawnLabel(unitId, text, color, opts = {}) {
    const view = this.viewOf.get(unitId);
    if (!view) return;
    const t = label(text, opts.size || 16, color, { font: FONT.ui });
    t.anchor = { x: 0.5, y: 0.5 };
    t.x = view.baseX; t.y = view.root.y - view.targetH - 44;
    this.fieldLayer.addChild(t);
    this._popups = this._popups || [];
    this._popups.push({ t, age: 0, x: view.baseX, y0: t.y });
  }

  // Brief colour pulse on a unit's sprite (passive proc tint) → back to rest.
  tintPulse(unitId, color, ms = 200) {
    const v = this.viewOf.get(unitId);
    if (!v || !v.sprite || v.sprite.destroyed) return;
    const rest = v.unit.side === 'enemy' ? (v.unit.tint || 0xd4d4d4) : 0xffffff;
    v.sprite.tint = color;
    setTimeout(() => { if (v.sprite && !v.sprite.destroyed) v.sprite.tint = rest; }, ms);
  }

  // 장비 패시브 발동 시각 신호 — battleScene 프리미티브(라벨+tint+spark+shake)로 구성해
  // spellFx 엔진을 건드리지 않는다(진행 중인 스펠/공격 FX와 자연 공존). 짧고 명료.
  //   counter(반격) · inflictResist(저항) · dmgReduce(피해 경감). regen은 라운드
  //   플립에서 drainRoundEvents가, crit 글린트는 flashFromEvents가 처리.
  equipFx(events) {
    for (const ev of events) {
      if (ev.type === 'counter') {
        this.spawnLabel(ev.unitId, '반격!', 0xff6a6a);
        this.tintPulse(ev.unitId, 0xff8a6a, 180);
        if (typeof ev.amount === 'number') this.spawnDamageNumber(ev.targetId, ev.amount, false);
        this.spawnHitFx(ev.targetId, 'slash');
        this.shake(120, 3);
        this.game.audio?.play('hit_physical');
      } else if (ev.type === 'inflictResist') {
        this.spawnLabel(ev.targetId, '저항!', 0xcfe0ff);
        this.tintPulse(ev.targetId, 0x9ad6ff, 200);
        this.spawnHitFx(ev.targetId, 'spark');
      } else if (ev.type === 'dmgReduce') {
        // 피격마다 떠서 도배되지 않게: tint는 항상, '경감' 라벨은 ~1.4s throttle.
        this.tintPulse(ev.unitId, 0x9ad6ff, 150);
        const now = this.elapsed || 0;
        if (now - (this._lastGuardLabel || -9) > 1.4) { this._lastGuardLabel = now; this.spawnLabel(ev.unitId, '경감', 0xcfe0ff); }
      }
    }
  }

  // 장신구 재생(regen) — startRound가 state.roundEvents에 쌓아둔 것을 라운드 플립에서
  // 드레인해 시각 신호(재생 라벨+초록 tint+spark)로 띄운다(비차단). 기존엔 무음이었음.
  drainRoundEvents() {
    const evs = this.state.roundEvents;
    if (!evs || !evs.length) return;
    this.state.roundEvents = [];
    for (const ev of evs) {
      if (ev.type !== 'regen') continue;
      this.spawnLabel(ev.unitId, '재생', 0x62c46a);
      this.tintPulse(ev.unitId, 0x8fe39a, 220);
      this.spawnHitFx(ev.unitId, 'spark');
    }
  }

  // Pixel hit effect sprite (베기/화염/냉기/회복).
  // Spawns at target's mid-body, scales 0.5→1.2 and fades 1→0 over ~0.4s.
  spawnHitFx(unitId, kind) {
    const view = this.viewOf.get(unitId);
    if (!view) return;
    const tex = fxTexture(kind, 5);
    if (!tex) return;
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.x = view.baseX;
    sprite.y = view.root.y - view.targetH * 0.5; // target unit mid-body
    this.fieldLayer.addChild(sprite);
    this._fx = this._fx || [];
    this._fx.push({ sprite, age: 0, dur: 0.4 });
  }

  // Determine FX kind from action/event: spell element or damage type.
  fxKindForEvent(event) {
    if (event.type === 'heal') return 'spark';
    if (event.type === 'spellHit') {
      const spell = getSpell(event.spellId);
      if (!spell) return 'fire'; // default
      // Map spell id keywords to element-based FX kinds.
      if (spell.id.includes('fire') || spell.id.includes('firebolt') || spell.id.includes('firestorm')) return 'fire';
      if (spell.id.includes('ice') || spell.id.includes('frost') || spell.id.includes('lullaby')) return 'ice';
      if (spell.id.includes('smite') || spell.id.includes('holy') || spell.id.includes('nova')) return 'spark';
      // Default damage spells to fire.
      return 'fire';
    }
    if (event.type === 'attack') return 'slash';
    return 'fire'; // fallback
  }

  // Screen shake: jitter the field layer, decaying to rest.
  shake(durMs, mag) {
    this._shake = { t: 0, dur: durMs / 1000, mag };
  }

  // Drive the ported spell-FX engine from a resolved spell action. Reads the
  // castStart event (absent on a fizzle → no FX), resolves the affected unit
  // views, converts their mid-body positions to the engine's logical space
  // (÷FX_LO), and plays the per-spell choreography. battle.js stays pure — this
  // is cosmetic only; the impact damage numbers/red flash stay in flashFromEvents.
  playSpellFx(action, events) {
    if (!this.spellFx) return;
    const cast = events.find((e) => e.type === 'castStart');
    if (!cast) return;
    // 원소별 시전음 (asset 레이어 — 없거나 미로드면 무음, 임팩트가 ZzFX로 커버).
    const sfxSpell = getSpell(cast.spellId);
    if (sfxSpell) this.game.audio.playElement?.('cast', sfxSpell.kind === 'heal' || sfxSpell.kind === 'cure' ? 'heal' : sfxSpell.element);
    if (!hasSpellFx(cast.spellId)) return;
    const av = this.viewOf.get(action.actorId);
    if (!av) return;
    const spell = getSpell(cast.spellId);
    const toLogical = (v) => ({ x: v.baseX / FX_LO, y: (v.baseY - v.targetH * 0.5) / FX_LO });
    let units;
    if (spell.target === 'allEnemies') units = living(this.state, 'enemy');
    else if (spell.target === 'allAllies') units = living(this.state, 'hero');
    else if (spell.target === 'self') units = [av.unit];
    else {
      const ally = spell.kind === 'heal' || spell.kind === 'cure';
      units = action.targetId ? [findUnit(this.state, action.targetId)] : living(this.state, ally ? 'hero' : 'enemy').slice(0, 1);
    }
    const enemies = units.map((u) => { const vv = u && this.viewOf.get(u.id); return vv ? toLogical(vv) : null; }).filter(Boolean);
    if (!enemies.length) enemies.push(toLogical(av));
    // State-branch flags the FX choreographies read (분노/은신/충전). rage isn't
    // consumed by the resolver (still set post-cast); stealth/charge are consumed,
    // so their stateEnd event marks that THIS cast was a sneak/overcharged one.
    this.spellFx._rage = !!(av.unit && av.unit.rage > 0);
    this.spellFx._stealth = events.some((e) => e.type === 'stateEnd' && e.state === 'stealth');
    this.spellFx._charge = events.some((e) => e.type === 'stateEnd' && e.state === 'charge');
    this.spellFx.play(cast.spellId, { caster: toLogical(av), enemies });
  }

  // Enemy-side counterpart of playSpellFx. Targets are caster-relative
  // (monsterSkills.js: 'one'/'all' = the OPPOSING side, 'self' = the caster), so
  // a monster's choreography plays on the heroes. Cosmetic only (battle.js pure).
  playMonsterSkillFx(action, events) {
    if (!this.spellFx) return;
    const cast = events.find((e) => e.type === 'castStart');
    if (!cast) return;
    const sfxSkill = getMonsterSkill(cast.spellId);
    if (sfxSkill) this.game.audio.playElement?.('cast', sfxSkill.element);
    if (!hasSpellFx(cast.spellId)) return;
    const av = this.viewOf.get(action.actorId);
    if (!av) return;
    const skill = getMonsterSkill(cast.spellId);
    const toLogical = (v) => ({ x: v.baseX / FX_LO, y: (v.baseY - v.targetH * 0.5) / FX_LO });
    const foeSide = av.unit && av.unit.side === 'hero' ? 'enemy' : 'hero';
    let units;
    if (!skill || skill.target === 'self') units = [av.unit];
    else if (skill.target === 'all') units = living(this.state, foeSide);
    else units = action.targetId ? [findUnit(this.state, action.targetId)] : living(this.state, foeSide).slice(0, 1);
    const enemies = units.map((u) => { const vv = u && this.viewOf.get(u.id); return vv ? toLogical(vv) : null; }).filter(Boolean);
    if (!enemies.length) enemies.push(toLogical(av));
    // Target-sprite recolour (석화 회색 / 공허 보라 / 용암 적색) — the FX engine runs in
    // logical coords so it can't tint the real sprites; do it scene-side here.
    const tintCol = SKILL_TINT[cast.spellId];
    if (tintCol) for (const u of units) {
      const vv = u && this.viewOf.get(u.id);
      if (vv && vv.sprite && !vv.sprite.destroyed) {
        vv.sprite.tint = tintCol;
        const rest = vv.unit.side === 'enemy' ? (vv.unit.tint || 0xd4d4d4) : 0xffffff;
        setTimeout(() => { if (vv.sprite && !vv.sprite.destroyed) vv.sprite.tint = rest; }, 1000);
      }
    }
    // Monster skills don't use the hero state-branch flags (분노/은신/충전).
    this.spellFx._rage = false; this.spellFx._stealth = false; this.spellFx._charge = false;
    this.spellFx.play(cast.spellId, { caster: toLogical(av), enemies });
  }

  // 인연공격 FX — a DUO choreography: the engine gets BOTH origins (caster + partner)
  // so the two heroes strike together. partner is an optional play() arg (null for
  // every existing single-caster spell — no caller threading). Cosmetic only.
  playBondFx(action, events) {
    if (!this.spellFx || !action.comboId || !hasSpellFx(action.comboId)) return;
    const av = this.viewOf.get(action.actorId);
    if (!av) return;
    const toLogical = (v) => ({ x: v.baseX / FX_LO, y: (v.baseY - v.targetH * 0.5) / FX_LO });
    const partnerIds = action.partnerIds || (action.partnerId ? [action.partnerId] : []);
    const partners = partnerIds.map((id) => this.viewOf.get(id)).filter(Boolean).map(toLogical);
    const all = action.base && action.base.target === 'all';
    const units = all ? living(this.state, 'enemy')
      : action.targetId ? [findUnit(this.state, action.targetId)] : living(this.state, 'enemy').slice(0, 1);
    const enemies = units.map((u) => { const vv = u && this.viewOf.get(u.id); return vv ? toLogical(vv) : null; }).filter(Boolean);
    if (!enemies.length) enemies.push(toLogical(av));
    this.spellFx._rage = false; this.spellFx._stealth = false; this.spellFx._charge = false;
    // partner (single) kept for the duo DEFS; partners[] for trio/quad multi-origin.
    this.spellFx.play(action.comboId, { caster: toLogical(av), partner: partners[0] || null, partners, enemies });
  }

  buildMenuPlaceholder() { this.menuLayer.removeChildren(); }

  // Full-bleed bottom panel — covers the entire grass band (from the backdrop
  // horizon to the screen bottom, edge to edge), per the requested layout.
  buildPanel(w, h) {
    this.panelBg.removeChildren();
    const py = h * 0.6; // matches backdrop horizon (grass line)
    const ph = h - py;
    this.panelRect = { x: 24, y: py, w: w - 48, h: ph };
    const g = new PIXI.Graphics();
    g.rect(0, py, w, ph).fill({ color: NUM.ink900, alpha: 0.96 }); // edge-to-edge fill
    g.rect(0, py, w, 4).fill({ color: NUM.frame });                 // top border
    this.panelBg.addChild(g);
    // 운명(Fabula Point) gauge — a party-shared resource shown ALWAYS (even at 0)
    // as its own thing, distinct from the per-unit HP/MP bars: "✦ 운명" label +
    // FABULA_CAP diamond pips (filled gold = banked, hollow = capacity). Top-right
    // of the panel. Lets the player read FP as a separate pool they build toward.
    this.fabulaGauge = new PIXI.Container();
    // Centered just ABOVE the panel (over the empty bottom-center of the field) so
    // the party FP pool is impossible to miss and never collides with the command
    // menu — was a subtle top-right corner badge before. Container origin = its
    // mid-x; updateFabulaBadge lays content out left→right centered on it.
    this.fabulaGauge.x = this.panelRect.x + this.panelRect.w / 2;
    this.fabulaGauge.y = this.panelRect.y - 22;
    this.panelBg.addChild(this.fabulaGauge);
    this.updateFabulaBadge();
  }

  // Redraw the FP gauge from runtime.fabula. Laid out left→right and centered on
  // the container origin: a BIG "운명 N/CAP" number, then high-contrast diamond
  // pips (solid gold = banked, dark = empty). The number is the source of truth so
  // the player always reads the exact amount (pips alone were ambiguous).
  updateFabulaBadge() {
    if (!this.fabulaGauge) return;
    const fp = Math.max(0, Math.min(FABULA_CAP, this.game.runtime.fabula || 0));
    this.fabulaGauge.removeChildren();
    const pip = 8, gap = 5, step = pip * 2 + gap;
    const pipsW = FABULA_CAP * step;
    // Big, explicit count — the number, not the pips, is what the player reads.
    const lbl = label(`✦ 운명  ${fp} / ${FABULA_CAP}`, FS.command, HEX.gold, { font: FONT.ui });
    lbl.anchor = { x: 0, y: 0.5 };
    const padX = 12, gapLP = 14;
    const totalW = padX + lbl.width + gapLP + pipsW + padX;
    const x0 = -totalW / 2; // left edge, centered on the container origin (panel mid-x)
    // Background pill so the whole gauge reads as one prominent resource.
    const bg = new PIXI.Graphics();
    bg.roundRect(x0, -16, totalW, 32, 7)
      .fill({ color: NUM.ink900, alpha: 0.94 }).stroke({ color: NUM.gold, width: 2, alpha: 0.8 });
    this.fabulaGauge.addChild(bg);
    lbl.x = x0 + padX; lbl.y = 0;
    this.fabulaGauge.addChild(lbl);
    // Diamond pips after the number, left→right.
    const pipStart = x0 + padX + lbl.width + gapLP + pip;
    for (let i = 0; i < FABULA_CAP; i++) {
      const cx = pipStart + i * step, cy = 0;
      const filled = i < fp;
      const d = new PIXI.Graphics();
      d.poly([cx, cy - pip, cx + pip, cy, cx, cy + pip, cx - pip, cy]);
      if (filled) d.fill({ color: NUM.gold }).stroke({ color: NUM.goldGlow, width: 1 });
      else d.fill({ color: NUM.ink800, alpha: 0.9 }).stroke({ color: NUM.gold, width: 1, alpha: 0.35 });
      this.fabulaGauge.addChild(d);
    }
  }

  // Bank +1 Fabula Point the first time each hero enters Crisis (≤50% HP) this
  // battle. Silent (badge ticks up + a chime); no blocking message.
  checkCrisisFP() {
    if (!this.crisisAwarded) return;
    for (const u of this.heroUnits) {
      if (u.alive && u.hp > 0 && u.hp <= u.maxHp * 0.5 && !this.crisisAwarded.has(u.id)) {
        this.crisisAwarded.add(u.id);
        const before = this.game.runtime.fabula || 0;
        this.game.runtime.fabula = Math.min(6, before + 1);
        if (this.game.runtime.fabula > before) this.game.audio?.play('phase');
        // 애정 surge: partners bonded by affection rally when a friend falls into
        // Crisis (the deferred Crisis-partner-atk, now powered by the emotion).
        for (const pid of partnersWithEmotion(this.game.runtime.bonds || {}, u.refId, 'affection')) {
          const pv = this.heroUnits.find((h) => h.refId === pid && h.alive);
          if (pv && !pv._affectionSurge) {
            pv.atkBuff = (pv.atkBuff || 0) + 0.2;
            pv._affectionSurge = true;
            this.queueMsg(`${pv.name}는 ${u.name}를 지키려 분기한다! 공격력 상승!`);
          }
        }
      }
    }
    this.updateFabulaBadge();
  }

  // 증오(hatred) death-rage: when a hatred-bonded ally falls, the survivor's grief
  // curdles to fury — a large one-time atkBuff surge. Mirror of the affection
  // Crisis surge, but triggered by DEATH (ruthless: loss fuels violence, not
  // protection). Stronger than the affection surge — death > Crisis.
  checkDeathRage() {
    if (!this.deathRaged) return;
    for (const u of this.heroUnits) {
      if (!u.alive && !this.deathRaged.has(u.id)) {
        this.deathRaged.add(u.id);
        for (const pid of partnersWithEmotion(this.game.runtime.bonds || {}, u.refId, 'hatred')) {
          const pv = this.heroUnits.find((h) => h.refId === pid && h.alive);
          if (pv && !pv._hatredSurge) {
            pv.atkBuff = (pv.atkBuff || 0) + 0.35;
            pv._hatredSurge = true;
            this.queueMsg(`${pv.name}는 ${u.name}의 죽음에 격노한다! 공격력 급상승!`);
          }
        }
      }
    }
  }

  // Vertical command column (flex-col), centered in the bottom panel.
  openCommand(actor) {
    this.actor = actor;
    this.menuLayer.removeChildren();
    // 자비 (mercy) sits above 방어 — it is the game's signature mechanic, not a
    // throwaway. It stays visible always but is disabled (greyed) until at least
    // one enemy is weakened enough to spare/recruit (design DD1).
    // 운명(Fate) appears only when the party has Fabula Points to spend.
    const fp = this.game.runtime.fabula || 0;
    this.menuOptions = ['attack', 'spell', 'item', 'mercy'];
    const labels = ['공격', '주문', '아이템', '자비'];
    // 운명: free action, but only once per turn (hidden after use this turn).
    if (fp > 0 && !this.fateUsedThisTurn) { this.menuOptions.push('fate'); labels.push(`운명 (${fp})`); }
    this.menuOptions.push('defend', 'flee');
    labels.push('방어', '도망');
    this.mercyEnabled = living(this.state, 'enemy').some(canMercy);
    this.cmdDisabled = this.menuOptions.map((o) => o === 'mercy' && !this.mercyEnabled);
    // 2-column grid (row-major): 공격|주문 / 아이템|자비 / [운명] 방어|도망.
    const r = this.panelRect;
    this.cmdTexts = [];
    this.cmdCols = 2;
    const rows = Math.ceil(labels.length / this.cmdCols);
    const itemH = Math.min(40, (r.h - 24) / rows);
    const top = r.y + (r.h - itemH * rows) / 2 + itemH / 2;
    const cx = r.x + r.w * 0.5;
    const colX = [cx - r.w * 0.14, cx + r.w * 0.04]; // left-anchored columns, block centered
    labels.forEach((s, i) => {
      const disabled = this.cmdDisabled[i];
      const t = label(s, FS.command, disabled ? HEX.textOff : HEX.text, { font: FONT.ui });
      t.anchor = { x: 0, y: 0.5 };
      t.x = colX[i % this.cmdCols]; t.y = top + Math.floor(i / this.cmdCols) * itemH;
      this.menuLayer.addChild(t);
      this.cmdTexts.push(t);
      if (this.menuOptions[i] === 'mercy') {
        this.mercyCmdIdx = i;
        if (disabled) {
          // 비활성 사유 인라인 — 왜 못 쓰는지 즉답. 남은 적이 전부 보스면 아예 불가.
          const foes = living(this.state, 'enemy');
          const allBoss = foes.length > 0 && foes.every((u) => u.boss);
          const why = label(allBoss ? '— 통하지 않는다' : '— 적을 약하게', FS.caption, HEX.textOff, { font: FONT.ui });
          why.anchor = { x: 0, y: 0.5 };
          why.x = t.x + t.width + 8; why.y = t.y;
          this.menuLayer.addChild(why);
        } else {
          // 시그니처 승격 — 조건 충족 시 자비 라벨은 골드 상시 (highlightCommand가 유지).
          t.style.fill = HEX.gold;
          // 영입까지 가능한 적이 있으면 배지.
          if (living(this.state, 'enemy').some(canRecruit)) {
            const bt = label('영입 가능', FS.caption, HEX.goldDeep, { font: FONT.ui });
            bt.anchor = { x: 0, y: 0.5 };
            bt.x = t.x + t.width + 14; bt.y = t.y;
            const bb = new PIXI.Graphics();
            bb.roundRect(bt.x - 5, bt.y - bt.height / 2 - 1, bt.width + 10, bt.height + 2, 3)
              .stroke({ color: NUM.goldDeep, width: 1, alpha: 0.9 });
            this.menuLayer.addChild(bb, bt);
          }
        }
      }
    });
    this.cmdCursor = new PIXI.Graphics();
    this.menuLayer.addChild(this.cmdCursor);
    this.menuIndex = 0;
    this.phase = 'command';
    this.highlightCommand();
  }

  highlightCommand() {
    this.cmdTexts.forEach((t, i) => {
      const disabled = this.cmdDisabled && this.cmdDisabled[i];
      // 자비 충족 상태는 커서와 무관하게 골드 상시 (시그니처 승격 연출).
      const mercyGold = i === this.mercyCmdIdx && !disabled;
      t.style.fill = disabled ? HEX.textOff : (i === this.menuIndex || mercyGold ? HEX.gold : HEX.text);
      t.scale.set(i === this.menuIndex && !disabled ? 1.12 : 1);
    });
    const t = this.cmdTexts[this.menuIndex];
    this.cmdCursor.clear();
    // Cursor sits just left of the (left-anchored) label.
    this.cmdCursor.poly([t.x - 22, t.y - 8, t.x - 22, t.y + 8, t.x - 12, t.y]).fill({ color: NUM.gold });
  }

  // ---- messages ----
  queueMsg(...msgs) { this.msgQueue.push(...msgs); if (this.msgTimer <= 0) this.showNextMsg(); }

  showNextMsg() {
    const m = this.msgQueue.shift();
    this.msgLayer.removeChildren();
    if (m == null) {
      this.msgTimer = 0;
      const cb = this.onMsgDone; this.onMsgDone = null;
      if (cb) cb();
      return;
    }
    // Render message text inside the full-width bottom panel.
    const r = this.panelRect || { x: 30, y: 16, w: this.game.renderer.screen.w - 60, h: 56 };
    const t = label(m, FS.body, HEX.text, { font: FONT.ui, wordWrap: true, wordWrapWidth: r.w - 56 });
    t.anchor = { x: 0, y: 0.5 };
    t.x = r.x + 28; t.y = r.y + r.h * 0.5;
    this.msgLayer.addChild(t);
    this.msgTimer = MSG_TIME;
  }

  // ---- turn flow ----
  nextTurn() {
    const over = isOver(this.state);
    if (over) return this.handleEnd(over);
    const actor = currentActor(this.state);
    this.activeId = actor ? actor.id : null;
    this.refreshUnits();
    if (!actor) { advanceTurn(this.state); return this.nextTurn(); }
    // Round banner: with interleaved initiative the acting side flips often, so
    // announce once per round (for whoever leads it) instead of on every flip —
    // the gold active-unit highlight telegraphs individual turns. An enemy-led
    // round shows "적의 턴", flagging that a fast mob struck first.
    if (this.state.round !== this.bannerRound) {
      this.bannerRound = this.state.round;
      this.curPhase = actor.side;
      this.drainRoundEvents(); // 장신구 재생(regen) 신호 — 라운드 시작 시 1회
      this.showPhaseBanner(actor.side === 'hero' ? '플레이어 턴' : '적의 턴', actor.side);
    }
    this.beginTurn(actor);
  }

  // Process the actor's status ailments, then act (or skip if asleep/dead).
  beginTurn(actor) {
    const ts = tickStatus(actor, this.game.rng);
    if (ts.events.length) {
      for (const ev of ts.events) {
        if (ev.type === 'poisonTick') { this.queueMsg(`${actor.name}는 독으로 ${ev.amount} 피해!`); this.spawnDamageNumber(actor.id, ev.amount, false); }
        else if (ev.type === 'burnTick') { this.queueMsg(`${actor.name}는 화상으로 ${ev.amount} 피해!`); this.spawnDamageNumber(actor.id, ev.amount, false); }
        else if (ev.type === 'bleedTick') { this.queueMsg(`${actor.name}는 출혈로 ${ev.amount} 피해!`); this.spawnDamageNumber(actor.id, ev.amount, false); }
        else if (ev.type === 'asleep') this.queueMsg(`${actor.name}는 잠들어 있다...`);
        else if (ev.type === 'paralyzed') this.queueMsg(`${actor.name}는 감전되어 움직일 수 없다!`);
        else if (ev.type === 'petrified') this.queueMsg(`${actor.name}는 석화되어 움직일 수 없다!`);
        else if (ev.type === 'stunned') this.queueMsg(`${actor.name}는 기절해 움직일 수 없다!`);
        else if (ev.type === 'shakeOff') this.queueMsg(`${actor.name}가 몸을 떨치고 일어섰다!`);
        else if (ev.type === 'wake') this.queueMsg(`${actor.name}가 깨어났다!`);
        else if (ev.type === 'death') this.queueMsg(`${actor.name}는 쓰러졌다!`);
      }
      this.refreshUnits();
      this.onMsgDone = () => {
        if (!actor.alive || ts.skip) { advanceTurn(this.state); this.nextTurn(); }
        else this.act(actor);
      };
      if (this.msgTimer <= 0) this.showNextMsg();
      return;
    }
    this.act(actor);
  }

  act(actor) {
    // 운명 is a free action but capped at ONE per turn — reset the guard at the
    // true start of each hero turn (re-opening the command menu mid-turn doesn't).
    if (actor.side === 'hero') { this.fateUsedThisTurn = false; this.phase = 'command'; this.openCommand(actor); }
    else { this.phase = 'enemy'; this.applyAction(enemyChooseAction(this.state, actor.id, this.game.rng)); }
  }

  showPhaseBanner(text, side) {
    this.game.audio.play('phase');
    const { w, h } = this.game.renderer.screen;
    const c = new PIXI.Container();
    const stripe = new PIXI.Graphics();
    const bgColor = side === 'hero' ? NUM.phaseHeroBg : NUM.phaseEnemyBg;
    const fgColor = side === 'hero' ? HEX.phaseHeroFg : HEX.phaseEnemyFg;
    stripe.rect(0, h * 0.42, w, 60).fill({ color: bgColor, alpha: 0.82 });
    const t = label(text, FS.display, fgColor, { font: FONT.display });
    t.anchor = { x: 0.5, y: 0.5 };
    t.x = w / 2; t.y = h * 0.42 + 30;
    c.addChild(stripe, t);
    this.msgLayer.addChild(c);
    // fade the banner out over ~0.7s (cheap timeout-based; not gameplay-gating)
    let a = 1;
    const id = setInterval(() => {
      a -= 0.08;
      if (!c.destroyed) c.alpha = Math.max(0, a);
      if (a <= 0) { clearInterval(id); if (!c.destroyed) c.destroy({ children: true }); }
    }, 45);
  }

  // Phase-2 transition: a full-screen crimson flash that punches in then fades.
  // Cosmetic only (above every battle layer); paired with the 격노 banner + shake.
  enrageFlash() {
    const { w, h } = this.game.renderer.screen;
    const g = new PIXI.Graphics();
    g.rect(0, 0, w, h).fill({ color: 0xff2a2a });
    g.alpha = 0;
    this.container.addChild(g);
    let t = 0;
    const id = setInterval(() => {
      t += 0.05;
      g.alpha = t < 0.12 ? (t / 0.12) * 0.5 : Math.max(0, 0.5 - (t - 0.12) * 0.9);
      if (t >= 0.75) { clearInterval(id); if (!g.destroyed) g.destroy(); }
    }, 40);
  }

  // Submenu rendered INSIDE the bottom panel (RPG-standard), same column style
  // as the command list. opts.disabled[] greys + blocks entries (e.g. unaffordable
  // spells). Returns a { texts, setIndex, disabled } menu object (navMenu-compatible).
  panelMenu(labels, opts = {}) {
    this.menuLayer.removeChildren();
    const r = this.panelRect;
    const disabled = opts.disabled || [];
    // opts.cx (0..1 of panel width) shifts the list left so a side info panel fits.
    const cx = r.x + r.w * (opts.cx != null ? opts.cx : 0.5);
    // A long spellbook (13+ spells at high level) would overflow the fixed panel
    // and clip/overlap. Cap how many rows are visible and SCROLL the window with
    // the cursor (▲▼ markers when there's more above/below). itemH stays readable.
    const itemH = 38;
    const maxVisible = Math.max(3, Math.floor((r.h - 28) / itemH));
    const windowed = labels.length > maxVisible;
    const visN = Math.min(labels.length, maxVisible);
    const top = r.y + (r.h - itemH * visN) / 2 + itemH / 2;

    // Reusable row slots (one per visible line) + scroll arrows.
    const rows = [];
    for (let v = 0; v < visN; v++) {
      const t = label('', FS.command, HEX.text, { font: FONT.ui });
      t.anchor = { x: 0.5, y: 0.5 };
      t.x = cx; t.y = top + v * itemH;
      this.menuLayer.addChild(t);
      rows.push(t);
    }
    const cursor = new PIXI.Graphics();
    this.menuLayer.addChild(cursor);
    const upArrow = label('▲', FS.caption, HEX.textMute); upArrow.anchor = { x: 0.5, y: 0.5 };
    upArrow.x = cx; upArrow.y = top - itemH * 0.7;
    const dnArrow = label('▼', FS.caption, HEX.textMute); dnArrow.anchor = { x: 0.5, y: 0.5 };
    dnArrow.x = cx; dnArrow.y = top + (visN - 1) * itemH + itemH * 0.7;
    if (windowed) this.menuLayer.addChild(upArrow, dnArrow);

    let scroll = 0;
    const setIndex = (idx) => {
      // Keep the selected row inside the visible window.
      if (windowed) {
        if (idx < scroll) scroll = idx;
        else if (idx >= scroll + visN) scroll = idx - visN + 1;
        scroll = Math.max(0, Math.min(scroll, labels.length - visN));
      }
      rows.forEach((t, v) => {
        const li = scroll + v;
        const dis = disabled[li];
        t.text = labels[li] ?? '';
        t.style.fill = dis ? HEX.textOff : (li === idx ? HEX.gold : HEX.text);
        t.scale.set(li === idx && !dis ? 1.1 : 1);
      });
      const selRow = rows[idx - scroll];
      cursor.clear();
      if (selRow) cursor.poly([selRow.x - selRow.width / 2 - 18, selRow.y - 8, selRow.x - selRow.width / 2 - 18, selRow.y + 8, selRow.x - selRow.width / 2 - 8, selRow.y]).fill({ color: NUM.gold });
      if (windowed) { upArrow.visible = scroll > 0; dnArrow.visible = scroll + visN < labels.length; }
    };
    setIndex(0);
    // `texts` keeps full length so navMenu/navTarget cursor wrap (% texts.length)
    // still spans every option, not just the visible window.
    return { texts: labels.map(() => ({})), setIndex, disabled };
  }

  // Rich spell list (left half of the panel): per row an element COLOUR DOT + name,
  // with 형식·속성 and MP right-aligned — at-a-glance element/cost reading (the info
  // panel on the right carries the full detail). Scrolls like panelMenu. spellIds
  // is parallel to rows; a null entry is the '← 뒤로' row. navMenu-compatible return.
  spellMenu(spellIds, disabled) {
    this.menuLayer.removeChildren();
    const r = this.panelRect;
    const itemH = 40;
    const maxVisible = Math.max(2, Math.floor((r.h - 20) / itemH));
    const n = spellIds.length;
    const visN = Math.min(n, maxVisible);
    const windowed = n > maxVisible;
    const top = r.y + (r.h - itemH * visN) / 2 + itemH / 2;
    const dotX = r.x + 34, lx = r.x + 50, metaRX = r.x + r.w * 0.42;

    const rows = [];
    for (let v = 0; v < visN; v++) {
      const y = top + v * itemH;
      const g = new PIXI.Graphics(); // dot drawn at absolute (dotX, row.y) in setIndex — no container offset
      const name = label('', FS.command, HEX.text, { font: FONT.ui }); name.anchor = { x: 0, y: 0.5 }; name.x = lx; name.y = y;
      const tag = label('', FS.caption, HEX.textMute, { font: FONT.ui }); tag.anchor = { x: 1, y: 0.5 }; tag.x = metaRX; tag.y = y - 8;
      const mp = label('', FS.caption, '#56a8e8', { font: FONT.ui }); mp.anchor = { x: 1, y: 0.5 }; mp.x = metaRX; mp.y = y + 9;
      this.menuLayer.addChild(g, name, tag, mp);
      rows.push({ g, name, tag, mp, y });
    }
    const cursor = new PIXI.Graphics(); this.menuLayer.addChild(cursor);
    const upArrow = label('▲', FS.caption, HEX.textMute); upArrow.anchor = { x: 0.5, y: 0.5 }; upArrow.x = dotX + 30; upArrow.y = top - itemH * 0.66;
    const dnArrow = label('▼', FS.caption, HEX.textMute); dnArrow.anchor = { x: 0.5, y: 0.5 }; dnArrow.x = dotX + 30; dnArrow.y = top + (visN - 1) * itemH + itemH * 0.66;
    if (windowed) this.menuLayer.addChild(upArrow, dnArrow);

    let scroll = 0;
    const setIndex = (idx) => {
      if (windowed) {
        if (idx < scroll) scroll = idx; else if (idx >= scroll + visN) scroll = idx - visN + 1;
        scroll = Math.max(0, Math.min(scroll, n - visN));
      }
      rows.forEach((row, v) => {
        const li = scroll + v, sid = spellIds[li], spell = sid && getSpell(sid), dis = disabled[li], sel = li === idx;
        row.g.clear();
        if (spell) {
          const elem = ELEM_INFO[spell.element] || ['#cfd8ec', '무'];
          row.g.circle(dotX, row.y, 7).fill({ color: dis ? '#4a5066' : elem[0] }).stroke({ color: '#0d1020', width: 1, alpha: 0.6 });
          row.name.text = spell.name;
          row.tag.text = `${TARGET_KR[spell.target] || ''} · ${elem[1]}`;
          row.mp.text = `MP ${spell.mpCost}`;
          row.tag.visible = true; row.mp.visible = true;
        } else {
          row.name.text = '← 뒤로'; row.tag.visible = false; row.mp.visible = false;
        }
        row.name.style.fill = dis ? HEX.textOff : (sel ? HEX.gold : HEX.text);
        row.name.scale.set(sel && !dis ? 1.08 : 1);
        row.tag.style.fill = dis ? HEX.textOff : HEX.textMute;
        // MP cost turns RED when unaffordable so the disabled reason reads at a glance.
        row.mp.style.fill = dis ? '#e25563' : '#56a8e8';
      });
      const selRow = rows[idx - scroll];
      cursor.clear();
      if (selRow) cursor.poly([dotX - 18, selRow.y - 7, dotX - 18, selRow.y + 7, dotX - 10, selRow.y]).fill({ color: NUM.gold });
      if (windowed) { upArrow.visible = scroll > 0; dnArrow.visible = scroll + visN < n; }
    };
    setIndex(0);
    return { texts: spellIds.map(() => ({})), setIndex, disabled };
  }

  openItemMenu() {
    const inv = this.game.runtime.inventory;
    const owned = Object.keys(inv).filter((id) => { const it = getItem(id); return it && it.kind === 'consumable' && !it.effect.warp && inv[id] > 0; });
    if (!owned.length) { this.queueMsg('쓸 수 있는 아이템이 없다.'); this.onMsgDone = () => this.openCommand(this.actor); if (this.msgTimer <= 0) this.showNextMsg(); return; }
    this.itemList = owned;
    const names = owned.map((id) => `${getItem(id).name} x${inv[id]}`);
    // Shift the list left so the item-info tooltip fits on the right (like spells).
    this.menu = this.panelMenu([...names, '← 뒤로'], { cx: 0.26 });
    this.itemInfo = new PIXI.Container();
    this.menuLayer.addChild(this.itemInfo);
    this.skillInfoUpdate = (i) => this.renderItemInfo(this.itemList[i]);
    this.menuIndex = 0; this.menu.setIndex(0);
    this.skillInfoUpdate(0);
    this.phase = 'menu_item';
  }

  // Item-info tooltip (분류·효과·보유) for the cursored consumable — mirrors the
  // spell skill-info panel. id undefined (the 뒤로 row) clears it.
  renderItemInfo(id) {
    const c = this.itemInfo;
    if (!c) return;
    c.removeChildren();
    const it = id && getItem(id);
    if (!it) return;
    const r = this.panelRect;
    const bw = r.w * 0.5, bh = r.h - 16, bx = r.x + r.w * 0.46, by = r.y + 8;
    const box = frame(bw, bh, 'bevel'); box.x = bx; box.y = by;
    c.addChild(box);
    const lx = bx + 16; let yy = by + 14;
    const line = (txt, col, sz) => {
      const t = label(txt, sz || FS.caption, col || HEX.text, { font: FONT.ui });
      t.x = lx; t.y = yy; c.addChild(t); yy += (sz || FS.caption) + 11; return t;
    };
    line(it.name, HEX.gold, FS.label);
    line('분류: ' + itemKindKR(it), HEX.textSoft);
    line('효과: ' + itemSummary(it), HEX.text);
    const have = (this.game.runtime.inventory || {})[id];
    if (have != null) line('보유: ' + have + '개', HEX.textSoft);
  }

  confirmItem() {
    if (this.menuIndex >= this.itemList.length) { this.openCommand(this.actor); return; }
    this.openTarget({ type: 'item', itemId: this.itemList[this.menuIndex], ally: true });
  }

  applyItem(actorId, itemId, targetId) {
    this.menuLayer.removeChildren();
    const it = getItem(itemId);
    const t = findUnit(this.state, targetId);
    if (it.effect.hp) { const b = t.hp; t.hp = Math.min(t.maxHp, t.hp + it.effect.hp); this.queueMsg(`${t.name}의 HP가 ${t.hp - b} 회복!`); }
    else if (it.effect.mp) { const b = t.mp; t.mp = Math.min(t.maxMp, t.mp + it.effect.mp); this.queueMsg(`${t.name}의 MP가 ${t.mp - b} 회복!`); }
    else if (it.effect.cure) { const ok = cureStatus(t, it.effect.cure); this.queueMsg(ok ? `${t.name}의 ${STATUS_KR[it.effect.cure]} 상태가 치료됐다!` : '아무 효과도 없었다.'); }
    else if (it.effect.fabula) {
      const before = this.game.runtime.fabula || 0;
      this.game.runtime.fabula = Math.min(FABULA_CAP, before + it.effect.fabula);
      this.updateFabulaBadge();
      this.queueMsg(`운명의 모래시계가 깨졌다 — ✦운명 +${this.game.runtime.fabula - before}!`);
    }
    this.game.runtime.inventory[itemId] = Math.max(0, (this.game.runtime.inventory[itemId] || 1) - 1);
    this.game.audio.play('heal_chime');
    this.refreshUnits();
    this.onMsgDone = () => { advanceTurn(this.state); this.nextTurn(); };
    if (this.msgTimer <= 0) this.showNextMsg();
  }

  openSpellMenu() {
    const actor = this.actor;
    if (!actor.spells.length) { this.queueMsg(`${actor.name}는 주문이 없다.`); this.onMsgDone = () => this.openCommand(actor); if (this.msgTimer <= 0) this.showNextMsg(); return; }
    // Grey out + block spells the actor can't afford (MP) or can't use yet
    // (그림자 일격류는 은신 상태 필요). Disabled rows are skipped + non-castable.
    const disabled = [...actor.spells.map((id) => { const s = getSpell(id); return s.mpCost > actor.mp || (s.requiresStealth && !actor.stealth); }), false];
    this.spellIds = [...actor.spells, null]; // parallel to rows (null = 뒤로)
    // Rich rows (element dot + name + 형식·속성 + MP); info panel sits on the right.
    this.menu = this.spellMenu(this.spellIds, disabled);
    // Info panel (right side) — live-previews the cursored spell.
    this.skillInfo = new PIXI.Container();
    this.menuLayer.addChild(this.skillInfo);
    this.skillInfoUpdate = (i) => this.renderSkillInfo(this.spellIds[i]);
    this.menuIndex = 0; this.menu.setIndex(0);
    this.skillInfoUpdate(0);
    this.phase = 'menu_spell';
  }

  // Render the skill-info tooltip (속성·형식·소모·예상 피해·효과·상성) for the cursored
  // spell into this.skillInfo. spellId null (the 뒤로 row) clears it.
  renderSkillInfo(spellId, target = null) {
    const c = this.skillInfo;
    if (!c) return;
    c.removeChildren();
    const spell = spellId && getSpell(spellId);
    if (!spell) return;
    const r = this.panelRect;
    const bw = r.w * 0.5, bh = r.h - 16, bx = r.x + r.w * 0.46, by = r.y + 8;
    const box = frame(bw, bh, 'bevel'); box.x = bx; box.y = by;
    c.addChild(box);
    const actor = this.actor;
    // 대상 지정 중이면 커서의 대상 기준으로 계산 (예상 피해·상성이 대상을 따라간다).
    const enemy = target || living(this.state, 'enemy')[0];
    const lx = bx + 16;
    let yy = by + 12;
    const line = (txt, col, sz) => {
      const t = label(txt, sz || FS.caption, col || HEX.text, { font: FONT.ui });
      t.x = lx; t.y = yy; c.addChild(t); yy += (sz || FS.caption) + 9; return t;
    };
    line(spell.name, HEX.gold, FS.label);
    // 속성 — colour dot + 이름
    const elem = ELEM_INFO[spell.element] || ['#cfd8ec', '무속성'];
    const dot = new PIXI.Graphics(); dot.circle(lx + 5, yy + 7, 5).fill({ color: elem[0] }); c.addChild(dot);
    line('     속성: ' + elem[1], HEX.textSoft);
    let fmt = TARGET_KR[spell.target] || spell.target;
    if (spell.hits > 1) fmt += ` · ${spell.hits}연타`;
    line('형식: ' + fmt, HEX.textSoft);
    let cost = `MP ${spell.mpCost}`;
    if (spell.hpCost) cost += ` · HP ${Math.round(spell.hpCost * 100)}%`;
    line('소모: ' + cost, HEX.textSoft);
    if (spell.kind === 'damage' && enemy) {
      const base = spell.physical ? skillDamage(spell, actor, enemy, null) : magicDamage(spell, enemy, null, actor);
      const lo = Math.floor(base * 0.9), hi = Math.ceil(base * 1.1), hits = spell.hits || 1;
      line('예상 피해: ' + (hits > 1 ? `${lo}~${hi} ×${hits} (총 ${lo * hits}~${hi * hits})` : `${lo} ~ ${hi}`), HEX.text);
    } else if (spell.kind === 'heal') {
      const amt = Math.floor(spell.power * magicScale(actor));
      line('회복량: ' + `${Math.floor(amt * 0.9)} ~ ${Math.ceil(amt * 1.1)}`, HEX.hpHigh);
    }
    const eff = this.skillEffectText(spell);
    if (eff) line('효과: ' + eff, HEX.textSoft);
    // Inflicted-status meaning (what 화상/동상/석화… actually does) — so the
    // player learns the ailment at the point of casting it.
    if (spell.inflict && statusDesc(spell.inflict)) line(`└ ${STATUS_KR[spell.inflict] || spell.inflict}: ${statusDesc(spell.inflict)}`, HEX.textMute);
    // Usage condition (그림자 일격류는 은신 필요) — green if met, red if not.
    if (spell.requiresStealth) line('조건: 은신 상태 필요', actor && actor.stealth ? HEX.hpHigh : HEX.hpLow);
    if (spell.element && spell.element !== 'physical') {
      // 도감 연동 — 조우 기록(save.seen)이 있는 몬스터만 상성 공개, 미조우는 ???.
      const seen = this.game.runtime.seen || [];
      const known = (u) => u && u.refId && seen.includes(u.refId);
      if (spell.target === 'all' && !target) {
        // 전체기: 대상별 상성 요약 (약점 N체 · 반감 M체 · 미확인 K).
        const foes = living(this.state, 'enemy');
        let weak = 0, res = 0, unk = 0;
        for (const f of foes) {
          if (!known(f)) { unk++; continue; }
          const k = affinityKind(spell.element, f.family);
          if (k === 'strong') weak++; else if (k === 'resist') res++;
        }
        const parts = [];
        if (weak) parts.push(`약점 ${weak}체`);
        if (res) parts.push(`반감 ${res}체`);
        if (unk) parts.push(`미확인 ${unk}`);
        line('상성: ' + (parts.length ? parts.join(' · ') : '● 보통'), weak ? HEX.goldGlow : HEX.textMute);
      } else if (enemy && enemy.side === 'enemy') {
        if (!known(enemy)) {
          line('상성: ??? (미조우)', HEX.textOff);
        } else if (enemy.family) {
          const k = affinityKind(spell.element, enemy.family);
          const info = k === 'strong' ? ['▲ 약점 — 피해 증가', HEX.goldGlow]
            : k === 'resist' ? ['▼ 반감 — 피해 감소', HEX.textMute] : ['● 보통', HEX.textMute];
          line('상성: ' + info[0], info[1]);
        }
      }
    }
  }

  // One-line 효과 summary (inflict / state / heal-shield-buff / crit-pierce).
  skillEffectText(spell) {
    if (spell.kind === 'state') return ({ stealth: '은신 — 다음 공격 확정 치명', rage: '분노 — 근접 피해+흡혈', charge: '충전 — 다음 주문 강화' })[spell.state] || '상태 돌입';
    if (spell.kind === 'buff') {
      if (spell.stat === 'shield') return '방어막 (피해 흡수)';
      if (spell.stat === 'eva') return '회피 상승';
      if (spell.aggro) return '도발 (적 시선 유도)';
      return (BUFF_KR[spell.stat] || spell.stat) + ' 상승';
    }
    if (spell.kind === 'cure') return '상태이상 치유';
    if (spell.kind === 'mana') return 'MP 회복';
    const parts = [];
    if (spell.inflict) parts.push(`${STATUS_KR[spell.inflict] || spell.inflict} ${Math.round((spell.inflictChance || 0.6) * 100)}%`);
    if (spell.critBonus) parts.push(`치명 +${Math.round(spell.critBonus * 100)}%`);
    if (spell.pierce) parts.push('방어 무시');
    if (spell.melee) parts.push('근접(분노 강화)');
    return parts.join(' · ');
  }

  openTarget(forAction) {
    this.targetForAction = forAction;
    const isAlly = forAction.kind === 'heal' || forAction.ally;
    let pool = living(this.state, isAlly ? 'hero' : 'enemy');
    // Mercy targeting only lists eligible (weakened, non-boss) enemies.
    if (forAction.predicate) pool = pool.filter(forAction.predicate);
    this.targetList = pool.map((u) => u.id);
    this.targetIndex = 0;
    this.phase = 'target';
    const names = this.targetList.map((id) => findUnit(this.state, id).name);
    // 주문 대상 지정: 스킬 툴팁을 옆에 유지 (panelMenu가 menuLayer를 비우므로 재생성).
    const spellTip = forAction.type === 'spell';
    this.menu = this.panelMenu(names, spellTip ? { cx: 0.26 } : {});
    if (spellTip) {
      this.skillInfo = new PIXI.Container();
      this.menuLayer.addChild(this.skillInfo);
    }
    this.menu.setIndex(0);
    this.refreshTargetGlow();
  }

  // Highlight the currently-selected target sprite with a pulsing glow.
  refreshTargetGlow() {
    this.targetGlowId = this.targetList[this.targetIndex] || null;
    // reset every unit to its rest tint; the glow is applied per-frame in tickJuice
    for (const v of this.viewOf.values()) {
      if (v.anim) continue;
      v.sprite.tint = v.unit.side === 'enemy' ? (v.unit.tint || 0xd4d4d4) : 0xffffff;
      v.root.scale.set(1);
    }
    this.showTargetPreview(); // damage band + kill skull on the hovered target
    // 주문 대상 지정 중엔 스킬 툴팁도 커서 대상 기준으로 갱신 (예상 피해·상성 동기).
    if (this.targetForAction && this.targetForAction.type === 'spell' && this.targetGlowId) {
      this.renderSkillInfo(this.targetForAction.spellId, findUnit(this.state, this.targetGlowId));
    }
  }

  clearTargetGlow() {
    this.targetGlowId = null;
    for (const v of this.viewOf.values()) {
      if (v.anim) continue;
      v.sprite.tint = v.unit.side === 'enemy' ? (v.unit.tint || 0xd4d4d4) : 0xffffff;
      v.root.scale.set(1);
    }
    this.clearTargetPreview();
  }

  applyAction(action) {
    if (!action) { advanceTurn(this.state); return this.nextTurn(); }
    this.menuLayer.removeChildren();
    // Boss heavy strike: telegraph first (charge-up glow + warning), then resolve.
    const v = action.actorId ? this.viewOf.get(action.actorId) : null;
    if (action.heavy && v && v.unit.boss) {
      v.sprite.tint = 0xff7a7a; // boss charge tint
      v.anim = { t: 0, dur: 0.5, kind: 'charge' };
      this.game.audio.play('phase');
      this.queueMsg(`${v.unit.name}가 힘을 모은다...!`);
      this.onMsgDone = () => this.resolveNow(action);
      if (this.msgTimer <= 0) this.showNextMsg();
      return;
    }
    this.resolveNow(action);
  }

  // Mid-battle minion spawn (사령 소환). The pure resolver already pushed the new
  // unit into state.units; this builds its sprite on the enemy backline. Fully
  // guarded — refreshUnits iterates viewOf, so a missing view just doesn't render
  // (the unit still acts). Units pop in instantly (entrance tween is enter-only).
  spawnSummonViews(events) {
    const news = events.filter((e) => e.type === 'summon' && !this.viewOf.has(e.unitId));
    if (!news.length) return;
    const { w, h } = this.game.renderer.screen;
    const hScale = Math.min(h / 720, 1.2);
    news.forEach((ev) => {
      const unit = findUnit(this.state, ev.unitId);
      if (!unit) return;
      const k = (this._summonSlot = (this._summonSlot || 0) + 1);
      const x = w * 0.83 - (60 + (k % 3) * 26) * hScale; // enemy backline, staggered
      const y = h * 0.28 + ((k - 1) % 4) * 70 * hScale;
      this.makeUnitView(unit, x, y, true, 106 * hScale);
      const v = this.viewOf.get(unit.id);
      if (v) {
        v.root.x = v.baseX; v.root.alpha = 1; // pop in (no walk-in tween mid-battle)
        // Necrotic materialize flash → fades back to the unit's rest tint.
        v.sprite.tint = 0xc9a0ff;
        setTimeout(() => { if (v.sprite && !v.sprite.destroyed) v.sprite.tint = v.unit.tint || 0xd4d4d4; }, 240);
      }
      this.game.audio?.play('phase');
    });
  }

  resolveNow(action) {
    // 인연공격/필살기 → 시네마틱 컷신을 먼저 재생하고, 임팩트 순간에 실제 데미지/FX를
    // 적용한다(연출과 타격 동기화). 컷신이 끝나면 메시지 + 턴 진행.
    if (action.type === 'bondStrike' && this.cutscene) { this.resolveBondCutscene(action); return; }
    // 클래스 필살기(ult 주문)도 컷신 경로로 — 1인 시네마틱.
    if (action.type === 'spell' && this.cutscene) {
      const sp = getSpell(action.spellId);
      if (sp && sp.ult) { this.resolveSpellUltCutscene(action, sp); return; }
    }
    if (action.type === 'attack' || action.type === 'spell' || action.type === 'monsterSkill') this.animateActor(action.actorId, 'attack');
    const { events } = resolveAction(this.state, action, this.game.rng);
    this.spawnSummonViews(events); // 사령 소환: build sprites for any new minions
    this.msgQueueFromEvents(events);
    if (action.type === 'spell') this.playSpellFx(action, events);
    if (action.type === 'monsterSkill') this.playMonsterSkillFx(action, events);
    if (action.type === 'bondStrike') this.playBondFx(action, events);
    if (action.type === 'mercy') this.mercyFx(events);
    this.fabulaFx(events);
    this.checkFlawFP(action, events);
    setTimeout(() => { if (!this.container.destroyed) { this.flashFromEvents(events); this.equipFx(events); this.refreshUnits(); } }, 180);
    // Phase-2 enrage check (after the hit lands).
    const enr = enrageBosses(this.state);
    for (const ev of enr) {
      this.queueMsg(ev.cry);
      const v = this.viewOf.get(ev.unitId);
      if (v) { v.sprite.tint = 0xff5050; v.anim = { t: 0, dur: 0.6, kind: 'charge' }; }
      // Phase-2 transition VFX: crimson screen flash + a 격노! banner + harder shake.
      this.enrageFlash();
      this.showPhaseBanner('격 노 !', 'enemy'); // plays the 'phase' sound itself
      this.shake(320, 6);
    }
    // 운명(Fabula) commands are FREE ACTIONS — they don't consume the actor's
    // turn. After resolving, re-open the SAME hero's command menu so they can
    // still attack/cast this turn (the FP cost, already spent in confirmFate, is
    // the gate). Everything else advances the turn as normal.
    const isFate = action.type === 'inspire' || action.type === 'lastStand' || action.type === 'rally';
    this.onMsgDone = isFate
      ? () => { this.refreshUnits(); this.openCommand(this.actor); }
      : () => { advanceTurn(this.state); this.nextTurn(); };
    if (this.msgTimer <= 0) this.showNextMsg();
  }

  // 인연공격/필살기 컷신 경로 — 컷신을 재생하고, 임팩트(전체의 ~52%)에서 resolveAction +
  // spellFx + 데미지 숫자를 적용, 컷신 종료(onDone)에 메시지 + enrage 체크 + 턴 진행.
  // bondStrike는 시전자의 턴을 소비하므로(자유행동 아님) 종료 후 advanceTurn.
  // 공유 컷신 해결 경로 — 인연기(2~4인) + 클래스 필살기(1인) 공용. cs = {title, element,
  // count, portraits}; fxFn(events)는 임팩트 때 재생할 FX(인연=playBondFx / 주문=playSpellFx).
  // 컷신 종료(onDone)에 메시지 + enrage 체크 + 턴 진행(시전자 턴 소비).
  resolveWithCutscene(action, cs, fxFn) {
    this.game.audio?.play('phase');
    let events = [];
    this.cutscene.play(
      cs,
      () => { // onImpact: 실제 타격
        events = resolveAction(this.state, action, this.game.rng).events;
        fxFn(events);
        this.flashFromEvents(events);
        this.equipFx(events);
        this.refreshUnits();
      },
      () => { // onDone: 메시지 + enrage + 턴 진행
        this.msgQueueFromEvents(events);
        const enr = enrageBosses(this.state);
        for (const ev of enr) {
          this.queueMsg(ev.cry);
          const v = this.viewOf.get(ev.unitId);
          if (v) { v.sprite.tint = 0xff5050; v.anim = { t: 0, dur: 0.6, kind: 'charge' }; }
          this.enrageFlash(); this.showPhaseBanner('격 노 !', 'enemy'); this.shake(320, 6);
        }
        this.onMsgDone = () => { advanceTurn(this.state); this.nextTurn(); };
        if (this.msgTimer <= 0) this.showNextMsg();
      },
    );
  }

  resolveBondCutscene(action) {
    const members = [action.actorId, ...(action.partnerIds || [])]
      .map((id) => findUnit(this.state, id)).filter(Boolean);
    this.resolveWithCutscene(action, {
      title: action.name || '인연공격',
      element: (action.base && action.base.element) || 'arcane',
      count: members.length, portraits: members.map((u) => this.portraitUrl(u)),
    }, (events) => this.playBondFx(action, events));
  }

  // 클래스 1인 필살기(ult 주문) 컷신 — kind:'ult', 시전자 클래스 포트레이트 1장.
  resolveSpellUltCutscene(action, spell) {
    const actor = findUnit(this.state, action.actorId);
    this.resolveWithCutscene(action, {
      title: spell.name, element: spell.element || 'arcane',
      count: 1, portraits: [this.portraitUrl(actor)],
    }, (events) => this.playSpellFx(action, events));
  }

  // Cutscene portrait art URL for a unit — recruited monster allies use their
  // /enemies sprite; real heroes use the front-facing /heroes art.
  portraitUrl(u) {
    return u && u.ally ? enemyUrl(u.sprite) : heroUrl(u && u.sprite, 'south');
  }

  // Visual flourish for Fabula (운명) effects — reuses the unit anim/tint + shake
  // system (same as mercyFx), so it's Graphics-only (no new assets).
  fabulaFx(events) {
    for (const ev of events) {
      if (ev.type === 'fabula' && ev.kind === 'inspire') {
        for (const v of this.viewOf.values()) {
          if (v.unit.side !== 'hero' || !v.unit.alive) continue;
          v.sprite.tint = 0xffe28a; v.anim = { t: 0, dur: 0.6, kind: 'charge' };
        }
        this.game.audio?.play('levelup'); this.shake(160, 4);
      } else if (ev.type === 'fabula' && ev.kind === 'lastStand') {
        const v = this.viewOf.get(ev.targetId);
        if (v) { v.sprite.tint = 0xbfe6ff; v.anim = { t: 0, dur: 0.7, kind: 'charge' }; }
        this.game.audio?.play('phase');
      } else if (ev.type === 'rally') {
        const v = this.viewOf.get(ev.targetId);
        if (v) { v.sprite.tint = 0xffe28a; v.anim = { t: 0, dur: 0.8, kind: 'recruit' }; }
        this.game.audio?.play('heal_chime'); this.shake(200, 4);
      } else if (ev.type === 'lastStand') {
        // a fatal hit survived at 1 HP — white guard flash on the survivor
        const v = this.viewOf.get(ev.unitId);
        if (v) { v.sprite.tint = 0xffffff; v.anim = { t: 0, dur: 0.4, kind: 'charge' }; }
        this.game.audio?.play('phase'); this.shake(120, 3);
      }
    }
  }

  // Trait/약점 → Fabula Point. Each hero has one flaw that, the first time it
  // manifests in a battle, banks +1 FP (the FU "invoke your flaw for drama" idea,
  // automated). knight 맹세: attacks while in Crisis. warrior 분노: takes a heavy
  // hit. huntress 통찰: casts a spell.
  checkFlawFP(action, events) {
    const award = (refId, msg) => {
      const u = this.heroUnits.find((h) => h.refId === refId);
      if (!u || !u.alive || this.flawAwarded.has(refId)) return;
      this.flawAwarded.add(refId);
      const before = this.game.runtime.fabula || 0;
      this.game.runtime.fabula = Math.min(6, before + 1);
      if (this.game.runtime.fabula > before) { this.queueMsg(msg); this.game.audio?.play('phase'); this.updateFabulaBadge(); }
    };
    const actor = action && action.actorId ? findUnit(this.state, action.actorId) : null;
    if (action && action.type === 'attack' && actor && actor.refId === 'knight' && actor.hp <= actor.maxHp * 0.5)
      award('knight', '기사는 맹세를 되새긴다 — 위기 속의 일격! ✦운명 +1');
    if (action && action.type === 'spell' && actor && actor.refId === 'huntress')
      award('huntress', '사냥꾼의 통찰이 운명을 끌어온다! ✦운명 +1');
    for (const ev of events) {
      if (ev.type === 'attack' && ev.heavy) {
        const t = findUnit(this.state, ev.targetId);
        if (t && t.refId === 'warrior') award('warrior', '전사의 분노가 타오른다! ✦운명 +1');
      }
    }
  }

  msgQueueFromEvents(events) {
    const nameOf = (id) => { const u = findUnit(this.state, id); return u ? u.name : '?'; };
    for (const ev of events) {
      if (ev.type === 'attack') this.queueMsg(`${nameOf(ev.actorId)}의 공격! ${nameOf(ev.targetId)}에게 ${ev.amount} 피해${ev.heavy ? ' (강타!)' : ''}`);
      else if (ev.type === 'castStart') { const sp = ev.monster ? getMonsterSkill(ev.spellId) : getSpell(ev.spellId); this.queueMsg(`${nameOf(ev.actorId)}는 ${sp ? sp.name : '스킬'}!`); }
      else if (ev.type === 'spellHit' || ev.type === 'monsterSkillHit') this.queueMsg(`${nameOf(ev.targetId)}에게 ${ev.amount} 피해${ev.crit ? ' (치명타!)' : ''}`);
      else if (ev.type === 'bondStrike') { const ms = [ev.actorId, ...(ev.partnerIds || [])].map(nameOf); this.queueMsg(`${ms.join(' · ')}의 인연${(ev.partnerIds || []).length >= 2 ? ' 필살기' : '공격'}!`); }
      else if (ev.type === 'bondHit') this.queueMsg(`${nameOf(ev.targetId)}에게 ${ev.amount} 피해!`);
      else if (ev.type === 'drainHeal') this.queueMsg(`${nameOf(ev.actorId)}는 ${ev.amount} HP를 흡수했다!`);
      else if (ev.type === 'monsterBuff') { const sk = getMonsterSkill(ev.spellId); this.queueMsg(ev.allies ? `${nameOf(ev.actorId)}가 전열을 고무한다 — 아군이 강해진다!` : (sk && sk.defMult) ? `${nameOf(ev.actorId)}가 ${sk.name} — 방어가 단단해진다!` : `${nameOf(ev.actorId)}가 광폭화한다 — 공격·속도 상승!`); }
      else if (ev.type === 'summon') this.queueMsg(`${nameOf(ev.actorId)}가 ${nameOf(ev.unitId)}를 소환했다!`);
      else if (ev.type === 'heal') this.queueMsg(`${nameOf(ev.targetId)}의 HP가 ${ev.amount} 회복`);
      else if (ev.type === 'mana') this.queueMsg(`${nameOf(ev.actorId)}의 MP가 ${ev.amount} 회복`);
      else if (ev.type === 'buff') this.queueMsg(`${nameOf(ev.actorId)}의 ${BUFF_KR[ev.stat] || ev.stat}이(가) 올랐다!`);
      else if (ev.type === 'shielded') this.queueMsg(`방어막이 ${ev.amount} 피해를 막았다!`);
      else if (ev.type === 'counter') this.queueMsg(`${nameOf(ev.unitId)}가 반격했다 — ${nameOf(ev.targetId)}에게 ${ev.amount} 피해!`);
      else if (ev.type === 'regen') this.queueMsg(`${nameOf(ev.unitId)}는 ${ev.hp > 0 ? `HP ${ev.hp}` : ''}${ev.hp > 0 && ev.mp > 0 ? ' / ' : ''}${ev.mp > 0 ? `MP ${ev.mp}` : ''} 회복(장신구)`);
      else if (ev.type === 'lifesteal') this.queueMsg(`${nameOf(ev.actorId)}는 ${ev.amount} HP를 흡수했다!`);
      else if (ev.type === 'hpCost') this.queueMsg(`${nameOf(ev.actorId)}는 생명력을 불태운다… (-${ev.amount} HP)`);
      else if (ev.type === 'dodge') this.queueMsg(`${nameOf(ev.targetId)}는 공격을 회피했다!`);
      else if (ev.type === 'miss') this.queueMsg(ev.reason === 'blind' ? `${nameOf(ev.actorId)}는 실명 상태 — 공격이 빗나갔다!` : `${nameOf(ev.actorId)}의 공격이 빗나갔다!`);
      else if (ev.type === 'inflictResist') this.queueMsg(`${nameOf(ev.targetId)}는 ${STATUS_KR[ev.status] || ev.status}에 저항했다!`);
      else if (ev.type === 'taunt') this.queueMsg(`${nameOf(ev.actorId)}가 적의 시선을 끈다!`);
      else if (ev.type === 'state') this.queueMsg(`${nameOf(ev.actorId)}는 ${STATE_KR[ev.state] || ev.state}!`);
      else if (ev.type === 'defend') this.queueMsg(`${nameOf(ev.actorId)}는 방어 태세!`);
      else if (ev.type === 'fizzle') this.queueMsg(ev.reason === 'stealth' ? '은신 상태에서만 쓸 수 있다!' : ev.reason === 'bond' ? '인연공격을 펼칠 수 없다!' : 'MP가 부족하다!');
      else if (ev.type === 'flee') this.queueMsg(ev.ok ? '도망쳤다!' : '도망치지 못했다!');
      else if (ev.type === 'death') this.queueMsg(`${nameOf(ev.unitId)}를 쓰러뜨렸다!`);
      else if (ev.type === 'inflict') this.queueMsg(`${nameOf(ev.targetId)}는 ${STATUS_KR[ev.status] || ev.status} 상태가 되었다!`);
      else if (ev.type === 'fabula' && ev.kind === 'inspire') this.queueMsg('운명을 비틀었다 — 모두가 고무됐다! 공격력 상승!');
      else if (ev.type === 'fabula' && ev.kind === 'lastStand') this.queueMsg(`${nameOf(ev.targetId)}는 불굴의 각오를 다졌다 — 다음 치명타를 버틴다!`);
      else if (ev.type === 'lastStand') this.queueMsg(`${nameOf(ev.unitId)}는 쓰러지지 않았다! (HP 1)`);
      else if (ev.type === 'rally') this.queueMsg(`${nameOf(ev.targetId)}가 운명의 부름에 다시 일어섰다!`);
      else if (ev.type === 'spare') this.queueMsg(`${ev.name}를 살려주었다. 안식을…`);
      else if (ev.type === 'recruit') {
        this.queueMsg(`${ev.name}가 마음을 열었다 — 동료가 되었다!`);
        const rl = getMonster(ev.refId)?.recruitLine; // bespoke join flavor, if any
        if (rl) this.queueMsg(rl);
      }
      else if (ev.type === 'recruitFail') this.queueMsg(`${ev.name}는 아직 마음을 열지 않았다!`);
      else if (ev.type === 'fizzle' && ev.reason === 'mercy') this.queueMsg('아직 자비를 베풀 수 없다.');
      else if (ev.type === 'fizzle' && ev.reason === 'recruit') this.queueMsg('이 적은 영입할 수 없다.');
    }
  }

  // Bespoke mercy feedback (design DD2): recruit = target glows gold and slides
  // toward the party side; spare = soft white fade. NOT the generic death anim.
  mercyFx(events) {
    for (const ev of events) {
      if (ev.type === 'recruit') {
        const v = this.viewOf.get(ev.targetId);
        if (v) { v.sprite.tint = NUM.mercy; v.anim = { t: 0, dur: 0.7, kind: 'recruit' }; }
        this.game.audio.play('levelup');
        this.shake(160, 3);
      } else if (ev.type === 'spare') {
        const v = this.viewOf.get(ev.targetId);
        if (v) { v.sprite.tint = 0xeaf2ff; v.anim = { t: 0, dur: 0.6, kind: 'spare' }; }
        this.game.audio.play('menu_confirm');
      } else if (ev.type === 'recruitFail') {
        const v = this.viewOf.get(ev.targetId);
        if (v) { v.sprite.tint = NUM.danger; v.anim = { t: 0, dur: 0.35, kind: 'charge' }; }
        this.game.audio.play('menu_cancel');
      }
    }
  }

  update(dt) {
    this.elapsed = (this.elapsed || 0) + dt;
    this.tickAnims(dt); // always advance animations, even during messages
    this.tickJuice(dt);
    if (this.weather) this.weather.update(dt);
    if (this.buffAura) {
      // Aura breathes while any living hero carries an attack buff (고무/warcry/
      // 애정 surge) or a one-shot 불굴 (lastStand) guard.
      const buffed = this.state.units.some((u) => u.side === 'hero' && u.alive && ((u.atkBuff || 0) > 0.001 || u.lastStand));
      this.buffAura.setActive(buffed);
      this.buffAura.update(dt);
    }
    if (this.spellFx) this.spellFx.update(dt);

    // 스킬 컷신 재생 중: everything else is locked (input, msg, turn flow). Z fast-
    // forwards. The cutscene drives the damage/FX itself via onImpact/onDone.
    if (this.cutscene && this.cutscene.active) {
      if (this.game.input.pressed('confirm')) this.cutscene.skip();
      this.cutscene.update(dt);
      return;
    }

    // Victory/defeat transition: animate the overlay, then finish (Z skips).
    if (this.phase === 'ending') {
      this.endT += dt;
      this.animEndFx(this.endT);
      const dur = this.endOutcome === 'victory' ? 1.0 : 1.25;
      if (this.endT >= dur || this.game.input.pressed('confirm')) this.finishEnd();
      return;
    }

    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.game.input.pressed('confirm') || this.msgTimer <= 0) { this.msgTimer = 0; this.showNextMsg(); }
      return;
    }
    if (this.msgQueue.length) { this.showNextMsg(); return; }

    const input = this.game.input;
    if (this.phase === 'command') this.navCommand(input);
    else if (this.phase === 'menu_spell') this.navMenu(input, () => this.confirmSpell(), () => this.openCommand(this.actor));
    else if (this.phase === 'menu_item') this.navMenu(input, () => this.confirmItem(), () => this.openCommand(this.actor));
    else if (this.phase === 'menu_mercy') this.navMenu(input, () => this.confirmMercy(), () => this.openCommand(this.actor));
    else if (this.phase === 'menu_fate') this.navMenu(input, () => this.confirmFate(), () => this.openCommand(this.actor));
    else if (this.phase === 'target') this.navTarget(input);
  }

  navCommand(input) {
    const n = this.cmdTexts.length;
    const cols = this.cmdCols || 2;
    const rows = Math.ceil(n / cols);
    let row = Math.floor(this.menuIndex / cols), col = this.menuIndex % cols;
    let moved = false;
    if (input.pressed('left') || input.pressed('right')) { col = (col + 1) % cols; moved = true; }
    if (input.pressed('down')) { row = (row + 1) % rows; moved = true; }
    if (input.pressed('up')) { row = (row + rows - 1) % rows; moved = true; }
    if (moved) {
      let idx = row * cols + col;
      if (idx >= n) idx = n - 1; // last row may be short (odd count) — clamp to it
      this.menuIndex = idx; this.highlightCommand(); this.game.audio.play('menu_cursor');
    }
    if (input.pressed('confirm')) { this.game.audio.play('menu_confirm'); this.confirmCommand(); }
  }

  navMenu(input, onConfirm, onCancel) {
    const n = this.menu.texts.length;
    const moved = input.pressed('up') || input.pressed('down');
    if (input.pressed('up')) { this.menuIndex = (this.menuIndex + n - 1) % n; this.menu.setIndex(this.menuIndex); this.game.audio.play('menu_cursor'); }
    if (input.pressed('down')) { this.menuIndex = (this.menuIndex + 1) % n; this.menu.setIndex(this.menuIndex); this.game.audio.play('menu_cursor'); }
    // Live-refresh the info panel as the cursor moves (spells + items both use it).
    if (moved && (this.phase === 'menu_spell' || this.phase === 'menu_item') && this.skillInfoUpdate) this.skillInfoUpdate(this.menuIndex);
    if (input.pressed('confirm')) {
      if (this.menu.disabled && this.menu.disabled[this.menuIndex]) { this.game.audio.play('menu_cancel'); return; } // unaffordable/blocked
      this.game.audio.play('menu_confirm'); onConfirm();
    }
    if (input.pressed('cancel') && onCancel) { this.game.audio.play('menu_cancel'); onCancel(); }
  }

  confirmCommand() {
    const choice = this.menuOptions[this.menuIndex];
    if (choice === 'attack') {
      const enemies = living(this.state, 'enemy');
      if (enemies.length === 1) this.applyAction({ type: 'attack', actorId: this.actor.id, targetId: enemies[0].id });
      else this.openTarget({ type: 'attack' });
    } else if (choice === 'spell') this.openSpellMenu();
    else if (choice === 'item') this.openItemMenu();
    else if (choice === 'mercy') {
      if (!this.mercyEnabled) { this.game.audio.play('menu_cancel'); this.queueMsg('아직 자비를 베풀 수 없다. 적을 더 약하게 만들어라.'); this.onMsgDone = () => this.openCommand(this.actor); if (this.msgTimer <= 0) this.showNextMsg(); return; }
      this.openMercyMenu();
    }
    else if (choice === 'fate') this.openFateMenu();
    else if (choice === 'defend') this.applyAction({ type: 'defend', actorId: this.actor.id });
    else if (choice === 'flee') this.applyAction({ type: 'flee', actorId: this.actor.id });
  }

  // 운명 submenu: spend Fabula Points. 고무(inspire)/불굴(lastStand) cost 1,
  // 재기(rally) costs 2 and needs a fallen ally. Unaffordable/unavailable are
  // greyed + blocked (navMenu honors disabled[]).
  openFateMenu() {
    const fp = this.game.runtime.fabula || 0;
    const koAlly = this.heroUnits.find((u) => !u.alive);
    this.fateOptions = ['inspire', 'lastStand', 'rally'];
    const labels = ['고무 — 전원 공격 +30% (1)', '불굴 — 치명타 1HP 생존 (1)', '재기 — 쓰러진 동료 부활 (2)'];
    const disabled = [fp < 1, fp < 1, fp < 2 || !koAlly];
    // 인연공격/필살기 — one row per combo the ACTOR can launch right now (pure gate:
    // bonds + affordable FP + not used this battle + partners alive). Duos (✦, 2인)
    // and trio/quad ults (★, 3·4인) share the list. 개인기 rows keep fixed indices;
    // bond rows append before 뒤로.
    const bonds = this.game.runtime.bonds || {};
    this.bondStrikeList = availableBondStrikes(this.state, bonds, fp, this.actor.refId);
    for (const entry of this.bondStrikeList) {
      const members = [this.actor.refId, ...entry.partnerRefs]
        .map((rid) => this.heroUnits.find((h) => h.refId === rid)?.name || rid);
      this.fateOptions.push('bond:' + entry.id);
      labels.push(`${entry.size >= 3 ? '★' : '✦'} ${entry.name} — ${members.join(' · ')} (${entry.cost})`);
      disabled.push(false);
    }
    labels.push('← 뒤로'); disabled.push(false);
    this.menu = this.panelMenu(labels, { disabled });
    this.menuIndex = 0; this.menu.setIndex(0);
    this.phase = 'menu_fate';
  }

  confirmFate() {
    if (this.menuIndex >= this.fateOptions.length) { this.openCommand(this.actor); return; }
    const choice = this.fateOptions[this.menuIndex];
    if (choice.startsWith('bond:')) { this.startBondStrike(choice.slice(5)); return; } // own turn-consuming path
    const cost = choice === 'rally' ? 2 : 1;
    this.game.runtime.fabula = Math.max(0, (this.game.runtime.fabula || 0) - cost);
    this.fateUsedThisTurn = true; // one free 운명 per turn — no chain-spam
    this.updateFabulaBadge();
    this.game.audio.play('levelup');
    if (choice === 'inspire') this.applyAction({ type: 'inspire', actorId: this.actor.id });
    else if (choice === 'lastStand') this.applyAction({ type: 'lastStand', actorId: this.actor.id, targetId: this.actor.id });
    else { const ko = this.heroUnits.find((u) => !u.alive); this.applyAction({ type: 'rally', actorId: this.actor.id, targetId: ko ? ko.id : this.actor.id }); }
  }

  // 인연공격/필살기: resolve the participant units + the merged rider mod, then pick a
  // target (single) or fire (AoE). FP is NOT spent yet — it's deducted in
  // commitBondStrike AFTER validation, so a cancel/fizzle never costs anything (D3).
  startBondStrike(comboId) {
    const entry = (this.bondStrikeList || []).find((e) => e.id === comboId);
    if (!entry) { this.openCommand(this.actor); return; }
    const partnerUnits = entry.partnerRefs.map((ref) => this.heroUnits.find((h) => h.refId === ref && h.alive));
    if (partnerUnits.some((u) => !u)) { this.openCommand(this.actor); return; } // a member fell since menu built
    const mod = bondModForCombo(this.game.runtime.bonds || {}, this.actor.refId, entry.partnerRefs);
    this.pendingBond = { entry, partnerIds: partnerUnits.map((u) => u.id), mod };
    if (entry.base.target === 'all') this.commitBondStrike(null);
    else this.openTarget({ type: 'bond' });
  }

  commitBondStrike(targetId) {
    const pb = this.pendingBond;
    if (!pb) { this.openCommand(this.actor); return; }
    this.pendingBond = null;
    // FP spent here — after members-alive + target validated (D3). bondStrike
    // CONSUMES the actor's turn (it's not a free 운명), so no fateUsedThisTurn.
    this.game.runtime.fabula = Math.max(0, (this.game.runtime.fabula || 0) - pb.entry.cost);
    this.updateFabulaBadge();
    this.game.audio.play('levelup');
    this.applyAction({ type: 'bondStrike', actorId: this.actor.id, partnerIds: pb.partnerIds, comboId: pb.entry.id, name: pb.entry.name, base: pb.entry.base, mod: pb.mod, targetId });
  }

  // 자비 submenu: 살림(spare) always; 영입(recruit) only if a weakened enemy is
  // recruitable. Then pick the target among mercy-eligible enemies.
  openMercyMenu() {
    this.menuLayer.removeChildren();
    const canRec = living(this.state, 'enemy').some(canRecruit);
    this.mercyModes = canRec ? ['spare', 'recruit'] : ['spare'];
    const names = canRec ? ['살려주기', '영입하기', '← 뒤로'] : ['살려주기', '← 뒤로'];
    this.menu = this.panelMenu(names);
    this.menuIndex = 0; this.menu.setIndex(0);
    this.phase = 'menu_mercy';
  }

  confirmMercy() {
    if (this.menuIndex >= this.mercyModes.length) { this.openCommand(this.actor); return; }
    const mode = this.mercyModes[this.menuIndex];
    // Only enemies eligible for THIS mode are targetable.
    this.openTarget({ type: 'mercy', mode, predicate: mode === 'recruit' ? canRecruit : canMercy });
  }

  confirmSpell() {
    const spells = this.actor.spells;
    if (this.menuIndex >= spells.length) { this.openCommand(this.actor); return; }
    const spell = getSpell(spells[this.menuIndex]);
    if (spell.target === 'self' || spell.target === 'allEnemies' || spell.target === 'allAllies') {
      this.applyAction({ type: 'spell', actorId: this.actor.id, spellId: spell.id });
    } else if (spell.kind === 'heal' || spell.kind === 'cure') {
      this.openTarget({ type: 'spell', spellId: spell.id, kind: 'heal' }); // ally select
    } else {
      this.openTarget({ type: 'spell', spellId: spell.id }); // enemy select (damage/ailment)
    }
  }

  navTarget(input) {
    const n = this.targetList.length;
    if (!n) { this.clearTargetGlow(); this.openCommand(this.actor); return; }
    if (input.pressed('up') || input.pressed('left')) { this.targetIndex = (this.targetIndex + n - 1) % n; this.menu.setIndex(this.targetIndex); this.refreshTargetGlow(); this.game.audio.play('menu_cursor'); }
    if (input.pressed('down') || input.pressed('right')) { this.targetIndex = (this.targetIndex + 1) % n; this.menu.setIndex(this.targetIndex); this.refreshTargetGlow(); this.game.audio.play('menu_cursor'); }
    if (input.pressed('cancel')) { this.clearTargetGlow(); this.openCommand(this.actor); return; }
    if (input.pressed('confirm')) {
      const targetId = this.targetList[this.targetIndex];
      this.clearTargetGlow();
      const a = this.targetForAction;
      if (a.type === 'attack') this.applyAction({ type: 'attack', actorId: this.actor.id, targetId });
      else if (a.type === 'bond') this.commitBondStrike(targetId);
      else if (a.type === 'item') this.applyItem(this.actor.id, a.itemId, targetId);
      else if (a.type === 'mercy') this.applyAction({ type: 'mercy', mode: a.mode, actorId: this.actor.id, targetId });
      else this.applyAction({ type: 'spell', actorId: this.actor.id, spellId: a.spellId, targetId });
    }
  }

  handleEnd(outcome) {
    this.menuLayer.removeChildren();
    if (outcome === 'victory') {
      // 전투 BGM을 멈추고 승리 징글 (asset — 미로드면 기존 ZzFX 팡파르 폴백).
      this.game.audio.setMusic('off');
      if (!this.game.audio.playJingle?.('victory')) this.game.audio.play('victory_fanfare');
    } else if (outcome === 'defeat') this.game.audio.play('defeat_thud');
    // Fled (or any non win/lose) ends immediately — no transition flourish.
    if (outcome !== 'victory' && outcome !== 'defeat') {
      this.phase = 'over';
      this.game.endBattle(outcome, this.state, { isBoss: this.isBoss, bossObj: this.bossObj, crisisHeroes: this.crisisAwarded ? [...this.crisisAwarded] : [] });
      return;
    }
    // Win/lose: play a short fade-in transition, then finish (skippable with Z).
    this.phase = 'ending';
    this.endOutcome = outcome;
    this.endT = 0;
    this.buildEndFx(outcome);
  }

  // Full-screen victory/defeat transition overlay (flash + verdict text).
  buildEndFx(outcome) {
    const { w, h } = this.game.renderer.screen;
    this.endFx = new PIXI.Container();
    this.endFlash = new PIXI.Graphics();
    const veil = outcome === 'victory' ? 0xfff2c0 : 0x3a0a0a;
    this.endFlash.rect(0, 0, w, h).fill({ color: veil });
    this.endFx.addChild(this.endFlash);
    const textColor = outcome === 'victory' ? HEX.gold : HEX.danger;
    this.endText = label(outcome === 'victory' ? '승리!' : '전멸…', 64,
      textColor, { font: FONT.display });
    this.endText.anchor = { x: 0.5, y: 0.5 };
    this.endText.x = w / 2; this.endText.y = h * 0.42;
    this.endFx.addChild(this.endText);
    this.container.addChild(this.endFx); // above every battle layer
  }

  animEndFx(t) {
    if (!this.endFx) return;
    if (this.endOutcome === 'victory') {
      // Bright flash that settles to a soft gold wash; text punches in.
      this.endFlash.alpha = t < 0.18 ? (t / 0.18) * 0.85 : Math.max(0.12, 0.85 - (t - 0.18) * 1.1);
      const k = Math.min(1, t / 0.32);
      this.endText.scale.set(1.4 - 0.4 * k);
      this.endText.alpha = Math.min(1, t / 0.2);
    } else {
      // Defeat: dark-red veil deepens; text fades in slowly.
      this.endFlash.alpha = Math.min(0.62, t * 0.7);
      this.endText.alpha = Math.min(1, t / 0.5);
    }
  }

  finishEnd() {
    this.phase = 'over';
    this.game.endBattle(this.endOutcome, this.state, { isBoss: this.isBoss, bossObj: this.bossObj, crisisHeroes: this.crisisAwarded ? [...this.crisisAwarded] : [] });
  }

  exit() {
    if (this.weather) this.weather.destroy();
    if (this.buffAura) this.buffAura.destroy();
    if (this.spellFx) this.spellFx.destroy();
  }
}

// Gear stat bonus (incl. per-slot 강화 levels) — canonical helper in items.js.
function equipBonus(p) { return gearBonus(p.equip); }

// Turn-based battle resolver. PURE — never imports Pixi. The renderer/scene
// reads the returned `events[]` to play animations; all state lives in plain
// objects so the whole module is unit-testable headless.
//
// Design (locked via /plan-eng-review 2026-05-29):
//   - Round-based turn order: each round, living units sorted by spd desc,
//     tie-break heroes-before-enemies then stable index. Deterministic.
//   - resolveAction(state, action, rng) mutates a passed state and returns
//     { events }. Callers clone first if they want immutability.
//   - isOver(state) -> null | 'victory' | 'defeat'.
//
// Unit shape (heroes built by progression.buildHeroUnit; enemies below):
//   { id, side:'hero'|'enemy', name, maxHp, hp, maxMp, mp, atk, def, spd,
//     spells:[], alive, defending, atkBuff, ai?, sprite }

import { getSpell } from '../content/spells.js';
import { getMonster } from '../content/monsters.js';
import { affinityMult } from './affinity.js';
import { getMonsterSkill } from '../content/monsterSkills.js';

const VARIANCE = (rng) => 0.9 + 0.2 * (rng ? rng.next() : 0.5); // ±10%

// --- Combat-state tuning (the class rework — 2026-05-29) -------------------
export const RAGE_DMG = 1.3;        // 분노: melee skill damage ×1.3
export const RAGE_LIFESTEAL = 0.3;  // 분노: heal 30% of melee skill damage dealt
export const CRIT_MULT = 1.8;       // 치명타 / 은신 기습 multiplier
export const CHARGE_MULT = 1.5;     // 충전(과부하): next magic spell ×1.5
export const STEALTH_DODGE = 0.7;   // 은신 중 회피 확률
export const EVA_DODGE = 0.5;       // 연막탄 회피 확률 (evaTurns > 0)
export const BLIND_MISS = 0.5;      // 실명(blind): a blinded attacker misses 50%
export const HIGHCRIT_CHANCE = 0.35; // 급강하(highCrit) skills crit at this rate
export const MAX_CC_SKIPS = 2;      // anti-stunlock: a unit can lose ≤2 turns in a row

// Effective def — 갑옷 파괴(defdown) softens a target's defense (×0.6).
export function effectiveDef(target) {
  const s = target.status || {};
  return target.def * (s.defdown > 0 ? 0.6 : 1);
}

// Physical damage: atk scaled by atk/(atk+def), min 1, halved if target
// defending, ×heavyMult for boss heavy strikes. atkBuff is an additive
// multiplier (warcry → +0.35). Attacker debuffs: 약화 −30%, 위협 −20%, 동상 −20%.
export function physicalDamage(attacker, target, rng, heavyMult = 1) {
  const st = attacker.status || {};
  const weak = st.weaken > 0 ? 0.7 : 1;    // 약화 debuff: atk −30%
  const adown = st.atkdown > 0 ? 0.8 : 1;  // 위협(atkdown) debuff: atk −20%
  const frost = st.freeze > 0 ? 0.8 : 1;   // 동상 debuff: atk −20% (on top of slowing)
  const atk = attacker.atk * (1 + (attacker.atkBuff || 0)) * heavyMult * weak * adown * frost;
  let dmg = atk * (atk / (atk + effectiveDef(target)));
  dmg *= VARIANCE(rng);
  if (target.defending) dmg *= 0.5;
  // 기본 공격도 장착 무기 속성의 상성을 탄다 (물리 클래스가 원소 무기로 약점을
  // 노릴 수 있게). weaponElement 없는 유닛(적·비무장)은 elementMultiplier(null)=×1.
  const affMul = elementMultiplier(attacker.weaponElement, target);
  dmg *= affMul;
  dmg *= condMult(attacker, target, affMul > 1); // 조건부 공격 패시브 (상성 뒤·크리 앞)
  return Math.max(1, Math.floor(dmg));
}

// 조건부 공격 패시브 곱연산 (스펙 파이프라인: 상성 → 조건부 → 크리). 장비/아티팩트
// passive에서 합산된 값을 읽는다. `weak`=이번 타격이 약점(▲)이었는지. passive 없으면 ×1.
//   execute: 대상 HP ≤ EXECUTE_THRESHOLD(30%) → ×(1+execute)  [처형 도끼]
//   hpBelow50: 공격자 HP ≤ 50% → ×(1+hpBelow50)               [광전사의 인장]
//   weaknessDmg: 약점 타격 시 → ×(1+weaknessDmg)              [원소 촉매]
export const EXECUTE_THRESHOLD = 0.3;
export function condMult(attacker, target, weak) {
  const p = attacker.passives; if (!p) return 1;
  let m = 1;
  if (p.execute > 0 && target.maxHp && target.hp <= target.maxHp * EXECUTE_THRESHOLD) m *= (1 + p.execute);
  if (p.hpBelow50 > 0 && attacker.maxHp && attacker.hp <= attacker.maxHp * 0.5) m *= (1 + p.hpBelow50);
  if (p.weaknessDmg > 0 && weak) m *= (1 + p.weaknessDmg);
  return m;
}

// Physical SKILL damage — atk-scaled (respects def, like a basic attack) instead
// of magic (maxMp-scaled, ignoring def). `spell.power` is bonus attack added on
// top of the attacker's atk, so a huntress/warrior skill scales with their
// STRENGTH (not mana). Honors 분노(rage melee +30%), pierce (ignore def),
// 약화/위협/동상 debuffs, defending, and elemental affinity. Pure.
// When spell.element is 'physical', uses the attacker's equipped weapon element
// (if any) to determine affinity, allowing physical classes to leverage
// elemental weapons.
export function skillDamage(spell, attacker, target, rng) {
  const st = attacker.status || {};
  const mult = (st.weaken > 0 ? 0.7 : 1) * (st.atkdown > 0 ? 0.8 : 1) * (st.freeze > 0 ? 0.8 : 1);
  // atkScale (default 1) lets a multi-hit skill (연사) weight each arrow well below
  // a full swing, so N hits ≈ one strong shot rather than N strong shots.
  const atkScale = spell.atkScale == null ? 1 : spell.atkScale;
  let atk = (attacker.atk * (1 + (attacker.atkBuff || 0)) * atkScale + (spell.power || 0)) * mult;
  if (spell.melee && attacker.rage > 0) atk *= RAGE_DMG;
  let dmg = spell.pierce ? atk * 0.7 : atk * (atk / (atk + effectiveDef(target)));
  dmg *= VARIANCE(rng);
  if (target.defending) dmg *= 0.5;
  // Apply affinity: use spell.element if set; if element is 'physical', use
  // the attacker's weaponElement (if equipped).
  const element = spell.element === 'physical' && attacker.weaponElement
    ? attacker.weaponElement
    : spell.element;
  const affMul = elementMultiplier(element, target);
  dmg *= affMul;
  dmg *= condMult(attacker, target, affMul > 1); // 처형/광전사/촉매: 물리 스킬에도 조건부 배수
  return Math.max(1, Math.floor(dmg));
}

// Magic power scales with the caster's mana depth: maxMp already grows at a
// per-class rate (huntress fastest, warrior slowest), so reusing it as the
// spell-power lever gives casters a scaling damage stat — and per-class caster
// identity — WITHOUT a new stored stat (no save-schema change). K is the
// balance tuning knob. A null / maxMp-less caster (enemy, recruited ally with
// no maxMp) falls back to ×1, the old flat behavior — keeps the resolver PURE
// and degrades gracefully. Tuned via `npm run balance` (3 passes).
export const MAGIC_SCALE_K = 15;
export function magicScale(caster) {
  return 1 + (caster && caster.maxMp ? caster.maxMp : 0) / MAGIC_SCALE_K;
}

// Elemental affinity — a spell's `element` vs the target's `family` tag. The
// table + multipliers now live in systems/affinity.js (shared with the battle UI
// so the previewed number matches the dealt number). Pure; heroes/untagged
// targets are neutral (×1).
export function elementMultiplier(element, target) {
  return affinityMult(element, target && target.family);
}

// Monster skill damage — atk-scaled like a basic attack (NOT maxMp magic, so it
// stays on the tuned encounter ladder), weighted by skill.dmgMult, with optional
// def `pierce` (fraction ignored). Honors the same attacker debuffs (약화/위협/동상),
// defending, and elemental affinity as physicalDamage. Pure.
export function monsterSkillDamage(actor, target, skill, rng) {
  const st = actor.status || {};
  const mult = (st.weaken > 0 ? 0.7 : 1) * (st.atkdown > 0 ? 0.8 : 1) * (st.freeze > 0 ? 0.8 : 1);
  const atk = actor.atk * (1 + (actor.atkBuff || 0)) * mult * (skill.dmgMult == null ? 1 : skill.dmgMult);
  const def = effectiveDef(target) * (1 - (skill.pierce || 0));
  let dmg = atk * (atk / (atk + def));
  dmg *= VARIANCE(rng);
  if (target.defending) dmg *= 0.5;
  dmg *= elementMultiplier(skill.element, target);
  return Math.max(1, Math.floor(dmg));
}

// Magic damage ignores def (so casters stay relevant). spell power is scaled by
// the caster's magicScale, then by elemental affinity vs the target's family.
export function magicDamage(spell, target, rng, caster) {
  let dmg = spell.power * magicScale(caster) * VARIANCE(rng);
  const affMul = elementMultiplier(spell.element, target);
  dmg *= affMul;
  const p = caster && caster.passives;
  if (p) {
    if (p.spellDmg > 0) dmg *= (1 + p.spellDmg);              // 현자의 눈: 주문 위력
    if (p.weaknessDmg > 0 && affMul > 1) dmg *= (1 + p.weaknessDmg); // 원소 촉매: 약점 주문 강화
  }
  if (target.defending) dmg *= 0.5;
  return Math.max(1, Math.floor(dmg));
}

// Default HP fraction at/below which an enemy can be shown mercy (spared or
// recruited). Per-monster override via `mercyThreshold` in monsters.js.
export const MERCY_THRESHOLD = 0.3;

// Shared unit factory — every battle unit (hero / enemy / ally) carries the
// same base shape. hero/enemy/ally builders override the fields that differ.
// Extracting this keeps the three builders from drifting when a field is added.
export function makeUnit(over) {
  return {
    side: 'enemy',
    maxMp: 0,
    mp: 0,
    spells: [],
    status: {},
    alive: true,
    defending: false,
    atkBuff: 0,
    lastStand: false, // Fabula 불굴: survive the next lethal hit at 1 HP (one-shot)
    // --- Combat states (class rework). Pure — resolved entirely in battle.js. ---
    stealth: false,   // 은신 (hunter): next damaging skill = guaranteed crit; dodge until acts
    rage: 0,          // 분노 (warrior): turns of melee +dmg + lifesteal
    charge: false,    // 충전 (mage): next magic spell amplified ×CHARGE_MULT
    shield: 0,        // 방어막 absorb pool (masbarrier / manashield) — soaks damage first
    evaTurns: 0,      // 연막탄 회피 turns (EVA_DODGE chance while > 0)
    aggro: false,     // 도발 (taunt): enemy AI prefers this target
    summoned: false,  // 사령 소환으로 생성된 유닛: no xp/gold, unspareable, unslain-tallied
    // --- Monster skills (enemy-side kit). skills: [{id,chance,cd,max?}] from
    // monsters.js; _cd/_used track per-battle cooldown + use counts. Ticked once
    // per round in startRound. Heroes leave skills null. ---
    skills: null,
    _cd: {},
    _used: {},
    _ccSkips: 0,      // consecutive CC-skipped turns (anti-stunlock, see tickStatus)
    // Equipment passive effects (accessory特수효과). Merged from equipped gear at
    // build time (progression.equipPassives) — a plain data bag the resolver reads
    // at hook points (startRound regen / dealDamage dmgReduce / applyStatus resist /
    // attack counter / rollCrit). Enemies + allies default to {} → every hook no-ops.
    // Shape: { resist:{poison:0.5,…}, regenHp, regenMp, counter, crit, dmgReduce }.
    passives: {},
    ...over,
  };
}

let _enemyCounter = 0;
// Build an enemy unit from a monster id. Unique id even for duplicate types.
export function buildEnemyUnit(monsterId, opts = {}) {
  const m = getMonster(monsterId);
  if (!m) return null;
  return makeUnit({
    id: opts.id || `e${++_enemyCounter}`,
    refId: monsterId,
    name: m.name,
    side: 'enemy',
    maxHp: m.maxHp,
    hp: m.maxHp,
    atk: m.atk,
    def: m.def,
    spd: m.spd,
    ai: m.ai || 'attack',
    boss: !!m.boss,
    sprite: m.sprite,
    xp: m.xp,
    gold: m.gold,
    phase2: m.phase2 || null,
    enraged: false,
    // Palette-swap visuals (cosmetic only — battleScene reads these). A monster
    // can reuse an existing sprite key with a distinct tint/scale to read as a
    // new creature (JRPG-style recolour); the resolver never touches them.
    tint: m.tint || null,            // hex recolour multiplier (null = default lift)
    spriteScale: m.spriteScale || 1, // size multiplier vs the base sprite
    inflict: m.inflict || null, // {status, chance} applied on this enemy's hits
    family: m.family || null,   // 'undead'|'icy'|'fiery' — elemental affinity tag
    skills: m.skills || null,   // [{id,chance,cd,max?}] — enemy skill kit (monsterSkills.js)
    // Mercy gating: bosses are normally never spareable/recruitable, but a boss
    // can opt IN via `spareable: true` (a story boss the player may show mercy —
    // e.g. 늪의 마녀's 자비/처단 갈림). `recruitable` honors an explicit override
    // so a spareable boss can also join; else defaults to non-boss + opt-out.
    mercyThreshold: m.mercyThreshold != null ? m.mercyThreshold : MERCY_THRESHOLD,
    spareable: !!m.spareable,
    recruitable: m.recruitable != null ? !!m.recruitable : (!m.boss && m.recruitable !== false),
    _bossTick: 0,
  });
}

// Mercy eligibility — pure predicates the battle UI uses to gate the 자비 menu
// option and the renderer/scene uses to decide spare-vs-recruit availability.
// An enemy can be shown mercy once weakened to its HP threshold; bosses never.
export function canMercy(target) {
  return !!(target && target.side === 'enemy' && target.alive && (!target.boss || target.spareable) && !target.summoned
    && target.hp <= target.maxHp * (target.mercyThreshold != null ? target.mercyThreshold : MERCY_THRESHOLD));
}
export function canRecruit(target) {
  return canMercy(target) && target.recruitable !== false;
}

// --- Status ailments (apply to heroes AND enemies — same code both ways) ---
//   poison (DoT 8%/turn), sleep (skip turn, 45% wake/turn), weaken (atk -30%),
//   burn (DoT 6%/turn — fire element), shock (30%/turn paralysis skip — thunder),
//   freeze (동상 — spd ×0.5 in turn order + atk −20%, ice element).
// burn/sleep/shock are the "skip or chip" family; weaken/freeze are debuffs.
// Plus the physical-debuff trio from the class rework: atkdown (위협 −20% atk),
// defdown (갑옷 파괴 ×0.6 def), slow (둔화 — half turn-speed, no atk penalty).
// Bestiary-2 CC (2026-05-30): petrify (석화 — full turn skip, no self-wake, longer
// than freeze; cleanse-curable), stun (기절 — 1-turn skip), blind (실명 — attacker
// misses 50%, no skip). All gated by the MAX_CC_SKIPS anti-stunlock cap.
export const STATUS_TYPES = ['poison', 'sleep', 'weaken', 'burn', 'shock', 'freeze', 'atkdown', 'defdown', 'slow', 'petrify', 'stun', 'blind', 'bleed'];
// Stacking rule (LOCKED 2026-05-30): re-applying a status REFRESHES to the longer
// remaining duration (Math.max) — it does NOT accumulate turns or multiply DoT damage.
// So poison/burn/bleed are kept up by re-applying but never snowball into a runaway
// stack (a 출혈 spammer can't pile 3+ bleeds for triple ticks). Damage per tick is a
// fixed % of maxHp regardless of how many times applied. Intentional anti-stack.
export function applyStatus(unit, type, turns) {
  unit.status = unit.status || {};
  // 언데드는 출혈(bleed) 면역 — 피가 없다 (쌍검사 출혈 빌드의 후반 카운터). 다른 상태는 정상.
  if (type === 'bleed' && unit.family === 'undead') return;
  unit.status[type] = Math.max(unit.status[type] || 0, turns);
}
// Effective speed for turn-order: 동상(freeze) or 둔화(slow) halves it (acts later).
export function effectiveSpd(unit) {
  const s = unit.status || {};
  return (s.freeze > 0 || s.slow > 0) ? unit.spd * 0.5 : unit.spd;
}
export function cureStatus(unit, type) {
  if (unit.status && unit.status[type]) { delete unit.status[type]; return true; }
  return false;
}
// Process a unit's statuses at the start of its turn. Returns { events, skip }.
export function tickStatus(unit, rng) {
  const events = [];
  let skip = false;
  const s = unit.status || (unit.status = {});
  // DoT family — poison (8%, 자연/마법) · burn (6%, 화염) · bleed (6%, 물리/쌍검사);
  // each ticks in order, any can be the killing tick.
  const DOT_EVENT = { poison: 'poisonTick', burn: 'burnTick', bleed: 'bleedTick' };
  for (const [key, frac] of [['poison', 0.08], ['burn', 0.06], ['bleed', 0.06]]) {
    if (s[key] > 0) {
      const dmg = Math.max(2, Math.round(unit.maxHp * frac));
      unit.hp = Math.max(0, unit.hp - dmg);
      events.push({ type: DOT_EVENT[key], unitId: unit.id, amount: dmg });
      s[key]--; if (s[key] <= 0) delete s[key];
      if (unit.hp === 0) { unit.alive = false; events.push({ type: 'death', unitId: unit.id }); return { events, skip }; }
    }
  }
  if (s.sleep > 0) {
    if (rng && rng.next() < 0.45) { delete s.sleep; events.push({ type: 'wake', unitId: unit.id }); }
    else { s.sleep--; skip = true; events.push({ type: 'asleep', unitId: unit.id }); if (s.sleep <= 0) delete s.sleep; }
  }
  // shock (감전): paralysis — 30%/turn the unit can't act. Doesn't self-wake like
  // sleep; just ticks down. Stacks with sleep (either can cause the skip).
  if (s.shock > 0) {
    if (rng && rng.next() < 0.3) { skip = true; events.push({ type: 'paralyzed', unitId: unit.id }); }
    s.shock--; if (s.shock <= 0) delete s.shock;
  }
  // 석화(petrify) / 기절(stun): deterministic full-turn skips (no self-wake).
  // petrify is the longer, cleanse-gated lockdown; stun is the brief 1-turn kind.
  if (s.petrify > 0) { skip = true; events.push({ type: 'petrified', unitId: unit.id }); s.petrify--; if (s.petrify <= 0) delete s.petrify; }
  if (s.stun > 0) { skip = true; events.push({ type: 'stunned', unitId: unit.id }); s.stun--; if (s.stun <= 0) delete s.stun; }
  // Plain duration debuffs (no per-turn effect beyond expiring): 약화/동상/위협/방어파괴/둔화/실명.
  for (const k of ['weaken', 'freeze', 'atkdown', 'defdown', 'slow', 'blind']) {
    if (s[k] > 0) { s[k]--; if (s[k] <= 0) delete s[k]; }
  }
  // Anti-stunlock: a unit may lose at most MAX_CC_SKIPS turns in a row. On the
  // cap it shakes off the deterministic skippers (sleep/petrify/stun) and acts,
  // so stacked CC can't freeze a hero out of the whole fight.
  if (skip) {
    unit._ccSkips = (unit._ccSkips || 0) + 1;
    if (unit._ccSkips > MAX_CC_SKIPS) {
      skip = false; unit._ccSkips = 0;
      for (const k of ['sleep', 'petrify', 'stun']) delete s[k];
      events.push({ type: 'shakeOff', unitId: unit.id });
    }
  } else {
    unit._ccSkips = 0;
  }
  // Combat-state countdowns (the unit's OWN states, ticked at the start of its turn).
  if (unit.rage > 0) { unit.rage--; if (unit.rage <= 0) events.push({ type: 'rageEnd', unitId: unit.id }); }
  if (unit.evaTurns > 0) unit.evaTurns--;
  return { events, skip };
}

// Phase-2 enrage: any living boss whose HP has crossed its phase2 threshold and
// hasn't enraged yet powers up (atk×mult, +spd, partial heal). Pure — returns
// enrage events for the renderer/UI. Call after each resolved action.
export function enrageBosses(state) {
  const events = [];
  for (const u of state.units) {
    if (!u.alive || !u.phase2 || u.enraged) continue;
    if (u.hp <= u.maxHp * u.phase2.at) {
      u.enraged = true;
      u.atk = Math.round(u.atk * (u.phase2.atkMult || 1.4));
      u.spd += (u.phase2.spdBonus || 0);
      if (u.phase2.heal) u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * u.phase2.heal));
      // Phase-2 skill swap: a boss can trade its P1 kit for a fiercer P2 set on
      // enrage (cooldowns reset so the new kit fires immediately).
      if (u.phase2.skills) { u.skills = u.phase2.skills; u._cd = {}; }
      events.push({ type: 'enrage', unitId: u.id, cry: u.phase2.cry || `${u.name}가 분노한다!` });
    }
  }
  return events;
}

export function createBattle(heroUnits, enemyUnits) {
  const units = [...heroUnits, ...enemyUnits];
  // bondStrikeUsed: the once-per-battle gate for 인연공격 (bondSkills.js). MUST be
  // pre-initialized here — the scene hides the 운명 menu's bond rows when it's true,
  // and an undefined flag (undefined !== true) would let the row re-appear.
  const state = { units, turnOrder: [], turnIndex: 0, round: 0, outcome: null, fled: false, bondStrikeUsed: false };
  startRound(state);
  return state;
}

export function living(state, side) {
  return state.units.filter((u) => u.alive && (!side || u.side === side));
}

export function findUnit(state, id) {
  return state.units.find((u) => u.id === id) || null;
}

// Build the turn order for a new round as a single INTERLEAVED initiative track:
// every living unit (heroes + enemies) races by spd desc, so a fast enemy can act
// BEFORE a slow hero instead of waiting out a whole player phase. Ties break
// heroes-before-enemies, then stable original index. This is what lets swift mobs
// (frost_crow/swamp_runner/spirit_guard) land hits before the party culls them —
// the "trash should threaten" fix (2026-05-29; replaced a side-phased "all heroes
// then all enemies" order, and restores the module-header design). Resets per-round
// flags (defending).
export function startRound(state) {
  state.round += 1;
  for (const u of state.units) {
    u.defending = false;
    // Monster-skill cooldowns tick down once per round (responsibility kept out
    // of tickStatus, which handles ailments per-actor-turn).
    if (u._cd) for (const k in u._cd) if (u._cd[k] > 0) u._cd[k]--;
  }
  const sideRank = (u) => (u.side === 'hero' ? 0 : 1);
  const bySpd = (a, b) => {
    const sa = effectiveSpd(a.u), sb = effectiveSpd(b.u); // 동상 slows turn order
    return sb !== sa ? sb - sa
      : sideRank(a.u) !== sideRank(b.u) ? sideRank(a.u) - sideRank(b.u)
        : a.idx - b.idx;
  };
  const withIdx = (u) => ({ u, idx: state.units.indexOf(u) });
  const order = living(state).map(withIdx).sort(bySpd).map((x) => x.u.id);
  state.turnOrder = order;
  state.turnIndex = 0;
  // 장신구 재생(regen) passive — once per round, before anyone acts. Heals a
  // fraction of max, clamped to max (no overheal). Events stashed on state for the
  // scene to drain at the round-flip (resolver stays pure; no events param here).
  const regenEvents = [];
  for (const u of living(state)) {
    const p = u.passives;
    if (!p) continue;
    let hp = 0, mp = 0;
    if (p.regenHp && u.hp < u.maxHp) { hp = Math.min(u.maxHp - u.hp, Math.floor(u.maxHp * p.regenHp)); u.hp += hp; }
    if (p.regenMp && u.mp < u.maxMp) { mp = Math.min(u.maxMp - u.mp, Math.floor(u.maxMp * p.regenMp)); u.mp += mp; }
    if (hp > 0 || mp > 0) regenEvents.push({ type: 'regen', unitId: u.id, hp, mp });
  }
  state.roundEvents = regenEvents;
  return order;
}

// Which side acts at the current turn index ('hero' | 'enemy' | null).
export function currentPhase(state) {
  const a = state.turnOrder[state.turnIndex];
  const u = a ? findUnit(state, a) : null;
  return u ? u.side : null;
}

// The unit whose turn it is (skips any that died earlier this round).
export function currentActor(state) {
  while (state.turnIndex < state.turnOrder.length) {
    const u = findUnit(state, state.turnOrder[state.turnIndex]);
    if (u && u.alive) return u;
    state.turnIndex++;
  }
  return null;
}

// Advance to the next actor; if the round is exhausted, start a new round.
export function advanceTurn(state) {
  state.turnIndex++;
  if (!currentActor(state)) startRound(state);
  return currentActor(state);
}

export function isOver(state) {
  if (state.fled) return 'fled';
  if (living(state, 'hero').length === 0) return 'defeat';
  if (living(state, 'enemy').length === 0) return 'victory';
  return null;
}

// Enemy AI: choose an action for the given enemy actor. 'attack' picks a random
// living hero. 'boss' does a heavy strike every 3rd action.
export function enemyChooseAction(state, actorId, rng) {
  const actor = findUnit(state, actorId);
  const heroes = living(state, 'hero');
  if (!actor || heroes.length === 0) return null;
  // 도발(taunt): a taunting hero soaks aggro — enemies must target a taunter if any.
  const taunters = heroes.filter((h) => h.aggro);
  const pool = taunters.length ? taunters : heroes;
  const target = rng ? rng.pick(pool) : pool[0];
  // Skill kit: before the basic-attack default, roll each ready skill (off
  // cooldown + under its per-battle `max`). First to pass its `chance` fires.
  // Mirrored automatically by the balance harness (it reuses this fn). Pure.
  if (actor.skills && actor.skills.length) {
    const allyCount = living(state, actor.side).length;
    const ready = actor.skills.filter((s) => {
      if ((actor._cd[s.id] || 0) > 0) return false;
      if (s.max != null && (actor._used[s.id] || 0) >= s.max) return false;
      // 전열 고무(allybuff): pointless when the caster fights alone — skip it so a
      // lone war_drummer attacks instead of buffing only itself.
      const def = getMonsterSkill(s.id);
      if (def && def.kind === 'allybuff' && allyCount < 2) return false;
      return true;
    });
    for (const s of ready) {
      if ((rng ? rng.next() : 1) < (s.chance || 0)) {
        actor._cd[s.id] = s.cd || 0;
        actor._used[s.id] = (actor._used[s.id] || 0) + 1;
        return { type: 'monsterSkill', actorId, skillId: s.id, targetId: target.id };
      }
    }
  }
  let heavy = false;
  if (actor.ai === 'boss') {
    actor._bossTick = (actor._bossTick || 0) + 1;
    // Enraged (phase 2) bosses strike heavy more often (every 2nd vs 3rd).
    heavy = actor._bossTick % (actor.enraged ? 2 : 3) === 0;
  }
  return { type: 'attack', actorId, targetId: target.id, heavy };
}

// 회피 roll — 은신(stealth) or 연막탄(evaTurns) lets a unit dodge an incoming
// physical attack entirely. rng-less (deterministic tests) never dodges.
function tryDodge(target, rng) {
  const ch = target.stealth ? STEALTH_DODGE : (target.evaTurns > 0 ? EVA_DODGE : 0);
  return ch > 0 && (rng ? rng.next() : 1) < ch;
}

// 실명(blind) accuracy roll — a blinded attacker's damaging action misses
// BLIND_MISS of the time. rng-less (deterministic tests) never misses.
function blindMiss(actor, rng) {
  return actor.status && actor.status.blind > 0 && rng && rng.next() < BLIND_MISS;
}

// Resolve one action. Mutates state, returns { events }.
// Crit roll — 은신 기습은 확정 크리, 그 외엔 base 확률 + 장신구 passives.crit(가산).
// 기본공격(base 0)과 주문(base = spell.critBonus)이 같은 헬퍼를 써서 갈라지지 않게.
function rollCrit(actor, base, rng) {
  if (actor.stealth) return true;
  const ch = (base || 0) + ((actor.passives && actor.passives.crit) || 0);
  return ch > 0 && rng && rng.next() < ch;
}

// Inflict-chance multiplier after the target's equip resist passive (resist[status]
// is a 0..0.9 reduction → mult 1..0.1). Pure; used at every status-infliction roll.
function resistMult(target, status) {
  const r = target.passives && target.passives.resist && target.passives.resist[status];
  return r ? Math.max(0, 1 - r) : 1;
}

// action types: attack | spell | defend | flee | mercy | inspire | lastStand | rally
export function resolveAction(state, action, rng) {
  const events = [];
  const actor = findUnit(state, action.actorId);
  if (!actor || !actor.alive) return { events };

  if (action.type === 'attack') {
    const target = findUnit(state, action.targetId);
    if (!target || !target.alive) return { events };
    if (blindMiss(actor, rng)) {
      events.push({ type: 'miss', actorId: actor.id, targetId: target.id, reason: 'blind' });
      return { events };
    }
    if (tryDodge(target, rng)) {
      events.push({ type: 'dodge', actorId: actor.id, targetId: target.id });
      return { events };
    }
    let dmg = physicalDamage(actor, target, rng, action.heavy ? 1.6 : 1);
    // 은신 기습 확정 크리 + 장신구 crit passive (rollCrit). 은신은 아래서 소비.
    const crit = rollCrit(actor, 0, rng);
    if (crit) dmg = Math.floor(dmg * CRIT_MULT);
    events.push({ type: 'attack', actorId: actor.id, targetId: target.id, amount: dmg, heavy: !!action.heavy, crit });
    dealDamage(state, target, dmg, events);
    applyOnHit(state, actor, target, dmg, true, events); // 흡혈/가시 (기본공격=근접)
    // 반격(counter) passive (v1: 기본공격 피격만). 반격은 직접 dealDamage라 재반격
    // 없음(재귀 가드). 살아있는 반대편 피격자만 — 죽으면 반격 없음.
    if (target.alive && target.side !== actor.side && actor.alive
        && target.passives && target.passives.counter > 0 && rng && rng.next() < target.passives.counter) {
      const cdmg = physicalDamage(target, actor, rng, 1);
      events.push({ type: 'counter', unitId: target.id, targetId: actor.id, amount: cdmg });
      dealDamage(state, actor, cdmg, events);
    }
    if (actor.stealth) { actor.stealth = false; events.push({ type: 'stateEnd', actorId: actor.id, state: 'stealth' }); }
    // On-hit status infliction (enemy kits: spider→poison, etc.) — target's equip
    // resist passive lowers the chance; a roll that lands in the resisted band
    // emits a `resist` event (the charm saved them).
    const infl = actor.inflict;
    const iroll = infl && target.alive && rng ? rng.next() : 1;
    if (infl && target.alive && iroll < infl.chance * resistMult(target, infl.status)) {
      applyStatus(target, infl.status, infl.turns || 3);
      events.push({ type: 'inflict', targetId: target.id, status: infl.status });
    } else if (infl && target.alive && iroll < infl.chance) {
      events.push({ type: 'inflictResist', targetId: target.id, status: infl.status }); // charm saved them
    }
  } else if (action.type === 'spell') {
    const spell = getSpell(action.spellId);
    if (!spell) return { events };
    // 그림자 일격류는 은신 상태에서만 — backstop for the UI gate (no MP spent).
    if (spell.requiresStealth && !actor.stealth) { events.push({ type: 'fizzle', actorId: actor.id, reason: 'stealth' }); return { events }; }
    if (actor.mp < spell.mpCost) { events.push({ type: 'fizzle', actorId: actor.id, reason: 'mp' }); return { events }; }
    actor.mp -= spell.mpCost;
    events.push({ type: 'castStart', actorId: actor.id, spellId: spell.id });
    if (spell.kind === 'damage') {
      const targets = spell.target === 'allEnemies' ? living(state, 'enemy')
        : [findUnit(state, action.targetId)].filter((t) => t && t.alive);
      // 충전(과부하) amplifies the next MAGIC spell only (physical skills are unaffected).
      const charged = actor.charge && !spell.physical;
      const hits = spell.hits || 1; // 연사(multishot) = multi-strike
      for (const t of targets) {
        if (blindMiss(actor, rng)) { events.push({ type: 'miss', actorId: actor.id, targetId: t.id, reason: 'blind' }); continue; }
        for (let h = 0; h < hits && t.alive; h++) {
          let dmg = spell.physical ? skillDamage(spell, actor, t, rng) : magicDamage(spell, t, rng, actor);
          if (charged) dmg = Math.floor(dmg * CHARGE_MULT);
          // 치명타: 은신 기습 확정 + critBonus + 장신구 crit passive (rollCrit).
          const crit = rollCrit(actor, spell.critBonus || 0, rng);
          if (crit) dmg = Math.floor(dmg * CRIT_MULT);
          events.push({ type: 'spellHit', actorId: actor.id, targetId: t.id, spellId: spell.id, amount: dmg, crit: !!crit });
          dealDamage(state, t, dmg, events);
          // 분노 흡혈: melee skills heal the warrior for a fraction of damage dealt.
          if (spell.melee && actor.rage > 0 && actor.alive) {
            const heal = Math.max(1, Math.floor(dmg * RAGE_LIFESTEAL));
            const before = actor.hp; actor.hp = Math.min(actor.maxHp, actor.hp + heal);
            if (actor.hp > before) events.push({ type: 'lifesteal', actorId: actor.id, amount: actor.hp - before });
          }
        }
        if (t.alive && spell.inflict && rng && rng.next() < (spell.inflictChance || 0.6)) {
          applyStatus(t, spell.inflict, spell.inflictTurns || 3);
          events.push({ type: 'inflict', targetId: t.id, status: spell.inflict });
        }
      }
      if (charged) { actor.charge = false; events.push({ type: 'stateEnd', actorId: actor.id, state: 'charge' }); }
      if (actor.stealth) { actor.stealth = false; events.push({ type: 'stateEnd', actorId: actor.id, state: 'stealth' }); }
    } else if (spell.kind === 'heal') {
      const targets = spell.target === 'allAllies' ? living(state, 'hero') : [findUnit(state, action.targetId) || actor];
      for (const t of targets) {
        const amt = Math.floor(spell.power * magicScale(actor) * VARIANCE(rng));
        const before = t.hp;
        t.hp = Math.min(t.maxHp, t.hp + amt);
        events.push({ type: 'heal', actorId: actor.id, targetId: t.id, amount: t.hp - before });
      }
    } else if (spell.kind === 'buff') {
      const targets = spell.target === 'allAllies' ? living(state, 'hero')
        : spell.target === 'oneAlly' ? [findUnit(state, action.targetId) || actor] : [actor];
      for (const t of targets) {
        if (spell.stat === 'def') { t.def += spell.power; events.push({ type: 'buff', actorId: t.id, stat: 'def', amount: spell.power }); }
        else if (spell.stat === 'spd') { t.spd += spell.power; events.push({ type: 'buff', actorId: t.id, stat: 'spd', amount: spell.power }); }
        else if (spell.stat === 'shield') { t.shield = (t.shield || 0) + spell.power; events.push({ type: 'buff', actorId: t.id, stat: 'shield', amount: spell.power }); }
        else if (spell.stat === 'eva') { t.evaTurns = Math.max(t.evaTurns || 0, spell.power); events.push({ type: 'buff', actorId: t.id, stat: 'eva', amount: spell.power }); }
        else { t.atkBuff = (t.atkBuff || 0) + spell.power; events.push({ type: 'buff', actorId: t.id, stat: 'atk', amount: spell.power }); }
      }
      // 도발(taunt): the caster soaks enemy aggro for the rest of the battle.
      if (spell.aggro) { actor.aggro = true; events.push({ type: 'taunt', actorId: actor.id }); }
      // 연막탄: also blinds enemies (atkdown) so they hit softer while the smoke holds.
      if (spell.debuffEnemyAcc) for (const e of living(state, 'enemy')) { applyStatus(e, 'atkdown', 2); events.push({ type: 'inflict', targetId: e.id, status: 'atkdown' }); }
    } else if (spell.kind === 'mana') {
      // 명상: restore the caster's MP. If power < 1, treat as % of maxMp (flat cap);
      // otherwise scale with magicScale. This prevents infinite looping on zero-cost
      // mana restoration (meditate).
      const restore = spell.power < 1
        ? Math.floor(actor.maxMp * spell.power)
        : Math.floor(spell.power * magicScale(actor) * VARIANCE(rng));
      const before = actor.mp; actor.mp = Math.min(actor.maxMp, actor.mp + restore);
      events.push({ type: 'mana', actorId: actor.id, amount: actor.mp - before });
    } else if (spell.kind === 'state') {
      // Enter a combat state (은신/분노/충전). 분노 pays an HP cost (피의 갈증).
      if (spell.hpCost) {
        const cost = Math.max(1, Math.floor(actor.maxHp * spell.hpCost));
        actor.hp = Math.max(1, actor.hp - cost);
        events.push({ type: 'hpCost', actorId: actor.id, amount: cost });
      }
      if (spell.state === 'stealth') actor.stealth = true;
      else if (spell.state === 'charge') actor.charge = true;
      else if (spell.state === 'rage') actor.rage = spell.turns || 3;
      events.push({ type: 'state', actorId: actor.id, state: spell.state });
    } else if (spell.kind === 'ailment') {
      const targets = spell.target === 'allEnemies' ? living(state, 'enemy')
        : [findUnit(state, action.targetId)].filter((t) => t && t.alive);
      for (const t of targets) {
        applyStatus(t, spell.status, spell.turns || 3);
        events.push({ type: 'inflict', targetId: t.id, status: spell.status });
      }
    } else if (spell.kind === 'cure') {
      const targets = spell.target === 'allAllies' ? living(state, 'hero') : [findUnit(state, action.targetId) || actor];
      for (const t of targets) {
        let any = false;
        for (const st of STATUS_TYPES) if (cureStatus(t, st)) any = true;
        events.push({ type: 'cure', actorId: actor.id, targetId: t.id, ok: any });
      }
    }
  } else if (action.type === 'monsterSkill') {
    return resolveMonsterSkill(state, actor, action, rng);
  } else if (action.type === 'defend') {
    actor.defending = true;
    events.push({ type: 'defend', actorId: actor.id });
  } else if (action.type === 'flee') {
    // Flee chance scales with party vs enemy speed. Heroes only.
    const heroSpd = living(state, 'hero').reduce((s, u) => s + u.spd, 0);
    const enemySpd = living(state, 'enemy').reduce((s, u) => s + u.spd, 0) || 1;
    const ok = (rng ? rng.next() : 0.5) < heroSpd / (heroSpd + enemySpd);
    events.push({ type: 'flee', actorId: actor.id, ok });
    if (ok) state.fled = true;
  } else if (action.type === 'mercy') {
    // Spare or recruit a weakened enemy. action.mode = 'spare' | 'recruit'.
    const target = findUnit(state, action.targetId);
    if (!canMercy(target)) { events.push({ type: 'fizzle', actorId: actor.id, reason: 'mercy' }); return { events }; }
    if (action.mode === 'recruit') {
      if (!canRecruit(target)) { events.push({ type: 'fizzle', actorId: actor.id, reason: 'recruit' }); return { events }; }
      // Recruit chance scales with how weakened the target is (1 - hp/maxHp):
      // a near-dead enemy is almost certain, a just-eligible one is a coin flip.
      const chance = 1 - target.hp / target.maxHp;
      const ok = (rng ? rng.next() : 0.5) < chance;
      if (ok) {
        target.alive = false;          // leaves the enemy side (isOver victory works)
        target.resolved = 'recruited';  // kept in state.units so spoils still grants xp
        state.mercied = (state.mercied || 0) + 1;
        state.recruited = (state.recruited || 0) + 1;
        events.push({ type: 'recruit', targetId: target.id, refId: target.refId, name: target.name });
      } else {
        events.push({ type: 'recruitFail', targetId: target.id, name: target.name }); // turn consumed
      }
    } else {
      // Default: spare. Enemy leaves peacefully; counts as a mercy for the ending.
      target.alive = false;
      target.resolved = 'spared';
      state.mercied = (state.mercied || 0) + 1;
      events.push({ type: 'spare', targetId: target.id, name: target.name });
    }
  } else if (action.type === 'inspire') {
    // Fabula 고무: rally the party — every living hero gains +30% atk for the
    // rest of the battle (reuses the additive atkBuff path warcry uses).
    for (const t of living(state, 'hero')) {
      t.atkBuff = (t.atkBuff || 0) + 0.3;
      events.push({ type: 'buff', actorId: t.id, stat: 'atk', amount: 0.3 });
    }
    events.push({ type: 'fabula', kind: 'inspire', actorId: actor.id });
  } else if (action.type === 'lastStand') {
    // Fabula 불굴: the target braces — the next lethal hit leaves it at 1 HP.
    const t = findUnit(state, action.targetId) || actor;
    t.lastStand = true;
    events.push({ type: 'fabula', kind: 'lastStand', targetId: t.id });
  } else if (action.type === 'rally') {
    // Fabula 재기: revive a fallen hero at 15% HP (clears its ailments). A clutch
    // second chance, not a full reset — the revived hero is fragile and needs a
    // heal/herb to stabilize (mercy-ceiling nerf 2026-05-29; was 30%, made the
    // mercy build a zero-attrition free pass on bosses — see TODOS).
    const t = findUnit(state, action.targetId);
    if (t && t.side === 'hero' && !t.alive) {
      t.alive = true;
      t.hp = Math.max(1, Math.round(t.maxHp * 0.15));
      t.status = {};
      // Record the rescue so the run can deepen 애정(affection) between the pair.
      (state.revives = state.revives || []).push([actor.id, t.id]);
      events.push({ type: 'rally', targetId: t.id });
    } else {
      events.push({ type: 'fizzle', actorId: actor.id, reason: 'rally' });
    }
  } else if (action.type === 'bondStrike') {
    // 인연공격/필살기 (duo + trio/quad ult). PURE: the scene assembles `base` (the
    // combo's physical skill, from bondSkills.js) + `mod` (the bond riders) and rides
    // them in — battle.js never reads bonds/save. N participants via `partnerIds[]`
    // (1 duo / 2 trio / 3 quad; single `partnerId` accepted for back-compat). Only the
    // acting hero's turn is consumed; partners join for free (FP is the price).
    const partnerIds = action.partnerIds || (action.partnerId ? [action.partnerId] : []);
    const partners = partnerIds.map((id) => findUnit(state, id));
    const partnersOk = partners.length > 0 && partners.every((p) => p && p.alive && p.side === 'hero' && p.id !== actor.id);
    if (!partnersOk) { events.push({ type: 'fizzle', actorId: actor.id, reason: 'bond' }); return { events }; }
    const base = action.base || {};
    const mod = action.mod || {};
    const targets = base.target === 'all'
      ? living(state, 'enemy')
      : [findUnit(state, action.targetId)].filter((t) => t && t.alive);
    if (!targets.length) { events.push({ type: 'fizzle', actorId: actor.id, reason: 'bond' }); return { events }; }
    events.push({ type: 'bondStrike', actorId: actor.id, partnerIds: partners.map((p) => p.id), comboId: action.comboId });
    const hits = base.hits || 1;
    let totalDealt = 0;
    for (const t of targets) {
      // ① 불신(mistrust) → defdown BEFORE damage so effectiveDef softens THIS strike.
      if (mod.applyDefdown) { applyStatus(t, 'defdown', 2); events.push({ type: 'inflict', targetId: t.id, status: 'defdown' }); }
      for (let h = 0; h < hits && t.alive; h++) {
        // ② base damage (atk-scaled skillDamage), then 존경/멸시 dmgMult.
        let dmg = skillDamage(base, actor, t, rng);
        if (mod.dmgMult) dmg = Math.floor(dmg * mod.dmgMult);
        events.push({ type: 'bondHit', actorId: actor.id, targetId: t.id, comboId: action.comboId, amount: dmg });
        const before = t.hp;
        dealDamage(state, t, dmg, events); // honors 방어막 soak + lastStand clamp
        totalDealt += Math.max(0, before - t.hp);
      }
      // 콤보가 상태이상을 부여하면(소이탄 연격→화상 등) 살아있는 대상에 적용.
      if (t.alive && base.inflict && rng && rng.next() < (base.inflictChance || 0.6)) {
        applyStatus(t, base.inflict, base.inflictTurns || 3);
        events.push({ type: 'inflict', targetId: t.id, status: base.inflict });
      }
    }
    const casters = [actor, ...partners];
    // ③ 증오(hatred) → lifesteal a fraction of total damage to all casters.
    if (mod.lifesteal && totalDealt > 0) for (const c of casters) {
      if (!c.alive) continue;
      const heal = Math.max(1, Math.floor(totalDealt * mod.lifesteal));
      const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + heal);
      if (c.hp > b) events.push({ type: 'lifesteal', actorId: c.id, amount: c.hp - b });
    }
    // ④ 애정(affection) heal / 충성(loyalty) shield → both casters.
    if (mod.healCasters) for (const c of casters) {
      if (!c.alive) continue;
      const amt = Math.max(1, Math.floor(c.maxHp * mod.healCasters));
      const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + amt);
      if (c.hp > b) events.push({ type: 'heal', actorId: c.id, targetId: c.id, amount: c.hp - b });
    }
    if (mod.shieldCasters) for (const c of casters) {
      if (!c.alive) continue;
      const amt = Math.max(1, Math.floor(c.maxHp * mod.shieldCasters));
      c.shield = (c.shield || 0) + amt;
      events.push({ type: 'buff', actorId: c.id, stat: 'shield', amount: amt });
    }
    state.bondStrikeUsed = true; // the per-battle gate (scene also hides the row)
  }
  return { events };
}

// Resolve an enemy skill (from monsterSkills.js). Caster-relative targeting:
// 'one'/'all' hit the OPPOSING side, 'self' the caster. Damage is atk-scaled
// (monsterSkillDamage), never magic. Emits castStart + per-effect events keyed
// by skillId so battleScene can play the FX choreography. PURE.
export function resolveMonsterSkill(state, actor, action, rng) {
  const events = [];
  const skill = getMonsterSkill(action.skillId);
  if (!skill) return { events };
  const foeSide = actor.side === 'hero' ? 'enemy' : 'hero';
  const foes = living(state, foeSide);
  events.push({ type: 'castStart', actorId: actor.id, spellId: skill.id, monster: true });

  const targets = skill.target === 'self' ? [actor]
    : skill.target === 'all' ? foes
      : (() => {
        const t = findUnit(state, action.targetId);
        if (t && t.alive && t.side === foeSide) return [t];
        return foes.length ? [rng ? rng.pick(foes) : foes[0]] : [];
      })();

  if (skill.kind === 'damage' || skill.kind === 'drain') {
    // hits (연속 할퀴기 flurry) = multi-strike; highCrit (급강하 divebomb) = a
    // chance to land CRIT_MULT. Both per-hit so weighted dmgMult stays on-ladder.
    const nhits = skill.hits || 1;
    for (const t of targets) {
      if (!t.alive) continue;
      for (let h = 0; h < nhits && t.alive; h++) {
        let dmg = monsterSkillDamage(actor, t, skill, rng);
        const crit = !!skill.highCrit && rng && rng.next() < HIGHCRIT_CHANCE;
        if (crit) dmg = Math.floor(dmg * CRIT_MULT);
        events.push({ type: 'monsterSkillHit', actorId: actor.id, targetId: t.id, spellId: skill.id, amount: dmg, crit: !!crit });
        dealDamage(state, t, dmg, events);
        if (skill.kind === 'drain' && actor.alive) {
          const heal = Math.max(1, Math.floor(dmg * (skill.healPct || 0.5)));
          const before = actor.hp;
          actor.hp = Math.min(actor.maxHp, actor.hp + heal);
          if (actor.hp > before) events.push({ type: 'drainHeal', actorId: actor.id, amount: actor.hp - before });
        }
      }
      if (t.alive && skill.inflict && rng && rng.next() < (skill.inflictChance || 0.5)) {
        applyStatus(t, skill.inflict, skill.inflictTurns || 3);
        events.push({ type: 'inflict', targetId: t.id, status: skill.inflict });
      }
    }
  } else if (skill.kind === 'ailment') {
    for (const t of targets) {
      if (!t.alive) continue;
      // Optional `chance`: petrify/strong CC lands partially; omit = always (curse/monshock).
      if (skill.chance != null && !(rng && rng.next() < skill.chance)) {
        events.push({ type: 'inflictResist', targetId: t.id, status: skill.status });
        continue;
      }
      applyStatus(t, skill.status, skill.turns || 3);
      events.push({ type: 'inflict', targetId: t.id, status: skill.status });
    }
  } else if (skill.kind === 'selfbuff') {
    if (skill.atkMult) actor.atk = Math.round(actor.atk * skill.atkMult);
    if (skill.defMult) actor.def = Math.round(actor.def * skill.defMult); // 석화 방벽 stoneskin
    if (skill.spdBonus) actor.spd += skill.spdBonus;
    events.push({ type: 'monsterBuff', actorId: actor.id, spellId: skill.id });
  } else if (skill.kind === 'selfheal') {
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + Math.round(actor.maxHp * (skill.healPct || 0.15)));
    events.push({ type: 'heal', actorId: actor.id, targetId: actor.id, amount: actor.hp - before, spellId: skill.id });
  } else if (skill.kind === 'selfdestruct') {
    // 자폭: blast every foe, then the caster dies (glass-cannon trade). Counts
    // toward state.slain via killUnit; spoils still awards its xp (counts all
    // enemy units, dead included). Recruit/mercy: a self-destructed unit is just
    // dead, never recruited — no invariant broken.
    for (const t of foes) {
      if (!t.alive) continue;
      const dmg = monsterSkillDamage(actor, t, skill, rng);
      events.push({ type: 'monsterSkillHit', actorId: actor.id, targetId: t.id, spellId: skill.id, amount: dmg });
      dealDamage(state, t, dmg, events);
    }
    if (actor.alive) killUnit(state, actor, events);
  } else if (skill.kind === 'allybuff') {
    // 전열 고무: every living ally on the caster's side gets an atk/spd surge.
    for (const a of living(state, actor.side)) {
      if (skill.atkMult) a.atk = Math.round(a.atk * skill.atkMult);
      if (skill.spdBonus) a.spd += skill.spdBonus;
    }
    events.push({ type: 'monsterBuff', actorId: actor.id, spellId: skill.id, allies: true });
  } else if (skill.kind === 'guard') {
    // 룬 보호막: grant an absorb shield to the caster's side (soaked first in
    // dealDamage). target 'allies' shields the whole line; else just the caster.
    const guarded = skill.target === 'allies' ? living(state, actor.side) : [actor];
    for (const a of guarded) {
      const amt = Math.round(a.maxHp * (skill.shieldPct || 0.25));
      a.shield = (a.shield || 0) + amt;
      events.push({ type: 'buff', actorId: a.id, stat: 'shield', amount: amt, spellId: skill.id });
    }
  } else if (skill.kind === 'summon') {
    // 사령 소환: spawn `count` minions onto the caster's side. They COUNT for
    // victory (isOver needs every enemy dead) but grant NO xp/gold (spoils) and
    // are neither spareable, recruitable, nor tallied as 'slain' — so farming
    // them is pointless and they never pollute the mercy/slain ending ratio. The
    // per-battle `max` cap on the monster's skill entry stops infinite-summon
    // difficulty blowup; `fieldCap` keeps the board a sane size. New units join
    // the initiative track on the next startRound. The renderer spawns a sprite
    // from the `summon` event (battleScene). Pure — only mutates state.units.
    const n = skill.count || 1;
    const cap = skill.fieldCap || 8;
    for (let i = 0; i < n; i++) {
      if (living(state, actor.side).length >= cap) break;
      const u = buildEnemyUnit(skill.spawn);
      if (!u) break;
      u.side = actor.side;
      u.summoned = true;
      u.xp = 0; u.gold = 0;       // no farmable spoils
      u.recruitable = false;      // never recruitable
      state.units.push(u);
      events.push({ type: 'summon', actorId: actor.id, unitId: u.id, refId: u.refId, spellId: skill.id });
    }
  }
  return { events };
}

// Subtract damage; honor a one-shot lastStand (Fabula 불굴) that leaves the unit
// at 1 HP instead of dying. Pushes a 'lastStand' event when it triggers, or a
// 'death' (via killUnit) when the unit actually falls. Returns true if it died.
function dealDamage(state, target, dmg, events) {
  // 방어막(shield) soaks damage first (masbarrier / manashield).
  if (target.shield > 0 && dmg > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed; dmg -= absorbed;
    events.push({ type: 'shielded', unitId: target.id, amount: absorbed });
    if (dmg <= 0) return false;
  }
  // dmgReduce passive (장신구): % off incoming damage, after shield. Clamped ≤0.4
  // at build time so DoT (this is the central sink — poison/burn tick through here
  // too) stays meaningful. Min 1 so a hit never reduces to a no-op tickle.
  const dr = (target.passives && target.passives.dmgReduce) || 0;
  if (dr > 0 && dmg > 0) {
    const before = dmg;
    dmg = Math.max(1, Math.floor(dmg * (1 - dr)));
    // 무쇠 브로치 등 피해 감소 패시브가 실제로 깎았을 때만 신호(연출용 — 메커니즘 불변).
    if (dmg < before) events.push({ type: 'dmgReduce', unitId: target.id, amount: before - dmg });
  }
  target.hp = Math.max(0, target.hp - dmg);
  if (target.hp === 0 && target.lastStand) {
    target.hp = 1;
    target.lastStand = false;
    events.push({ type: 'lastStand', unitId: target.id });
    return false;
  }
  if (target.hp === 0) { killUnit(state, target, events); return true; }
  return false;
}

// On-hit passive effects after damage lands (v1: basic-attack path, mirroring the
// counter precedent). 흡혈(lifesteal): attacker heals a fraction of damage dealt.
// 가시(thorns): a MELEE-hit defender reflects a fraction back to the attacker
// (recursion-safe — direct hp write, honours the attacker's 불굴/lastStand).
function applyOnHit(state, attacker, target, dmg, melee, events) {
  if (dmg <= 0) return;
  const ls = attacker.passives && attacker.passives.lifesteal;
  if (ls > 0 && attacker.alive) {
    const heal = Math.min(attacker.maxHp - attacker.hp, Math.max(1, Math.floor(dmg * ls)));
    if (heal > 0) { attacker.hp += heal; events.push({ type: 'lifesteal', unitId: attacker.id, amount: heal }); }
  }
  const th = target.passives && target.passives.thorns;
  if (th > 0 && melee && attacker.alive && target.side !== attacker.side) {
    const refl = Math.max(1, Math.floor(dmg * th));
    events.push({ type: 'thorns', unitId: target.id, targetId: attacker.id, amount: refl });
    attacker.hp = Math.max(0, attacker.hp - refl);
    if (attacker.hp === 0 && attacker.lastStand) { attacker.hp = 1; attacker.lastStand = false; events.push({ type: 'lastStand', unitId: attacker.id }); }
    else if (attacker.hp === 0) killUnit(state, attacker, events);
  }
}

// Mark a unit dead, emit its death event, and tally enemy kills on the battle
// state (drives the mercy-vs-slain ending ratio alongside state.mercied).
function killUnit(state, unit, events) {
  unit.alive = false;
  // Summoned minions don't count toward the slain tally (they'd pollute the
  // mercy/slain ending ratio + let a summoner farm the slay count).
  if (unit.side === 'enemy' && !unit.summoned) state.slain = (state.slain || 0) + 1;
  events.push({ type: 'death', unitId: unit.id });
}

// Total xp/gold from every enemy in the encounter — killed, spared, OR
// recruited all count. Spared/recruited enemies stay in state.units with
// alive=false, so this filter (side==='enemy', any alive state) grants full
// xp for mercy too — sparing never underlevels the player (design D5).
export function spoils(state) {
  return state.units
    .filter((u) => u.side === 'enemy')
    .reduce((acc, u) => ({ xp: acc.xp + (u.xp || 0), gold: acc.gold + (u.gold || 0) }), { xp: 0, gold: 0 });
}

// How a SPECIFIC enemy ended a finished battle, for content that branches on
// spare-vs-slay (e.g. an empire miniboss whose mercy/slaughter opens a
// different path to the boss). Reads that enemy's `resolved` tag directly, so
// sparing an unrelated minion in the same fight can't flip the result — the
// cross-model catch behind D4. A missing unit (never in this battle) or any
// non-mercy end defaults to 'slain', the safe gate-locked side.
//   spared/recruited → 'spared'   ·   killed / absent → 'slain'
export function branchOutcome(state, refId) {
  const u = state.units.find((x) => x.refId === refId);
  return u && (u.resolved === 'spared' || u.resolved === 'recruited') ? 'spared' : 'slain';
}

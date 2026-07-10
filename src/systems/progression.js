// Progression: XP curve, level-for-xp, and building a battle-ready hero unit
// from a party-member definition at a given level. Pure — no Pixi, no globals.
//
// XP curve: cost to go from level L to L+1 is stepCost(L) = 8 + 6*(L-1)
//   L1→2: 8, L2→3: 14, L3→4: 20 ...  (gentle linear growth, tuned so a
//   slice player reaching the boss is roughly level 7-9).

import { getMember } from '../content/party.js';
import { getMonster } from '../content/monsters.js';
import { makeUnit } from './battle.js';

// Generic per-level growth applied to a recruited ally's monster base stats.
// Allies use ONE shared curve (not per-monster) — keeps monsters.js untouched
// (design D3). +10% per level on hp/atk/def, +0.5 spd/level (floored).
export const ALLY_GROWTH = { hpMul: 0.10, atkMul: 0.10, defMul: 0.10, spdAdd: 0.5 };

export function stepCost(level) {
  return 8 + 6 * (level - 1);
}

// Cumulative XP required to BE `level` (level 1 = 0 xp).
export function xpToReach(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += stepCost(l);
  return total;
}

// Highest level achievable with `xp` total experience.
export function levelForXp(xp) {
  let level = 1;
  while (xp >= xpToReach(level + 1)) level++;
  return level;
}

// Compute a hero's stats at a level: base + growth*(level-1), floored.
// Returns the stat block plus the list of spells known by that level.
export function statsAtLevel(memberId, level) {
  const m = getMember(memberId);
  if (!m) return null;
  const s = {};
  for (const key of ['maxHp', 'maxMp', 'atk', 'def', 'spd']) {
    s[key] = Math.floor(m.base[key] + (m.growth[key] || 0) * (level - 1));
  }
  const spells = [...m.spells];
  for (let l = 2; l <= level; l++) {
    if (m.learn && m.learn[l]) spells.push(m.learn[l]);
  }
  return { stats: s, spells };
}

// Spells newly learned when crossing from `fromLevel` to `toLevel`.
export function spellsLearnedBetween(memberId, fromLevel, toLevel) {
  const m = getMember(memberId);
  if (!m || !m.learn) return [];
  const out = [];
  for (let l = fromLevel + 1; l <= toLevel; l++) {
    if (m.learn[l]) out.push(m.learn[l]);
  }
  return out;
}

// Build a battle unit for a hero. equip = {atk, def} bonus from gear (folded by
// the caller via party state). hp/mp default to full unless provided (carry
// current hp/mp between battles).
export function buildHeroUnit(memberId, level, opts = {}) {
  const m = getMember(memberId);
  const { stats, spells } = statsAtLevel(memberId, level);
  const equip = opts.equip || {};
  const maxHp = stats.maxHp + (equip.maxHp || 0);
  const maxMp = stats.maxMp + (equip.maxMp || 0);
  return makeUnit({
    id: opts.id || memberId,
    refId: memberId,
    name: m.name,
    side: 'hero',
    level,
    maxHp,
    hp: opts.hp != null ? Math.min(opts.hp, maxHp) : maxHp,
    maxMp,
    mp: opts.mp != null ? Math.min(opts.mp, maxMp) : maxMp,
    atk: stats.atk + (equip.atk || 0),
    def: stats.def + (equip.def || 0),
    spd: stats.spd + (equip.spd || 0),
    spells,
    sprite: m.sprite,
    // Combat passives from equipped gear (items.equipPassives), read live by the
    // resolver. Caller computes from raw equip (opts.equip here is the stat bonus).
    passives: opts.passives || {},
  });
}

// Build a battle unit for a recruited ally (a monster fighting on the hero
// side). Stats derive from the monster's base scaled by the generic ALLY_GROWTH
// curve at `level`. Allies have no spells in this pass (see TODOS.md). Returns
// null for an unknown refId. hp/mp carry between battles via opts (like heroes).
export function buildAllyUnit(refId, level = 1, opts = {}) {
  const m = getMonster(refId);
  if (!m) return null;
  const lv = Math.max(1, level);
  const n = lv - 1;
  const maxHp = Math.floor(m.maxHp * (1 + ALLY_GROWTH.hpMul * n));
  // A recruited monster brings its signature spell (`joinSkill`, a spells.js id)
  // + a modest MP pool to cast it; allies are menu-controlled, so it shows in
  // their command panel. No joinSkill → attack-only (maxMp 0), the old behavior.
  const joinSkill = m.joinSkill || null;
  const maxMp = joinSkill ? Math.floor(12 + 3 * n) : 0;
  return makeUnit({
    id: opts.id || `ally_${refId}`,
    refId,
    name: m.name,
    side: 'hero',
    ally: true,
    level: lv,
    maxHp,
    hp: opts.hp != null ? Math.min(opts.hp, maxHp) : maxHp,
    maxMp,
    mp: opts.mp != null ? Math.min(opts.mp, maxMp) : maxMp,
    atk: Math.floor(m.atk * (1 + ALLY_GROWTH.atkMul * n)),
    def: Math.floor(m.def * (1 + ALLY_GROWTH.defMul * n)),
    spd: Math.floor(m.spd + ALLY_GROWTH.spdAdd * n),
    spells: joinSkill ? [joinSkill] : [],
    sprite: m.sprite,
  });
}

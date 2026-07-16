import { describe, it, expect } from 'vitest';
import { ARTIFACTS, artifactSlotCount, computeSetBonus, artifactPassives, mergePassives, ART_AFFINITY_MUL, SET_BONUS_2, SET_BONUS_3 } from './artifacts.js';
import { PARTY_MEMBERS } from './party.js';

// Passive/mod/trigger keys the resolver + scene actually read. An artifact naming
// a key outside these lists is dead data (silently ignored) — same trap as the
// equip-passive coverage guard.
const REAL_PASSIVE = new Set(['crit', 'lifesteal', 'weaknessDmg', 'hpBelow50', 'execute', 'dmgReduce', 'survive1hp', 'spellDmg', 'spellMpCut']);
const REAL_MOD = new Set(['spd', 'atk', 'def', 'maxHp', 'maxMp']);
const REAL_TRIGGER = new Set(['hpRegenEnd', 'mpRegenEnd', 'goldBonus', 'fpGain', 'recruitBonus']);
const RARITIES = new Set(['common', 'rare', 'legend']);
const CATS = new Set(['지속', '공격', '생존', '자원', '카르마']);

describe('artifacts — data integrity', () => {
  it.each(Object.values(ARTIFACTS))('$id has valid rarity/cat/affinity + real keys', (a) => {
    expect(a.id).toBeTruthy();
    expect(RARITIES.has(a.rarity)).toBe(true);
    expect(CATS.has(a.cat)).toBe(true);
    if (a.affinity) expect(PARTY_MEMBERS[a.affinity], `unknown affinity class '${a.affinity}'`).toBeDefined();
    for (const k of Object.keys(a.passive || {})) expect(REAL_PASSIVE.has(k), `${a.id} passive.${k} not implemented`).toBe(true);
    for (const k of Object.keys(a.mods || {})) expect(REAL_MOD.has(k), `${a.id} mods.${k} not a real stat`).toBe(true);
    for (const k of Object.keys(a.trigger || {})) expect(REAL_TRIGGER.has(k), `${a.id} trigger.${k} not wired`).toBe(true);
    expect(a.source, `${a.id} needs a source (placement coverage)`).toBeTruthy();
  });

  it('slot count grows 1 → 2 (L8) → 3 (L16)', () => {
    expect(artifactSlotCount(1)).toBe(1);
    expect(artifactSlotCount(7)).toBe(1);
    expect(artifactSlotCount(8)).toBe(2);
    expect(artifactSlotCount(15)).toBe(2);
    expect(artifactSlotCount(16)).toBe(3);
    expect(artifactSlotCount(30)).toBe(3);
  });

  it('set bonus: 2 same cat → x1.2, 3 same → x1.4', () => {
    expect(computeSetBonus(['lens', 'catalyst'])['공격']).toBe(SET_BONUS_2);       // 2 공격
    expect(computeSetBonus(['lens', 'catalyst', 'clawgrip'])['공격']).toBe(SET_BONUS_3); // 3 공격
    expect(computeSetBonus(['lens', 'wardrune'])['공격'] || 1).toBe(1);            // 1 공격 only
  });

  it('class affinity ×1.25 amplifies the matching class only', () => {
    const forHunter = artifactPassives(['lens'], 'huntress').passive.crit;  // lens affinity=huntress
    const forKnight = artifactPassives(['lens'], 'knight').passive.crit;
    expect(forHunter).toBeCloseTo(0.12 * ART_AFFINITY_MUL);
    expect(forKnight).toBeCloseTo(0.12);
  });

  it('survive1hp merges as a boolean flag, not summed', () => {
    const p = artifactPassives(['unbroken'], 'knight').passive;
    expect(p.survive1hp).toBe(true);
    const merged = mergePassives({ crit: 0.1 }, p);
    expect(merged.survive1hp).toBe(true);
    expect(merged.crit).toBe(0.1);
  });

  it('mergePassives sums numeric keys + unions resist', () => {
    const m = mergePassives({ crit: 0.1, resist: { poison: 0.3 } }, { crit: 0.12, resist: { burn: 0.2 } });
    expect(m.crit).toBeCloseTo(0.22);
    expect(m.resist).toEqual({ poison: 0.3, burn: 0.2 });
  });
});

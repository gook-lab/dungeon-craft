import { describe, it, expect } from 'vitest';
import { stepCost, xpToReach, levelForXp, statsAtLevel, spellsLearnedBetween, buildHeroUnit, buildAllyUnit } from './progression.js';

describe('xp curve', () => {
  it('level 1 needs 0 xp, thresholds increase', () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(stepCost(1));
    expect(xpToReach(3)).toBeGreaterThan(xpToReach(2));
  });

  it('levelForXp is the inverse of xpToReach', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpToReach(2))).toBe(2);
    expect(levelForXp(xpToReach(5) - 1)).toBe(4);
    expect(levelForXp(xpToReach(5))).toBe(5);
  });
});

describe('stats scaling', () => {
  it('stats grow with level', () => {
    const l1 = statsAtLevel('knight', 1).stats;
    const l5 = statsAtLevel('knight', 5).stats;
    expect(l5.maxHp).toBeGreaterThan(l1.maxHp);
    expect(l5.atk).toBeGreaterThan(l1.atk);
  });

  it('spells accumulate as levels are gained', () => {
    expect(statsAtLevel('knight', 1).spells).toEqual(['heal']);
    expect(statsAtLevel('knight', 3).spells).toEqual(['heal', 'smite']);
    expect(statsAtLevel('huntress', 5).spells).toContain('multishot'); // huntress L4 learn
  });
});

describe('spellsLearnedBetween', () => {
  it('reports only newly crossed learn levels', () => {
    expect(spellsLearnedBetween('knight', 1, 3)).toEqual(['smite']);
    expect(spellsLearnedBetween('knight', 3, 4)).toEqual([]);
    expect(spellsLearnedBetween('huntress', 1, 5)).toEqual(['multishot']); // L4 learn
  });
});

describe('buildHeroUnit', () => {
  it('builds a full-hp battle unit with equip bonuses', () => {
    const u = buildHeroUnit('warrior', 2, { equip: { atk: 3, def: 1 } });
    const base = statsAtLevel('warrior', 2).stats;
    expect(u.hp).toBe(u.maxHp);
    expect(u.atk).toBe(base.atk + 3);
    expect(u.def).toBe(base.def + 1);
    expect(u.side).toBe('hero');
    expect(u.alive).toBe(true);
  });

  it('clamps carried hp/mp to max', () => {
    const u = buildHeroUnit('knight', 1, { hp: 9999, mp: 9999 });
    expect(u.hp).toBe(u.maxHp);
    expect(u.mp).toBe(u.maxMp);
  });
});

describe('buildAllyUnit', () => {
  it('builds a hero-side unit from a monster base', () => {
    const a = buildAllyUnit('goblin', 1);
    expect(a.side).toBe('hero');
    expect(a.ally).toBe(true);
    expect(a.refId).toBe('goblin');
    expect(a.hp).toBe(a.maxHp);
    expect(a.alive).toBe(true);
    expect(a.spells).toEqual(['crushblow']); // goblin's joinSkill (all recruitables have one)
    expect(a.maxMp).toBeGreaterThan(0);
  });

  it('a monster with no joinSkill (e.g. a boss) builds attack-only (maxMp 0)', () => {
    const b = buildAllyUnit('skeleton_king', 1); // bosses carry no joinSkill
    expect(b.spells).toEqual([]);
    expect(b.maxMp).toBe(0);
  });

  it('grants a recruited monster its joinSkill + an MP pool to cast it', () => {
    const golem = buildAllyUnit('magma_golem', 1);
    expect(golem.spells).toEqual(['crushblow']); // signature skill
    expect(golem.maxMp).toBeGreaterThan(0);
    expect(golem.mp).toBe(golem.maxMp);
    const necro = buildAllyUnit('necromancer', 1);
    expect(necro.spells).toEqual(['darkmist']);
  });

  it('joinSkill ally MP pool grows with level and carried mp clamps to max', () => {
    const l1 = buildAllyUnit('fire_bat', 1);
    const l8 = buildAllyUnit('fire_bat', 8);
    expect(l8.maxMp).toBeGreaterThan(l1.maxMp);
    const carried = buildAllyUnit('fire_bat', 1, { mp: 9999 });
    expect(carried.mp).toBe(carried.maxMp);
  });

  it('scales stats up with level via the generic ALLY_GROWTH curve', () => {
    const l1 = buildAllyUnit('goblin', 1);
    const l5 = buildAllyUnit('goblin', 5);
    expect(l5.maxHp).toBeGreaterThan(l1.maxHp);
    expect(l5.atk).toBeGreaterThan(l1.atk);
    expect(l5.level).toBe(5);
  });

  it('clamps carried hp to max and returns null for unknown refId', () => {
    const a = buildAllyUnit('goblin', 2, { hp: 9999 });
    expect(a.hp).toBe(a.maxHp);
    expect(buildAllyUnit('not_a_monster', 1)).toBe(null);
  });
});

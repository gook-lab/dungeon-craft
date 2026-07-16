import { describe, it, expect } from 'vitest';
import { AFFINITY, AFFINITY_STRONG, AFFINITY_RESIST, affinityMult, affinityKind } from './affinity.js';
import { MONSTERS } from '../content/monsters.js';

// Family counts across the whole bestiary — used to guard against "대상 없는 특효"
// (a strong family that no monster carries → the affinity is dead content).
const famCount = {};
for (const m of Object.values(MONSTERS)) if (m.family) famCount[m.family] = (famCount[m.family] || 0) + 1;
const families = new Set(Object.keys(famCount));

// Every distinct family named anywhere in the AFFINITY table (strong OR resist).
const referencedFamilies = [...new Set(Object.values(AFFINITY).flatMap((r) => [...r.strong, ...r.resist]))];

describe('affinity — physical-element activation (earth/thunder/wind)', () => {
  // These were empty (×1 vs everyone) before the family layer; guard that they
  // stay live so an edit can't silently neuter the elemental weapons again.
  it.each(['earth', 'thunder', 'wind'])('%s has at least one strong family', (el) => {
    expect(AFFINITY[el].strong.length).toBeGreaterThan(0);
  });

  // Coverage guard: EVERY family a weapon/spell can exploit (a `strong` entry)
  // must actually exist on a monster — else the affinity is unreachable content
  // (this is exactly how `metal` sat at 1 boss-only member and 뇌전 ▲metal was
  // effectively dead until the reclassification).
  const strongFamilies = [...new Set(Object.values(AFFINITY).flatMap((r) => r.strong))];
  it.each(strongFamilies)('strong-family "%s" is tagged on at least one monster', (fam) => {
    expect(famCount[fam] || 0, `no monster carries family '${fam}' — that affinity is dead content`).toBeGreaterThan(0);
  });

  it('every family referenced by AFFINITY (strong or resist) exists on a monster', () => {
    for (const fam of referencedFamilies) {
      expect(families.has(fam), `AFFINITY references family '${fam}' that no monster has`).toBe(true);
    }
  });

  it('metal has enough members to make 뇌전 특효 meaningful (not boss-only)', () => {
    // Regression guard for the original problem: metal must span more than a
    // single (boss) member so thunder has real trash targets across regions.
    expect(famCount.metal || 0).toBeGreaterThanOrEqual(2);
  });

  it('multipliers resolve as expected for the new families', () => {
    expect(affinityMult('earth', 'rocky')).toBe(AFFINITY_STRONG);   // 대지 ▲ 석상
    expect(affinityMult('earth', 'aerial')).toBe(AFFINITY_RESIST);  // 대지 ▼ 공중
    expect(affinityMult('thunder', 'metal')).toBe(AFFINITY_STRONG); // 뇌전 ▲ 기갑
    expect(affinityMult('thunder', 'aerial')).toBe(AFFINITY_STRONG);// 뇌전 ▲ 공중
    expect(affinityMult('thunder', 'rocky')).toBe(AFFINITY_RESIST); // 뇌전 ▼ 바위(접지)
    expect(affinityMult('wind', 'beast')).toBe(AFFINITY_STRONG);    // 바람 ▲ 야수
    expect(affinityMult('wind', 'rocky')).toBe(AFFINITY_RESIST);    // 바람 ▼ 석상
    expect(affinityMult('wind', 'undead')).toBe(1);                 // 무관 = 중립
    expect(affinityKind('earth', 'rocky')).toBe('strong');
  });

  it('story bosses stay untagged (no weapon trivializes them)', () => {
    for (const id of ['bog_witch', 'dark_warden', 'fallen_emperor', 'void_lord', 'magma_drake']) {
      // magma_drake/void_lord may carry an elemental family, but must not be a NEW
      // physical-element family that a weapon could exploit for ×1.25.
      const fam = MONSTERS[id].family;
      expect(['rocky', 'metal', 'aerial', 'beast']).not.toContain(fam);
    }
  });
});

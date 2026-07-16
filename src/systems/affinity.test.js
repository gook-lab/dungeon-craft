import { describe, it, expect } from 'vitest';
import { AFFINITY, AFFINITY_STRONG, AFFINITY_RESIST, affinityMult, affinityKind } from './affinity.js';
import { MONSTERS } from '../content/monsters.js';

const families = new Set(Object.values(MONSTERS).map((m) => m.family).filter(Boolean));

describe('affinity — physical-element activation (earth/thunder/wind)', () => {
  // These were empty (×1 vs everyone) before the family layer; guard that they
  // stay live so an edit can't silently neuter the elemental weapons again.
  it.each(['earth', 'thunder', 'wind'])('%s has at least one strong family', (el) => {
    expect(AFFINITY[el].strong.length).toBeGreaterThan(0);
  });

  it('every family referenced by AFFINITY is actually used by a monster', () => {
    for (const [el, rule] of Object.entries(AFFINITY)) {
      for (const fam of [...rule.strong, ...rule.resist]) {
        expect(families.has(fam), `AFFINITY.${el} references family '${fam}' that no monster has`).toBe(true);
      }
    }
  });

  it('multipliers resolve as expected for the new families', () => {
    expect(affinityMult('earth', 'rocky')).toBe(AFFINITY_STRONG);   // 대지 ▲ 석상
    expect(affinityMult('earth', 'aerial')).toBe(AFFINITY_RESIST);  // 대지 ▼ 공중
    expect(affinityMult('thunder', 'metal')).toBe(AFFINITY_STRONG); // 뇌전 ▲ 기갑
    expect(affinityMult('thunder', 'aerial')).toBe(AFFINITY_STRONG);// 뇌전 ▲ 공중
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

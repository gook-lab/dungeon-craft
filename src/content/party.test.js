import { describe, it, expect } from 'vitest';
import { PARTY_MEMBERS } from './party.js';
import { getSpell } from './spells.js';

describe('Party members — data integrity', () => {
  it('each class has exactly one ult-flagged learnable spell', () => {
    for (const [classId, member] of Object.entries(PARTY_MEMBERS)) {
      const allSpells = [...(member.spells || [])];
      for (const spellId of Object.values(member.learn || {})) {
        if (!allSpells.includes(spellId)) allSpells.push(spellId);
      }

      const ultSpells = allSpells.filter(spellId => {
        const spell = getSpell(spellId);
        return spell && spell.ult === true;
      });

      expect(
        ultSpells,
        `${classId} should have exactly 1 ult spell, but has ${ultSpells.length}: ${ultSpells.join(', ')}`
      ).toHaveLength(1);
    }
  });
});

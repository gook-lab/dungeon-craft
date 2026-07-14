import { describe, it, expect } from 'vitest';
import { QUESTS, getQuest, isQuestComplete, questProgress } from './quests.js';
import { SPELLS } from './spells.js';
import { ITEMS } from './items.js';

describe('quest data integrity', () => {
  it('every quest has id/giver/cond/reward and valid reward refs', () => {
    for (const [id, q] of Object.entries(QUESTS)) {
      expect(q.id).toBe(id);
      expect(typeof q.giver).toBe('string');
      expect(['boss', 'mercy', 'slay', 'collect', 'reach', 'talk']).toContain(q.cond.type);
      expect(Array.isArray(q.offer) && q.offer.length).toBeTruthy();
      // reward item (if any) must exist; collect target item must exist
      if (q.reward && q.reward.item) expect(ITEMS[q.reward.item], `${id} reward item`).toBeTruthy();
      if (q.cond.type === 'collect') expect(ITEMS[q.cond.item], `${id} collect item`).toBeTruthy();
    }
  });
});

describe('isQuestComplete', () => {
  const rt = (over = {}) => ({ flags: { mercied: 0, slain: 0, ...(over.flags || {}) }, inventory: { ...(over.inventory || {}) } });

  it('boss: true only when the flag is set', () => {
    expect(isQuestComplete(getQuest('q_crypt'), rt())).toBe(false);
    expect(isQuestComplete(getQuest('q_crypt'), rt({ flags: { bossDefeated: true } }))).toBe(true);
  });

  it('mercy: true once mercied counter reaches the count', () => {
    expect(isQuestComplete(getQuest('q_mercy'), rt({ flags: { mercied: 4 } }))).toBe(false);
    expect(isQuestComplete(getQuest('q_mercy'), rt({ flags: { mercied: 5 } }))).toBe(true);
    expect(isQuestComplete(getQuest('q_mercy'), rt({ flags: { mercied: 9 } }))).toBe(true);
  });

  it('collect: true once inventory has enough of the item', () => {
    expect(isQuestComplete(getQuest('q_herbs'), rt({ inventory: { herb: 4 } }))).toBe(false);
    expect(isQuestComplete(getQuest('q_herbs'), rt({ inventory: { herb: 5 } }))).toBe(true);
  });

  it('null quest → false (no crash)', () => {
    expect(isQuestComplete(null, rt())).toBe(false);
  });
});

describe('questProgress', () => {
  it('shows fractional progress for counter/collect quests', () => {
    const rt = { flags: { mercied: 3 }, inventory: { herb: 2 } };
    expect(questProgress(getQuest('q_mercy'), rt)).toBe('자비 3/5');
    expect(questProgress(getQuest('q_herbs'), rt)).toBe('herb 2/5');
  });
});

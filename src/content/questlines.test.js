import { describe, it, expect } from 'vitest';
import { condMet, isQuestComplete, QUESTS } from './quests.js';
import {
  QUESTLINES, getQuestline, questlineState, isStageComplete, recordVisit, recordTalk,
  questlineProgress, advanceQuestlines, questlineUnlocked,
} from './questlines.js';
import { ITEMS } from './items.js';

const rt = (over = {}) => ({
  flags: { mercied: 0, slain: 0, ...(over.flags || {}) },
  inventory: { ...(over.inventory || {}) },
  visitedMaps: [...(over.visitedMaps || [])],
  talkedNpcs: [...(over.talkedNpcs || [])],
  questlines: { ...(over.questlines || {}) },
});

describe('questline data integrity', () => {
  it('every questline has ordered stages with valid conds + valid reward refs', () => {
    for (const [id, ql] of Object.entries(QUESTLINES)) {
      expect(ql.id).toBe(id);
      expect(Array.isArray(ql.stages) && ql.stages.length >= 2).toBeTruthy();
      for (const s of ql.stages) {
        expect(['boss', 'mercy', 'slay', 'collect', 'reach', 'talk']).toContain(s.cond.type);
        expect(typeof s.desc).toBe('string');
      }
      if (ql.reward && ql.reward.item) expect(ITEMS[ql.reward.item], `${id} reward item`).toBeTruthy();
    }
  });
});

describe('condMet — delegation equivalence (regression: extraction from isQuestComplete)', () => {
  // condMet was extracted OUT of isQuestComplete; every existing quest must
  // evaluate identically through both entry points, met and unmet.
  it('isQuestComplete(q, rt) === condMet(q.cond, rt) for every quest, both ways', () => {
    const met = {
      boss: (c) => rt({ flags: { [c.flag]: true } }),
      mercy: (c) => rt({ flags: { mercied: c.count } }),
      slay: (c) => rt({ flags: { slain: c.count } }),
      collect: (c) => rt({ inventory: { [c.item]: c.count } }),
      reach: (c) => rt({ visitedMaps: [c.map] }),
      talk: (c) => rt({ talkedNpcs: [c.npcId] }),
    };
    for (const q of Object.values(QUESTS)) {
      const unmet = rt();
      expect(isQuestComplete(q, unmet)).toBe(condMet(q.cond, unmet));
      expect(isQuestComplete(q, unmet)).toBe(false);
      const satisfied = met[q.cond.type](q.cond);
      expect(isQuestComplete(q, satisfied)).toBe(condMet(q.cond, satisfied));
      expect(isQuestComplete(q, satisfied)).toBe(true);
    }
  });

  it('reach: met only when visitedMaps includes the map', () => {
    expect(condMet({ type: 'reach', map: 'darkforest' }, rt())).toBe(false);
    expect(condMet({ type: 'reach', map: 'darkforest' }, rt({ visitedMaps: ['town', 'darkforest'] }))).toBe(true);
  });

  it('talk: met only when talkedNpcs includes the placement id', () => {
    expect(condMet({ type: 'talk', npcId: 'enoch_act1' }, rt())).toBe(false);
    expect(condMet({ type: 'talk', npcId: 'enoch_act1' }, rt({ talkedNpcs: ['enoch_act1'] }))).toBe(true);
    // A DIFFERENT placement of the same character does NOT satisfy it (D9 id scheme).
    expect(condMet({ type: 'talk', npcId: 'enoch_act2' }, rt({ talkedNpcs: ['enoch_act1'] }))).toBe(false);
  });

  it('legacy runtimes without tracker fields do not crash (old-save shape)', () => {
    const legacy = { flags: {}, inventory: {} }; // no visitedMaps / talkedNpcs
    expect(condMet({ type: 'reach', map: 'town' }, legacy)).toBe(false);
    expect(condMet({ type: 'talk', npcId: 'enoch_act1' }, legacy)).toBe(false);
  });
});

describe('questlineState / isStageComplete / questlineProgress', () => {
  it('missing save entry → auto-active at stage 0', () => {
    expect(questlineState(rt(), 'ql_act1')).toEqual({ stage: 0, status: 'active' });
  });

  it('isStageComplete follows the stage cond', () => {
    const s = getQuestline('ql_act1').stages[1]; // reach darkforest
    expect(isStageComplete(s, rt())).toBe(false);
    expect(isStageComplete(s, rt({ visitedMaps: ['darkforest'] }))).toBe(true);
    expect(isStageComplete(null, rt())).toBe(false);
  });

  it('progress string shows stage fraction then 완료', () => {
    const ql = getQuestline('ql_act1');
    expect(questlineProgress(ql, rt())).toContain('0/4');
    expect(questlineProgress(ql, rt({ questlines: { ql_act1: { stage: 2, status: 'active' } } }))).toContain('2/4');
    expect(questlineProgress(ql, rt({ questlines: { ql_act1: { stage: 4, status: 'done' } } }))).toBe('완료');
  });
});

describe('advanceQuestlines', () => {
  it('no conds met → no events, state untouched', () => {
    const r = rt();
    expect(advanceQuestlines(r)).toEqual([]);
    expect(r.questlines).toEqual({});
  });

  it('single stage advance emits one event with the next objective', () => {
    const r = rt({ talkedNpcs: ['enoch_act1'] });
    const ev = advanceQuestlines(r);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ id: 'ql_act1', stage: 1, status: 'active', reward: null });
    expect(ev[0].nextDesc).toContain('어둠숲');
    expect(r.questlines.ql_act1).toEqual({ stage: 1, status: 'active' });
  });

  it('pre-satisfied later conds chain-advance in ONE tick, ONE event (retroactive checklist)', () => {
    // Player explored darkforest BEFORE talking to Enoch — talking then jumps 0→2.
    const r = rt({ talkedNpcs: ['enoch_act1'], visitedMaps: ['darkforest'] });
    const ev = advanceQuestlines(r);
    expect(ev).toHaveLength(1); // one toast, not one per stage
    expect(ev[0].stage).toBe(2);
    expect(ev[0].status).toBe('active');
  });

  it('re-entry is a no-op: same conds, second tick emits nothing', () => {
    const r = rt({ talkedNpcs: ['enoch_act1'] });
    advanceQuestlines(r);
    expect(advanceQuestlines(r)).toEqual([]); // visitedMaps/talkedNpcs are persistent
  });

  it('final stage completion flips status to done and carries the reward', () => {
    const r = rt({
      talkedNpcs: ['enoch_act1'],
      visitedMaps: ['darkforest'],
      flags: { darkWardenDefeated: true, bossDefeated: true },
    });
    const ev = advanceQuestlines(r);
    expect(ev).toHaveLength(1);
    expect(ev[0].status).toBe('done');
    expect(ev[0].reward).toEqual(QUESTLINES.ql_act1.reward);
    expect(r.questlines.ql_act1).toEqual({ stage: 4, status: 'done' });
    // done questlines never re-advance or re-reward
    expect(advanceQuestlines(r)).toEqual([]);
  });

  it('initializes runtime.questlines when absent (legacy runtime)', () => {
    const r = { flags: {}, inventory: {}, visitedMaps: [], talkedNpcs: ['enoch_act1'] };
    const ev = advanceQuestlines(r);
    expect(ev).toHaveLength(1);
    expect(r.questlines.ql_act1.stage).toBe(1);
  });
});

describe('recordVisit / recordTalk (씬·메인이 부르는 기록 시임)', () => {
  it('first record returns true, repeat is a no-op false', () => {
    const r = rt();
    expect(recordVisit(r, 'darkforest')).toBe(true);
    expect(recordVisit(r, 'darkforest')).toBe(false);
    expect(r.visitedMaps).toEqual(['darkforest']);
    expect(recordTalk(r, 'enoch_act1')).toBe(true);
    expect(recordTalk(r, 'enoch_act1')).toBe(false);
    expect(r.talkedNpcs).toEqual(['enoch_act1']);
  });

  it('initializes missing tracker arrays (legacy runtime) and rejects non-strings', () => {
    const r = { flags: {}, inventory: {} };
    expect(recordVisit(r, 'town')).toBe(true);
    expect(r.visitedMaps).toEqual(['town']);
    expect(recordTalk(r, undefined)).toBe(false);
    expect(r.talkedNpcs).toEqual([]);
  });

  it('record → advance composes: visit darkforest after talking advances the reach stage', () => {
    const r = rt({ talkedNpcs: ['enoch_act1'], questlines: { ql_act1: { stage: 1, status: 'active' } } });
    recordVisit(r, 'darkforest');
    const ev = advanceQuestlines(r);
    expect(ev).toHaveLength(1);
    expect(ev[0].stage).toBe(2);
  });
});

describe('after 게이팅 (막 순차 해금)', () => {
  it('ql_act2 is locked while ql_act1 is not done — conds met but no advance', () => {
    const r = rt({ talkedNpcs: ['enoch_act2'] }); // 2막 stage-0 cond 충족
    expect(advanceQuestlines(r)).toEqual([]);     // 그래도 잠김 (1막 미완)
    expect(questlineUnlocked(r, QUESTLINES.ql_act2)).toBe(false);
    expect(questlineUnlocked(r, QUESTLINES.ql_act1)).toBe(true); // after 없음 → 항상 열림
  });

  it('completing act1 unlocks act2 and carries the chapter-card event', () => {
    const r = rt({
      talkedNpcs: ['enoch_act1'],
      visitedMaps: ['darkforest'],
      flags: { darkWardenDefeated: true, bossDefeated: true },
    });
    const ev = advanceQuestlines(r);
    expect(ev).toHaveLength(1);
    expect(ev[0].status).toBe('done');
    expect(ev[0].unlocked).toEqual({ id: 'ql_act2', name: QUESTLINES.ql_act2.name });
    expect(questlineUnlocked(r, QUESTLINES.ql_act2)).toBe(true);
  });

  it('after act1 is done, act2 advances retroactively from pre-satisfied conds', () => {
    const r = rt({
      questlines: { ql_act1: { stage: 4, status: 'done' } },
      talkedNpcs: ['enoch_act2'],
      flags: { frostBossDefeated: true },
    });
    const ev = advanceQuestlines(r);
    expect(ev).toHaveLength(1);
    expect(ev[0].id).toBe('ql_act2');
    expect(ev[0].stage).toBe(2); // talk + frost boss 소급 연쇄
    expect(ev[0].nextDesc).toContain('늪');
  });

  it('act2 full run completes on the emperor (6 stages)', () => {
    const r = rt({
      questlines: { ql_act1: { stage: 4, status: 'done' } },
      talkedNpcs: ['enoch_act2'],
      visitedMaps: ['ruins_below'],
      flags: { frostBossDefeated: true, swampBossDefeated: true, sealGuardianDefeated: true, empireBossDefeated: true },
    });
    const ev = advanceQuestlines(r);
    expect(ev[0].status).toBe('done');
    expect(ev[0].reward).toEqual(QUESTLINES.ql_act2.reward);
    expect(ev[0].unlocked).toEqual({ id: 'ql_act3', name: QUESTLINES.ql_act3.name }); // 3막 해금
  });
});

describe('ql_act3 (3막 게이팅 체인)', () => {
  it('act3 locked until act2 done; full chain completes on void lord', () => {
    const base = {
      questlines: { ql_act1: { stage: 4, status: 'done' } },
      talkedNpcs: ['enoch_act3'],
    };
    expect(advanceQuestlines(rt(base))).toEqual([]); // act2 미완 → act3 잠김
    const r = rt({
      questlines: { ql_act1: { stage: 4, status: 'done' }, ql_act2: { stage: 6, status: 'done' } },
      talkedNpcs: ['enoch_act3'],
      visitedMaps: ['starfall'],
      flags: { fallenStarDefeated: true, magmaDrakeDefeated: true, voidLordDefeated: true },
    });
    const ev = advanceQuestlines(r);
    expect(ev).toHaveLength(1);
    expect(ev[0].id).toBe('ql_act3');
    expect(ev[0].status).toBe('done');
    expect(ev[0].reward).toEqual(QUESTLINES.ql_act3.reward);
  });
});

// 사이드 퀘스트라인 「순례 · 재의 길」 (2026-07-15) — 첫 non-막 라인.
describe('ql_pilgrim (side questline)', () => {
  it('has no `after` gate — unlocked from a fresh game', () => {
    expect(questlineUnlocked(rt(), QUESTLINES.ql_pilgrim)).toBe(true);
  });

  it('advances stage-by-stage on pilgrim talks and rewards on the last stop', () => {
    const r = rt({ talkedNpcs: ['pilgrim_town'] });
    let ev = advanceQuestlines(r).find((e) => e.id === 'ql_pilgrim');
    expect(ev.stage).toBe(1);
    expect(ev.status).toBe('active');
    r.talkedNpcs.push('pilgrim_frost', 'pilgrim_lava');
    ev = advanceQuestlines(r).find((e) => e.id === 'ql_pilgrim');
    expect(ev.status).toBe('done');
    expect(ev.reward).toEqual(QUESTLINES.ql_pilgrim.reward);
    expect(ev.unlocked).toBeNull(); // 사이드라인 — 다음 막 카드 없음
  });
});

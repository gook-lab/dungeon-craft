import { describe, it, expect } from 'vitest';
import { freshSave, validateSave, loadSave, writeSave, clearSave, hasSave, slotSummary, toRuntime, runtimeToSave } from './save.js';

// In-memory storage fake implementing the localStorage interface.
function fakeStorage(initial = {}) {
  const m = { ...initial };
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; },
    _dump: () => m,
  };
}

describe('freshSave', () => {
  it('starts as the knight alone (trio assembled via town NPCs) with herbs', () => {
    const f = freshSave();
    expect(f.party.map((p) => p.id)).toEqual(['knight']);
    expect(f.inventory.herb).toBe(3);
    expect(f.flags.bossDefeated).toBe(false);
  });
});

describe('validateSave defensive defaults', () => {
  it('fills missing fields from fresh', () => {
    const v = validateSave({});
    expect(v.gold).toBe(0);
    expect(v.mapId).toBe('town');
    expect(v.party.length).toBe(1);
  });

  it('coerces wrong-typed fields', () => {
    const v = validateSave({ gold: 'lots', pos: { x: 'a', y: 2 }, flags: 'nope' });
    expect(v.gold).toBe(0);
    expect(v.pos).toEqual({ x: 7, y: 9 }); // bad x → fresh pos
    expect(v.flags.bossDefeated).toBe(false);
  });

  it('preserves valid data', () => {
    const good = { ...freshSave(), gold: 250, mapId: 'dungeon', flags: { bossDefeated: true, intro: true } };
    const v = validateSave(good);
    expect(v.gold).toBe(250);
    expect(v.mapId).toBe('dungeon');
    expect(v.flags.bossDefeated).toBe(true);
  });

  it('도감 seen list: defaults [], dedupes + drops non-strings, persists', () => {
    expect(freshSave().seen).toEqual([]);
    const v = validateSave({ seen: ['goblin', 'goblin', 'wolf', 42, null] });
    expect(v.seen).toEqual(['goblin', 'wolf']); // deduped, non-strings dropped
    expect(validateSave({}).seen).toEqual([]);  // missing → []
  });

  it('old save missing flags does not crash, defaults applied', () => {
    const old = { gold: 10, party: [{ id: 'knight', level: 3, xp: 40 }] };
    const v = validateSave(old);
    expect(v.party[0].level).toBe(3);
    expect(v.party[0].equip).toEqual({ weapon: null, armor: null, accessory: null, plus: { weapon: 0, armor: 0, accessory: 0 } });
    expect(v.flags.bossDefeated).toBe(false);
  });

  it('equip upgrade levels (plus) persist and clamp to [0,5]', () => {
    const v = validateSave({ party: [{ id: 'knight', equip: { weapon: 'iron_sword', plus: { weapon: 3, armor: 99, accessory: -2 } } }] });
    expect(v.party[0].equip.plus).toEqual({ weapon: 3, armor: 5, accessory: 0 }); // clamped
  });

  it('dungeon trigger-kit key flag (crypt_key) survives a save→reload round-trip', () => {
    expect(freshSave().flags.crypt_key).toBe(false); // whitelisted default
    const v = validateSave({ ...freshSave(), flags: { crypt_key: true } });
    expect(v.flags.crypt_key).toBe(true); // not dropped by the whitelist filter
  });

  it('swamp vault key flag (bog_key) survives a save→reload round-trip', () => {
    expect(freshSave().flags.bog_key).toBe(false); // whitelisted default
    const v = validateSave({ ...freshSave(), flags: { bog_key: true } });
    expect(v.flags.bog_key).toBe(true); // not dropped by the whitelist filter
  });

  it('caged-beast rescue flag (freedHound) survives a save→reload round-trip', () => {
    expect(freshSave().flags.freedHound).toBe(false); // whitelisted default
    const v = validateSave({ ...freshSave(), flags: { freedHound: true } });
    expect(v.flags.freedHound).toBe(true); // not dropped by the whitelist filter
  });

  it('moral-choice flags (deserter/frozenHunter/mireSoul) survive a save→reload round-trip', () => {
    const f = freshSave();
    expect(f.flags.deserterJudged).toBe(false);
    expect(f.flags.frozenHunterJudged).toBe(false);
    expect(f.flags.mireSoulJudged).toBe(false);
    const v = validateSave({ ...freshSave(), flags: { deserterJudged: true, frozenHunterJudged: true, mireSoulJudged: true } });
    expect(v.flags.deserterJudged).toBe(true);
    expect(v.flags.frozenHunterJudged).toBe(true);
    expect(v.flags.mireSoulJudged).toBe(true);
  });
});

describe('mercy/recruit save fields', () => {
  it('old save (pre-recruit) loads with empty roster + null activeAlly', () => {
    const old = { gold: 10, party: [{ id: 'knight', level: 3, xp: 40 }] };
    const v = validateSave(old);
    expect(v.allies).toEqual([]);
    expect(v.activeAlly).toBe(null);
    expect(v.flags.mercied).toBe(0);
    expect(v.flags.slain).toBe(0);
  });

  it('validates allies and drops malformed entries', () => {
    const v = validateSave({ allies: [
      { refId: 'goblin', level: 2, xp: 5, hp: 12, mp: 0 },
      { level: 3 },          // no refId → dropped
      'garbage',             // not an object → dropped
    ] });
    expect(v.allies.length).toBe(1);
    expect(v.allies[0]).toEqual({ refId: 'goblin', level: 2, xp: 5, hp: 12, mp: 0 });
  });

  it('ally missing level/xp falls back to defaults', () => {
    const v = validateSave({ allies: [{ refId: 'wisp' }] });
    expect(v.allies[0]).toEqual({ refId: 'wisp', level: 1, xp: 0, hp: null, mp: null });
  });

  it('activeAlly only kept when it points at a roster member', () => {
    const inRoster = validateSave({ allies: [{ refId: 'goblin' }], activeAlly: 'goblin' });
    expect(inRoster.activeAlly).toBe('goblin');
    const phantom = validateSave({ allies: [{ refId: 'goblin' }], activeAlly: 'dragon' });
    expect(phantom.activeAlly).toBe(null); // not in roster → dropped (no phantom 5th unit)
  });

  it('persists town companion join flags (NPC stays gone, no re-recruit)', () => {
    const v = validateSave({ flags: { joinedWarrior: true, joinedHuntress: true } });
    expect(v.flags.joinedWarrior).toBe(true);
    expect(v.flags.joinedHuntress).toBe(true);
    // default false on a fresh/old save
    expect(validateSave({}).flags.joinedWarrior).toBe(false);
    expect(validateSave({}).flags.joinedHuntress).toBe(false);
  });

  it('preserves mercy/slain counters', () => {
    const v = validateSave({ flags: { mercied: 7, slain: 3 } });
    expect(v.flags.mercied).toBe(7);
    expect(v.flags.slain).toBe(3);
  });

  it('persists the leader join flags (joinedKnight / joinedDuelist)', () => {
    expect(freshSave().flags.joinedKnight).toBe(false);
    expect(freshSave().flags.joinedDuelist).toBe(false);
    expect(validateSave({ flags: { joinedKnight: true } }).flags.joinedKnight).toBe(true);
    expect(validateSave({ flags: { joinedDuelist: true } }).flags.joinedDuelist).toBe(true);
  });
});

describe('active battle lineup (출전 명단)', () => {
  it('freshSave seeds active with the lone leader', () => {
    expect(freshSave().active).toEqual(['knight']);
  });

  it('old save (no active) derives the lineup from party + legacy activeAlly', () => {
    const old = {
      party: [{ id: 'knight', level: 5 }, { id: 'warrior', level: 5 }],
      allies: [{ refId: 'goblin' }],
      activeAlly: 'goblin',
    };
    const v = validateSave(old);
    expect(v.active).toEqual(['knight', 'warrior', 'goblin']); // party heroes + the deployed ally
  });

  it('keeps only owned ids, dedupes, and caps at MAX_ACTIVE (4)', () => {
    const v = validateSave({
      party: [{ id: 'knight' }, { id: 'warrior' }, { id: 'huntress' }, { id: 'mage' }, { id: 'duelist' }],
      allies: [{ refId: 'goblin' }],
      active: ['knight', 'knight', 'warrior', 'huntress', 'mage', 'duelist', 'goblin', 'ghost'],
    });
    expect(v.active.length).toBe(4);              // capped
    expect(v.active).toEqual(['knight', 'warrior', 'huntress', 'mage']);
    expect(v.active).not.toContain('ghost');      // not owned → dropped
  });

  it('drops a stale active id not in party/allies and refills from party', () => {
    const v = validateSave({ party: [{ id: 'knight' }], allies: [], active: ['ghost'] });
    expect(v.active).toEqual(['knight']); // stale-only → derived from party
  });
});

describe('Fallen Empire save fields', () => {
  it('freshSave seeds all empire flags false', () => {
    const f = freshSave();
    expect(f.flags.empireKnightDefeated).toBe(false);
    expect(f.flags.empireKnight_spared).toBe(false);
    expect(f.flags.empireKnight_slain).toBe(false);
    expect(f.flags.empireBossDefeated).toBe(false);
  });

  it('old save (pre-empire) loads with empire flags defaulted false, no crash', () => {
    // A save from before the empire shipped: only the old flags exist.
    const old = { flags: { bossDefeated: true, frostBossDefeated: true, swampBossDefeated: true, intro: true } };
    const v = validateSave(old);
    expect(v.flags.empireKnightDefeated).toBe(false);
    expect(v.flags.empireKnight_spared).toBe(false);
    expect(v.flags.empireKnight_slain).toBe(false);
    expect(v.flags.empireBossDefeated).toBe(false);
    // 5A natural continuation: a cleared swamp boss still reads true, so the
    // east gate to the empire opens for old post-game saves.
    expect(v.flags.swampBossDefeated).toBe(true);
  });

  it('optional miniboss flags (frostQueen/bloodCount/wraithLich/bridgeWarden) default false + persist', () => {
    const f = freshSave();
    expect(f.flags.frostQueenDefeated).toBe(false);
    expect(f.flags.bloodCountDefeated).toBe(false);
    expect(f.flags.wraithLichDefeated).toBe(false);
    expect(f.flags.bridgeWardenDefeated).toBe(false);
    const v = validateSave({ flags: { frostQueenDefeated: true, bloodCountDefeated: true, wraithLichDefeated: true, bridgeWardenDefeated: true } });
    expect(v.flags.frostQueenDefeated).toBe(true);
    expect(v.flags.bloodCountDefeated).toBe(true);
    expect(v.flags.wraithLichDefeated).toBe(true);
    expect(v.flags.bridgeWardenDefeated).toBe(true);
    expect(validateSave({}).flags.frostQueenDefeated).toBe(false);
  });

  it('persists the empire branch flags through validation (gate the throne)', () => {
    const v = validateSave({ flags: { empireKnightDefeated: true, empireKnight_spared: true, empireBossDefeated: true } });
    expect(v.flags.empireKnightDefeated).toBe(true);
    expect(v.flags.empireKnight_spared).toBe(true);
    expect(v.flags.empireKnight_slain).toBe(false);
    expect(v.flags.empireBossDefeated).toBe(true);
  });
});

describe('load/write round-trip', () => {
  it('writes then loads identical validated data', () => {
    const s = fakeStorage();
    const data = { ...freshSave(), gold: 99, mapId: 'dungeon' };
    expect(writeSave(data, s)).toBe(true);
    const loaded = loadSave(s);
    expect(loaded.gold).toBe(99);
    expect(loaded.mapId).toBe('dungeon');
  });

  it('loads fresh when storage empty', () => {
    const s = fakeStorage();
    expect(loadSave(s).gold).toBe(0);
  });

  it('loads fresh when stored JSON is corrupt', () => {
    const s = fakeStorage({ dragon_crypt_save_v1: '{not json' });
    expect(loadSave(s).mapId).toBe('town');
  });

  it('clearSave removes the entry', () => {
    const s = fakeStorage();
    writeSave(freshSave(), s);
    clearSave(s);
    expect(loadSave(s).gold).toBe(0);
  });
});

describe('save slots', () => {
  it('slots are isolated; slot 1 reuses the legacy key (backward compat)', () => {
    const s = fakeStorage();
    writeSave({ ...freshSave(), gold: 11 }, s, 1);
    writeSave({ ...freshSave(), gold: 22 }, s, 2);
    writeSave({ ...freshSave(), gold: 33 }, s, 3);
    expect(loadSave(s, 1).gold).toBe(11);
    expect(loadSave(s, 2).gold).toBe(22);
    expect(loadSave(s, 3).gold).toBe(33);
    // slot 1 is stored under the legacy single-slot key
    expect(JSON.parse(s.getItem('dragon_crypt_save_v1')).gold).toBe(11);
    expect(s.getItem('dragon_crypt_save_v1_s2')).toBeTruthy();
  });

  it('an existing legacy save shows up as slot 1', () => {
    const s = fakeStorage({ dragon_crypt_save_v1: JSON.stringify({ ...freshSave(), gold: 777 }) });
    expect(loadSave(s, 1).gold).toBe(777);
    expect(hasSave(s, 1)).toBe(true);
    expect(hasSave(s, 2)).toBe(false);
  });

  it('hasSave + slotSummary per slot; clearSave + delete are slot-scoped', () => {
    const s = fakeStorage();
    expect(hasSave(s, 2)).toBe(false);
    expect(slotSummary(s, 2)).toBe(null);
    writeSave({ ...freshSave(), gold: 50, mapId: 'frost' }, s, 2);
    expect(hasSave(s, 2)).toBe(true);
    const sum = slotSummary(s, 2);
    expect(sum.gold).toBe(50);
    expect(sum.mapId).toBe('frost');
    expect(sum.party).toEqual(['knight']);
    clearSave(s, 2);
    expect(hasSave(s, 2)).toBe(false);
  });
});

describe('Fabula Points + Bonds save fields', () => {
  it('fresh save starts at 0 fabula and empty bonds', () => {
    const f = freshSave();
    expect(f.fabula).toBe(0);
    expect(f.bonds).toEqual({});
  });

  it('old save (pre-fabula) defaults fabula=0, bonds={}', () => {
    const v = validateSave({ gold: 10 });
    expect(v.fabula).toBe(0);
    expect(v.bonds).toEqual({});
  });

  it('clamps fabula to [0, 6] and floors it', () => {
    expect(validateSave({ fabula: 99 }).fabula).toBe(6);
    expect(validateSave({ fabula: -3 }).fabula).toBe(0);
    expect(validateSave({ fabula: 2.9 }).fabula).toBe(2);
    expect(validateSave({ fabula: 'lots' }).fabula).toBe(0);
  });

  it('keeps valid emotion arrays, dedups + caps, drops junk', () => {
    const v = validateSave({ bonds: {
      'knight|warrior': ['loyalty', 'loyalty', 'affection'],   // dedups
      'knight|huntress': ['admiration', 'loyalty', 'affection', 'rage'], // caps 3, drops invalid
      'a|b': ['nonsense'],   // no valid emotions → dropped
      bad: 5,                // not an array → dropped
    } });
    expect(v.bonds['knight|warrior']).toEqual(['loyalty', 'affection']);
    expect(v.bonds['knight|huntress']).toEqual(['admiration', 'loyalty', 'affection']);
    expect(v.bonds['a|b']).toBeUndefined();
    expect(v.bonds.bad).toBeUndefined();
  });

  it('pre-B numeric bonds reset to {} (shape changed)', () => {
    expect(validateSave({ bonds: { knight: 3 } }).bonds).toEqual({});
  });

  it('bonds as a non-object falls back to {}', () => {
    expect(validateSave({ bonds: [1, 2] }).bonds).toEqual({});
    expect(validateSave({ bonds: 'nope' }).bonds).toEqual({});
  });

  it('round-trips fabula + bonds through write/load', () => {
    const s = fakeStorage();
    writeSave({ ...freshSave(), fabula: 4, bonds: { 'knight|warrior': ['loyalty'] } }, s);
    const loaded = loadSave(s);
    expect(loaded.fabula).toBe(4);
    expect(loaded.bonds).toEqual({ 'knight|warrior': ['loyalty'] });
  });
});

describe('questlines + reach/talk tracker save fields (서사 고도화 1막)', () => {
  it('fresh save starts with empty questlines/visitedMaps/talkedNpcs', () => {
    const f = freshSave();
    expect(f.questlines).toEqual({});
    expect(f.visitedMaps).toEqual([]);
    expect(f.talkedNpcs).toEqual([]);
  });

  it('old save (pre-questline, fields absent) fills defaults without crashing', () => {
    const v = validateSave({ gold: 10 });
    expect(v.questlines).toEqual({});
    expect(v.visitedMaps).toEqual([]);
    expect(v.talkedNpcs).toEqual([]);
  });

  it('keeps a valid questline entry, clamps stage into [0, stages.length]', () => {
    const v = validateSave({ questlines: { ql_act1: { stage: 2, status: 'active' } } });
    expect(v.questlines.ql_act1).toEqual({ stage: 2, status: 'active' });
    expect(validateSave({ questlines: { ql_act1: { stage: -3, status: 'active' } } }).questlines.ql_act1.stage).toBe(0);
    expect(validateSave({ questlines: { ql_act1: { stage: 99, status: 'done' } } }).questlines.ql_act1.stage).toBe(4);
    expect(validateSave({ questlines: { ql_act1: { stage: 'x', status: 'active' } } }).questlines.ql_act1.stage).toBe(0);
  });

  it('corrupt questlines: non-object container / non-object entry / bad status / unknown id → dropped', () => {
    expect(validateSave({ questlines: [1, 2] }).questlines).toEqual({});
    expect(validateSave({ questlines: 'nope' }).questlines).toEqual({});
    expect(validateSave({ questlines: { ql_act1: 3 } }).questlines).toEqual({});
    expect(validateSave({ questlines: { ql_act1: { stage: 1, status: 'paused' } } }).questlines).toEqual({});
    expect(validateSave({ questlines: { ql_unknown: { stage: 1, status: 'active' } } }).questlines).toEqual({});
  });

  it('trackers filter non-strings and dedupe', () => {
    const v = validateSave({
      visitedMaps: ['town', 'town', 7, null, 'darkforest'],
      talkedNpcs: ['enoch_act1', 'enoch_act1', {}, 'elder1'],
    });
    expect(v.visitedMaps).toEqual(['town', 'darkforest']);
    expect(v.talkedNpcs).toEqual(['enoch_act1', 'elder1']);
    expect(validateSave({ visitedMaps: 'town' }).visitedMaps).toEqual([]);
  });

  it('round-trips all three fields through write/load (storage layer)', () => {
    const s = fakeStorage();
    writeSave({
      ...freshSave(),
      questlines: { ql_act1: { stage: 1, status: 'active' } },
      visitedMaps: ['town', 'darkforest'],
      talkedNpcs: ['enoch_act1'],
    }, s);
    const loaded = loadSave(s);
    expect(loaded.questlines).toEqual({ ql_act1: { stage: 1, status: 'active' } });
    expect(loaded.visitedMaps).toEqual(['town', 'darkforest']);
    expect(loaded.talkedNpcs).toEqual(['enoch_act1']);
  });
});

describe('toRuntime ∘ runtimeToSave round-trip (Gotcha #11 게이트)', () => {
  // main.js는 이 두 함수를 호출만 한다 — 어느 한쪽에서 필드를 빠뜨리면 여기서 잡힌다.
  it('a fully-populated save survives save → runtime → save → validate intact', () => {
    const seeded = validateSave({
      ...freshSave(),
      gold: 321,
      mapId: 'darkforest',
      seen: ['goblin'],
      quests: { q_crypt: 'active' },
      questlines: { ql_act1: { stage: 2, status: 'active' } },
      visitedMaps: ['town', 'wild', 'darkforest'],
      talkedNpcs: ['enoch_act1'],
      ngPlus: 2,
      fabula: 3,
      bonds: { 'knight|warrior': ['loyalty'] },
      flags: { ...freshSave().flags, bossDefeated: true, mercied: 4 },
    });
    const back = validateSave(runtimeToSave(toRuntime(seeded)));
    expect(back).toEqual(seeded);
  });

  it('runtime mutations do not alias the source save (deep-enough copies)', () => {
    const save = validateSave({ ...freshSave(), questlines: { ql_act1: { stage: 1, status: 'active' } } });
    const rt = toRuntime(save);
    rt.questlines.ql_act1.stage = 3;
    rt.visitedMaps.push('darkforest');
    expect(save.questlines.ql_act1.stage).toBe(1);
    expect(save.visitedMaps).toEqual([]);
  });
});

describe('ngPlus (회차+) save field', () => {
  it('fresh save starts at 0; old save defaults 0', () => {
    expect(freshSave().ngPlus).toBe(0);
    expect(validateSave({ gold: 10 }).ngPlus).toBe(0);
  });

  it('clamps to non-negative int, cap 99', () => {
    expect(validateSave({ ngPlus: 3 }).ngPlus).toBe(3);
    expect(validateSave({ ngPlus: -2 }).ngPlus).toBe(0);
    expect(validateSave({ ngPlus: 2.9 }).ngPlus).toBe(2);
    expect(validateSave({ ngPlus: 'many' }).ngPlus).toBe(0);
    expect(validateSave({ ngPlus: 500 }).ngPlus).toBe(99);
  });

  it('round-trips through write/load and toRuntime/runtimeToSave', () => {
    const s = fakeStorage();
    writeSave({ ...freshSave(), ngPlus: 2 }, s);
    expect(loadSave(s).ngPlus).toBe(2);
    expect(runtimeToSave(toRuntime(validateSave({ ...freshSave(), ngPlus: 2 }))).ngPlus).toBe(2);
  });
});

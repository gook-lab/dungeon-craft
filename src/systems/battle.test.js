import { describe, it, expect } from 'vitest';
import {
  physicalDamage, magicDamage, magicScale, MAGIC_SCALE_K, buildEnemyUnit, createBattle, startRound,
  currentActor, advanceTurn, isOver, resolveAction, enemyChooseAction, spoils, living, enrageBosses,
  applyStatus, cureStatus, tickStatus, canMercy, canRecruit, makeUnit, branchOutcome, effectiveSpd,
  elementMultiplier, skillDamage, effectiveDef, CRIT_MULT, CHARGE_MULT,
  resolveMonsterSkill, monsterSkillDamage,
} from './battle.js';
import { buildHeroUnit, buildAllyUnit } from './progression.js';
import { equipPassives } from '../content/items.js';
import { getSpell } from '../content/spells.js';
import { createRng } from '../util/rng.js';

const fixedRng = () => createRng(12345);

describe('damage formulas', () => {
  it('physical damage is at least 1', () => {
    const weak = { atk: 1, atkBuff: 0 };
    const tank = { def: 100, defending: false };
    expect(physicalDamage(weak, tank, null)).toBeGreaterThanOrEqual(1);
  });

  it('defending halves damage', () => {
    const a = { atk: 20, atkBuff: 0 };
    const open = { def: 5, defending: false };
    const guard = { def: 5, defending: true };
    // null rng → variance fixed at 1.0, so comparison is exact-ish
    const dOpen = physicalDamage(a, open, null);
    const dGuard = physicalDamage(a, guard, null);
    expect(dGuard).toBeLessThan(dOpen);
    expect(dGuard).toBe(Math.max(1, Math.floor((20 * (20 / 25)) * 0.5)));
  });

  it('atkBuff increases damage', () => {
    const base = { atk: 10, atkBuff: 0 };
    const buffed = { atk: 10, atkBuff: 0.5 };
    const t = { def: 5, defending: false };
    expect(physicalDamage(buffed, t, null)).toBeGreaterThan(physicalDamage(base, t, null));
  });

  it('basic attack inherits weapon element affinity (holy weapon ▲ vs undead)', () => {
    const holyKnight = { atk: 20, atkBuff: 0, weaponElement: 'holy' };
    const plainKnight = { atk: 20, atkBuff: 0 };
    const undead = { def: 5, defending: false, family: 'undead' };
    const neutral = { def: 5, defending: false };
    // holy weapon beats undead (×1.25); vs a neutral target it's the same as no element.
    expect(physicalDamage(holyKnight, undead, null)).toBeGreaterThan(physicalDamage(plainKnight, undead, null));
    expect(physicalDamage(holyKnight, neutral, null)).toBe(physicalDamage(plainKnight, neutral, null));
  });

  it('basic attack: no weaponElement (enemies/unarmed) stays neutral ×1', () => {
    const enemy = { atk: 20, atkBuff: 0 }; // no weaponElement field
    const undead = { def: 5, defending: false, family: 'undead' };
    const plain = { def: 5, defending: false };
    expect(physicalDamage(enemy, undead, null)).toBe(physicalDamage(enemy, plain, null));
  });

  it('magic damage ignores def', () => {
    const spell = { power: 12 };
    const t1 = { def: 0, defending: false };
    const t2 = { def: 99, defending: false };
    expect(magicDamage(spell, t1, null)).toBe(magicDamage(spell, t2, null));
  });

  it('magicScale: null/maxMp-less caster falls back to x1 (flat, old behavior)', () => {
    expect(magicScale(null)).toBe(1);
    expect(magicScale(undefined)).toBe(1);
    expect(magicScale({})).toBe(1);
    expect(magicScale({ maxMp: 0 })).toBe(1);
  });

  it('magicScale: scales with caster maxMp (mana depth = spell power)', () => {
    expect(magicScale({ maxMp: MAGIC_SCALE_K })).toBe(2); // maxMp == K → x2
    expect(magicScale({ maxMp: 30 })).toBeCloseTo(1 + 30 / MAGIC_SCALE_K, 5);
    // deeper-mana caster hits harder with the same spell
    expect(magicScale({ maxMp: 24 })).toBeGreaterThan(magicScale({ maxMp: 8 }));
  });

  it('magic damage scales with caster maxMp', () => {
    const spell = { power: 12 };
    const t = { def: 5, defending: false };
    const lowMp = { maxMp: 6 };
    const highMp = { maxMp: 24 };
    expect(magicDamage(spell, t, null, highMp)).toBeGreaterThan(magicDamage(spell, t, null, lowMp));
    // exact: power * (1 + maxMp/K), variance fixed at 1.0 with null rng
    expect(magicDamage(spell, t, null, highMp)).toBe(Math.max(1, Math.floor(12 * (1 + 24 / MAGIC_SCALE_K))));
  });

  it('a high-level skill out-damages a same-level basic attack (design goal)', () => {
    // L12 huntress: basic attack vs ice_lance — the skill should now win.
    const huntress = buildHeroUnit('huntress', 12);
    const boss = buildEnemyUnit('werewolf_king'); // def 13
    const iceLance = { power: 16 };
    const basic = physicalDamage(huntress, boss, null);
    const skill = magicDamage(iceLance, boss, null, huntress);
    expect(skill).toBeGreaterThan(basic);
  });
});

describe('turn order', () => {
  it('orders by spd descending', () => {
    const fast = buildHeroUnit('huntress', 1); // spd 12
    const slow = buildHeroUnit('knight', 1);   // spd 6
    const state = createBattle([slow, fast], [buildEnemyUnit('walker')]); // walker spd 4
    expect(state.turnOrder[0]).toBe('huntress');
    expect(state.turnOrder[state.turnOrder.length - 1]).toBe(state.units.find(u => u.refId === 'walker').id);
  });

  it('tie-break: heroes before enemies at equal spd', () => {
    const h = buildHeroUnit('knight', 1);          // spd 6
    const e = buildEnemyUnit('wisp');              // spd 6
    const state = createBattle([h], [e]);
    expect(state.turnOrder[0]).toBe('knight');
  });
});

describe('resolveAction attack', () => {
  it('reduces target hp and emits attack event', () => {
    const h = buildHeroUnit('warrior', 1);
    const e = buildEnemyUnit('walker');
    const state = createBattle([h], [e]);
    const { events } = resolveAction(state, { type: 'attack', actorId: 'warrior', targetId: e.id }, fixedRng());
    expect(events[0].type).toBe('attack');
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('emits death event and marks unit dead when hp hits 0', () => {
    const h = buildHeroUnit('warrior', 1);
    const e = buildEnemyUnit('bat'); // 9 hp
    e.hp = 1;
    const state = createBattle([h], [e]);
    const { events } = resolveAction(state, { type: 'attack', actorId: 'warrior', targetId: e.id }, fixedRng());
    expect(e.alive).toBe(false);
    expect(events.some((ev) => ev.type === 'death' && ev.unitId === e.id)).toBe(true);
  });

  it('heavy strike does more than normal', () => {
    const e = buildEnemyUnit('skeleton_king');
    const h1 = buildHeroUnit('knight', 1);
    const h2 = buildHeroUnit('knight', 1);
    const s1 = createBattle([h1], [buildEnemyUnit('walker')]);
    // compare boss heavy vs normal directly via physicalDamage path
    const normal = resolveAction(createBattle([buildHeroUnit('knight', 1)], [buildEnemyUnit('walker')]),
      { type: 'attack', actorId: e.id, targetId: 'knight', heavy: false }, null);
    // structural: heavy flag accepted without throwing, hp drops
    const st = createBattle([buildHeroUnit('knight', 1)], [e]);
    const before = findHeroHp(st);
    resolveAction(st, { type: 'attack', actorId: e.id, targetId: 'knight', heavy: true }, null);
    expect(findHeroHp(st)).toBeLessThan(before);
  });
});

function findHeroHp(state) {
  return state.units.find((u) => u.side === 'hero').hp;
}

describe('resolveAction spell', () => {
  it('damage spell hits target and spends mp', () => {
    const h = buildHeroUnit('huntress', 1); // firebolt mp3
    const e = buildEnemyUnit('walker');
    const state = createBattle([h], [e]);
    const mpBefore = h.mp;
    const { events } = resolveAction(state, { type: 'spell', actorId: 'huntress', spellId: 'firebolt', targetId: e.id }, fixedRng());
    expect(h.mp).toBe(mpBefore - 3);
    expect(events.some((ev) => ev.type === 'spellHit')).toBe(true);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('allEnemies spell hits every living enemy', () => {
    const h = buildHeroUnit('huntress', 5); // firestorm learned at 5
    const e1 = buildEnemyUnit('walker');
    const e2 = buildEnemyUnit('goblin');
    const state = createBattle([h], [e1, e2]);
    resolveAction(state, { type: 'spell', actorId: 'huntress', spellId: 'firestorm', targetId: e1.id }, fixedRng());
    expect(e1.hp).toBeLessThan(e1.maxHp);
    expect(e2.hp).toBeLessThan(e2.maxHp);
  });

  it('heal restores hp without exceeding max', () => {
    const h = buildHeroUnit('knight', 1);
    const ally = buildHeroUnit('warrior', 1);
    ally.hp = 5;
    const state = createBattle([h, ally], [buildEnemyUnit('walker')]);
    resolveAction(state, { type: 'spell', actorId: 'knight', spellId: 'heal', targetId: 'warrior' }, fixedRng());
    expect(ally.hp).toBeGreaterThan(5);
    expect(ally.hp).toBeLessThanOrEqual(ally.maxHp);
  });

  it('fizzles when mp insufficient', () => {
    const h = buildHeroUnit('knight', 1);
    h.mp = 0;
    const state = createBattle([h], [buildEnemyUnit('walker')]);
    const { events } = resolveAction(state, { type: 'spell', actorId: 'knight', spellId: 'heal', targetId: 'knight' }, fixedRng());
    expect(events[0].type).toBe('fizzle');
  });

  it('warcry buff raises atkBuff', () => {
    const h = buildHeroUnit('warrior', 4); // learns warcry at 4
    const state = createBattle([h], [buildEnemyUnit('walker')]);
    resolveAction(state, { type: 'spell', actorId: 'warrior', spellId: 'warcry' }, fixedRng());
    expect(h.atkBuff).toBeCloseTo(0.35);
  });

  it('그림자 일격(assassinate) only fires from 은신: fizzles otherwise, lands when cloaked', () => {
    const h = buildHeroUnit('huntress', 16); // learns assassinate at 16
    h.mp = 20;
    const e = buildEnemyUnit('walker');
    // Not stealthed → fizzle with reason 'stealth', no MP spent, no damage.
    const s1 = createBattle([h], [e]);
    const hp0 = e.hp; const mp0 = h.mp;
    const r1 = resolveAction(s1, { type: 'spell', actorId: 'huntress', spellId: 'assassinate', targetId: e.id }, fixedRng());
    expect(r1.events.some((x) => x.type === 'fizzle' && x.reason === 'stealth')).toBe(true);
    expect(e.hp).toBe(hp0);    // no damage
    expect(h.mp).toBe(mp0);    // no MP spent
    // Cloaked → it lands (stealth crit).
    h.stealth = true;
    resolveAction(s1, { type: 'spell', actorId: 'huntress', spellId: 'assassinate', targetId: e.id }, fixedRng());
    expect(e.hp).toBeLessThan(hp0);
  });
});

describe('flee', () => {
  it('is deterministic under a fixed seed', () => {
    const make = () => createBattle([buildHeroUnit('huntress', 1)], [buildEnemyUnit('walker')]);
    const a = make(); const ra = resolveAction(a, { type: 'flee', actorId: 'huntress' }, createRng(7));
    const b = make(); const rb = resolveAction(b, { type: 'flee', actorId: 'huntress' }, createRng(7));
    expect(ra.events[0].ok).toBe(rb.events[0].ok);
  });
});

describe('isOver + spoils', () => {
  it('victory when all enemies dead', () => {
    const h = buildHeroUnit('warrior', 1);
    const e = buildEnemyUnit('bat');
    const state = createBattle([h], [e]);
    e.alive = false; e.hp = 0;
    expect(isOver(state)).toBe('victory');
  });

  it('defeat when all heroes dead', () => {
    const h = buildHeroUnit('warrior', 1);
    const e = buildEnemyUnit('bat');
    const state = createBattle([h], [e]);
    h.alive = false; h.hp = 0;
    expect(isOver(state)).toBe('defeat');
  });

  it('spoils sum xp and gold across enemies', () => {
    const state = createBattle([buildHeroUnit('warrior', 1)], [buildEnemyUnit('goblin'), buildEnemyUnit('wolf')]);
    const s = spoils(state);
    expect(s.xp).toBe(6 + 7);
    expect(s.gold).toBe(6 + 3);
  });
});

describe('enemy AI', () => {
  it('picks a living hero to attack', () => {
    const state = createBattle([buildHeroUnit('knight', 1)], [buildEnemyUnit('goblin')]);
    const goblin = state.units.find((u) => u.side === 'enemy');
    const action = enemyChooseAction(state, goblin.id, fixedRng());
    expect(action.type).toBe('attack');
    expect(action.targetId).toBe('knight');
  });

  it('boss does heavy strike every third action', () => {
    const state = createBattle([buildHeroUnit('knight', 1)], [buildEnemyUnit('skeleton_king')]);
    const boss = state.units.find((u) => u.side === 'enemy');
    boss.skills = []; // isolate the basic-attack heavy cadence (boss now also has monslam)
    const a1 = enemyChooseAction(state, boss.id, fixedRng());
    const a2 = enemyChooseAction(state, boss.id, fixedRng());
    const a3 = enemyChooseAction(state, boss.id, fixedRng());
    expect(a1.heavy).toBe(false);
    expect(a2.heavy).toBe(false);
    expect(a3.heavy).toBe(true);
  });
});

describe('boss phase 2 enrage', () => {
  it('enrages once when HP crosses the threshold, buffing atk + healing', () => {
    const boss = buildEnemyUnit('skeleton_king');
    const state = createBattle([buildHeroUnit('warrior', 5)], [boss]);
    const atk0 = boss.atk;
    boss.hp = boss.maxHp * 0.45; // below 0.5 threshold
    const ev1 = enrageBosses(state);
    expect(ev1.length).toBe(1);
    expect(ev1[0].type).toBe('enrage');
    expect(boss.enraged).toBe(true);
    expect(boss.atk).toBeGreaterThan(atk0);
    expect(boss.hp).toBeGreaterThan(boss.maxHp * 0.45); // partial heal
    // does not re-trigger
    expect(enrageBosses(state).length).toBe(0);
  });

  it('does not enrage above the threshold', () => {
    const boss = buildEnemyUnit('werewolf_king');
    const state = createBattle([buildHeroUnit('warrior', 5)], [boss]);
    boss.hp = boss.maxHp * 0.8;
    expect(enrageBosses(state).length).toBe(0);
    expect(boss.enraged).toBe(false);
  });

  it('enraged boss strikes heavy more often', () => {
    const boss = buildEnemyUnit('skeleton_king');
    boss.enraged = true;
    boss.skills = []; // isolate the basic-attack heavy cadence (boss now also has skills)
    const state = createBattle([buildHeroUnit('knight', 5)], [boss]);
    const a2 = enemyChooseAction(state, boss.id, fixedRng()); // tick1
    const b2 = enemyChooseAction(state, boss.id, fixedRng()); // tick2 -> heavy (enraged %2)
    expect(b2.heavy).toBe(true);
  });
});

describe('status ailments', () => {
  it('poison ticks damage and counts down', () => {
    const u = buildHeroUnit('knight', 5);
    applyStatus(u, 'poison', 3);
    const hp0 = u.hp;
    const { events } = tickStatus(u, createRng(1));
    expect(events.some((e) => e.type === 'poisonTick')).toBe(true);
    expect(u.hp).toBeLessThan(hp0);
    expect(u.status.poison).toBe(2);
  });

  it('sleep skips the turn until it wakes', () => {
    const u = buildHeroUnit('warrior', 5);
    applyStatus(u, 'sleep', 3);
    // seed where rng.next() >= 0.45 → stays asleep (skip)
    let sawSkip = false;
    for (let s = 1; s <= 30 && !sawSkip; s++) {
      const u2 = buildHeroUnit('warrior', 5); applyStatus(u2, 'sleep', 3);
      const r = tickStatus(u2, createRng(s));
      if (r.skip) { sawSkip = true; expect(r.events.some((e) => e.type === 'asleep')).toBe(true); }
    }
    expect(sawSkip).toBe(true);
  });

  it('weaken reduces physical damage', () => {
    const base = buildHeroUnit('warrior', 5);
    const weak = buildHeroUnit('warrior', 5);
    applyStatus(weak, 'weaken', 3);
    const t = { def: 5, defending: false };
    expect(physicalDamage(weak, t, null)).toBeLessThan(physicalDamage(base, t, null));
  });

  it('cureStatus removes an ailment', () => {
    const u = buildHeroUnit('knight', 3);
    applyStatus(u, 'poison', 3);
    expect(cureStatus(u, 'poison')).toBe(true);
    expect(u.status.poison).toBeUndefined();
    expect(cureStatus(u, 'poison')).toBe(false);
  });

  it('enemy attack can inflict its status', () => {
    const spider = buildEnemyUnit('spider'); // poison 0.4
    const hero = buildHeroUnit('knight', 5);
    const state = createBattle([hero], [spider]);
    // force inflict by seeding rng low; try several seeds to find one that triggers
    let inflicted = false;
    for (let s = 1; s <= 30 && !inflicted; s++) {
      const h = buildHeroUnit('knight', 5);
      const sp = buildEnemyUnit('spider');
      const st = createBattle([h], [sp]);
      resolveAction(st, { type: 'attack', actorId: sp.id, targetId: h.id }, createRng(s));
      if (h.status && h.status.poison) inflicted = true;
    }
    expect(inflicted).toBe(true);
  });

  it('burn ticks damage (fire DoT) and counts down', () => {
    const u = buildHeroUnit('knight', 5);
    applyStatus(u, 'burn', 3);
    const hp0 = u.hp;
    const { events } = tickStatus(u, createRng(1));
    expect(events.some((e) => e.type === 'burnTick')).toBe(true);
    expect(u.hp).toBeLessThan(hp0);
    expect(u.status.burn).toBe(2);
  });

  it('shock can paralyze (skip turn) and counts down', () => {
    let sawParalyze = false;
    for (let s = 1; s <= 40 && !sawParalyze; s++) {
      const u = buildHeroUnit('warrior', 5); applyStatus(u, 'shock', 3);
      const r = tickStatus(u, createRng(s));
      if (r.skip) { sawParalyze = true; expect(r.events.some((e) => e.type === 'paralyzed')).toBe(true); }
    }
    expect(sawParalyze).toBe(true);
  });

  it('freeze slows turn order (effectiveSpd halved) and reduces atk', () => {
    const fast = buildHeroUnit('huntress', 5); // high spd
    const frozen = buildHeroUnit('huntress', 5);
    applyStatus(frozen, 'freeze', 2);
    expect(effectiveSpd(frozen)).toBeLessThan(effectiveSpd(fast));
    expect(effectiveSpd(frozen)).toBeCloseTo(frozen.spd * 0.5);
    const t = { def: 5, defending: false };
    expect(physicalDamage(frozen, t, null)).toBeLessThan(physicalDamage(fast, t, null));
    // ticks down
    tickStatus(frozen, createRng(1));
    expect(frozen.status.freeze).toBe(1);
  });

  it('a damage spell with inflict applies its ailment (e.g. 화염 화살 → 화상)', () => {
    let inflicted = false;
    for (let s = 1; s <= 40 && !inflicted; s++) {
      const caster = buildHeroUnit('huntress', 5); caster.mp = 99;
      // High-HP boss so the hit never one-shots it (a dead target can't carry a status).
      const boss = buildEnemyUnit('skeleton_king');
      const st = createBattle([caster], [boss]);
      resolveAction(st, { type: 'spell', actorId: caster.id, spellId: 'firebolt', targetId: boss.id }, createRng(s));
      const tgt = st.units.find((x) => x.id === boss.id);
      if (tgt.alive && tgt.status && tgt.status.burn) inflicted = true;
    }
    expect(inflicted).toBe(true);
  });
});

describe('elemental affinity', () => {
  it('holy is strong (×1.25) vs undead, neutral otherwise', () => {
    expect(elementMultiplier('holy', { family: 'undead' })).toBeCloseTo(1.25);
    expect(elementMultiplier('holy', { family: 'icy' })).toBe(1);
    expect(elementMultiplier('holy', { family: null })).toBe(1);
  });

  it('fire ↔ ice: strong on the opposite kind, resisted on own kind', () => {
    expect(elementMultiplier('fire', { family: 'icy' })).toBeCloseTo(1.25);
    expect(elementMultiplier('fire', { family: 'fiery' })).toBeCloseTo(0.8);
    expect(elementMultiplier('ice', { family: 'fiery' })).toBeCloseTo(1.25);
    expect(elementMultiplier('ice', { family: 'icy' })).toBeCloseTo(0.8);
  });

  it('no element or no family → neutral ×1', () => {
    expect(elementMultiplier(undefined, { family: 'undead' })).toBe(1);
    expect(elementMultiplier('fire', {})).toBe(1);
  });

  it('magicDamage applies affinity (smite hits undead harder than non-undead)', () => {
    const caster = buildHeroUnit('knight', 5);
    const smite = { power: 13, element: 'holy' };
    const undeadDmg = magicDamage(smite, buildEnemyUnit('walker'), null, caster);   // family undead
    const plainDmg = magicDamage(smite, buildEnemyUnit('goblin'), null, caster);    // no family
    expect(undeadDmg).toBeGreaterThan(plainDmg);
  });
});

describe('makeUnit base factory (regression)', () => {
  it('hero and enemy units carry the shared base shape', () => {
    const h = buildHeroUnit('knight', 1);
    const e = buildEnemyUnit('walker');
    for (const u of [h, e]) {
      expect(u).toHaveProperty('alive', true);
      expect(u).toHaveProperty('defending', false);
      expect(u).toHaveProperty('atkBuff', 0);
      expect(u.status).toEqual({});
      expect(typeof u.maxMp).toBe('number');
      expect(Array.isArray(u.spells)).toBe(true);
    }
    expect(h.side).toBe('hero');
    expect(e.side).toBe('enemy');
  });

  it('overrides win over base defaults', () => {
    const u = makeUnit({ side: 'hero', mp: 5, atkBuff: 0.5 });
    expect(u.side).toBe('hero');
    expect(u.mp).toBe(5);
    expect(u.atkBuff).toBe(0.5);
    expect(u.alive).toBe(true); // untouched default
  });
});

describe('mercy: canMercy / canRecruit eligibility', () => {
  it('not eligible at full HP', () => {
    expect(canMercy(buildEnemyUnit('goblin'))).toBe(false);
  });
  it('eligible once weakened to threshold', () => {
    const e = buildEnemyUnit('goblin'); // maxHp 14, threshold 0.3 → 4.2
    e.hp = 4;
    expect(canMercy(e)).toBe(true);
  });
  it('bosses are never spareable or recruitable', () => {
    const boss = buildEnemyUnit('skeleton_king');
    boss.hp = 1;
    expect(canMercy(boss)).toBe(false);
    expect(canRecruit(boss)).toBe(false);
  });
  it('recruitable: false enemy can be spared but not recruited', () => {
    const e = buildEnemyUnit('goblin');
    e.hp = 1; e.recruitable = false;
    expect(canMercy(e)).toBe(true);
    expect(canRecruit(e)).toBe(false);
  });
});

describe('mercy: spare', () => {
  it('spare removes the enemy from the field, counts mercy, and still grants xp', () => {
    const h = buildHeroUnit('warrior', 1);
    const e = buildEnemyUnit('goblin'); e.hp = 3;
    const state = createBattle([h], [e]);
    const { events } = resolveAction(state, { type: 'mercy', mode: 'spare', actorId: 'warrior', targetId: e.id }, fixedRng());
    expect(events.some((ev) => ev.type === 'spare')).toBe(true);
    expect(e.alive).toBe(false);
    expect(e.resolved).toBe('spared');
    expect(state.mercied).toBe(1);
    expect(isOver(state)).toBe('victory');     // spared enemy doesn't block victory
    expect(spoils(state).xp).toBe(6);          // sparing still pays full xp (D5)
  });

  it('mercy on a full-HP enemy fizzles (no state change)', () => {
    const h = buildHeroUnit('warrior', 1);
    const e = buildEnemyUnit('goblin');
    const state = createBattle([h], [e]);
    const { events } = resolveAction(state, { type: 'mercy', mode: 'spare', actorId: 'warrior', targetId: e.id }, fixedRng());
    expect(events[0].type).toBe('fizzle');
    expect(e.alive).toBe(true);
    expect(state.mercied || 0).toBe(0);
  });
});

describe('mercy: recruit', () => {
  it('recruit succeeds on a near-dead enemy and emits a recruit event', () => {
    const h = buildHeroUnit('warrior', 1);
    const e = buildEnemyUnit('goblin'); e.hp = 1; // chance ≈ 0.93
    const state = createBattle([h], [e]);
    const { events } = resolveAction(state, { type: 'mercy', mode: 'recruit', actorId: 'warrior', targetId: e.id }, null);
    const rec = events.find((ev) => ev.type === 'recruit');
    expect(rec).toBeTruthy();
    expect(rec.refId).toBe('goblin');
    expect(e.alive).toBe(false);
    expect(e.resolved).toBe('recruited');
    expect(state.recruited).toBe(1);
    expect(state.mercied).toBe(1); // recruit also counts toward the merciful ending
  });

  it('recruit can fail — enemy stays alive, turn consumed', () => {
    // At max-eligible HP (0.3·maxHp) chance is 0.7, so ~30% of seeds fail.
    let sawFail = false;
    for (let s = 1; s <= 40 && !sawFail; s++) {
      const e = buildEnemyUnit('wisp'); e.hp = Math.floor(e.maxHp * 0.3);
      const st = createBattle([buildHeroUnit('warrior', 1)], [e]);
      const { events } = resolveAction(st, { type: 'mercy', mode: 'recruit', actorId: 'warrior', targetId: e.id }, createRng(s));
      if (events.some((ev) => ev.type === 'recruitFail')) {
        sawFail = true;
        expect(e.alive).toBe(true);
        expect(st.recruited || 0).toBe(0);
      }
    }
    expect(sawFail).toBe(true);
  });

  it('recruit on a non-recruitable enemy fizzles', () => {
    const e = buildEnemyUnit('goblin'); e.hp = 1; e.recruitable = false;
    const st = createBattle([buildHeroUnit('warrior', 1)], [e]);
    const { events } = resolveAction(st, { type: 'mercy', mode: 'recruit', actorId: 'warrior', targetId: e.id }, null);
    expect(events[0].type).toBe('fizzle');
    expect(e.alive).toBe(true);
  });
});

describe('slain counter', () => {
  it('killing an enemy increments state.slain', () => {
    const h = buildHeroUnit('warrior', 5);
    const e = buildEnemyUnit('bat'); e.hp = 1;
    const state = createBattle([h], [e]);
    resolveAction(state, { type: 'attack', actorId: 'warrior', targetId: e.id }, fixedRng());
    expect(state.slain).toBe(1);
  });
});

describe('branchOutcome (per-enemy spare-vs-slay, for content gating)', () => {
  // A miniboss + an unrelated minion. The branch must track the SPECIFIC
  // enemy, not the battle-wide mercy tally — sparing the minion must NOT make
  // a slain miniboss read as 'spared' (the cross-model catch behind D4).
  it("reads 'spared' when the target enemy was spared, ignoring other mercy", () => {
    const h = buildHeroUnit('warrior', 5);
    const knight = buildEnemyUnit('goblin'); knight.hp = 2; // stand-in miniboss
    const minion = buildEnemyUnit('bat'); minion.hp = 1;
    const state = createBattle([h], [knight, minion]);
    resolveAction(state, { type: 'mercy', mode: 'spare', actorId: 'warrior', targetId: knight.id }, fixedRng());
    resolveAction(state, { type: 'attack', actorId: 'warrior', targetId: minion.id }, fixedRng());
    expect(branchOutcome(state, 'goblin')).toBe('spared');
  });

  it("reads 'slain' for a killed target even when a minion was spared", () => {
    const h = buildHeroUnit('warrior', 9);
    const knight = buildEnemyUnit('goblin'); knight.hp = 1;
    const minion = buildEnemyUnit('bat'); minion.hp = 2;
    const state = createBattle([h], [knight, minion]);
    resolveAction(state, { type: 'mercy', mode: 'spare', actorId: 'warrior', targetId: minion.id }, fixedRng());
    resolveAction(state, { type: 'attack', actorId: 'warrior', targetId: knight.id }, fixedRng());
    expect(state.mercied).toBe(1);                 // a mercy DID happen this fight
    expect(branchOutcome(state, 'goblin')).toBe('slain'); // …but not on the knight
  });

  it("counts a recruited target as 'spared'", () => {
    const h = buildHeroUnit('warrior', 5);
    const knight = buildEnemyUnit('goblin'); knight.hp = 1;
    const state = createBattle([h], [knight]);
    resolveAction(state, { type: 'mercy', mode: 'recruit', actorId: 'warrior', targetId: knight.id }, null);
    expect(branchOutcome(state, 'goblin')).toBe('spared');
  });

  it("defaults to 'slain' for an enemy that was never in the battle", () => {
    const state = createBattle([buildHeroUnit('warrior', 1)], [buildEnemyUnit('bat')]);
    expect(branchOutcome(state, 'fallen_knight')).toBe('slain');
  });
});

describe('round advance', () => {
  it('starts a new round after all units act', () => {
    const state = createBattle([buildHeroUnit('huntress', 1)], [buildEnemyUnit('walker')]);
    const r0 = state.round;
    const n = state.turnOrder.length;
    for (let i = 0; i < n; i++) advanceTurn(state);
    expect(state.round).toBe(r0 + 1);
  });
});

describe('Fabula Points actions', () => {
  it('lastStand (불굴) leaves the target at 1 HP instead of dying, once', () => {
    const hero = buildHeroUnit('knight', 1);
    const ogre = buildEnemyUnit('bog_brute');
    ogre.atk = 9999; // guarantee a lethal hit
    const state = createBattle([hero], [ogre]);
    resolveAction(state, { type: 'lastStand', actorId: hero.id, targetId: hero.id }, null);
    expect(hero.lastStand).toBe(true);
    // A massive hit that would kill is clamped to 1 HP, and the flag is consumed.
    const evs = resolveAction(state, { type: 'attack', actorId: ogre.id, targetId: hero.id }, null).events;
    expect(hero.alive).toBe(true);
    expect(hero.hp).toBe(1);
    expect(hero.lastStand).toBe(false);
    expect(evs.some((e) => e.type === 'lastStand')).toBe(true);
    // Next lethal hit kills normally (flag was one-shot).
    resolveAction(state, { type: 'attack', actorId: ogre.id, targetId: hero.id, heavy: true }, null);
    expect(hero.alive).toBe(false);
  });

  it('inspire (고무) grants every living hero +0.3 atkBuff', () => {
    const a = buildHeroUnit('knight', 3);
    const b = buildHeroUnit('warrior', 3);
    const state = createBattle([a, b], [buildEnemyUnit('walker')]);
    resolveAction(state, { type: 'inspire', actorId: a.id }, null);
    expect(a.atkBuff).toBeCloseTo(0.3);
    expect(b.atkBuff).toBeCloseTo(0.3);
  });

  it('rally (재기) revives a fallen hero at 15% HP', () => {
    const a = buildHeroUnit('knight', 5);
    const b = buildHeroUnit('warrior', 5);
    const state = createBattle([a, b], [buildEnemyUnit('walker')]);
    b.hp = 0; b.alive = false; b.status = { poison: 3 };
    const evs = resolveAction(state, { type: 'rally', actorId: a.id, targetId: b.id }, null).events;
    expect(b.alive).toBe(true);
    expect(b.hp).toBe(Math.max(1, Math.round(b.maxHp * 0.15)));
    expect(b.status.poison).toBeUndefined(); // ailments cleared on revive
    expect(evs.some((e) => e.type === 'rally')).toBe(true);
  });

  it('rally on a living hero fizzles (no double-heal exploit)', () => {
    const a = buildHeroUnit('knight', 5);
    const b = buildHeroUnit('warrior', 5);
    const state = createBattle([a, b], [buildEnemyUnit('walker')]);
    const evs = resolveAction(state, { type: 'rally', actorId: a.id, targetId: b.id }, null).events;
    expect(evs.some((e) => e.type === 'fizzle' && e.reason === 'rally')).toBe(true);
  });
});

// ===== Class-rework mechanics (physical skills, combat states, new debuffs) =====
describe('physical skill damage (skillDamage)', () => {
  it('atk-scaled: power adds to attacker atk, respects def', () => {
    const a = makeUnit({ atk: 20, atkBuff: 0 });
    const t = makeUnit({ def: 10 });
    // atk 20 + power 10 = 30; 30*30/(30+10) = 22.5 → 22 (rng null → variance 1.0)
    expect(skillDamage({ power: 10, physical: true }, a, t, null)).toBe(22);
  });

  it('pierce ignores def', () => {
    const a = makeUnit({ atk: 20 });
    const tank = makeUnit({ def: 100 });
    const plain = skillDamage({ power: 10, physical: true }, a, tank, null);
    const pierce = skillDamage({ power: 10, physical: true, pierce: true }, a, tank, null);
    expect(pierce).toBeGreaterThan(plain);
    expect(pierce).toBe(Math.floor(30 * 0.7)); // (atk+power)*0.7, def-independent
  });

  it('분노(rage) boosts melee skills', () => {
    const calm = makeUnit({ atk: 20, rage: 0 });
    const raging = makeUnit({ atk: 20, rage: 2 });
    const t = makeUnit({ def: 10 });
    const spell = { power: 10, physical: true, melee: true };
    expect(skillDamage(spell, raging, t, null)).toBeGreaterThan(skillDamage(spell, calm, t, null));
  });

  it('rage only helps melee skills (not ranged)', () => {
    const raging = makeUnit({ atk: 20, rage: 2 });
    const t = makeUnit({ def: 10 });
    const ranged = skillDamage({ power: 10, physical: true }, raging, t, null);
    const same = skillDamage({ power: 10, physical: true }, makeUnit({ atk: 20, rage: 0 }), t, null);
    expect(ranged).toBe(same);
  });

  it('atkScale weights multi-hit arrows below a full swing', () => {
    const a = makeUnit({ atk: 20 });
    const t = makeUnit({ def: 10 });
    const heavy = skillDamage({ power: 4, physical: true }, a, t, null);
    const light = skillDamage({ power: 4, physical: true, atkScale: 0.4 }, a, t, null);
    expect(light).toBeLessThan(heavy);
  });
});

describe('new debuffs', () => {
  it('effectiveDef: 방어약화(defdown) softens def ×0.6', () => {
    expect(effectiveDef(makeUnit({ def: 10 }))).toBe(10);
    expect(effectiveDef(makeUnit({ def: 10, status: { defdown: 2 } }))).toBe(6);
  });

  it('effectiveSpd: 둔화(slow) halves turn-speed like 동상', () => {
    expect(effectiveSpd(makeUnit({ spd: 10, status: { slow: 1 } }))).toBe(5);
  });

  it('위협(atkdown) lowers physical attack', () => {
    const t = makeUnit({ def: 5 });
    const clean = physicalDamage(makeUnit({ atk: 20 }), t, null);
    const weak = physicalDamage(makeUnit({ atk: 20, status: { atkdown: 2 } }), t, null);
    expect(weak).toBeLessThan(clean);
  });

  it('tickStatus expires the new debuffs', () => {
    const u = makeUnit({ status: { atkdown: 1, defdown: 1, slow: 1 } });
    tickStatus(u, null);
    expect(u.status.atkdown).toBeUndefined();
    expect(u.status.defdown).toBeUndefined();
    expect(u.status.slow).toBeUndefined();
  });
});

describe('combat states', () => {
  it('은신(stealth) forces a crit on the next damaging skill, then consumes', () => {
    const a = buildHeroUnit('huntress', 6); a.stealth = true;
    const e = buildEnemyUnit('bog_brute');
    const state = createBattle([a], [e]);
    const evs = resolveAction(state, { type: 'spell', actorId: a.id, spellId: 'aimedshot', targetId: e.id }, null).events;
    expect(evs.find((x) => x.type === 'spellHit').crit).toBe(true);
    expect(a.stealth).toBe(false);
  });

  it('피의 갈증(bloodlust) pays HP and enters rage', () => {
    const a = buildHeroUnit('warrior', 5);
    const state = createBattle([a], [buildEnemyUnit('walker')]);
    const hp0 = a.hp;
    resolveAction(state, { type: 'spell', actorId: a.id, spellId: 'bloodlust' }, null);
    expect(a.rage).toBe(3);
    expect(a.hp).toBeLessThan(hp0);
    expect(a.hp).toBeGreaterThan(0); // never self-kills
  });

  it('충전(charge) amplifies the next MAGIC spell ×CHARGE_MULT, then consumes', () => {
    const m = buildHeroUnit('mage', 5); m.charge = true;
    const e = buildEnemyUnit('bog_brute');
    const state = createBattle([m], [e]);
    const charged = resolveAction(state, { type: 'spell', actorId: m.id, spellId: 'arcanebolt', targetId: e.id }, null).events.find((x) => x.type === 'spellHit').amount;
    expect(m.charge).toBe(false);
    // baseline (uncharged) on a fresh identical caster
    const m2 = buildHeroUnit('mage', 5);
    const e2 = buildEnemyUnit('bog_brute');
    const s2 = createBattle([m2], [e2]);
    const base = resolveAction(s2, { type: 'spell', actorId: m2.id, spellId: 'arcanebolt', targetId: e2.id }, null).events.find((x) => x.type === 'spellHit').amount;
    expect(charged).toBe(Math.floor(base * CHARGE_MULT));
  });

  it('명상(meditate, mana kind) restores the caster MP as a flat fraction of maxMp, capped at maxMp', () => {
    const m = buildHeroUnit('mage', 6);
    const state = createBattle([m], [buildEnemyUnit('bog_brute')]);
    m.mp = 2; // enough to cast (mpCost 2)
    const spell = getSpell('meditate');
    const mpBefore = m.mp - spell.mpCost; // after paying the cost
    const evs = resolveAction(state, { type: 'spell', actorId: m.id, spellId: 'meditate' }, null).events;
    const mana = evs.find((x) => x.type === 'mana');
    expect(mana).toBeDefined();
    expect(mana.amount).toBeGreaterThan(0);
    // Restore should be ~40% of maxMp (flat, not scaled by magicScale)
    expect(mana.amount).toBe(Math.floor(m.maxMp * spell.power));
    expect(m.mp).toBe(mpBefore + mana.amount);
    expect(m.mp).toBeLessThanOrEqual(m.maxMp);
  });

  it('명상 never overflows maxMp (restore clamps)', () => {
    const m = buildHeroUnit('mage', 6);
    const state = createBattle([m], [buildEnemyUnit('bog_brute')]);
    m.mp = m.maxMp - 1; // nearly full → restore clamps to cap
    resolveAction(state, { type: 'spell', actorId: m.id, spellId: 'meditate' }, null);
    expect(m.mp).toBe(m.maxMp);
  });

  it('연사(multishot) strikes 5 times', () => {
    const a = buildHeroUnit('huntress', 5);
    const e = buildEnemyUnit('bog_brute');
    const state = createBattle([a], [e]);
    const evs = resolveAction(state, { type: 'spell', actorId: a.id, spellId: 'multishot', targetId: e.id }, null).events;
    expect(evs.filter((x) => x.type === 'spellHit').length).toBe(5);
  });

  it('분노 흡혈: melee skills heal the warrior while raging', () => {
    const w = buildHeroUnit('warrior', 5); w.rage = 2; w.hp = 12;
    const e = buildEnemyUnit('bog_brute');
    const state = createBattle([w], [e]);
    const evs = resolveAction(state, { type: 'spell', actorId: w.id, spellId: 'crushblow', targetId: e.id }, null).events;
    expect(evs.some((x) => x.type === 'lifesteal')).toBe(true);
    expect(w.hp).toBeGreaterThan(12);
  });
});

describe('shield / dodge / taunt', () => {
  it('방어막(shield) soaks damage before HP', () => {
    const h = buildHeroUnit('knight', 5); h.shield = 999;
    const e = buildEnemyUnit('walker');
    const state = createBattle([h], [e]);
    const hp0 = h.hp;
    const evs = resolveAction(state, { type: 'attack', actorId: e.id, targetId: h.id }, null).events;
    expect(h.hp).toBe(hp0);
    expect(h.shield).toBeLessThan(999);
    expect(evs.some((x) => x.type === 'shielded')).toBe(true);
  });

  it('전체 방어막(masbarrier) shields the whole party', () => {
    const k = buildHeroUnit('knight', 15);
    const w = buildHeroUnit('warrior', 5);
    const state = createBattle([k, w], [buildEnemyUnit('walker')]);
    resolveAction(state, { type: 'spell', actorId: k.id, spellId: 'masbarrier' }, null);
    expect(k.shield).toBeGreaterThan(0);
    expect(w.shield).toBeGreaterThan(0);
  });

  it('은신/회피 dodges an incoming attack', () => {
    const lowRng = { next: () => 0.1, pick: (a) => a[0], int: (a) => a };
    const h = buildHeroUnit('huntress', 6); h.stealth = true;
    const e = buildEnemyUnit('walker');
    const state = createBattle([h], [e]);
    const hp0 = h.hp;
    const evs = resolveAction(state, { type: 'attack', actorId: e.id, targetId: h.id }, lowRng).events;
    expect(evs.some((x) => x.type === 'dodge')).toBe(true);
    expect(h.hp).toBe(hp0);
  });

  it('도발(taunt) makes enemies target the taunter', () => {
    const tank = buildHeroUnit('knight', 8); tank.aggro = true;
    const other = buildHeroUnit('huntress', 8);
    const e = buildEnemyUnit('walker');
    const state = createBattle([tank, other], [e]);
    const act = enemyChooseAction(state, e.id, { pick: (a) => a[Math.floor(a.length / 2)], next: () => 0.5 });
    expect(act.targetId).toBe(tank.id);
  });
});

describe('monster skills', () => {
  // rng whose next() always passes a chance roll (returns 0 < chance).
  const hitRng = { next: () => 0, pick: (a) => a[0], int: (a) => a };
  // rng whose next() always fails a chance roll.
  const missRng = { next: () => 0.99, pick: (a) => a[0], int: (a) => a };

  it('monsterSkillDamage is atk-scaled and pierce ignores part of def', () => {
    const atkUnit = { atk: 30, atkBuff: 0, status: {} };
    const tank = { def: 30, defending: false };
    const plain = monsterSkillDamage(atkUnit, tank, { dmgMult: 1 }, null);
    const piercing = monsterSkillDamage(atkUnit, tank, { dmgMult: 1, pierce: 0.5 }, null);
    expect(piercing).toBeGreaterThan(plain); // ignoring half the def lands harder
  });

  it('damage skill hits a hero and can inflict its status', () => {
    const h = buildHeroUnit('warrior', 6);
    const e = buildEnemyUnit('spider'); // venomspit
    const state = createBattle([h], [e]);
    const hp0 = h.hp;
    const { events } = resolveMonsterSkill(state, e, { skillId: 'venomspit', targetId: h.id }, hitRng);
    expect(h.hp).toBeLessThan(hp0);
    expect(events.some((x) => x.type === 'monsterSkillHit')).toBe(true);
    expect(h.status.poison).toBeGreaterThan(0); // hitRng passes the inflict roll
  });

  it("AoE damage skill (target:'all') hits every hero", () => {
    const a = buildHeroUnit('knight', 8);
    const b = buildHeroUnit('warrior', 8);
    const c = buildHeroUnit('huntress', 8);
    const e = buildEnemyUnit('imp'); // firebreath, target:'all'
    const state = createBattle([a, b, c], [e]);
    const hps = [a.hp, b.hp, c.hp];
    resolveMonsterSkill(state, e, { skillId: 'firebreath' }, hitRng);
    expect(a.hp).toBeLessThan(hps[0]);
    expect(b.hp).toBeLessThan(hps[1]);
    expect(c.hp).toBeLessThan(hps[2]);
  });

  it('drain skill heals the caster for a fraction of damage', () => {
    const h = buildHeroUnit('knight', 10);
    const e = buildEnemyUnit('revenant'); // lifedrain healPct 0.6
    e.hp = 50; // wounded so the heal is observable
    const state = createBattle([h], [e]);
    const { events } = resolveMonsterSkill(state, e, { skillId: 'lifedrain', targetId: h.id }, hitRng);
    expect(e.hp).toBeGreaterThan(50);
    expect(events.some((x) => x.type === 'drainHeal')).toBe(true);
  });

  it('ailment skill applies a status without dealing damage', () => {
    const a = buildHeroUnit('knight', 8);
    const b = buildHeroUnit('warrior', 8);
    const e = buildEnemyUnit('bog_witch'); // curse → weaken all
    const state = createBattle([a, b], [e]);
    const hp0 = a.hp;
    resolveMonsterSkill(state, e, { skillId: 'curse' }, hitRng);
    expect(a.hp).toBe(hp0); // no damage
    expect(a.status.weaken).toBeGreaterThan(0);
    expect(b.status.weaken).toBeGreaterThan(0);
  });

  it('selfbuff (frenzy) raises the caster atk and spd', () => {
    const h = buildHeroUnit('knight', 8);
    const e = buildEnemyUnit('magma_drake');
    const state = createBattle([h], [e]);
    const atk0 = e.atk; const spd0 = e.spd;
    resolveMonsterSkill(state, e, { skillId: 'frenzy' }, hitRng);
    expect(e.atk).toBe(Math.round(atk0 * 1.3));
    expect(e.spd).toBe(spd0 + 4);
  });

  it('selfheal (monregen) restores the caster HP', () => {
    const h = buildHeroUnit('knight', 8);
    const e = buildEnemyUnit('bog_witch');
    e.hp = 100;
    const state = createBattle([h], [e]);
    resolveMonsterSkill(state, e, { skillId: 'monregen' }, hitRng);
    expect(e.hp).toBeGreaterThan(100);
  });

  it('selfdestruct (kamikaze) blasts every foe and kills the caster', () => {
    const a = buildHeroUnit('knight', 8);
    const b = buildHeroUnit('warrior', 8);
    const e = buildEnemyUnit('bog_brute'); // any caster; cast kamikaze directly
    const state = createBattle([a, b], [e]);
    const hps = [a.hp, b.hp];
    const { events } = resolveMonsterSkill(state, e, { skillId: 'kamikaze' }, hitRng);
    expect(a.hp).toBeLessThan(hps[0]);
    expect(b.hp).toBeLessThan(hps[1]);
    expect(e.alive).toBe(false);            // caster self-destructs
    expect(state.slain).toBe(1);            // tallied as a kill (full xp via spoils)
    expect(events.some((x) => x.type === 'death')).toBe(true);
  });

  it('allybuff (warcry) raises atk for every living ally on the caster side', () => {
    const h = buildHeroUnit('knight', 8);
    const e1 = buildEnemyUnit('war_drummer');
    const e2 = buildEnemyUnit('goblin');
    const state = createBattle([h], [e1, e2]);
    const a1 = e1.atk; const a2 = e2.atk;
    resolveMonsterSkill(state, e1, { skillId: 'warcry' }, hitRng);
    expect(e1.atk).toBe(Math.round(a1 * 1.25));
    expect(e2.atk).toBe(Math.round(a2 * 1.25)); // ally buffed too
  });

  it('guard (barrier) grants an absorb shield to the caster side', () => {
    const h = buildHeroUnit('knight', 8);
    const e1 = buildEnemyUnit('rune_guardian');
    const e2 = buildEnemyUnit('goblin');
    const state = createBattle([h], [e1, e2]);
    resolveMonsterSkill(state, e1, { skillId: 'barrier' }, hitRng);
    expect(e1.shield).toBeGreaterThan(0);
    expect(e2.shield).toBeGreaterThan(0); // whole line shielded (target:'allies')
  });

  it('summon spawns minions: count for victory, but no xp/mercy/slain pollution', () => {
    const h = buildHeroUnit('knight', 12);
    const e = buildEnemyUnit('necromancer');
    const state = createBattle([h], [e]);
    const enemiesBefore = living(state, 'enemy').length;
    const xpBefore = spoils(state).xp;
    const { events } = resolveMonsterSkill(state, e, { skillId: 'summon' }, hitRng);
    const minions = living(state, 'enemy').filter((u) => u.summoned);
    expect(minions.length).toBe(2);                              // count: 2
    expect(living(state, 'enemy').length).toBe(enemiesBefore + 2); // count for isOver victory
    expect(events.filter((x) => x.type === 'summon').length).toBe(2);
    expect(spoils(state).xp).toBe(xpBefore);                     // summoned grant NO xp (no farm)
    // unspareable + unrecruitable even at low HP
    minions.forEach((m) => { m.hp = 1; expect(canMercy(m)).toBe(false); expect(canRecruit(m)).toBe(false); });
    // killing a summoned minion does NOT tally state.slain (no mercy/slain pollution)
    const slainBefore = state.slain || 0;
    resolveAction(state, { type: 'attack', actorId: h.id, targetId: minions[0].id }, fixedRng());
    expect(minions[0].alive).toBe(false);
    expect(state.slain || 0).toBe(slainBefore);
  });

  it('summon respects fieldCap (never floods past the cap)', () => {
    const h = buildHeroUnit('knight', 12);
    const e = buildEnemyUnit('necromancer');
    const state = createBattle([h], [e]);
    // cast many times; living enemies must never exceed the skill's fieldCap (8)
    for (let i = 0; i < 12; i++) resolveMonsterSkill(state, e, { skillId: 'summon' }, hitRng);
    expect(living(state, 'enemy').length).toBeLessThanOrEqual(8);
  });

  it('AI fires a skill when its chance passes, else basic-attacks', () => {
    const h = buildHeroUnit('warrior', 6);
    const e = buildEnemyUnit('spider');
    e.skills = [{ id: 'venomspit', chance: 0.35, cd: 2 }]; // pin to one skill (roster-proof)
    const state = createBattle([h], [e]);
    const act = enemyChooseAction(state, e.id, hitRng);
    expect(act.type).toBe('monsterSkill');
    expect(act.skillId).toBe('venomspit');
    const e2 = buildEnemyUnit('spider');
    e2.skills = [{ id: 'venomspit', chance: 0.35, cd: 2 }];
    const s2 = createBattle([buildHeroUnit('warrior', 6)], [e2]);
    expect(enemyChooseAction(s2, e2.id, missRng).type).toBe('attack');
  });

  it('cooldown blocks immediate reuse; ticks down on a new round', () => {
    const h = buildHeroUnit('warrior', 6);
    const e = buildEnemyUnit('spider'); // venomspit cd 2
    e.skills = [{ id: 'venomspit', chance: 0.35, cd: 2 }]; // pin to one skill (roster-proof)
    const state = createBattle([h], [e]);
    expect(enemyChooseAction(state, e.id, hitRng).type).toBe('monsterSkill'); // cd→2
    expect(enemyChooseAction(state, e.id, hitRng).type).toBe('attack'); // still on cd
    startRound(state); // cd 2→1
    startRound(state); // cd 1→0 ready
    expect(enemyChooseAction(state, e.id, hitRng).type).toBe('monsterSkill');
  });

  it('per-battle max caps how often a skill can fire', () => {
    const h = buildHeroUnit('warrior', 6);
    const e = buildEnemyUnit('spider');
    e.skills = [{ id: 'frenzy', chance: 1, cd: 0, max: 1 }];
    const state = createBattle([h], [e]);
    expect(enemyChooseAction(state, e.id, hitRng).type).toBe('monsterSkill'); // used→1
    expect(enemyChooseAction(state, e.id, hitRng).type).toBe('attack'); // max reached
  });

  it('boss enrage swaps to its phase-2 skill set and resets cooldowns', () => {
    const h = buildHeroUnit('knight', 16);
    const e = buildEnemyUnit('magma_drake');
    const state = createBattle([h], [e]);
    expect(e.skills.some((s) => s.id === 'frenzy')).toBe(false); // P1: firebreath only
    e.hp = Math.floor(e.maxHp * 0.4); // cross the phase-2 threshold
    enrageBosses(state);
    expect(e.enraged).toBe(true);
    expect(e.skills.some((s) => s.id === 'frenzy')).toBe(true); // P2 kit
  });

  it('every boss has a P1 kit and a frenzy P2 kit (two-phase fights)', () => {
    for (const id of ['skeleton_king', 'werewolf_king', 'fallen_emperor']) {
      const boss = buildEnemyUnit(id);
      expect(boss.skills.length).toBeGreaterThan(0); // P1: no longer a stat-only boss
      expect(boss.phase2.skills.some((s) => s.id === 'frenzy')).toBe(true); // P2 enrage kit
      const state = createBattle([buildHeroUnit('knight', 16)], [boss]);
      boss.hp = Math.floor(boss.maxHp * 0.4);
      enrageBosses(state);
      expect(boss.skills.some((s) => s.id === 'frenzy')).toBe(true); // swapped on enrage
    }
  });
});

describe('bestiary-2 mechanics', () => {
  const hitRng = { next: () => 0, pick: (a) => a[0], int: (a) => a };     // always passes
  const missRng = { next: () => 0.99, pick: (a) => a[0], int: (a) => a }; // always fails

  it('petrify / stun skip a turn via tickStatus', () => {
    const u = makeUnit({ id: 'x', maxHp: 50, hp: 50 });
    applyStatus(u, 'petrify', 2);
    expect(tickStatus(u, hitRng).skip).toBe(true); // petrified → skip
    applyStatus(u, 'stun', 1);
    const r = tickStatus(u, hitRng);
    expect(r.skip).toBe(true);            // stunned → skip
    expect(u.status.stun).toBeUndefined(); // 1-turn stun expired
  });

  it('anti-stunlock: a unit loses at most 2 turns in a row, then shakes off', () => {
    const u = makeUnit({ id: 'x', maxHp: 50, hp: 50 });
    applyStatus(u, 'petrify', 9); // long lock
    expect(tickStatus(u, hitRng).skip).toBe(true);  // 1
    expect(tickStatus(u, hitRng).skip).toBe(true);  // 2
    const third = tickStatus(u, hitRng);
    expect(third.skip).toBe(false);                  // capped → acts
    expect(third.events.some((e) => e.type === 'shakeOff')).toBe(true);
    expect(u.status.petrify).toBeUndefined();        // lock cleared on shake-off
  });

  it('blind makes a basic attack miss (no damage)', () => {
    const e = buildEnemyUnit('goblin');
    const h = buildHeroUnit('warrior', 6);
    const state = createBattle([h], [e]);
    e.status.blind = 2;
    const hp0 = h.hp;
    const { events } = resolveAction(state, { type: 'attack', actorId: e.id, targetId: h.id }, hitRng);
    expect(events.some((ev) => ev.type === 'miss' && ev.reason === 'blind')).toBe(true);
    expect(h.hp).toBe(hp0); // missed → unharmed
  });

  it('flurry strikes 3 times (hits) and divebomb can crit (highCrit)', () => {
    const e = buildEnemyUnit('wolf'); e.atk = 40;
    const h = buildHeroUnit('mage', 6);
    const state = createBattle([h], [e]);
    const flur = resolveMonsterSkill(state, e, { skillId: 'flurry', targetId: h.id }, hitRng);
    expect(flur.events.filter((ev) => ev.type === 'monsterSkillHit').length).toBe(3);
    const e2 = buildEnemyUnit('frost_crow'); e2.atk = 40;
    const s2 = createBattle([buildHeroUnit('mage', 6)], [e2]);
    const dive = resolveMonsterSkill(s2, e2, { skillId: 'divebomb', targetId: s2.units[0].id }, hitRng);
    expect(dive.events.find((ev) => ev.type === 'monsterSkillHit').crit).toBe(true);
  });

  it('petrify ailment honors its chance (lands on hit, resists on miss)', () => {
    const make = () => {
      const e = buildEnemyUnit('medusa_head');
      const h = buildHeroUnit('warrior', 6);
      return { e, h, state: createBattle([h], [e]) };
    };
    const a = make();
    resolveMonsterSkill(a.state, a.e, { skillId: 'petrify', targetId: a.h.id }, hitRng);
    expect(a.h.status.petrify).toBeGreaterThan(0);
    const b = make();
    const r = resolveMonsterSkill(b.state, b.e, { skillId: 'petrify', targetId: b.h.id }, missRng);
    expect(b.h.status.petrify).toBeUndefined();
    expect(r.events.some((ev) => ev.type === 'inflictResist')).toBe(true);
  });

  it('stoneskin raises def; wardrum buffs the whole enemy line', () => {
    const g = buildEnemyUnit('stone_gargoyle'); const def0 = g.def;
    const s1 = createBattle([buildHeroUnit('warrior', 6)], [g]);
    resolveMonsterSkill(s1, g, { skillId: 'stoneskin' }, hitRng);
    expect(g.def).toBeGreaterThan(def0);

    const d = buildEnemyUnit('war_drummer'); const ally = buildEnemyUnit('goblin');
    const a0 = ally.atk;
    const s2 = createBattle([buildHeroUnit('warrior', 6)], [d, ally]);
    resolveMonsterSkill(s2, d, { skillId: 'wardrum' }, hitRng);
    expect(ally.atk).toBeGreaterThan(a0); // whole side surged
  });

  it('AI skips allybuff (wardrum) when the caster fights alone', () => {
    const lone = buildEnemyUnit('war_drummer');
    const s1 = createBattle([buildHeroUnit('warrior', 6)], [lone]);
    expect(enemyChooseAction(s1, lone.id, hitRng).type).toBe('attack'); // solo → no buff

    const d = buildEnemyUnit('war_drummer'); const ally = buildEnemyUnit('goblin');
    const s2 = createBattle([buildHeroUnit('warrior', 6)], [d, ally]);
    const act = enemyChooseAction(s2, d.id, hitRng);
    expect(act.type).toBe('monsterSkill'); // 2+ allies → buff fires
    expect(act.skillId).toBe('wardrum');
  });
});

// 인연공격 (bond strike) — duo combo resolver. The scene assembles base+mod and
// rides them in; battle.js applies them purely (no bonds import). See bondSkills.js.
describe('bondStrike (인연공격) resolver', () => {
  const hero = (refId, over = {}) => makeUnit({ id: refId, refId, side: 'hero', name: refId, maxHp: 100, hp: 100, atk: 40, def: 10, spd: 10, ...over });
  const foe = (over = {}) => makeUnit({ id: 'e1', refId: 'walker', side: 'enemy', name: 'walker', maxHp: 300, hp: 300, atk: 20, def: 20, spd: 8, ...over });
  const setup = (heroes, enemies) => createBattle(heroes, enemies);
  const baseOne = { physical: true, target: 'one', power: 30 };
  const strike = (actorId, partnerId, extra = {}) => ({ type: 'bondStrike', actorId, partnerId, comboId: 'duo_test', base: baseOne, targetId: 'e1', mod: {}, ...extra });

  it('deals damage to the target and sets the once-per-battle flag', () => {
    const st = setup([hero('knight'), hero('warrior')], [foe()]);
    const { events } = resolveAction(st, strike('knight', 'warrior'), fixedRng());
    expect(events.some((e) => e.type === 'bondStrike')).toBe(true);
    expect(events.some((e) => e.type === 'bondHit')).toBe(true);
    expect(st.units.find((u) => u.id === 'e1').hp).toBeLessThan(300);
    expect(st.bondStrikeUsed).toBe(true);
  });

  it('createBattle pre-initializes bondStrikeUsed to false', () => {
    expect(setup([hero('knight')], [foe()]).bondStrikeUsed).toBe(false);
  });

  it('fizzles (no flag, no damage) when the partner is down', () => {
    const st = setup([hero('knight'), hero('warrior', { alive: false, hp: 0 })], [foe()]);
    const { events } = resolveAction(st, strike('knight', 'warrior'), fixedRng());
    expect(events.some((e) => e.type === 'fizzle' && e.reason === 'bond')).toBe(true);
    expect(st.bondStrikeUsed).toBe(false);
    expect(st.units.find((u) => u.id === 'e1').hp).toBe(300);
  });

  it('mod.applyDefdown lands BEFORE damage so def is softened that strike', () => {
    const stA = setup([hero('knight'), hero('warrior')], [foe()]);
    const plain = resolveAction(stA, strike('knight', 'warrior'), createRng(7));
    const dPlain = plain.events.find((e) => e.type === 'bondHit').amount;
    const stB = setup([hero('knight'), hero('warrior')], [foe()]);
    const sundered = resolveAction(stB, strike('knight', 'warrior', { mod: { applyDefdown: true } }), createRng(7));
    const dSunder = sundered.events.find((e) => e.type === 'bondHit').amount;
    expect(stB.units.find((u) => u.id === 'e1').status.defdown).toBeGreaterThan(0);
    expect(dSunder).toBeGreaterThan(dPlain); // defdown applied pre-damage
  });

  it('mod.dmgMult multiplies the dealt damage', () => {
    const stA = setup([hero('knight'), hero('warrior')], [foe()]);
    const d1 = resolveAction(stA, strike('knight', 'warrior'), createRng(3)).events.find((e) => e.type === 'bondHit').amount;
    const stB = setup([hero('knight'), hero('warrior')], [foe()]);
    const d2 = resolveAction(stB, strike('knight', 'warrior', { mod: { dmgMult: 1.4 } }), createRng(3)).events.find((e) => e.type === 'bondHit').amount;
    expect(d2).toBe(Math.floor(d1 * 1.4));
  });

  it('mod.lifesteal heals both casters from damage dealt', () => {
    const st = setup([hero('knight', { hp: 50 }), hero('warrior', { hp: 50 })], [foe()]);
    resolveAction(st, strike('knight', 'warrior', { mod: { lifesteal: 0.5 } }), fixedRng());
    expect(st.units.find((u) => u.refId === 'knight').hp).toBeGreaterThan(50);
    expect(st.units.find((u) => u.refId === 'warrior').hp).toBeGreaterThan(50);
  });

  it('mod.healCasters and shieldCasters apply to both casters', () => {
    const st = setup([hero('knight', { hp: 40 }), hero('warrior', { hp: 40 })], [foe()]);
    resolveAction(st, strike('knight', 'warrior', { mod: { healCasters: 0.15, shieldCasters: 0.20 } }), fixedRng());
    const k = st.units.find((u) => u.refId === 'knight');
    expect(k.hp).toBe(40 + 15);   // 15% of 100 maxHp
    expect(k.shield).toBe(20);    // 20% of 100 maxHp
  });

  it('AoE base (target:all) hits every living enemy', () => {
    const st = setup([hero('knight'), hero('warrior')], [foe(), makeUnit({ id: 'e2', refId: 'walker', side: 'enemy', name: 'w2', maxHp: 200, hp: 200, atk: 10, def: 10, spd: 5 })]);
    const aoe = { type: 'bondStrike', actorId: 'knight', partnerId: 'warrior', comboId: 'duo_aoe', base: { physical: true, target: 'all', power: 20 }, mod: {} };
    resolveAction(st, aoe, fixedRng());
    expect(st.units.find((u) => u.id === 'e1').hp).toBeLessThan(300);
    expect(st.units.find((u) => u.id === 'e2').hp).toBeLessThan(200);
  });

  // 인연 필살기 (trio/quad) — N partners via partnerIds[].
  it('trio/quad ult: partnerIds[] all join, riders heal every caster', () => {
    const st = setup([hero('knight', { hp: 40 }), hero('warrior', { hp: 40 }), hero('huntress', { hp: 40 })], [foe()]);
    const ult = { type: 'bondStrike', actorId: 'knight', partnerIds: ['warrior', 'huntress'], comboId: 'bond_ult_trio', base: { physical: true, target: 'all', power: 26 }, mod: { healCasters: 0.15 } };
    const { events } = resolveAction(st, ult, fixedRng());
    expect(events.find((e) => e.type === 'bondStrike').partnerIds).toEqual(['warrior', 'huntress']);
    // all three casters healed 15% of 100 maxHp
    for (const ref of ['knight', 'warrior', 'huntress']) expect(st.units.find((u) => u.refId === ref).hp).toBe(55);
    expect(st.bondStrikeUsed).toBe(true);
  });

  it('ult fizzles if ANY listed partner is down', () => {
    const st = setup([hero('knight'), hero('warrior'), hero('huntress', { alive: false, hp: 0 })], [foe()]);
    const ult = { type: 'bondStrike', actorId: 'knight', partnerIds: ['warrior', 'huntress'], comboId: 'bond_ult_trio', base: { physical: true, target: 'all', power: 26 }, mod: {} };
    const { events } = resolveAction(st, ult, fixedRng());
    expect(events.some((e) => e.type === 'fizzle' && e.reason === 'bond')).toBe(true);
    expect(st.bondStrikeUsed).toBe(false);
  });
});

// --- Equipment passive effects (장신구 특수효과, /plan-eng-review 2026-05-30) ---
describe('accessory passives', () => {
  const miniState = (units) => ({ units, round: 0, turnOrder: [], turnIndex: 0 });

  it('equipPassives merges a single accessory + empty equip → zeros', () => {
    const p = equipPassives({ weapon: null, armor: null, accessory: 'thorn_band' });
    expect(p.counter).toBe(0.3);
    expect(p.regenHp).toBe(0);
    const empty = equipPassives({ weapon: null, armor: null, accessory: null });
    expect(empty).toEqual({ resist: {}, regenHp: 0, regenMp: 0, counter: 0, crit: 0, dmgReduce: 0 });
    // antitoxin resist map
    expect(equipPassives({ accessory: 'antitoxin_charm' }).resist.poison).toBe(0.6);
  });

  it('regen heals a fraction of max at round start, clamped (no overheal)', () => {
    const u = makeUnit({ id: 'h', side: 'hero', maxHp: 100, hp: 50, maxMp: 20, mp: 10, passives: { regenHp: 0.05, regenMp: 0.05 } });
    const e = makeUnit({ id: 'e', side: 'enemy', maxHp: 30, hp: 30 });
    const st = miniState([u, e]);
    startRound(st);
    expect(u.hp).toBe(55); // +floor(100*0.05)
    expect(u.mp).toBe(11); // +floor(20*0.05)
    u.hp = 98; startRound(st);
    expect(u.hp).toBe(100); // clamp, no overheal past maxHp
  });

  it('resist passive lowers inflict chance + emits resist when it saves you', () => {
    const target = makeUnit({ id: 'h', side: 'hero', maxHp: 100, hp: 100, def: 0, passives: { resist: { poison: 1.0 } } });
    const actor = makeUnit({ id: 'e', side: 'enemy', maxHp: 50, hp: 50, atk: 10, inflict: { status: 'poison', chance: 1.0, turns: 3 } });
    const st = miniState([actor, target]);
    const { events } = resolveAction(st, { type: 'attack', actorId: 'e', targetId: 'h' }, createRng(1));
    expect(target.status.poison).toBeFalsy();              // full resist → never inflicted
    expect(events.some((e) => e.type === 'inflictResist' && e.status === 'poison')).toBe(true);
  });

  it('dmgReduce reduces incoming damage below the rolled amount', () => {
    const target = makeUnit({ id: 'h', side: 'hero', maxHp: 1000, hp: 1000, def: 0, passives: { dmgReduce: 0.5 } });
    const actor = makeUnit({ id: 'e', side: 'enemy', maxHp: 50, hp: 50, atk: 40 });
    const st = miniState([actor, target]);
    const { events } = resolveAction(st, { type: 'attack', actorId: 'e', targetId: 'h' }, createRng(2));
    const atk = events.find((e) => e.type === 'attack');
    const loss = 1000 - target.hp;
    expect(loss).toBe(Math.max(1, Math.floor(atk.amount * 0.5)));
    expect(loss).toBeLessThan(atk.amount);
    // emits a dmgReduce signal (cosmetic — the amount actually shaved off)
    const dr = events.find((e) => e.type === 'dmgReduce');
    expect(dr).toBeTruthy();
    expect(dr.unitId).toBe('h');
    expect(dr.amount).toBe(atk.amount - loss);
  });

  it('counter strikes back once (no re-counter recursion)', () => {
    const target = makeUnit({ id: 'h', side: 'hero', maxHp: 1000, hp: 1000, atk: 30, def: 0, passives: { counter: 1.0 } });
    const actor = makeUnit({ id: 'e', side: 'enemy', maxHp: 1000, hp: 1000, atk: 20, def: 0 });
    const st = miniState([actor, target]);
    const { events } = resolveAction(st, { type: 'attack', actorId: 'e', targetId: 'h' }, createRng(3));
    expect(events.filter((e) => e.type === 'counter').length).toBe(1); // exactly one — no re-counter
    expect(actor.hp).toBeLessThan(1000);                               // attacker took the counter
  });

  it('buildHeroUnit folds equip passives onto the unit (wiring)', () => {
    const u = buildHeroUnit('knight', 5, { equip: {}, passives: equipPassives({ accessory: 'thorn_band' }) });
    expect(u.passives.counter).toBe(0.3);
    const bare = buildHeroUnit('knight', 5, {});
    expect(bare.passives).toEqual({}); // no passives opt → empty (all hooks no-op)
  });

  it('crit passive folds into the basic-attack crit roll', () => {
    const target = makeUnit({ id: 'h', side: 'enemy', maxHp: 1000, hp: 1000, def: 0 });
    const actor = makeUnit({ id: 'a', side: 'hero', maxHp: 50, hp: 50, atk: 10, passives: { crit: 1.0 } });
    const st = miniState([actor, target]);
    const { events } = resolveAction(st, { type: 'attack', actorId: 'a', targetId: 'h' }, createRng(4));
    expect(events.find((e) => e.type === 'attack').crit).toBe(true);
  });
});

// bleed (출혈) — 쌍검사 signature physical DoT (poison/burn 패밀리에 추가).
describe('bleed status (출혈)', () => {
  it('ticks ~6% maxHp/turn and emits bleedTick, then expires', () => {
    const u = makeUnit({ id: 'h', side: 'hero', maxHp: 100, hp: 100, alive: true });
    applyStatus(u, 'bleed', 2);
    const r1 = tickStatus(u, createRng(1));
    expect(r1.events.find((e) => e.type === 'bleedTick').amount).toBe(6);
    expect(u.hp).toBe(94);
    tickStatus(u, createRng(2));
    expect(u.status.bleed).toBeUndefined(); // 2 turns → gone
  });

  it('undead are immune to bleed (피가 없다) — other statuses still apply', () => {
    const z = makeUnit({ id: 'z', side: 'enemy', maxHp: 80, hp: 80, family: 'undead', alive: true });
    applyStatus(z, 'bleed', 3);
    expect(z.status.bleed).toBeUndefined();
    applyStatus(z, 'burn', 3); // non-bleed unaffected
    expect(z.status.burn).toBe(3);
  });

  it('cleanse-style cure (all STATUS_TYPES) clears bleed', () => {
    const u = makeUnit({ id: 'h', side: 'hero', maxHp: 100, hp: 100 });
    applyStatus(u, 'bleed', 3);
    expect(cureStatus(u, 'bleed')).toBe(true);
    expect(u.status.bleed).toBeUndefined();
  });

  it('DoT stacking rule: re-apply REFRESHES to the longer duration, never accumulates', () => {
    const u = makeUnit({ id: 'h', side: 'hero', maxHp: 100, hp: 100 });
    applyStatus(u, 'bleed', 3);
    applyStatus(u, 'bleed', 2); // shorter — keeps the longer (3), not 5
    expect(u.status.bleed).toBe(3);
    applyStatus(u, 'bleed', 5); // longer — refreshes up to 5, not 8
    expect(u.status.bleed).toBe(5);
    // one tick removes a single fixed % (no multi-stack damage)
    const r = tickStatus(u, createRng(1));
    expect(r.events.filter((e) => e.type === 'bleedTick')).toHaveLength(1);
    expect(u.hp).toBe(94); // 6% once, not stacked
  });
});

// 쌍검사 post-game learns (L19 팬파이어 / L23 처형탄) — 포스트게임 성장 대칭.
describe('duelist post-game skills', () => {
  it('fanfire (L19) hits every living enemy and can inflict bleed', () => {
    const d = buildHeroUnit('duelist', 19);
    expect(d.spells).toContain('fanfire');
    const e1 = buildEnemyUnit('star_husk'); // undead 아님(void) → bleed 가능
    const e2 = buildEnemyUnit('star_moth');
    const state = createBattle([d], [e1, e2]);
    resolveAction(state, { type: 'spell', actorId: 'duelist', spellId: 'fanfire', targetId: e1.id }, fixedRng());
    expect(e1.hp).toBeLessThan(e1.maxHp);
    expect(e2.hp).toBeLessThan(e2.maxHp);
  });

  it('executioner (L23) pierces def — out-damages an equal-power non-pierce hit on a heavy tank', () => {
    const d = buildHeroUnit('duelist', 23);
    expect(d.spells).toContain('executioner');
    // pierce = flat 0.7 (def-independent), so it wins only where def ratio < 0.7
    // (atk/(atk+def) — the anti-armour executioner niche, not a universal buff).
    const tank = makeUnit({ id: 't', side: 'enemy', maxHp: 400, hp: 400, def: 60, alive: true });
    const plain = skillDamage({ power: 28, physical: true }, d, tank, null);
    const pierced = skillDamage({ power: 28, physical: true, pierce: true }, d, tank, null);
    expect(pierced).toBeGreaterThan(plain);
  });
});

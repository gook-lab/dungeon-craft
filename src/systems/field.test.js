import { describe, it, expect } from 'vitest';
import { inBounds, canMove, portalAt, objectAt, buildEncounter, rollEncounter, tryMove, resolveTrigger, triggerKey, elevAt, isStair, isDrop, canStep, capEncounter } from './field.js';
import { createRng } from '../util/rng.js';

// 3x3 map: center walkable, a wall at (1,0), a portal at (2,2), an npc at (0,0)
const map = {
  w: 3, h: 3,
  ground: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  collision: [
    0, 1, 0,
    0, 0, 0,
    0, 0, 0,
  ],
  objects: [{ x: 0, y: 0, kind: 'npc', ref: 'elder' }],
  portals: [{ x: 2, y: 2, to: 'dungeon', tx: 1, ty: 1 }],
  encounters: { rate: 0.5, pool: ['goblin', 'wolf'], min: 1, max: 2 },
};

describe('bounds + collision', () => {
  it('inBounds rejects out-of-range', () => {
    expect(inBounds(map, -1, 0)).toBe(false);
    expect(inBounds(map, 3, 0)).toBe(false);
    expect(inBounds(map, 2, 2)).toBe(true);
  });

  it('canMove blocks walls and out-of-bounds', () => {
    expect(canMove(map, 1, 0)).toBe(false); // wall
    expect(canMove(map, 0, 1)).toBe(true);  // floor
    expect(canMove(map, 5, 5)).toBe(false); // oob
  });
});

// HD-2D elevation: a 3x1 strip, all walkable. Left cell elev 0, middle+right elev 1.
// A stair bridges the 0↔1 edge at the middle cell.
//   [0]──cliff──[1][1]   ← without a stair, 0→1 is blocked
//   stair at (1,0) makes 0↔1 crossable there.
const elevMap = {
  w: 3, h: 1,
  ground: [0, 0, 0],
  collision: [0, 0, 0],
  elev: [0, 1, 1],
  stairs: [{ x: 1, y: 0 }],
};
const flatMap = { w: 3, h: 1, ground: [0, 0, 0], collision: [0, 0, 0] }; // no elev → flat

describe('elevation (elevAt / isStair / canStep)', () => {
  it('elevAt reads the elev[] cell, 0 when absent or out of range', () => {
    expect(elevAt(elevMap, 0, 0)).toBe(0);
    expect(elevAt(elevMap, 1, 0)).toBe(1);
    expect(elevAt(flatMap, 1, 0)).toBe(0);       // no elev[] → flat
    expect(elevAt(elevMap, 9, 9)).toBe(0);       // oob → ||0 guard
  });

  it('isStair finds a bridge tile only at its coords', () => {
    expect(isStair(elevMap, 1, 0)).toBe(true);
    expect(isStair(elevMap, 0, 0)).toBe(false);
    expect(isStair(flatMap, 1, 0)).toBe(false);  // no stairs → never
  });

  it('canStep: same level always OK', () => {
    expect(canStep(elevMap, 1, 0, 2, 0)).toBe(true);  // elev1 → elev1
  });

  it('canStep: climbing UP a cliff (no stair) is BLOCKED, but hopping DOWN one ledge is free', () => {
    const noStair = { ...elevMap, stairs: [] };
    expect(canStep(noStair, 0, 0, 1, 0)).toBe(false); // elev0 → elev1 (UP, no stair) → blocked
    expect(canStep(noStair, 1, 0, 0, 0)).toBe(true);  // elev1 → elev0 (DOWN one ledge) → free hop
  });

  it('canStep: a 2-level drop needs a marked drop ledge (a 1-level hop does not)', () => {
    const cliff2 = { w: 2, h: 1, ground: [0, 0], collision: [0, 0], elev: [0, 2], stairs: [] };
    expect(canStep(cliff2, 1, 0, 0, 0)).toBe(false); // elev2 → elev0, drop of 2, no ledge → blocked
    const ledge2 = { ...cliff2, drops: [{ x: 1, y: 0 }] };
    expect(canStep(ledge2, 1, 0, 0, 0)).toBe(true);  // marked drop ledge → 2-level plunge OK
    expect(canStep(ledge2, 0, 0, 1, 0)).toBe(false); // still can't climb up
  });

  it('canStep: a stair on either end bridges the levels', () => {
    expect(canStep(elevMap, 0, 0, 1, 0)).toBe(true);  // dest (1,0) is a stair → OK
    expect(canStep(elevMap, 1, 0, 0, 0)).toBe(true);  // source (1,0) is a stair → OK
  });

  it('canStep: still respects collision + bounds (delegates to canMove)', () => {
    const walled = { w: 3, h: 1, ground: [0, 0, 0], collision: [0, 1, 0], elev: [0, 0, 0] };
    expect(canStep(walled, 0, 0, 1, 0)).toBe(false); // wall
    expect(canStep(walled, 0, 0, -1, 0)).toBe(false); // oob
  });

  it('REGRESSION: a flat map (no elev) — canStep ≡ canMove everywhere', () => {
    // every adjacent step on a flat walkable map is allowed exactly when canMove(dest) is
    for (let x = 0; x < 3; x++) {
      const ok = canStep(flatMap, 0, 0, x, 0);
      expect(ok).toBe(x === 0 ? true : canMove(flatMap, x, 0));
    }
  });

  // One-way drop: a cliff with NO stair, but the HIGH tile (1,0) is a drop ledge.
  //   [0]<cliff>[1=drop][1]   you may hop 1→0 (down), never 0→1 (up).
  const dropMap = {
    w: 3, h: 1, ground: [0, 0, 0], collision: [0, 0, 0],
    elev: [0, 1, 1], drops: [{ x: 1, y: 0 }], stairs: [],
  };
  it('isDrop finds a ledge tile only at its coords', () => {
    expect(isDrop(dropMap, 1, 0)).toBe(true);
    expect(isDrop(dropMap, 0, 0)).toBe(false);
    expect(isDrop(flatMap, 1, 0)).toBe(false);
  });
  it('canStep: a drop ledge allows DOWN but blocks UP (directional)', () => {
    expect(canStep(dropMap, 1, 0, 0, 0)).toBe(true);  // 1(elev1,drop) → 0(elev0): down → OK
    expect(canStep(dropMap, 0, 0, 1, 0)).toBe(false); // 0(elev0) → 1(elev1): up → blocked
  });
  it('canStep: a drop does NOT let you climb onto the ledge from below', () => {
    // even though (1,0) is a drop, stepping UP into it (from lower (0,0)) is blocked
    expect(canStep(dropMap, 0, 0, 1, 0)).toBe(false);
  });
});

describe('lookups', () => {
  it('portalAt finds the portal cell only', () => {
    expect(portalAt(map, 2, 2)).toMatchObject({ to: 'dungeon' });
    expect(portalAt(map, 1, 1)).toBe(null);
  });
  it('objectAt finds the npc', () => {
    expect(objectAt(map, 0, 0)).toMatchObject({ kind: 'npc' });
    expect(objectAt(map, 1, 1)).toBe(null);
  });
});

describe('encounters', () => {
  it('buildEncounter respects pool and count range', () => {
    const enc = buildEncounter(map, createRng(1));
    expect(enc.monsters.length).toBeGreaterThanOrEqual(1);
    expect(enc.monsters.length).toBeLessThanOrEqual(2);
    enc.monsters.forEach((m) => expect(['goblin', 'wolf']).toContain(m));
  });

  it('rollEncounter is deterministic under a fixed seed', () => {
    const a = rollEncounter(map, createRng(99));
    const b = rollEncounter(map, createRng(99));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('no encounters when map has none', () => {
    const town = { ...map, encounters: null };
    expect(rollEncounter(town, createRng(1))).toBe(null);
  });
});

describe('tryMove', () => {
  it('blocks movement into a wall (stays put)', () => {
    const r = tryMove(map, { x: 1, y: 1 }, 0, -1, createRng(1)); // into (1,0) wall
    expect(r.moved).toBe(false);
    expect(r).toMatchObject({ x: 1, y: 1 });
  });

  it('moves onto a portal and reports it, no encounter', () => {
    const r = tryMove(map, { x: 2, y: 1 }, 0, 1, createRng(1)); // into (2,2) portal
    expect(r.moved).toBe(true);
    expect(r.portal).toMatchObject({ to: 'dungeon' });
    expect(r.encounter).toBe(null);
  });

  it('moving onto a free cell can roll an encounter', () => {
    // seed chosen so the 0.5 chance fires; just assert structure is valid
    let sawEncounter = false;
    for (let s = 1; s <= 20 && !sawEncounter; s++) {
      const r = tryMove(map, { x: 1, y: 1 }, -1, 0, createRng(s)); // into (0,1) floor
      expect(r.moved).toBe(true);
      if (r.encounter) { sawEncounter = true; expect(r.encounter.monsters.length).toBeGreaterThan(0); }
    }
    expect(sawEncounter).toBe(true);
  });
});

describe('resolveTrigger (pure trigger effects)', () => {
  const tmap = {
    ...map,
    toggleWalls: { wallA: [{ x: 1, y: 1 }, { x: 1, y: 2 }] },
    encounters: { pool: ['goblin'], min: 2, max: 2 },
  };

  it('returns null for a non-trigger object', () => {
    expect(resolveTrigger(tmap, { x: 0, y: 0, kind: 'npc' })).toBe(null);
    expect(resolveTrigger(tmap, null)).toBe(null);
  });

  it('switch returns the wallId to open + fireKey', () => {
    const r = resolveTrigger(tmap, { x: 2, y: 0, kind: 'trigger', effect: 'switch', wallId: 'wallA', fireMsg: '철컹!' });
    expect(r).toMatchObject({ openWall: 'wallA', fireKey: '2,0', msg: '철컹!' });
  });

  it('once-fired trigger returns null when its key is already in `fired`', () => {
    const obj = { x: 2, y: 0, kind: 'trigger', effect: 'switch', wallId: 'wallA', once: true };
    const fired = new Set([triggerKey(obj)]);
    expect(resolveTrigger(tmap, obj, { fired })).toBe(null);
    // not-yet-fired → still resolves
    expect(resolveTrigger(tmap, obj, { fired: new Set() })).toMatchObject({ openWall: 'wallA' });
  });

  it('warp (same map) returns warpTo with to=null', () => {
    const r = resolveTrigger(tmap, { x: 1, y: 0, kind: 'trigger', effect: 'warp', tx: 2, ty: 2 });
    expect(r.warpTo).toEqual({ to: null, x: 2, y: 2 });
  });

  it('warp (cross map) carries the destination map id', () => {
    const r = resolveTrigger(tmap, { x: 1, y: 0, kind: 'trigger', effect: 'warp', to: 'frost', tx: 1, ty: 8 });
    expect(r.warpTo).toEqual({ to: 'frost', x: 1, y: 8 });
  });

  it('encounter builds a forced group from the trigger pool', () => {
    const r = resolveTrigger(tmap, { x: 1, y: 0, kind: 'trigger', effect: 'encounter', pool: ['imp'], min: 3, max: 3 }, { rng: createRng(1) });
    expect(r.encounter.monsters).toEqual(['imp', 'imp', 'imp']);
  });

  it('encounter falls back to the map pool when the trigger has none', () => {
    const r = resolveTrigger(tmap, { x: 1, y: 0, kind: 'trigger', effect: 'encounter' }, { rng: createRng(1) });
    expect(r.encounter.monsters.length).toBe(2);
    r.encounter.monsters.forEach((m) => expect(m).toBe('goblin'));
  });

  it('encounter `group` is an EXACT verbatim formation (order preserved, no RNG)', () => {
    const formation = ['dark_acolyte', 'giant_spider', 'spider'];
    const r = resolveTrigger(tmap, { x: 1, y: 0, kind: 'trigger', effect: 'encounter', group: formation }, { rng: createRng(1) });
    expect(r.encounter.monsters).toEqual(formation); // exact comp + order, group wins over pool
    // group takes precedence even if a pool is also present
    const r2 = resolveTrigger(tmap, { x: 1, y: 0, kind: 'trigger', effect: 'encounter', group: ['imp'], pool: ['goblin'], min: 3, max: 3 }, { rng: createRng(1) });
    expect(r2.encounter.monsters).toEqual(['imp']);
  });

  it('a `requires` door reports locked without the flag, opens with it', () => {
    const door = { x: 2, y: 0, kind: 'trigger', effect: 'switch', wallId: 'wallA', requires: 'crypt_key', lockedMsg: '잠겨있다.' };
    const locked = resolveTrigger(tmap, door, { flags: {} });
    expect(locked).toMatchObject({ locked: true, msg: '잠겨있다.' });
    expect(locked.openWall).toBeUndefined();
    const opened = resolveTrigger(tmap, door, { flags: { crypt_key: true } });
    expect(opened).toMatchObject({ openWall: 'wallA' });
    expect(opened.locked).toBeUndefined();
  });
});

// 조우 규모 캡 (2026-07-15 초반 완화) — 랜덤 조우를 파티 수+1로 자른다.
describe('capEncounter', () => {
  it('trims a random group to partySize+1, keeps smaller groups intact', () => {
    const enc = { monsters: ['goblin', 'wolf', 'spider'] };
    expect(capEncounter(enc, 1).monsters).toEqual(['goblin', 'wolf']); // 솔로 → 최대 2
    const duo = { monsters: ['goblin', 'wolf', 'spider'] };
    expect(capEncounter(duo, 3).monsters).toHaveLength(3); // 풀파티 → no-op
  });

  it('passes through null / missing party size (scripted formations skip the cap)', () => {
    expect(capEncounter(null, 2)).toBeNull();
    const enc = { monsters: ['a', 'b', 'c'] };
    expect(capEncounter(enc, 0).monsters).toHaveLength(3); // no size info → verbatim
  });
});

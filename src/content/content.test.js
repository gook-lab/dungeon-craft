import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PARTY_MEMBERS, STARTING_PARTY } from './party.js';
import { MONSTERS } from './monsters.js';
import { SPELLS } from './spells.js';
import { ITEMS, itemSummary } from './items.js';
import { MAPS, getMap } from './maps/index.js';
import { canStep } from '../systems/field.js';

describe('party data integrity', () => {
  it('every member has required stat block + growth', () => {
    for (const [id, m] of Object.entries(PARTY_MEMBERS)) {
      expect(m.id).toBe(id);
      for (const k of ['maxHp', 'maxMp', 'atk', 'def', 'spd']) {
        expect(Number.isFinite(m.base[k]), `${id}.base.${k}`).toBe(true);
        expect(Number.isFinite(m.growth[k]), `${id}.growth.${k}`).toBe(true);
      }
    }
  });

  it('starting party ids all exist', () => {
    STARTING_PARTY.forEach((id) => expect(PARTY_MEMBERS[id]).toBeTruthy());
  });

  it('all referenced spells (starting + learned) exist', () => {
    for (const m of Object.values(PARTY_MEMBERS)) {
      m.spells.forEach((s) => expect(SPELLS[s], `${m.id} starts ${s}`).toBeTruthy());
      Object.values(m.learn || {}).forEach((s) => expect(SPELLS[s], `${m.id} learns ${s}`).toBeTruthy());
    }
  });
});

describe('monster data integrity', () => {
  it('every monster has battle stats + xp/gold + sprite', () => {
    for (const [id, m] of Object.entries(MONSTERS)) {
      expect(m.id).toBe(id);
      for (const k of ['maxHp', 'atk', 'def', 'spd', 'xp', 'gold']) {
        expect(Number.isFinite(m[k]), `${id}.${k}`).toBe(true);
      }
      expect(typeof m.sprite).toBe('string');
    }
  });

  it('every recruitable monster has a valid joinSkill + recruitLine (consistent ally payoff)', () => {
    for (const [id, m] of Object.entries(MONSTERS)) {
      if (m.boss || m.recruitable === false) continue; // bosses + opt-outs excluded
      expect(typeof m.joinSkill, `${id}.joinSkill`).toBe('string');
      expect(SPELLS[m.joinSkill], `${id}.joinSkill→${m.joinSkill} exists`).toBeTruthy();
      expect(typeof m.recruitLine, `${id}.recruitLine`).toBe('string');
    }
  });

  it('every monster has a distinct VISUAL identity (sprite + tint + scale)', () => {
    // A monster may reuse an existing sprite key as long as a palette-swap
    // (tint) or size (spriteScale) variant gives it a distinct silhouette —
    // JRPG-style recolours (giant spider, frost wolf, …). Two monsters with the
    // SAME sprite AND no differentiating tint/scale would be indistinguishable.
    const byVisual = {};
    for (const [id, m] of Object.entries(MONSTERS)) {
      const key = `${m.sprite}|${m.tint || 'base'}|${m.spriteScale || 1}`;
      (byVisual[key] ||= []).push(id);
    }
    const dups = Object.entries(byVisual).filter(([, ids]) => ids.length > 1);
    expect(dups, `indistinct visuals: ${JSON.stringify(dups)}`).toEqual([]);
  });
});

describe('spell + item data integrity', () => {
  it('spells have valid kind/target', () => {
    const kinds = ['damage', 'heal', 'mana', 'buff', 'ailment', 'cure', 'state'];
    const targets = ['one', 'allEnemies', 'self', 'oneAlly', 'allAllies'];
    for (const [id, s] of Object.entries(SPELLS)) {
      expect(s.id).toBe(id);
      expect(kinds).toContain(s.kind);
      expect(targets).toContain(s.target);
      expect(Number.isFinite(s.mpCost)).toBe(true);
    }
  });

  it('items have valid kind + price', () => {
    const kinds = ['consumable', 'weapon', 'armor', 'accessory'];
    for (const [id, it] of Object.entries(ITEMS)) {
      expect(it.id).toBe(id);
      expect(kinds).toContain(it.kind);
      expect(Number.isFinite(it.price)).toBe(true);
    }
  });

  it('itemSummary returns a non-empty effect string for every item (tooltip text)', () => {
    for (const it of Object.values(ITEMS)) {
      const s = itemSummary(it);
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    }
    // spot-checks: consumable effect + gear stat read correctly
    expect(itemSummary(ITEMS.herb)).toContain('HP');
    expect(itemSummary(ITEMS.antidote)).toContain('치유');
    expect(itemSummary(ITEMS.iron_sword)).toContain('힘');
  });
});

// Completability guard. The frost→swamp portal was once missing entirely,
// making the final region (and the final boss) unreachable — the whole game
// couldn't be finished. These tests lock the portal graph so that regression
// can't ship silently again.
describe('map connectivity (completable playthrough)', () => {
  const walkable = (map, x, y) => map.collision[y * map.w + x] === 0;

  it('every portal targets an existing map and a walkable landing tile', () => {
    for (const [id, map] of Object.entries(MAPS)) {
      for (const p of map.portals || []) {
        const dest = getMap(p.to);
        expect(dest, `${id} portal → ${p.to}`).toBeTruthy();
        expect(walkable(dest, p.tx, p.ty), `${id}→${p.to} lands on wall (${p.tx},${p.ty})`).toBe(true);
      }
    }
  });

  it('town → … → swamp → empire + final boss are all reachable', () => {
    // BFS to fixpoint: a map's boss flag becomes settable once you can stand on
    // that map; a gated portal opens once its `requires` flag is set.
    const reachable = new Set(['town']);
    const flags = new Set();
    for (let pass = 0; pass < 16; pass++) {
      // Defeat the boss on any reachable map → set its flag.
      for (const id of reachable) {
        for (const o of getMap(id).objects || []) {
          if (o.kind === 'boss' && o.flag) flags.add(o.flag);
          // Branch bosses (e.g. the empire's fallen knight) record a spare-vs-
          // slay flag that gates the two paths onward. Defeating it ALWAYS opens
          // exactly one door; model the merciful door so the throne stays
          // reachable. Mirrors main.js endBattle's `${branchFlag}_${outcome}`.
          if (o.kind === 'boss' && o.branchFlag) flags.add(`${o.branchFlag}_spared`);
        }
      }
      // Follow every open portal out of reachable maps.
      for (const id of [...reachable]) {
        for (const p of getMap(id).portals || []) {
          if (!p.requires || flags.has(p.requires)) reachable.add(p.to);
        }
      }
    }
    for (const id of ['town', 'wild', 'dungeon', 'frost', 'swamp', 'overworld',
      'empire_gate', 'empire_camp', 'empire_city', 'empire_throne']) {
      expect(reachable.has(id), `${id} unreachable`).toBe(true);
    }
    // Exactly ONE final boss exists across the whole world, and it sits on a
    // reachable map. (Guards the bog_witch→fallen_emperor final migration: a
    // double-final or zero-final would be a shipping bug.)
    const finals = Object.entries(MAPS).flatMap(([id, m]) =>
      (m.objects || []).filter((o) => o.kind === 'boss' && o.final).map((o) => ({ id, o })));
    expect(finals.length, `expected exactly 1 final boss, found ${finals.length}`).toBe(1);
    expect(reachable.has(finals[0].id), `final boss map ${finals[0].id} unreachable`).toBe(true);
  });

  // In-map traversability: with objects baked into collision exactly as
  // fieldScene.loadMap does (npc/prop/sign/chest become solid; boss/portal stay
  // walkable), the player must be able to walk from spawn to every portal tile,
  // every boss tile, and a tile adjacent to every chest. This is the maze
  // safety net — a wall (or a prop) that seals off a portal/boss/chest would
  // pass the portal-graph test above but soft-lock the actual run.
  it('every map is traversable from spawn to its portals, bosses, and chests', () => {
    for (const [id, map] of Object.entries(MAPS)) {
      const { w, h } = map;
      const baked = map.collision.slice();
      for (const o of map.objects || []) {
        if (o.kind === 'prop' && o.walkable) continue; // walk-through decoration, never solid
        if (o.kind === 'npc' || o.kind === 'prop' || o.kind === 'sign' || o.kind === 'chest') baked[o.y * w + o.x] = 1;
      }
      // Trigger-kit: a `switch` trigger opens its toggleWalls cells. The guard
      // assumes every switch is reachable and pre-opens those walls before
      // flooding — exactly as it assumes a gated portal's `requires` flag is
      // obtainable. Without this, a boss/chest sealed behind a switch-wall (e.g.
      // the crypt's key-door vault) would read as a soft-lock.
      for (const cells of Object.values(map.toggleWalls || {})) {
        for (const c of cells) baked[c.y * w + c.x] = 0;
      }
      // Same-map warp pads teleport — model each as a graph edge so a boss/chest
      // reachable only across a chasm via a warp pad still counts as reachable.
      const warps = (map.objects || []).filter((o) => o.kind === 'trigger' && o.effect === 'warp' && !o.to);
      const sp = map.spawn || { x: 1, y: 1 };
      expect(baked[sp.y * w + sp.x] === 0, `${id} spawn (${sp.x},${sp.y}) is blocked`).toBe(true);

      // The flood uses the SHARED canStep predicate (the same one the live game +
      // roamers use) so an HD-2D elevation map is validated by the real walk rule:
      // a cliff edge blocks, a stair bridges. Flat maps (no map.elev) → canStep
      // collapses to canMove, so this is behaviour-identical for the existing maps.
      const bakedMap = { w, h, collision: baked, elev: map.elev, stairs: map.stairs };
      // Flood fill from spawn over walkable cells (+ warp edges).
      const seen = new Uint8Array(w * h);
      const q = [[sp.x, sp.y]];
      seen[sp.y * w + sp.x] = 1;
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (seen[k] || !canStep(bakedMap, x, y, nx, ny)) continue;
          seen[k] = 1; q.push([nx, ny]);
        }
        // Stepping onto a warp pad makes its destination reachable.
        const wp = warps.find((o) => o.x === x && o.y === y);
        if (wp) {
          const dk = wp.ty * w + wp.tx;
          if (!seen[dk] && baked[dk] !== 1) { seen[dk] = 1; q.push([wp.tx, wp.ty]); }
        }
      }
      const reachable = (x, y) => x >= 0 && y >= 0 && x < w && y < h && seen[y * w + x] === 1;
      const reachableAdj = (x, y) => reachable(x + 1, y) || reachable(x - 1, y) || reachable(x, y + 1) || reachable(x, y - 1);

      for (const p of map.portals || []) {
        expect(reachable(p.x, p.y), `${id}: portal (${p.x},${p.y})→${p.to} unreachable from spawn`).toBe(true);
      }
      for (const o of map.objects || []) {
        if (o.kind === 'boss') expect(reachable(o.x, o.y), `${id}: boss (${o.x},${o.y}) unreachable from spawn`).toBe(true);
        if (o.kind === 'chest') expect(reachableAdj(o.x, o.y), `${id}: chest (${o.x},${o.y}) has no reachable adjacent tile`).toBe(true);
      }

      // RETURN-reachability guard (any elevation map). Since you can hop DOWN a ledge
      // anywhere but only climb UP at stairs, a player can descend into a pocket whose
      // only exit is UP and get stranded. Reverse-flood from the portals (a tile N can
      // reach a portal iff it can STEP toward a tile that can) and assert every
      // forward-reachable tile can still reach an exit.
      if (map.elev) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const canExit = new Uint8Array(w * h);
        const rq = [];
        for (const p of map.portals || []) {
          const k = p.y * w + p.x;
          if (seen[k]) { canExit[k] = 1; rq.push([p.x, p.y]); }
        }
        while (rq.length) {
          const [x, y] = rq.pop();
          for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const k = ny * w + nx;
            if (canExit[k]) continue;
            if (canStep(bakedMap, nx, ny, x, y)) { canExit[k] = 1; rq.push([nx, ny]); }
          }
        }
        for (let i = 0; i < w * h; i++) {
          if (seen[i] && !canExit[i]) {
            expect.fail(`${id}: tile (${i % w},${Math.floor(i / w)}) is stranded — reachable from spawn but can't reach any exit (one-way drop trap)`);
          }
        }
      }
    }
  });

  // HD-2D elevation safety net (self-proving). A synthetic 5x3 map: the left
  // three columns are elev 0 (spawn side), the right two are elev 1 with the boss.
  // A stair at (2,1) is the ONLY legal bridge between the levels. This proves the
  // design's core claim — "forget the stair and the test catches the soft-lock":
  //   (a) with the stair, the boss IS reachable;
  //   (b) remove the stair and the boss becomes UNREACHABLE (the guard goes RED).
  //   elev:  0 0 0 1 1
  //          0 0 [stair@2] 1 1   ← boss at (4,1)
  //          0 0 0 1 1
  const elevFixture = () => ({
    w: 5, h: 3,
    spawn: { x: 0, y: 1 },
    ground: new Array(15).fill(0),
    collision: new Array(15).fill(0),       // everything walkable
    elev: [0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
    stairs: [{ x: 2, y: 1 }],
    objects: [{ x: 4, y: 1, kind: 'boss', ref: 'test_boss' }],
    portals: [],
  });

  // The same flood the map guard uses, but standalone over a passed-in map.
  const floodReach = (map, tx, ty) => {
    const { w, h } = map;
    const seen = new Uint8Array(w * h);
    const sp = map.spawn;
    const q = [[sp.x, sp.y]];
    seen[sp.y * w + sp.x] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (seen[k] || !canStep(map, x, y, nx, ny)) continue;
        seen[k] = 1; q.push([nx, ny]);
      }
    }
    return seen[ty * w + tx] === 1;
  };

  it('elevation: a stair bridges to the higher boss tile (reachable)', () => {
    expect(floodReach(elevFixture(), 4, 1)).toBe(true);
  });

  it('elevation: removing the stair soft-locks the boss (the guard catches it)', () => {
    const sealed = elevFixture();
    sealed.stairs = [];                       // forget the stair → cliff on all edges
    expect(floodReach(sealed, 4, 1)).toBe(false);
    // and the elev-0 spawn side is still fully reachable (only the high side is cut off)
    expect(floodReach(sealed, 2, 1)).toBe(true);
  });

  // One-way drop directionality + stranding. A 4x1 strip: spawn on a HIGH plateau
  // (elev 1, cols 0-1) with a drop ledge at (1,0); cols 2-3 are elev 0 with the exit.
  //   [1 spawn][1 drop]<drop↓>[0][0 exit]
  // You can descend 1→2, but you can NEVER climb back 2→1 (no stair). So if the only
  // exit is on the LOW side, descending is fine; but if the exit is UP, you strand.
  const dropFwd = () => ({
    w: 4, h: 1, spawn: { x: 0, y: 0 },
    ground: [0, 0, 0, 0], collision: [0, 0, 0, 0],
    elev: [1, 1, 0, 0], drops: [{ x: 1, y: 0 }], stairs: [],
  });

  it('one-way drop: you can descend across the ledge to the low side', () => {
    expect(floodReach(dropFwd(), 3, 0)).toBe(true);   // spawn(high) → drop down → exit(low)
  });

  it('one-way drop: the climb back UP is blocked (directional BFS)', () => {
    // flood from the LOW side — it must NOT reach the high plateau (no stair up)
    const m = dropFwd(); m.spawn = { x: 3, y: 0 };
    expect(floodReach(m, 0, 0)).toBe(false);          // low → high is impossible
    expect(floodReach(m, 2, 0)).toBe(true);           // but the low side itself is fine
  });
});

// Every NPC/boss art ref must resolve to an actual sprite file — mirrors the exact
// URL each renders in fieldScene.buildObjects (art:'enemy'→/enemies/ref_east.png,
// art:'hero'→/heroes/ref_dir.png, plain npc→/npcs/ref_dir.png, boss→/enemies/
// <monster.sprite>_east.png). Catches a stray ref like the witch NPC's old
// 'bog_witch_npc' (no such file → invisible NPC) before it ships. 2026-07-16.
// A portal MUST live in `map.portals` — `portalAt()` reads only that array, so an
// object with kind:'portal' is silently INERT (the map renders, you walk onto the tile,
// nothing happens). Shipped twice as a soft-lock: witchs_hut + wraith_bog had their only
// exit written as an object → you could enter but never leave. 2026-07-16.
describe('portal wiring integrity', () => {
  it('no map declares a portal as an object (portals must live in map.portals)', () => {
    const bad = [];
    for (const [id, map] of Object.entries(MAPS)) {
      for (const o of (map.objects || [])) {
        if (o.kind === 'portal') bad.push(`${id}:(${o.x},${o.y}) → ${o.to} — move it into map.portals`);
      }
    }
    expect(bad, `portal declared as an object (inert — portalAt only reads map.portals):\n${bad.join('\n')}`).toEqual([]);
  });

  it('every map you can walk INTO has a way back out (no portal-less dead ends)', () => {
    // A map that any portal targets must itself expose ≥1 portal, else entering it
    // strands the player (warp-only regions are exempt: nothing portals into them).
    const targeted = new Set();
    for (const map of Object.values(MAPS)) for (const p of (map.portals || [])) targeted.add(p.to);
    const stranding = [...targeted].filter((id) => !(MAPS[id]?.portals || []).length);
    expect(stranding, `enterable maps with NO exit portal: ${stranding.join(', ')}`).toEqual([]);
  });
});

describe('map sprite-ref integrity', () => {
  const pub = (...p) => join(process.cwd(), 'public', ...p);
  it('every NPC/boss object renders from an existing sprite file', () => {
    const missing = [];
    for (const [id, map] of Object.entries(MAPS)) {
      for (const o of (map.objects || [])) {
        let file = null;
        if (o.kind === 'npc') {
          if (o.art === 'enemy') file = pub('enemies', `${o.ref}_east.png`);
          else if (o.art === 'hero') file = pub('heroes', `${o.ref}_${o.dir || 'south'}.png`);
          else if (o.ref) file = pub('npcs', `${o.ref}_${o.dir || 'south'}.png`);
        } else if (o.kind === 'boss') {
          const sprite = MONSTERS[o.ref]?.sprite || o.ref;
          file = pub('enemies', `${sprite}_east.png`);
        }
        if (file && !existsSync(file)) missing.push(`${id}:(${o.x},${o.y}) ${o.kind} ref='${o.ref}' → ${file.split('/public/')[1]}`);
      }
    }
    expect(missing, `missing sprite files:\n${missing.join('\n')}`).toEqual([]);
  });
});

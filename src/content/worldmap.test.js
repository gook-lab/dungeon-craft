import { describe, it, expect } from 'vitest';
import { WORLD_NODES, WORLD_EDGES, worldNode } from './worldmap.js';
import { MAPS } from './maps/index.js';

describe('worldmap fast-travel data', () => {
  it('every node id is a real map id', () => {
    for (const n of WORLD_NODES) {
      expect(MAPS[n.id], `node ${n.id} → map`).toBeTruthy();
    }
  });

  it('every node has a valid spawn (travel lands on a walkable tile)', () => {
    for (const n of WORLD_NODES) {
      const m = MAPS[n.id]; const s = m.spawn;
      expect(m.collision[s.y * m.w + s.x], `${n.id} spawn`).toBe(0);
    }
  });

  it('node coords are normalized 0..1 and ids unique', () => {
    const seen = new Set();
    for (const n of WORLD_NODES) {
      expect(n.x).toBeGreaterThanOrEqual(0); expect(n.x).toBeLessThanOrEqual(1);
      expect(n.y).toBeGreaterThanOrEqual(0); expect(n.y).toBeLessThanOrEqual(1);
      expect(seen.has(n.id), `dup ${n.id}`).toBe(false); seen.add(n.id);
    }
  });

  it('every edge references existing nodes', () => {
    for (const [a, b] of WORLD_EDGES) {
      expect(worldNode(a), `edge ${a}`).toBeTruthy();
      expect(worldNode(b), `edge ${b}`).toBeTruthy();
    }
  });

  it('requires flags (if any) are known progression flags', () => {
    const known = new Set(['bossDefeated', 'frostBossDefeated', 'swampBossDefeated', 'empireBossDefeated', 'magmaDrakeDefeated', 'voidLordDefeated']);
    for (const n of WORLD_NODES) {
      if (n.requires) expect(known.has(n.requires), `${n.id} requires ${n.requires}`).toBe(true);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { spawnRoamers, roamerAt, stepRoamers, roamerGroup , roamerCount} from './roamers.js';
import { createRng } from '../util/rng.js';

const map = {
  w: 8, h: 8,
  collision: (() => { const c = new Array(64).fill(0); for (let i = 0; i < 8; i++) { c[i] = 1; c[56 + i] = 1; c[i * 8] = 1; c[i * 8 + 7] = 1; } return c; })(),
  spawn: { x: 1, y: 1 },
  encounters: { pool: ['goblin', 'wolf'], min: 1, max: 2 },
};

describe('spawnRoamers', () => {
  it('places roamers on walkable, non-spawn tiles', () => {
    const rs = spawnRoamers(map, createRng(3), 4);
    expect(rs.length).toBeGreaterThan(0);
    rs.forEach((r) => {
      expect(map.collision[r.y * map.w + r.x]).toBe(0);
      expect(map.encounters.pool).toContain(r.ref);
    });
  });
  it('returns empty when no encounter pool', () => {
    expect(spawnRoamers({ ...map, encounters: null }, createRng(1), 4)).toEqual([]);
  });
});

describe('stepRoamers', () => {
  it('moves roamers only onto walkable tiles', () => {
    const rs = [{ id: 'r0', ref: 'goblin', x: 4, y: 4 }];
    stepRoamers(rs, map, { x: 1, y: 1 }, createRng(5));
    expect(map.collision[rs[0].y * map.w + rs[0].x]).toBe(0);
  });
  it('detects collision with the player', () => {
    const rs = [{ id: 'r0', ref: 'wolf', x: 3, y: 3 }];
    const hit = stepRoamers(rs, map, { x: 3, y: 3 }, createRng(1));
    expect(hit).toBe(rs[0]);
  });
  it('chases the player when close', () => {
    const rs = [{ id: 'r0', ref: 'goblin', x: 5, y: 4 }];
    stepRoamers(rs, map, { x: 2, y: 4 }, createRng(1), 4); // player to the left
    expect(rs[0].x).toBe(4); // stepped toward player
  });
});

describe('roamerGroup + roamerAt', () => {
  it('group always includes the roamer ref', () => {
    const g = roamerGroup({ ref: 'wolf' }, map, createRng(2));
    expect(g.monsters[0]).toBe('wolf');
    expect(g.monsters.length).toBeGreaterThanOrEqual(1);
  });
  it('roamerAt finds a roamer on a tile', () => {
    const rs = [{ id: 'r0', ref: 'bat', x: 2, y: 3 }];
    expect(roamerAt(rs, 2, 3)).toBe(rs[0]);
    expect(roamerAt(rs, 0, 0)).toBe(null);
  });
});

// 로머 밀도 (2026-07-15) — 면적 비례 + 맵별 오버라이드.
describe('roamerCount', () => {
  it('scales with map area, clamped to 5..12', () => {
    expect(roamerCount({ w: 36, h: 28, encounters: {} })).toBe(12); // 1008/80 → ceiling
    expect(roamerCount({ w: 34, h: 26, encounters: {} })).toBe(11); // 884/80
    expect(roamerCount({ w: 18, h: 14, encounters: {} })).toBe(5);  // 소형 보스방 floor
    expect(roamerCount({ w: 60, h: 60, encounters: {} })).toBe(12); // ceiling
  });

  it('map override wins (wild starter field stays moderate)', () => {
    expect(roamerCount({ w: 36, h: 28, encounters: { roamers: 8 } })).toBe(8);
  });
});

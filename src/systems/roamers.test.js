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

// 로머 밀도 (2026-07-15 v3 재산정) — 칸수/100 (구 wild 1008칸=10의 밀도를 기준으로
// 고정), 8~45 클램프 + 맵별 오버라이드.
describe('roamerCount', () => {
  it('scales with map area at the legacy-wild density (cells/100), clamped 8..45', () => {
    expect(roamerCount({ w: 36, h: 28, encounters: {} })).toBe(10);  // 구 wild 튜닝값 재현
    expect(roamerCount({ w: 80, h: 52, encounters: {} })).toBe(42);  // v3 wild — 밀도 유지
    expect(roamerCount({ w: 18, h: 14, encounters: {} })).toBe(8);   // 소형 포켓 floor
    expect(roamerCount({ w: 90, h: 60, encounters: {} })).toBe(45);  // ceiling
  });

  it('map override wins', () => {
    expect(roamerCount({ w: 80, h: 52, encounters: { roamers: 12 } })).toBe(12);
  });
});

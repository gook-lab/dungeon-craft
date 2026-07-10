import { describe, it, expect } from 'vitest';
import { createRng } from '../../util/rng.js';
import { fillGrid, borderWall, pillarHall, cavern, bridgeChasm, floodReachable } from './_builder.js';

// All signature generators must keep the open floor ONE connected region so a
// map built with them can't soft-lock. We assert: every interior open cell is
// reachable from a known-open spawn (no isolated pockets the player could need).

function openCells(collision, w, h) {
  const cells = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (collision[y * w + x] === 0) cells.push([x, y]);
  return cells;
}
function firstOpen(collision, w, h) {
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (collision[y * w + x] === 0) return [x, y];
  return null;
}

describe('pillarHall', () => {
  it('keeps every open cell reachable (≥2 aisles)', () => {
    const W = 24, H = 18;
    const col = fillGrid(W, H, 0); borderWall(col, W, H);
    pillarHall(col, W, H, 2, 2, W - 3, H - 3, { spacing: 4, size: 2 });
    const [sx, sy] = firstOpen(col, W, H);
    const reached = floodReachable(col, W, H, sx, sy);
    for (const [x, y] of openCells(col, W, H)) {
      expect(reached.has(y * W + x), `pillar pocket isolated at ${x},${y}`).toBe(true);
    }
  });

  it('actually places pillars (some walls in the interior)', () => {
    const W = 24, H = 18;
    const col = fillGrid(W, H, 0); borderWall(col, W, H);
    pillarHall(col, W, H, 2, 2, W - 3, H - 3, { spacing: 4, size: 2 });
    let interiorWalls = 0;
    for (const [x, y] of openCells(col, W, H)) void 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (col[y * W + x] === 1) interiorWalls++;
    expect(interiorWalls).toBeGreaterThan(0);
  });
});

describe('cavern', () => {
  it('keeps every open cell reachable for many seeds (deterministic)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const W = 26, H = 20;
      const col = fillGrid(W, H, 0); borderWall(col, W, H);
      cavern(col, W, H, 2, 2, W - 3, H - 3, createRng(seed).next, { cell: 4, density: 0.7 });
      const start = firstOpen(col, W, H);
      expect(start, `seed ${seed}: fully walled?`).not.toBe(null);
      const reached = floodReachable(col, W, H, start[0], start[1]);
      for (const [x, y] of openCells(col, W, H)) {
        expect(reached.has(y * W + x), `seed ${seed}: cave pocket isolated at ${x},${y}`).toBe(true);
      }
    }
  });

  it('same seed → identical layout', () => {
    const build = () => {
      const W = 20, H = 16;
      const col = fillGrid(W, H, 0); borderWall(col, W, H);
      cavern(col, W, H, 2, 2, W - 3, H - 3, createRng(7).next, {});
      return col.join('');
    };
    expect(build()).toBe(build());
  });
});

describe('bridgeChasm', () => {
  it('horizontal chasm: only the bridge gaps cross', () => {
    const W = 20, H = 16;
    const col = fillGrid(W, H, 0); borderWall(col, W, H);
    bridgeChasm(col, W, H, 'h', 8, [5, 14], { thickness: 2 });
    // a non-bridge band cell is wall
    expect(col[8 * W + 3]).toBe(1);
    // the bridge column is open through the band
    expect(col[8 * W + 5]).toBe(0);
    expect(col[9 * W + 5]).toBe(0);
    // top and bottom halves both reachable via the bridge
    const reached = floodReachable(col, W, H, 5, 1);
    expect(reached.has((H - 2) * W + 5)).toBe(true); // bottom row reached
  });

  it('vertical chasm splits + bridges reconnect', () => {
    const W = 22, H = 14;
    const col = fillGrid(W, H, 0); borderWall(col, W, H);
    bridgeChasm(col, W, H, 'v', 10, [7], { thickness: 2 });
    expect(col[3 * W + 10]).toBe(1);          // band wall
    expect(col[7 * W + 10]).toBe(0);          // bridge gap
    const reached = floodReachable(col, W, H, 1, 7);
    expect(reached.has(7 * W + (W - 2))).toBe(true); // far side reached through bridge
  });

  it('zero bridges → two halves are isolated (guard sanity)', () => {
    const W = 18, H = 12;
    const col = fillGrid(W, H, 0); borderWall(col, W, H);
    bridgeChasm(col, W, H, 'h', 6, [], { thickness: 1 });
    const reached = floodReachable(col, W, H, 1, 1);
    expect(reached.has((H - 2) * W + 1)).toBe(false); // bottom unreachable
  });
});

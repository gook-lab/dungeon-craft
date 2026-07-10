// Map builder helpers. D3 locked "hand-authored JS array maps" — these produce
// the literal {ground, collision} arrays so authors don't hand-type 300-element
// arrays. Ground values are SEMANTIC tile ids (0=grass, 1=path, 2=floor,
// 3=water); the field scene translates them to tileset sub-rects per biome.

export function fillGrid(w, h, value) {
  return new Array(w * h).fill(value);
}

// Paint a filled rectangle of `value` into a grid (inclusive bounds).
export function rect(grid, w, x0, y0, x1, y1, value) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x >= 0 && y >= 0 && x < w) grid[y * w + x] = value;
    }
  }
}

// Paint a horizontal or vertical line.
export function hLine(grid, w, x0, x1, y, value) { rect(grid, w, x0, y, x1, y, value); }
export function vLine(grid, w, x, y0, y1, value) { rect(grid, w, x, y0, x, y1, value); }

// HD-2D elevation: raise the WALKABLE cells of a rect to `level` in an elev grid.
// Skips collision walls so buildElevation never draws a cliff around a wall block.
// Pair with a `stairs:[{x,y}]` bridge (and optional `drops:[{x,y}]`); content.test's
// elevation-aware flood verifies the region stays reachable.
export function raiseRect(elev, collision, w, x0, y0, x1, y1, level = 1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = y * w + x;
      if (x >= 0 && y >= 0 && x < w && (collision[k] || 0) === 0) elev[k] = level;
    }
  }
}

// Border walls: set collision=1 around the edges of a w×h collision grid.
export function borderWall(collision, w, h) {
  for (let x = 0; x < w; x++) { collision[x] = 1; collision[(h - 1) * w + x] = 1; }
  for (let y = 0; y < h; y++) { collision[y * w] = 1; collision[y * w + w - 1] = 1; }
}

// Serpentine "comb" maze: full-height wall columns at x = x0, x0+step, … ≤ x1,
// each with a 2-tall opening that alternates top / bottom. This guarantees a
// single connected snaking corridor (boustrophedon) — the player must weave up
// and down to cross, but every cell stays reachable. Columns left of x0 and
// right of the last wall stay fully open (entrances, boss room, exits live
// there). Used by the dungeon-class maze maps; the in-map traversability test
// (content.test.js) verifies spawn → portals/boss/chests after each change.
export function combMaze(collision, w, h, x0, x1, step = 4) {
  let flip = 0;
  for (let x = x0; x <= x1; x += step) {
    for (let y = 1; y <= h - 2; y++) collision[y * w + x] = 1;
    if (flip % 2 === 0) { collision[1 * w + x] = 0; collision[2 * w + x] = 0; }      // open top
    else { collision[(h - 2) * w + x] = 0; collision[(h - 3) * w + x] = 0; }          // open bottom
    flip++;
  }
}

// --- Signature room shapes (던전 다양성 키트 B단계) -------------------------
// combMaze was the ONLY generator → every dungeon-class map flowed identically.
// These three break that monopoly. Each is CONNECTIVITY-SAFE BY CONSTRUCTION:
// they only ever place ISOLATED obstacle clusters with guaranteed ≥2-tile aisles
// (pillarHall/cavern) or a band with explicit gaps (bridgeChasm), so the open
// floor stays one connected region. The content.test.js flood-fill guard still
// verifies every spawn→portal/boss/chest path after each map change.

// 기둥홀 — a grand open hall studded with regularly-spaced pillars. Pillars are
// `size`×`size` solid blocks on a `spacing`-grid; aisles = spacing-size ≥ 2 keep
// it walkable everywhere. Opposite of the claustrophobic comb maze: open sight-
// lines, cover to weave around. Bounds [x0,y0]..[x1,y1] inclusive (leave a margin
// from borders so pillars never fuse to the wall).
export function pillarHall(collision, w, h, x0, y0, x1, y1, opts = {}) {
  const spacing = opts.spacing || 4;
  const size = opts.size || 2;
  for (let py = y0; py + size - 1 <= y1; py += spacing) {
    for (let px = x0; px + size - 1 <= x1; px += spacing) {
      rect(collision, w, px, py, px + size - 1, py + size - 1, 1);
    }
  }
}

// 동굴 — an organic cavern: scattered rock clusters at jittered grid positions
// with variable size and random skips. Same connectivity guarantee as pillarHall
// (clusters snap to a coarse `cell` grid with a guaranteed gutter), but the jitter
// + skips read as a natural cave, not a regular hall. Needs a seeded `rng` (0..1)
// so maps stay deterministic (content.test re-runs the same layout).
export function cavern(collision, w, h, x0, y0, x1, y1, rng, opts = {}) {
  const cell = opts.cell || 4;     // grid pitch; gutter = cell - maxSize stays ≥ 1
  const density = opts.density ?? 0.7; // chance a grid cell gets a cluster
  const r = typeof rng === 'function' ? rng : (rng && typeof rng.next === 'function' ? rng.next : Math.random);
  for (let gy = y0; gy <= y1; gy += cell) {
    for (let gx = x0; gx <= x1; gx += cell) {
      if (r() > density) continue;            // skip → open pocket
      const size = r() < 0.45 ? 2 : 1;        // mix of boulders + pebbles
      // jitter within the cell's gutter so it doesn't read as a grid
      const jx = Math.floor(r() * Math.max(1, cell - size - 1));
      const jy = Math.floor(r() * Math.max(1, cell - size - 1));
      const px = Math.min(gx + jx, x1 - size + 1);
      const py = Math.min(gy + jy, y1 - size + 1);
      rect(collision, w, px, py, px + size - 1, py + size - 1, 1);
    }
  }
}

// 협곡다리 — a chasm band that splits the map, crossable only by narrow bridges.
// `axis:'h'` lays a `thickness`-row wall band at `at` (or `axis:'v'` a column
// band at `at`); `bridges` lists the cross-coordinates left open (a 1-tile gap
// each). Forces single-file crossings — the dramatic setpiece for a collapsing-
// bridge ambush (C단계 붕괴다리 미니보스). At least one bridge MUST be listed or
// the two halves are unreachable (content.test flood-fill catches an empty list).
export function bridgeChasm(collision, w, h, axis, at, bridges, opts = {}) {
  const thickness = opts.thickness || 2;
  const gaps = new Set(bridges || []);
  if (axis === 'v') {
    for (let x = at; x < at + thickness; x++) {
      for (let y = 1; y <= h - 2; y++) if (!gaps.has(y)) collision[y * w + x] = 1;
    }
  } else {
    for (let y = at; y < at + thickness; y++) {
      for (let x = 1; x <= w - 2; x++) if (!gaps.has(x)) collision[y * w + x] = 1;
    }
  }
}

// Connectivity helper (used by tests + cavern callers that want to assert). BFS
// over walkable (collision===0) cells from a start; returns the reached Set of
// indices. A map is completable iff every spawn/portal/boss/chest cell is in it.
export function floodReachable(collision, w, h, sx, sy) {
  const seen = new Set();
  const start = sy * w + sx;
  if (collision[start] === 1) return seen;
  const stack = [start];
  seen.add(start);
  while (stack.length) {
    const i = stack.pop();
    const cx = i % w, cy = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen.has(ni) || collision[ni] === 1) continue;
      seen.add(ni); stack.push(ni);
    }
  }
  return seen;
}

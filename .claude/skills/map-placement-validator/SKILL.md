---
name: map-placement-validator
description: Verify a map object placement (chest/NPC/sign/prop/trigger) is reachable and non-sealing using the game's REAL baked-collision + canStep flood — and find connectivity-safe cells to place N new objects. Use before hand-placing anything on a map, and when adding explore rewards/NPCs to large maps. Prevents the soft-lock class of bug that content.test only catches after the fact.
---

# map-placement-validator

Hand-placing objects on a 4,000-tile map is error-prone (see memory
`v3-map-migration-generator`: 손 배열 = 길이 오류). Objects like `chest`/`npc`/`sign`/
non-walkable `prop` are **baked SOLID** — one dropped in a 1-wide corridor seals the
region behind it. This skill answers two questions deterministically:

1. **Is this placement safe?** (reachable + doesn't strand anything)
2. **Where CAN I safely place N objects?** (ranked, spread-out, verified)

## The rule it mirrors

It replicates `content.test.js`'s guard EXACTLY, so a PASS here means the test passes:
- bake: `collision.slice()`, then `npc|prop|sign|chest` → solid (`prop` with
  `walkable:true` is skipped); `toggleWalls` cells → open.
- flood from `map.spawn` via the shared **`canStep(map, fx, fy, tx, ty)`** (field.js) so
  elevation/stairs/one-way drops behave identically to the live game.
- a chest passes if it has ≥1 **reachable adjacent** tile (the chest tile itself is solid).

## Usage

Write a throwaway script under the scratchpad (never in `src/`) and run it with node.
Import via absolute `file://` URLs — relative paths from a temp dir will not resolve.

```js
import { getMap } from 'file://$HOME/sonix/toy/dragon-game/src/content/maps/index.js';
import { canStep } from 'file://$HOME/sonix/toy/dragon-game/src/systems/field.js';

function bake(map) {
  const { w } = map;
  const baked = map.collision.slice();
  for (const o of (map.objects || [])) {
    if (o.kind === 'prop' && o.walkable) continue;
    if (['npc', 'prop', 'sign', 'chest'].includes(o.kind)) baked[o.y * w + o.x] = 1;
  }
  for (const cells of Object.values(map.toggleWalls || {})) for (const c of cells) baked[c.y * w + c.x] = 0;
  return baked;
}
function flood(bm, sx, sy) {
  const { w, h } = bm; const seen = new Uint8Array(w * h); const q = [[sx, sy]];
  seen[sy * w + sx] = 1;
  while (q.length) { const [x, y] = q.pop();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = ny * w + nx;
      if (seen[k] || bm.collision[k] === 1 || !canStep(bm, x, y, nx, ny)) continue;
      seen[k] = 1; q.push([nx, ny]);
    } }
  return seen;
}
const adj = (w,h,x,y) => [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy]).filter(([nx,ny])=>nx>=0&&ny>=0&&nx<w&&ny<h);
const reachableAdj = (seen,w,h,x,y) => adj(w,h,x,y).some(([nx,ny]) => seen[ny*w+nx]);
```

### Mode A — validate a proposed placement
Bake WITH the new object solid, re-flood, and assert every existing portal/boss/chest
still has a reachable adjacent tile **and** the new object does too. If any regress, the
placement seals something → reject.

### Mode B — find N safe cells (what the 2026-07-16 explore-chest pass used)
```
candidates = cells that are: walkable, in the spawn flood, unoccupied,
             and have >= 3 open orthogonal neighbours (open area, NOT a 1-wide corridor)
rank        by distance from spawn DESC (off the critical path = real exploration reward)
select      greedily with Chebyshev spacing >= 6 between picks
VERIFY      each pick by re-flooding with it + all prior picks solid, asserting every
            portal/boss/chest/prior-pick still has a reachable adjacent tile
```
Deterministic (no RNG) → reproducible. Emit the chosen cells as object literals in the
map file's style (unquoted keys, single-quoted strings) and paste them into
`objects: [ ... ]`.

## After placing

```bash
npx vitest run src/content/content.test.js   # the authoritative guard
```
It also runs the **stranding guard** on maps with `drops` (reverse-flood: every reachable
tile must reach an exit) and the **sprite-ref integrity guard** for NPC/boss art refs.

## Gotchas

- **Boss/portal objects are NOT baked solid** — only npc/prop/sign/chest are. A boss tile
  stays walkable.
- Elevation maps: `canStep` blocks climbing without a stair. Decorative elevation with too
  few stairs reads as an invisible wall (town's terrace: 52 blocked cells / 1 stair → it
  was flattened 2026-07-16).
- A dead-end submap is exempt from the critical-path BFS, so this skill will happily place
  objects in a map that has **no entrance at all** — separately confirm a portal points IN.

## Related

- `content.test.js` — the authoritative post-hoc guard this mirrors
- Memory: `map-generator-connectivity-safety`, `v3-map-migration-generator`
- `/verify-agent-output` — the broader agent audit

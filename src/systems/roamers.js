// Field monster roamers (symbol encounters). PURE grid logic — the field scene
// renders + tweens; this owns spawn placement and movement so it's testable.
// Roamers wander randomly, chase the player when close, and touching the player
// (either direction) starts a battle with that roamer's monster.

import { canStep } from './field.js';

export function spawnRoamers(map, rng, count) {
  if (!map.encounters || !map.encounters.pool || !map.encounters.pool.length) return [];
  const out = [];
  const taken = new Set([`${map.spawn.x},${map.spawn.y}`]);
  let tries = 0;
  while (out.length < count && tries < count * 50) {
    tries++;
    const x = rng.int(1, map.w - 2);
    const y = rng.int(1, map.h - 2);
    if ((map.collision[y * map.w + x] || 0) !== 0) continue;
    const key = `${x},${y}`;
    if (taken.has(key)) continue;
    if (Math.abs(x - map.spawn.x) + Math.abs(y - map.spawn.y) < 4) continue; // not on top of spawn
    taken.add(key);
    out.push({ id: 'r' + out.length, ref: rng.pick(map.encounters.pool), x, y, px: x, py: y });
  }
  return out;
}

export function roamerAt(roamers, x, y) {
  return roamers.find((r) => r.x === x && r.y === y) || null;
}

// Advance every roamer one tile (chase if the player is within `chase` tiles,
// else wander). Returns the roamer now sharing the player's tile, or null.
export function stepRoamers(roamers, map, player, rng, chase = 4) {
  for (const r of roamers) {
    const dist = Math.abs(r.x - player.x) + Math.abs(r.y - player.y);
    let dx = 0, dy = 0;
    if (dist <= chase) {
      if (Math.abs(player.x - r.x) >= Math.abs(player.y - r.y) && player.x !== r.x) dx = Math.sign(player.x - r.x);
      else dy = Math.sign(player.y - r.y);
    } else {
      const d = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      dx = d[0]; dy = d[1];
    }
    const nx = r.x + dx, ny = r.y + dy;
    // Same walk rule as the player (bounds + collision + elevation cliffs/stairs)
    // via the shared canStep — a roamer never phases through a cliff edge.
    if (!canStep(map, r.x, r.y, nx, ny)) continue;
    if (roamers.some((o) => o !== r && o.x === nx && o.y === ny)) continue; // no stacking
    r.x = nx; r.y = ny;
  }
  return roamers.find((r) => r.x === player.x && r.y === player.y) || null;
}

// Build the encounter group for a touched roamer: its monster guaranteed, plus
// 0-2 extra from the map pool.
export function roamerGroup(roamer, map, rng) {
  const monsters = [roamer.ref];
  const extra = rng.int(0, 2);
  for (let i = 0; i < extra; i++) monsters.push(rng.pick(map.encounters.pool));
  return { monsters };
}

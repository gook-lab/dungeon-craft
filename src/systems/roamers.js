// Field monster roamers (symbol encounters). PURE grid logic — the field scene
// renders + tweens; this owns spawn placement and movement so it's testable.
// Roamers wander randomly, chase the player when close, and touching the player
// (either direction) starts a battle with that roamer's monster.

import { canStep } from './field.js';

// 로머 밀도 (2026-07-15): 고정 6마리 → 맵 면적 비례 (약 90타일당 1마리, 7~12
// 클램프). `map.encounters.roamers`로 맵별 오버라이드 가능. 로머는 loadMap마다
// 새로 스폰되므로 맵을 나갔다 오면 리스폰된다 (보스는 로머가 아니라 플래그
// 게이트 오브젝트 — 자연 제외). 심볼 조우라 피해 다닐 수 있어 밀도를 올려도
// 강제 전투량이 늘진 않는다.
export function roamerCount(map) {
  if (map.encounters && map.encounters.roamers) return map.encounters.roamers;
  // v3 광활 스케일 재산정 (2026-07-15): 구 wild(36×28=1008칸)의 튜닝값 roamers 10
  // ≈ 칸수/100 을 밀도 기준으로 고정 — 맵이 2~8배 커져도 체감 밀도가 유지된다.
  // (wild 80×52=4160칸 → 42, empire_city 4480 → 45 클램프, 소형 포켓 → 하한 8.)
  // rate는 이 공식과 무관 — 로머는 심볼 조우라 밀도를 올려도 강제 전투량은 불변.
  return Math.max(8, Math.min(45, Math.round((map.w * map.h) / 100)));
}

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

// Field logic — grid movement, collision, portals, random encounters. PURE
// (no Pixi). The field scene owns tween animation + input; this module owns the
// rules so they're unit-testable.
//
// Map shape (content/maps/*.js):
//   { w, h, ground:[w*h idx], collision:[w*h 0|1], objects:[{x,y,kind,ref}],
//     portals:[{x,y,to,tx,ty}], encounters:{rate,pool,min,max}, tileset, spawn:{x,y} }

export function inBounds(map, x, y) {
  return x >= 0 && y >= 0 && x < map.w && y < map.h;
}

// Can the player stand on (x,y)? In bounds AND collision cell is 0 (walkable).
export function canMove(map, x, y) {
  if (!inBounds(map, x, y)) return false;
  return (map.collision[y * map.w + x] || 0) === 0;
}

// HD-2D elevation (cosmetic Y-offset for the render, but a REAL walk rule here).
// elevAt: a map's optional `elev[]` (row-major, same shape as collision); absent →
// every cell 0 (flat), so the existing 12 maps are unchanged. `||0` also guards an
// out-of-range index.
export function elevAt(map, x, y) {
  return map.elev ? (map.elev[y * map.w + x] || 0) : 0;
}

// A stair/ramp tile bridges two elevations. Stored as map.stairs = [{x,y}…] (few
// per map → linear scan is fine). Absent → no bridges (pure flat map).
export function isStair(map, x, y) {
  const s = map.stairs;
  if (!s) return false;
  for (let i = 0; i < s.length; i++) if (s[i].x === x && s[i].y === y) return true;
  return false;
}

// A one-way DROP ledge: standing on it you can hop DOWN to a lower neighbour, but
// never back up (a stair is the only way up). Stored as map.drops = [{x,y}…].
export function isDrop(map, x, y) {
  const d = map.drops;
  if (!d) return false;
  for (let i = 0; i < d.length; i++) if (d[i].x === x && d[i].y === y) return true;
  return false;
}

// The ONE edge predicate: can a unit step from (fx,fy) to the ADJACENT (tx,ty)?
// Folds the existing cell check (bounds + collision) AND the elevation rule:
//   same level                  → OK
//   stair on either end          → OK (bidirectional bridge — the way UP)
//   stepping DOWN one ledge      → OK ANYWHERE (you can always hop off a 1-level
//                                   drop; classic RPG ledge-hop). This is what makes
//                                   "내려가기" feel free — you're never stuck up top.
//   stepping DOWN 2+ levels      → only off a marked `drop` ledge (a real plunge)
//   climbing UP (non-stair)      → blocked (a cliff; find the stair)
// DIRECTIONAL (from→to), so a flood/BFS respects it: you can flood down freely but
// only climb at stairs. Shared by tryMove (player), roamers, and content.test.
export function canStep(map, fx, fy, tx, ty) {
  if (!canMove(map, tx, ty)) return false;
  const e = elevAt(map, fx, fy);
  const t = elevAt(map, tx, ty);
  if (e === t) return true;
  if (isStair(map, fx, fy) || isStair(map, tx, ty)) return true;
  if (e > t) {                                     // descending
    if (e - t === 1) return true;                  // hop down one ledge — anywhere
    if (isDrop(map, fx, fy)) return true;          // marked multi-level plunge
  }
  return false;                                    // climbing up (non-stair) → cliff
}

export function portalAt(map, x, y) {
  if (!map.portals) return null;
  return map.portals.find((p) => p.x === x && p.y === y) || null;
}

export function objectAt(map, x, y) {
  if (!map.objects) return null;
  return map.objects.find((o) => o.x === x && o.y === y) || null;
}

// Build an encounter group from an encounter spec. Two modes:
//   { group: [ids…] } → an EXACT, hand-authored formation (verbatim, in order) —
//     used by scripted ambush triggers (a caster backline + escorts, etc.).
//   { pool, min, max } → a random group of count∈[min,max] picked from the pool —
//     the map-pool random roll.
// Shared by the map-pool random roll and trigger-driven fights. PURE.
function buildGroup(enc, rng) {
  if (enc && Array.isArray(enc.group) && enc.group.length) return { monsters: [...enc.group] };
  if (!enc || !enc.pool || enc.pool.length === 0) return null;
  const min = enc.min || 1;
  const max = enc.max || min;
  const count = rng ? rng.int(min, max) : min;
  const monsters = [];
  for (let i = 0; i < count; i++) monsters.push(rng ? rng.pick(enc.pool) : enc.pool[0]);
  return { monsters };
}

// Build a random encounter group from the map's pool. count in [min,max].
export function buildEncounter(map, rng) {
  return buildGroup(map.encounters, rng);
}

// 조우 규모 완화 (2026-07-15): 랜덤 스텝 조우/로머 그룹을 파티 수+1로 캡 —
// 혼자 시작한 리더가 첫 필드에서 2~3마리와 맞붙지 않게 하는 초반 안전벨트
// (풀 파티 3~4인에선 캡이 min/max 위로 올라가 no-op). 스크립트 편성(트리거의
// exact `group` 매복)은 저술된 연출이므로 호출부(fieldScene)가 캡을 건너뛴다.
export function capEncounter(enc, partySize) {
  if (!enc || !Array.isArray(enc.monsters) || !partySize) return enc;
  const cap = Math.max(1, partySize + 1);
  if (enc.monsters.length > cap) enc.monsters = enc.monsters.slice(0, cap);
  return enc;
}

// Roll for an encounter after a step. Returns the encounter group or null.
// Deterministic under a seeded rng.
export function rollEncounter(map, rng) {
  const enc = map.encounters;
  if (!enc || !enc.rate) return null;
  if (!(rng ? rng.chance(enc.rate) : false)) return null;
  return buildEncounter(map, rng);
}

// Attempt to move the player one cell in (dx,dy). Returns a result describing
// what happened — the scene applies tween + transitions from this.
//   { moved, x, y, portal, encounter }
export function tryMove(map, pos, dx, dy, rng) {
  const nx = pos.x + dx;
  const ny = pos.y + dy;
  if (!canStep(map, pos.x, pos.y, nx, ny)) {
    return { moved: false, x: pos.x, y: pos.y, portal: null, encounter: null };
  }
  const portal = portalAt(map, nx, ny);
  const encounter = portal ? null : rollEncounter(map, rng);
  return { moved: true, x: nx, y: ny, portal, encounter };
}

// Stable identity for a trigger tile (used to track once-fired triggers).
export function triggerKey(obj) { return `${obj.x},${obj.y}`; }

// PURE trigger resolver — mirrors the battle.js resolver seam: given a `trigger`
// object the player stepped on, return an effect descriptor the scene applies
// (it never mutates map/runtime/Pixi). Returns null for non-triggers or a
// once-fired trigger.
//
//   effect 'switch'    → { openWall, fireKey, msg }   opens map.toggleWalls[wallId]
//   effect 'warp'      → { warpTo:{to,x,y}, fireKey, msg }   to=null ⇒ same map
//   effect 'encounter' → { encounter:{monsters}, fireKey, msg }   forced fight
//
//   A flag-gated trigger (`requires`) reports { locked:true } until the player
//   holds that flag — this is how an in-dungeon locked door (key from a
//   loot.flag chest) opens a `switch` wall. Map-to-map doors use portal
//   `requires` instead; this is the same idea for a door WITHIN one map.
//
//   obj fields: { x, y, kind:'trigger', effect, fireMsg?, once?, requires?, lockedMsg?,
//                 wallId? (switch), to?/tx/ty (warp), pool?/min?/max? (encounter) }
//   opts: { rng, fired, flags }  fired = Set of triggerKey()s consumed (for once);
//                                flags = runtime.flags (for `requires` gating)
export function resolveTrigger(map, obj, opts = {}) {
  if (!obj || obj.kind !== 'trigger') return null;
  const { rng = null, fired = null, flags = null } = opts;
  const key = triggerKey(obj);
  if (obj.once && fired && fired.has(key)) return null;
  if (obj.requires && !(flags && flags[obj.requires])) {
    return { fireKey: key, locked: true, msg: obj.lockedMsg || null };
  }
  const base = { fireKey: key, msg: obj.fireMsg || null };
  switch (obj.effect) {
    case 'switch':
      return { ...base, openWall: obj.wallId };
    case 'warp':
      return { ...base, warpTo: { to: obj.to || null, x: obj.tx, y: obj.ty } };
    case 'encounter': {
      // `group` = exact formation (verbatim); else `pool`+min/max; else the map pool.
      const enc = obj.group ? { group: obj.group }
        : obj.pool ? { pool: obj.pool, min: obj.min, max: obj.max }
          : map.encounters;
      const encounter = buildGroup(enc, rng);
      return encounter ? { ...base, encounter } : null;
    }
    default:
      return null;
  }
}

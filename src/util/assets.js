// Asset URL registry. All PNGs live under /public (Vite serves at root). Mirrors
// game's heroAssets/enemyAssets bridge pattern, simplified for the RPG. The
// renderer's pngTexture(url) does the actual loading; this just maps logical
// keys → URLs so content/scenes never hardcode paths.

export const DIRS = ['south', 'north', 'east', 'west'];

// Hero field sprite (static 4-dir rotation). knight/warrior/huntress have all
// four; others would fall back (not used in the slice party).
export function heroUrl(base, dir = 'south') {
  const d = DIRS.includes(dir) ? dir : 'south';
  return `/heroes/${base}_${d}.png`;
}

// Hero 4-dir walk frame (8-frame cycle) — movement polish. All 5 heroes ship
// north/south/east/west walk cycles (imported from the PixelLab 4-dir bundles).
export const WALK_FRAMES = 8;
export function heroWalkUrl(base, dir, frame) {
  const d = DIRS.includes(dir) ? dir : 'south';
  return `/heroes/anim/${base}_${d}_${((frame % WALK_FRAMES) + WALK_FRAMES) % WALK_FRAMES}.png`;
}

// Hero attack frames (east/west only). Per-hero frame counts from the source art.
export const ATTACK_FRAMES = { knight: 3, warrior: 7, huntress: 7, mage: 6, duelist: 7 };
export function heroAttackUrl(base, dir, frame) {
  const d = dir === 'west' ? 'west' : 'east';
  const n = ATTACK_FRAMES[base] || 3;
  return `/heroes/atk/${base}_${d}_${((frame % n) + n) % n}.png`;
}

// Enemy battle portrait (east-facing single sprite).
export function enemyUrl(key) {
  return `/enemies/${key}_east.png`;
}

// NPC field sprite (PixelLab 4-dir).
export function npcUrl(key, dir = 'south') {
  const d = DIRS.includes(dir) ? dir : 'south';
  return `/npcs/${key}_${d}.png`;
}

export function pickupUrl(key) {
  return `/pickups/${key}.png`;
}

export function structureUrl(key) {
  return `/structures/${key}.png`;
}

// Tileset sheets. town_ground is the PixelLab 4x4 Wang sheet (32px tiles).
export const TILESETS = {
  town: '/tilesets/town_ground.png',
  // The wilds used to reuse town_ground (identical look). Now its own lush
  // grass↔dirt-trail meadow sheet (PixelLab Wang 32px) so the field reads
  // distinctly from the village. Same {0:12 grass, 1:6 dirt} packing.
  wild: '/tilesets/meadow.png',
  dungeon: '/tilesets/dungeon_stone.png',
  frost: '/tilesets/frost_ice.png',
  swamp: '/tilesets/swamp_mud.png',
  // Ported from ../game for upcoming regions (magma / void / alt-ice). Wang sheets
  // in the same 32px format; wired into TILESET_META + TILE_COLOR so a new region
  // can just set `tileset: 'lava'|'void'|'ice'`. (Verify the Wang `index` on first
  // render — falls back to the TILE_COLOR solid floor if the sub-tile is off.)
  lava: '/tilesets/lava.png',
  void: '/tilesets/void.png',
  ice: '/tilesets/ice.png',
  // Accent sheet (within-map ground variety): bog-water pools scattered through
  // the mud swamp (rendered via TILESET_META.swamp.accents → buildGround).
  swamp_bog: '/tilesets/swamp_bog.png',
  // Fallen-empire region (B단계 시각 다양성): the 4 empire maps used to all reuse
  // `dungeon` flagstone. This cracked-obsidian-and-blood marble (PixelLab Wang,
  // 32px) gives the corrupted throne its own grim look. Full-upper tile = idx 12
  // (the convention every other Wang sheet here follows).
  empire: '/tilesets/empire_marble.png',
};

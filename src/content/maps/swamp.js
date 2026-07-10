// Mire of the Witch — the third region. A toxic swamp cavern beyond the frost
// caverns, home of the Bog Witch (late boss). The toughest enemies; gated behind
// the Werewolf King (frost portal opens only once he's defeated). Her defeat opens
// the east passage to the Fallen Empire (the emperor is the true final).
// Enlarged 2026-05-30 (28×22 → 36×28) for a longer slog + open mangrove arches.

import { fillGrid, rect, cavern, borderWall, raiseRect } from './_builder.js';
import { createRng } from '../../util/rng.js';

const W = 36, H = 28;
const ground = fillGrid(W, H, 5); // mud
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// A dense MANGROVE TANGLE (cavern). Bounded to cols 4..W-8 so the left key/switch
// vault corridor + the boss chamber (right) stay open. Fixed seed.
cavern(collision, W, H, 4, 1, W - 8, H - 2, createRng(4242).next, { cell: 3, density: 0.66 });

// 3-wide mangrove arches at each end (rows 7-9).
for (let y = 7; y <= 9; y++) { collision[y * W] = 0; collision[y * W + (W - 1)] = 0; }

// Bog-water pools (ground id 3 → swamp_bog accent sheet) — walkable shallow water.
rect(ground, W, 30, 14, 34, 18, 3); // wide pool by the witch's cauldron (SE)
rect(ground, W, 30, 2, 33, 4, 3);   // NE pool
rect(ground, W, 1, 10, 3, 12, 3);   // pool by the west entrance

// Seal the sunken vault in the bottom-left pocket behind a key-door at (2,17).
collision[17 * W + 1] = 1;
collision[17 * W + 2] = 1; // the toggle door (starts closed)
collision[17 * W + 3] = 1;

const bossX = W - 3, bossY = 8; // 33,8

// HD-2D: a TWO-TIER witch's roost — a low tangle-root platform (L1) rising from the
// mire, with the cauldron core (L2) raised higher still where the Bog Witch broods.
// Rooty stairs climb tier by tier; the empire exit rides the top.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, bossX - 3, 6, bossX + 1, 10, 1); // L1 root platform
raiseRect(elev, collision, W, bossX - 1, 7, bossX + 1, 9, 2);  // L2 cauldron core
for (let y = 7; y <= 9; y++) if (collision[y * W + (W - 1)] === 0) elev[y * W + (W - 1)] = 2; // east arch on the core level
const stairs = [
  { x: bossX - 3, y: 8 }, // mire → L1 root platform
  { x: bossX - 1, y: 8 }, // L1 → L2 cauldron core
];

export default {
  id: 'swamp',
  name: '마녀의 늪',
  w: W, h: H,
  tileset: 'swamp',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 8 },
  toggleWalls: {
    bog_vault: [{ x: 2, y: 17 }],
  },
  objects: [
    { x: bossX, y: bossY, kind: 'boss', ref: 'bog_witch', talk: 'swamp_boss_intro', flag: 'swampBossDefeated', win: 'swamp_boss_win' },
    { x: 6, y: 3, kind: 'prop', ref: 'prop_giant_mangrove', tiles: 2.6 },
    // Walk-through reed clumps (PixelLab) across the open mire margins.
    { x: 3, y: 4, kind: 'prop', ref: 'prop_swamp_reeds', tiles: 1.5, walkable: true },
    { x: 3, y: 12, kind: 'prop', ref: 'prop_swamp_reeds', tiles: 1.4, walkable: true },
    { x: bossX - 4, y: 12, kind: 'prop', ref: 'prop_swamp_reeds', tiles: 1.5, walkable: true },
    { x: bossX, y: 4, kind: 'prop', ref: 'prop_swamp_reeds', tiles: 1.4, walkable: true },
    { x: bossX - 1, y: 12, kind: 'prop', ref: 'prop_witch_cauldron' },
    { x: bossX - 3, y: 4, kind: 'prop', ref: 'prop_rotten_log' },
    { x: bossX + 1, y: 3, kind: 'prop', ref: 'prop_mushroom_hd' },
    { x: 1, y: 9, kind: 'sign', talk: 'swamp_warn' },
    { x: 2, y: 13, kind: 'chest', loot: { item: 'flame_brand' } },
    // --- KEY + SWITCH vault (left corridor) ---
    { x: 2, y: 3, kind: 'chest', loot: { flag: 'bog_key', msg: '진흙에 잠긴 녹슨 금고 열쇠를 건졌다.' } },
    { x: 2, y: 16, kind: 'trigger', effect: 'switch', wallId: 'bog_vault', requires: 'bog_key', lockedMsg: '진흙에 잠긴 녹슨 레버다. 어딘가에 맞는 열쇠가 있을 듯하다.', fireMsg: '열쇠가 레버를 돌린다 — 늪물이 빠지며 돌문이 열린다.' },
    { x: 2, y: 19, kind: 'chest', loot: { item: 'guard_brooch' } },
    { x: bossX + 1, y: 13, kind: 'chest', loot: { item: 'mythril_mail' } },
    { x: bossX - 1, y: 2, kind: 'chest', loot: { item: 'elixir' } },
    // 도덕 선택 (C단계): a soul half-drowned in a bog pool — rest it (자비) or drain it (잔혹).
    { x: bossX - 2, y: 16, kind: 'npc', ref: 'priest', dir: 'south', talk: 'moral_mire_soul', moral: 'mire_soul', flag: 'mireSoulJudged', label: '! 잠긴 영혼' },
    // Hidden treasure in the deep mire (off the minimap).
    { x: bossX - 1, y: 20, kind: 'chest', loot: { item: 'sage_amulet' }, hidden: true },
    // P3 — a sickly green glow from the cauldron + the witch's platform.
    { x: bossX, y: bossY, kind: 'light', color: 0x88ff66, radius: 3, intensity: 0.4 },
    { x: bossX - 1, y: 12, kind: 'light', color: 0x66ff44, radius: 2.4, intensity: 0.5 },
  ],
  portals: [
    { x: 0, y: 8, to: 'frost', tx: 32, ty: 8 }, // lands inside frost's east region (W=34)
    // East exit to the Fallen Empire — sealed until the Bog Witch falls.
    { x: W - 1, y: 8, to: 'empire_gate', tx: 1, ty: 8, requires: 'swampBossDefeated', lockedTalk: 'empire_gate_locked' },
  ],
  encounters: { rate: 0.14, pool: ['mud_crawler', 'bog_brute', 'swamp_runner', 'giant_frog', 'medusa_head', 'bog_zombie', 'bog_leech'], min: 2, max: 5 },
};

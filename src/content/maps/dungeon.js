// Bone Crypt — the slice's dungeon. Stone-tiled cave, higher encounter rate,
// tougher pool, and the Skeleton King boss on a raised dais at the far end.
// Stepping onto the boss tile triggers the boss battle (gated by flags.bossDefeated).
// Enlarged 2026-05-30 (26×22 → 34×26) for a longer crypt crawl + a 3-wide gateway
// at each end so the entrance/exit read as open arches, not sealed cracks.
//
//   col 1-3 (open)        cavern x=4..W-8           right region (open + dais)
//   row1  🗝key                                       · silver ·
//   row8  ▶spawn═══[gate]   … crypt cave …       [stair]💀boss[exit→frost]
//   row12 ⚠trap
//   row18 🔒door(needs key) → ▣vault chest

import { fillGrid, cavern, borderWall, raiseRect } from './_builder.js';
import { createRng } from '../../util/rng.js';

const W = 34, H = 26;
const ground = fillGrid(W, H, 2); // stone floor (dungeon tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// Organic CRYPT-CAVE (cavern generator) through the middle. Bounded to cols 4..W-8
// so the left trigger corridor (cols 1-3) + the boss region (right) stay open.
cavern(collision, W, H, 4, 1, W - 8, H - 2, createRng(1337).next, { cell: 4, density: 0.6 });

// 3-wide arched GATEWAYS at each end (rows 7-9) so transitions feel open, not sealed.
for (let y = 7; y <= 9; y++) { collision[y * W] = 0; collision[y * W + (W - 1)] = 0; }

// Seal the bottom-left treasure vault: wall row 18 across cols 1-3, leaving the
// center cell (2,18) as the stone door the key-switch opens.
collision[18 * W + 1] = 1;
collision[18 * W + 2] = 1; // the toggle door (starts closed)
collision[18 * W + 3] = 1;

const bossX = W - 3, bossY = 8; // 31,8

// HD-2D: a TWO-TIER throne. A broad approach platform (L1) rings a higher throne
// dais (L2) the skeleton king sits on — you climb the outer stair, cross the
// platform, then climb the inner stair to him. The frost exit rides the throne level.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, bossX - 4, 6, bossX + 1, 10, 1); // L1 approach platform (open boss region)
raiseRect(elev, collision, W, bossX - 1, 7, bossX + 1, 9, 2);  // L2 throne dais
for (let y = 7; y <= 9; y++) if (collision[y * W + (W - 1)] === 0) elev[y * W + (W - 1)] = 2; // east arch on the throne level
const stairs = [
  { x: bossX - 4, y: 8 }, // ground → L1 platform
  { x: bossX - 1, y: 8 }, // L1 → L2 throne
];
// leap down off the platform's south front after the fight (back to the cave floor)
const drops = [];
for (let x = bossX - 4; x <= bossX + 1; x++) if (collision[10 * W + x] === 0 && elev[10 * W + x] === 1) drops.push({ x, y: 10 });

export default {
  id: 'dungeon',
  name: '뼈의 지하묘',
  w: W, h: H,
  tileset: 'dungeon',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  drops,
  spawn: { x: 1, y: 8 },
  toggleWalls: {
    vault_door: [{ x: 2, y: 18 }],
  },
  objects: [
    { x: bossX, y: bossY, kind: 'boss', ref: 'skeleton_king', talk: 'boss_intro', flag: 'bossDefeated', win: 'boss_win' },
    { x: 2, y: 5, kind: 'prop', ref: 'prop_tombstone_hd' },
    { x: bossX + 1, y: 5, kind: 'prop', ref: 'prop_broken_brazier' },
    { x: bossX + 1, y: 11, kind: 'prop', ref: 'prop_broken_brazier' },
    { x: bossX - 1, y: 14, kind: 'prop', ref: 'prop_mossy_shrine' },
    // Walk-through crypt rubble (PixelLab) scattered in the open margins.
    { x: 3, y: 4, kind: 'prop', ref: 'prop_crypt_rubble', tiles: 1.4, walkable: true },
    { x: 3, y: 11, kind: 'prop', ref: 'prop_crypt_rubble', tiles: 1.3, walkable: true },
    { x: bossX - 3, y: 11, kind: 'prop', ref: 'prop_crypt_rubble', tiles: 1.4, walkable: true },
    { x: bossX, y: 4, kind: 'prop', ref: 'prop_crypt_rubble', tiles: 1.3, walkable: true },
    { x: 1, y: 9, kind: 'sign', talk: 'dungeon_warn' },
    { x: 2, y: 2, kind: 'chest', loot: { gold: 60 } },
    { x: bossX + 1, y: 2, kind: 'chest', loot: { item: 'silver_sword' } },
    { x: bossX + 1, y: 15, kind: 'chest', loot: { item: 'guardian_shield' } },
    { x: bossX + 1, y: 10, kind: 'sign', talk: 'frost_gate' },
    // P3 point light — a cold spectral aura glows up from the skeleton king's dais.
    { x: bossX, y: bossY, kind: 'light', color: 0x88ccff, radius: 3, intensity: 0.4 },

    // --- Trigger kit (left corridor) ---
    { x: 3, y: 1, kind: 'chest', loot: { flag: 'crypt_key', msg: '낡은 묘실 열쇠를 손에 넣었다.' } },
    { x: 2, y: 12, kind: 'trigger', effect: 'encounter', once: true, group: ['dark_acolyte', 'giant_spider', 'spider'], fireMsg: '함정이다 — 흑마도사가 거미들을 부린다!' },
    { x: 2, y: 17, kind: 'trigger', effect: 'switch', wallId: 'vault_door', requires: 'crypt_key', lockedMsg: '굳게 잠긴 돌문이다. 어딘가에 열쇠가 있을 듯하다.', fireMsg: '열쇠가 돌문을 열었다 — 돌이 갈리는 소리.' },
    { x: 2, y: 19, kind: 'chest', loot: { item: 'sage_amulet' } },
  ],
  portals: [
    { x: 0, y: 8, to: 'wild', tx: 34, ty: 8 }, // lands just inside wild's east gate (wild W=36)
    { x: W - 1, y: 8, to: 'frost', tx: 1, ty: 8, requires: 'bossDefeated', lockedTalk: 'frost_gate' },
  ],
  encounters: { rate: 0.12, pool: ['imp', 'wisp', 'walker', 'spider', 'brood_mother', 'bone_archer', 'powder_skeleton', 'giant_spider', 'dark_acolyte'], min: 2, max: 5 },
};

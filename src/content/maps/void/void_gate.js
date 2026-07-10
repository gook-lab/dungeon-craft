// The Void Rift — approach (공허의 균열). DEEPEST post-game region, reached via
// the town rune-gate after the magma drake falls (warp point gated on
// magmaDrakeDefeated). A starless expanse of broken obelisks and dimensional
// rifts; the abyss lord's seat (void_core) lies east. West recalls to town.
// Void tileset (ground id 7); abyssal horrors roam.

import { fillGrid, cavern, borderWall, raiseRect } from '../_builder.js';
import { createRng } from '../../../util/rng.js';

const W = 26, H = 22;
const ground = fillGrid(W, H, 7); // void floor (void tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// Drifting SHATTERED-OBELISK debris (cavern) across the starless expanse — sparse,
// irregular shards rather than a tidy maze. Bounded to cols 4-20 so the entrance
// hollow (npcs/chests/warp) + the east miniboss margin stay open. Fixed seed.
cavern(collision, W, H, 4, 1, 20, 20, createRng(909).next, { cell: 4, density: 0.55 });

for (let y = 7; y <= 9; y++) { collision[y * W] = 0; collision[y * W + (W - 1)] = 0; } // 3-wide arches

// HD-2D: a floating void-stone shelf at the east gateway to the abyss lord's seat.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 21, 6, 24, 10, 1);
for (let y = 6; y <= 10; y++) if (collision[y * W + (W - 1)] === 0) elev[y * W + (W - 1)] = 1; // whole east arch rides the shelf
const stairs = [{ x: 21, y: 8 }];

export default {
  id: 'void_gate',
  name: '공허의 균열',
  w: W, h: H,
  tileset: 'void',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 8 },
  objects: [
    { x: 2, y: 5, kind: 'prop', ref: 'prop_obsidian_obelisk' },
    { x: 24, y: 5, kind: 'prop', ref: 'prop_star_cluster' },
    { x: 22, y: 14, kind: 'prop', ref: 'prop_dimensional_rift' },
    { x: 24, y: 11, kind: 'prop', ref: 'prop_black_singularity' },
    { x: 1, y: 9, kind: 'sign', talk: 'void_sign' },
    // Optional miniboss (망령 리치) guarding the deep void — off the east path so
    // players can choose to face it. Not final/trueEnding; just a post-game fight.
    { x: 23, y: 13, kind: 'boss', ref: 'wraith_lich', talk: 'wraith_lich_intro', flag: 'wraithLichDefeated', win: 'wraith_lich_win' },
    // Post-game quest givers (camped in the open entrance hollow, off the path).
    { x: 2, y: 6, kind: 'npc', ref: 'priest', dir: 'south', quest: 'q_voidlord', label: '! 공허 감시자' },
    { x: 2, y: 11, kind: 'npc', ref: 'elder', dir: 'south', quest: 'q_void_relics', label: '! 공허 사서' },
    { x: 2, y: 13, kind: 'npc', ref: 'priest', dir: 'south', quest: 'q_wraith', label: '! 공허의 속죄자' },
    { x: 2, y: 2, kind: 'chest', loot: { gold: 600 } },
    { x: 24, y: 2, kind: 'chest', loot: { item: 'sage_amulet' } },
    // Hidden cache adrift in the deep void (off the minimap).
    { x: 2, y: 20, kind: 'chest', loot: { item: 'swift_boots' }, hidden: true },
    // WARP pad pair: paired dimensional rifts fold space across the expanse —
    // the void is exactly where a teleporter belongs.
    { x: 2, y: 18, kind: 'trigger', effect: 'warp', tx: 24, ty: 18, fireMsg: '차원의 틈이 열리며 별빛 너머로 끌려간다…' },
    { x: 24, y: 18, kind: 'trigger', effect: 'warp', tx: 2, ty: 18, fireMsg: '차원의 틈이 열리며 별빛 너머로 끌려간다…' },
  ],
  portals: [
    { x: 0, y: 8, to: 'town', tx: 7, ty: 9 },           // recall home on foot
    { x: 25, y: 8, to: 'void_core', tx: 1, ty: 7 },     // into the abyss lord's seat
  ],
  encounters: { rate: 0.17, pool: ['reaper', 'revenant', 'necromancer'], min: 2, max: 4 },
};

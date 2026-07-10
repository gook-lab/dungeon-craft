// The Void Rift — core (공허의 심연). The abyss lord's seat: a starless void
// arena. The void lord is the game's toughest foe — a DEEPEST post-game
// superboss (NO `final` flag; the emperor stays the story finale). West portal
// back to the approach. Defeating it → win dialog → resume (not an ending).

import { fillGrid, borderWall, raiseRect } from '../_builder.js';

const W = 18, H = 14;
const ground = fillGrid(W, H, 7); // void floor
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

collision[7 * W] = 0; // west entrance gap (from the approach)

const bossX = 13, bossY = 7;

// HD-2D: the abyss lord floats on a TWO-TIER shard of broken void-stone — a lower
// platform (L1) crowned by a higher throne (L2). Stairs climb tier by tier.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 11, 4, 16, 10, 1); // L1 void shard
raiseRect(elev, collision, W, 12, 6, 14, 8, 2);  // L2 throne (void_lord at 13,7)
const stairs = [
  { x: 11, y: 7 }, // approach → L1
  { x: 12, y: 7 }, // L1 → L2 throne
];

export default {
  id: 'void_core',
  name: '공허의 심연',
  w: W, h: H,
  tileset: 'void',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 7 },
  objects: [
    // trueEnding: the deepest post-game superboss → the TRUE ending screen
    // (distinct from the emperor's story `final`). Not `final` — the emperor stays
    // the story finale; this is the optional ultimate conclusion.
    { x: bossX, y: bossY, kind: 'boss', ref: 'void_lord', talk: 'void_boss_intro', flag: 'voidLordDefeated', win: 'void_boss_win', trueEnding: true },
    { x: 12, y: 4, kind: 'prop', ref: 'prop_black_singularity' },
    { x: 12, y: 10, kind: 'prop', ref: 'prop_star_cluster' },
    { x: 2, y: 4, kind: 'prop', ref: 'prop_obsidian_obelisk' },
    { x: 1, y: 8, kind: 'sign', talk: 'void_core_sign' },
    { x: 2, y: 11, kind: 'chest', loot: { item: 'elixir' } },
    // P3 — a violet abyssal glow over the throne + the singularity.
    { x: bossX, y: bossY, kind: 'light', color: 0xb060ff, radius: 3.2, intensity: 0.45 },
    { x: 12, y: 4, kind: 'light', color: 0x9040ff, radius: 2.4, intensity: 0.45 },
  ],
  portals: [
    { x: 0, y: 7, to: 'void_gate', tx: 24, ty: 8 },
  ],
  encounters: null, // boss arena
};

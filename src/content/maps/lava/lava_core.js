// Volcanic Crater — core (용암 심부). The magma drake's lair: an open molten
// arena. The drake is an endgame SUPERBOSS (NO `final` flag — the emperor stays
// the story finale; this is optional post-game challenge). West portal back to
// the approach. Defeating the drake → win dialog → resume (not an ending).

import { fillGrid, borderWall, raiseRect } from '../_builder.js';

const W = 18, H = 14;
const ground = fillGrid(W, H, 6); // magma rock floor
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

collision[7 * W] = 0; // west entrance gap (from the approach)

const bossX = 13, bossY = 7;

// HD-2D: the magma drake coils on a RAISED obsidian shelf above the molten floor
// (east third), reached by a stair at the causeway's end. Drops along the shelf
// front let you leap back down after the fight. content.test verifies reachability.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 11, 4, 16, 10, 1); // L1 obsidian shelf
raiseRect(elev, collision, W, 12, 6, 14, 8, 2);  // L2 magma throne (drake at 13,7)
const stairs = [
  { x: 11, y: 7 }, // causeway → L1 shelf
  { x: 12, y: 7 }, // L1 → L2 throne
];
const drops = [];
for (let x = 11; x <= 16; x++) drops.push({ x, y: 10 });

export default {
  id: 'lava_core',
  name: '용암 심부',
  w: W, h: H,
  tileset: 'lava',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  drops,
  spawn: { x: 1, y: 7 },
  objects: [
    { x: bossX, y: bossY, kind: 'boss', ref: 'magma_drake', talk: 'lava_boss_intro', flag: 'magmaDrakeDefeated', win: 'lava_boss_win' },
    { x: 12, y: 4, kind: 'prop', ref: 'prop_magma_vent' },
    { x: 12, y: 10, kind: 'prop', ref: 'prop_lava_crack_hd' },
    { x: 2, y: 4, kind: 'prop', ref: 'prop_obsidian_pillar_hd' },
    { x: 1, y: 8, kind: 'sign', talk: 'lava_core_sign' },
    { x: 2, y: 11, kind: 'chest', loot: { item: 'elixir' } },
    // P3 point lights — magma vents throw a hot orange glow; the drake broods in a deep-red aura.
    { x: 12, y: 4, kind: 'light', color: 0xff6420, radius: 3.2, intensity: 0.7 },
    { x: 12, y: 10, kind: 'light', color: 0xff5a14, radius: 3.0, intensity: 0.65 },
    { x: bossX, y: bossY, kind: 'light', color: 0xff3010, radius: 3.5, intensity: 0.5 },
  ],
  portals: [
    { x: 0, y: 7, to: 'lava_gate', tx: 24, ty: 8 },
  ],
  encounters: null, // boss arena
};

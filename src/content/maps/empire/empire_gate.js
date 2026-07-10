// Ruined Outer Wall — the Fallen Empire's gateway (fourth region, post-swamp).
// Once the proud rampart of an imperial city, now a collapsed stone maze.
// Reached only after the Bog Witch falls (swamp east exit, gated). Serpentine
// comb maze through the middle; west entrance (from swamp) and east exit (to
// the refugee camp) sit in the open margins. Stone tileset reused (no new art).

import { fillGrid, pillarHall, borderWall, raiseRect } from '../_builder.js';

const W = 26, H = 22;
const ground = fillGrid(W, H, 8); // corrupted imperial marble (empire tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// A fallen COLONNADE, not a comb maze — rows of toppled imperial columns. Open
// sightlines with cover to weave around (distinct feel from the crypt's maze).
pillarHall(collision, W, H, 3, 3, 22, 18, { spacing: 5, size: 2 });

for (let y = 7; y <= 9; y++) { collision[y * W] = 0; collision[y * W + (W - 1)] = 0; } // 3-wide arches

// HD-2D: a broken rampart by the east gate — climb its stair to pass on to the camp.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 23, 6, 24, 10, 1);
for (let y = 6; y <= 10; y++) if (collision[y * W + (W - 1)] === 0) elev[y * W + (W - 1)] = 1; // whole east arch rides the rampart
const stairs = [{ x: 23, y: 8 }];

export default {
  id: 'empire_gate',
  name: '무너진 성문',
  w: W, h: H,
  tileset: 'empire',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 8 },
  objects: [
    { x: 2, y: 5, kind: 'prop', ref: 'prop_broken_brazier' },
    { x: 24, y: 5, kind: 'prop', ref: 'prop_tombstone_hd' },
    { x: 24, y: 11, kind: 'prop', ref: 'prop_mossy_shrine' },
    { x: 1, y: 9, kind: 'sign', talk: 'empire_gate_sign' },
    { x: 2, y: 2, kind: 'chest', loot: { gold: 120 } },
    { x: 24, y: 2, kind: 'chest', loot: { item: 'elixir' } },
    // Hidden cache in the ruined wall's deep shadow (off the minimap).
    { x: 2, y: 20, kind: 'chest', loot: { gold: 200 }, hidden: true },
  ],
  portals: [
    // West back to the swamp; east deeper into the empire (refugee camp).
    { x: 0, y: 8, to: 'swamp', tx: 26, ty: 8 },
    { x: 25, y: 8, to: 'empire_camp', tx: 1, ty: 6 },
  ],
  encounters: { rate: 0.14, pool: ['rusty_soldier', 'spirit_guard', 'stone_gargoyle', 'rune_guardian', 'war_drummer', 'imperial_guard', 'wraith_sentinel'], min: 2, max: 5 },
};

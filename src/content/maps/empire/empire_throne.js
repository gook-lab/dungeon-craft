// Throne Hall — the seat of the 타락한 황제 (fallen emperor), the new FINAL
// boss (final:true lives here on the boss object, moved off the Bog Witch).
// A single open hall: both city gates (정문/뒷문) converge on the west landing;
// the emperor waits on the dais to the east. Defeating him routes endBattle →
// game.toEnding(tone) → EndingScene, tone-branched by the run's mercy ratio.

import { fillGrid, rect, borderWall, raiseRect } from '../_builder.js';

const W = 18, H = 14;
const ground = fillGrid(W, H, 8); // corrupted imperial marble (empire tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// Two colonnades of fallen marble columns flank the central aisle (row 7) that
// leads to the emperor's dais — a grand throne hall, not a bare box. Columns are
// isolated 1×1 blocks above/below the aisle, so the approach stays walkable.
for (const cx of [4, 7, 10]) { rect(collision, W, cx, 4, cx, 4, 1); rect(collision, W, cx, 10, cx, 10, 1); }

collision[7 * W] = 0; // west entrance gap (from both city gates)

const bossX = 13, bossY = 7;

// HD-2D: the emperor broods on a RAISED imperial dais (east third). A grand 3-wide
// ceremonial staircase at the aisle's end is the only ascent. content.test verifies
// the dais + the retreat portal stay reachable.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 11, 3, 16, 11, 1); // L1 dais
raiseRect(elev, collision, W, 12, 5, 14, 9, 2);  // L2 throne the emperor sits on (13,7)
const stairs = [
  { x: 11, y: 6 }, { x: 11, y: 7 }, { x: 11, y: 8 }, // grand 3-wide ceremonial steps (aisle → L1)
  { x: 12, y: 7 },                                    // inner step (L1 → L2 throne)
];

export default {
  id: 'empire_throne',
  name: '옥좌의 방',
  w: W, h: H,
  tileset: 'empire',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 7 },
  objects: [
    { x: bossX, y: bossY, kind: 'boss', ref: 'fallen_emperor', talk: 'empire_boss_intro', flag: 'empireBossDefeated', win: 'empire_boss_win', final: true },
    // Brazier glow flanking the throne (auto point-lights via the prop name).
    { x: 12, y: 4, kind: 'prop', ref: 'prop_broken_brazier' },
    { x: 12, y: 10, kind: 'prop', ref: 'prop_broken_brazier' },
    { x: 2, y: 4, kind: 'prop', ref: 'prop_tombstone_hd' },
    { x: 1, y: 8, kind: 'sign', talk: 'empire_throne_sign' },
    { x: 2, y: 11, kind: 'chest', loot: { item: 'elixir' } },
  ],
  portals: [
    // Retreat back to the inner city (the boss tile triggers the final fight).
    { x: 0, y: 7, to: 'empire_city', tx: 1, ty: 8 },
  ],
  encounters: null, // boss arena, no random fights
};

// The Wilds — open meadow between town and dungeon. A worn DIRT ROAD runs from
// the north gate down to the east–west corridor and out to the dungeon. Scattered
// tree clusters break the space into lanes, a pond is a landmark, and a grassy
// BLUFF rises in the south-east (the tiered Octopath overworld look).
// Enlarged 2026-05-30 (28×22 → 36×28) so the overland trek between town and the
// crypt feels like a journey, with 3-wide gateways at each end.

import { fillGrid, hLine, vLine, rect, borderWall } from './_builder.js';

const W = 36, H = 28;
const ground = fillGrid(W, H, 0); // meadow grass
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// Worn dirt road: gate columns (10,11) down to the corridor, then the full
// east–west corridor out to the dungeon gate.
vLine(ground, W, 10, 1, 8, 1);
vLine(ground, W, 11, 1, 8, 1);
hLine(ground, W, 1, W - 2, 8, 1);

// A small pond (water id 3 + solid), off the road — a landmark you weave around.
rect(ground, W, 8, 16, 10, 17, 3);
rect(collision, W, 8, 16, 10, 17, 1);

// Tree / obstacle clusters. None on row 8 (the road) or the gate columns 10-11.
const obstacles = [
  // NW ancient grove
  { x: 3, y: 3, ref: 'prop_giant_ancient_oak', tiles: 3.4 },
  { x: 7, y: 4, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 8, y: 4, ref: 'prop_oak_tree', tiles: 2.3 },
  { x: 2, y: 6, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 3, y: 6, ref: 'prop_dead_tree_hd', tiles: 2.2 },
  // NE young oaks
  { x: 14, y: 4, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 15, y: 4, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 15, y: 5, ref: 'prop_oak_tree', tiles: 2.3 },
  { x: 20, y: 5, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 21, y: 5, ref: 'prop_giant_ancient_oak', tiles: 3.4 },
  // far-NE grove (new east meadow)
  { x: 27, y: 4, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 28, y: 5, ref: 'prop_giant_ancient_oak', tiles: 3.4 }, { x: 32, y: 3, ref: 'prop_oak_tree', tiles: 2.3 },
  // mid-field lane dividers (below the corridor)
  { x: 6, y: 11, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 7, y: 11, ref: 'prop_rotten_log', tiles: 1.7 }, { x: 6, y: 12, ref: 'prop_oak_tree', tiles: 2.3 },
  { x: 13, y: 12, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 14, y: 12, ref: 'prop_mushroom_hd', tiles: 1.3 },
  { x: 18, y: 11, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 19, y: 11, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 19, y: 12, ref: 'prop_dead_tree_hd', tiles: 2.2 },
  { x: 24, y: 11, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 25, y: 11, ref: 'prop_oak_tree', tiles: 2.3 },
  // SW withered deadwood corner
  { x: 4, y: 14, ref: 'prop_dead_tree_hd', tiles: 2.2 }, { x: 5, y: 14, ref: 'prop_rotten_log', tiles: 1.7 },
  { x: 3, y: 17, ref: 'prop_mushroom_hd', tiles: 1.3 },
  // SE midfield
  { x: 22, y: 14, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 23, y: 14, ref: 'prop_dead_tree_hd', tiles: 2.2 },
  { x: 11, y: 14, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 12, y: 14, ref: 'prop_oak_tree', tiles: 2.3 },
  // deep south
  { x: 14, y: 22, ref: 'prop_oak_tree', tiles: 2.3 }, { x: 8, y: 23, ref: 'prop_dead_tree_hd', tiles: 2.2 },
];
for (const o of obstacles) collision[o.y * W + o.x] = 1;

// 3-wide gateways: north gate to town (cols 10-11) + east arch to the dungeon (rows 7-9).
collision[10] = 0; collision[11] = 0;
for (let y = 7; y <= 9; y++) collision[y * W + (W - 1)] = 0;
// South gap to the 어둠숲 (1막 스토리 존 — 항상 열린 사이드 분기, D8 확정).
collision[(H - 1) * W + 16] = 0; collision[(H - 1) * W + 17] = 0;

// HD-2D: a MULTI-TIER overworld (the Octopath look). A wooded knoll rises in the NW
// (gold chest up among the ancient oaks), and the SE has a two-step bluff — a broad
// plateau (L1) crowned by a higher peak (L2) where the oak-staff chest waits.
const elev = fillGrid(W, H, 0);
rect(elev, W, 2, 1, 6, 4, 1);                // NW wooded knoll (L1)
rect(elev, W, 27, 15, 33, 21, 1);            // SE bluff plateau (L1)
rect(elev, W, 29, 17, 31, 19, 2);            // its higher peak (L2)
const stairs = [
  { x: 6, y: 4 },   // meadow → NW knoll
  { x: 27, y: 15 }, // meadow → SE bluff (L1)
  { x: 29, y: 17 }, // bluff L1 → L2 peak
];
const drops = [];
for (let y = 16; y <= 20; y++) drops.push({ x: 27, y }); // leap west off the bluff face

export default {
  id: 'wild',
  name: '황야',
  w: W, h: H,
  tileset: 'wild',
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  drops,
  spawn: { x: 10, y: 1 },
  objects: [
    ...obstacles.map((o) => ({ x: o.x, y: o.y, kind: 'prop', ref: o.ref, tiles: o.tiles })),
    // A mossy forest shrine by the pond — a landmark + atmosphere (decorative).
    { x: 12, y: 16, kind: 'prop', ref: 'prop_forest_shrine_hd', tiles: 2.0 },
    // Walk-through environment clutter (PixelLab) — bushes/boulders/reeds break up
    // the open meadow. `walkable` → never baked solid, so they can't seal a lane.
    { x: 16, y: 3, kind: 'prop', ref: 'prop_wild_bush', tiles: 1.3, walkable: true },
    { x: 24, y: 4, kind: 'prop', ref: 'prop_wild_bush', tiles: 1.3, walkable: true },
    { x: 8, y: 20, kind: 'prop', ref: 'prop_wild_bush', tiles: 1.3, walkable: true },
    { x: 20, y: 19, kind: 'prop', ref: 'prop_mossy_boulder', tiles: 1.6, walkable: true },
    { x: 5, y: 19, kind: 'prop', ref: 'prop_mossy_boulder', tiles: 1.5, walkable: true },
    { x: 12, y: 19, kind: 'prop', ref: 'prop_swamp_reeds', tiles: 1.4, walkable: true },
    { x: 8, y: 2, kind: 'sign', talk: 'wild_sign' },
    { x: 30, y: 6, kind: 'sign', talk: 'dungeon_sign' },
    { x: 2, y: 3, kind: 'chest', loot: { gold: 35 } },
    { x: 31, y: 17, kind: 'chest', loot: { item: 'oak_staff' } }, // atop the SE bluff
    // Hidden treasure tucked in the wilds' far south (off the minimap).
    { x: 3, y: 24, kind: 'chest', loot: { gold: 120 }, hidden: true },
    // 어둠숲 입구 게이트 — 죽은 나무 두 그루가 남쪽 통로(16-17열)를 액자처럼 감싸고
    // 표지판이 길을 알린다 (맨 구멍이던 입구에 시각 표지).
    { x: 15, y: 26, kind: 'prop', ref: 'prop_dead_tree_hd', tiles: 2.4 },
    { x: 18, y: 26, kind: 'prop', ref: 'prop_dead_tree_hd', tiles: 2.4 },
    { x: 15, y: 25, kind: 'sign', talk: 'darkforest_gate_sign' },
  ],
  portals: [
    { x: 10, y: 0, to: 'town', tx: 7, ty: 11 },
    { x: 11, y: 0, to: 'town', tx: 8, ty: 11 },
    { x: W - 1, y: 8, to: 'dungeon', tx: 1, ty: 8 },
    // 남쪽 어둠숲 (1막 퀘스트라인 목적지 — dead-end 사이드 존).
    { x: 16, y: H - 1, to: 'darkforest', tx: 12, ty: 1 },
    { x: 17, y: H - 1, to: 'darkforest', tx: 12, ty: 1 },
  ],
  // 초반 완화 (2026-07-15): 첫 필드 — 솔로/듀오 초반 파티 기준 1~2마리.
  // roamers 8: 면적 공식(≈11)보다 낮춘 스타터 필드 밀도 오버라이드.
  encounters: { rate: 0.09, pool: ['goblin', 'wolf', 'spider', 'bat', 'walker', 'hornet'], min: 1, max: 2, roamers: 8 },
};

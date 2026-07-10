// Frostspire Cavern — the second region. A snow-and-ice cavern beyond the crypt,
// home of the Werewolf King (second boss). Tougher encounters; gated behind the
// skeleton king (the dungeon portal here only opens once he's defeated).
// Enlarged 2026-05-30 (26×22 → 34×26) for a longer crossing + 3-wide ice arches.

import { fillGrid, pillarHall, borderWall, raiseRect } from './_builder.js';

const W = 34, H = 26;
const ground = fillGrid(W, H, 4); // snow (semantic 4)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// A FROZEN COLONNADE of ice pillars (pillarHall) — discrete 2×2 columns on a grid,
// open sightlines between them. Bounded to cols 4..W-6 so the left corridor
// (queen/trap/chest) + the boss shelf (right) stay open.
pillarHall(collision, W, H, 4, 3, W - 8, H - 4, { spacing: 4, size: 2 });

// 3-wide ice arches at each end (rows 7-9).
for (let y = 7; y <= 9; y++) { collision[y * W] = 0; collision[y * W + (W - 1)] = 0; }

const bossX = W - 3, bossY = 8; // 31,8

// HD-2D: an ASCENDING GLACIER — a broad lower ice terrace (L1) you cross, then a
// higher boss shelf (L2) where the Werewolf King prowls. Two carved stairs in
// sequence climb step by step. The swamp exit rides the top shelf.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, bossX - 4, 6, bossX + 1, 10, 1); // L1 lower terrace
raiseRect(elev, collision, W, bossX - 1, 6, bossX + 1, 10, 2); // L2 boss shelf
for (let y = 7; y <= 9; y++) if (collision[y * W + (W - 1)] === 0) elev[y * W + (W - 1)] = 2; // east arch on the shelf level
const stairs = [
  { x: bossX - 4, y: 8 }, // ground → L1 terrace
  { x: bossX - 1, y: 8 }, // L1 → L2 shelf
];

export default {
  id: 'frost',
  name: '서리첨탑 동굴',
  w: W, h: H,
  tileset: 'frost',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 8 },
  objects: [
    // 2막 관통 캐릭터 — 방랑자 에녹 (배치별 고유 id enoch_act2; 1막은 마을의 enoch_act1).
    { x: 2, y: 10, kind: 'npc', ref: 'enoch', npcId: 'enoch_act2', dir: 'south', talk: 'enoch_act2', label: '? 방랑자' },
    // 로어 사이드퀘: 서리 여왕(옵셔널 미니보스) 지목 — 발견성.
    { x: 1, y: 12, kind: 'npc', ref: 'herbalist', dir: 'south', quest: 'q_frozen_kin', label: '! 생존자' },
    { x: bossX, y: bossY, kind: 'boss', ref: 'werewolf_king', talk: 'frost_boss_intro', flag: 'frostBossDefeated', win: 'frost_boss_win' },
    // Optional MINIBOSS (서리 여왕) — spareable, off the main path. Engage by choice.
    { x: 2, y: 16, kind: 'boss', ref: 'frost_queen', talk: 'frost_queen_intro', flag: 'frostQueenDefeated', win: 'frost_queen_win' },
    { x: 2, y: 5, kind: 'prop', ref: 'prop_ice_crystal_hd' },
    { x: bossX + 1, y: 5, kind: 'prop', ref: 'prop_frozen_statue_hd' },
    { x: bossX - 1, y: 14, kind: 'prop', ref: 'prop_ice_spike_hd' },
    // Walk-through ice clusters (PixelLab) dotting the open snow.
    { x: 3, y: 4, kind: 'prop', ref: 'prop_ice_cluster', tiles: 1.3, walkable: true },
    { x: 3, y: 12, kind: 'prop', ref: 'prop_ice_cluster', tiles: 1.2, walkable: true },
    { x: bossX - 3, y: 12, kind: 'prop', ref: 'prop_ice_cluster', tiles: 1.3, walkable: true },
    { x: bossX, y: 4, kind: 'prop', ref: 'prop_ice_cluster', tiles: 1.2, walkable: true },
    { x: 1, y: 9, kind: 'sign', talk: 'frost_warn' },
    { x: bossX + 1, y: 10, kind: 'sign', talk: 'swamp_gate' },
    // ENCOUNTER trap: thin ice splinters underfoot on the descent to the queen.
    { x: 2, y: 11, kind: 'trigger', effect: 'encounter', once: true, pool: ['frost_wisp', 'frost_crow', 'yeti'], min: 2, max: 3, fireMsg: '얼음이 쩍 갈라진다 — 냉기 속에서 무언가 솟구친다!' },
    { x: 2, y: 3, kind: 'chest', loot: { item: 'frost_blade' } },
    { x: bossX + 1, y: 15, kind: 'chest', loot: { gold: 150 } },
    { x: bossX + 1, y: 2, kind: 'chest', loot: { item: 'antidote' } },
    // 도덕 선택 (C단계): a hunter frozen alive — free him (자비) or smash the ice (잔혹).
    { x: bossX + 1, y: 13, kind: 'npc', ref: 'guard', dir: 'south', talk: 'moral_frozen_hunter', moral: 'frozen_hunter', flag: 'frozenHunterJudged', label: '! 얼어붙은 자' },
    // Hidden treasure in the deep ice (off the minimap).
    { x: bossX + 1, y: 19, kind: 'chest', loot: { item: 'sage_amulet' }, hidden: true },
    // P3 — a cold moonlit aura over the werewolf's shelf.
    { x: bossX, y: bossY, kind: 'light', color: 0xaad4ff, radius: 3, intensity: 0.38 },
  ],
  portals: [
    { x: 0, y: 8, to: 'dungeon', tx: 32, ty: 8 }, // lands inside dungeon's east region (W=34)
    // East exit to the witch's swamp — gated behind the Werewolf King.
    { x: W - 1, y: 8, to: 'swamp', tx: 1, ty: 8, requires: 'frostBossDefeated', lockedTalk: 'swamp_gate' },
  ],
  encounters: { rate: 0.13, pool: ['frost_wisp', 'ice_golem', 'void_walker', 'chimera', 'frost_crow', 'yeti', 'frost_wolf', 'ice_wraith'], min: 2, max: 5 },
};

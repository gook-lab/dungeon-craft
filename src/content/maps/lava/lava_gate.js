// Volcanic Crater — approach (불의 분화구 입구). POST-GAME optional region,
// reached via the town rune-gate once the emperor falls (warp point gated on
// empireBossDefeated). A magma maze of obsidian pillars and lava cracks; the
// drake's lair (lava_core) lies east. West portal recalls to town on foot.
// Lava tileset (ground id 6); molten monsters roam.

import { fillGrid, pillarHall, borderWall, raiseRect } from '../_builder.js';

const W = 26, H = 22;
const ground = fillGrid(W, H, 6); // magma rock floor (lava tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// A field of OBSIDIAN PILLARS (pillarHall) rising from the magma — the dark wall
// sprite reads as black obsidian on the molten floor. Bounded to cols 4-20 so the
// entrance hollow (npcs/chests/warp, cols 1-3) + east margin stay open.
pillarHall(collision, W, H, 4, 3, 20, 18, { spacing: 4, size: 2 });

for (let y = 7; y <= 9; y++) { collision[y * W] = 0; collision[y * W + (W - 1)] = 0; } // 3-wide arches
// South pass down to the 별무덤 (3막 스토리 리전 — 재의 들판으로 내려가는 잿길).
collision[(H - 1) * W + 12] = 0;

// HD-2D: a raised obsidian shelf at the east gateway to the drake's lair — climb a
// stair to the exit, so the threshold reads as an ascent into deeper danger.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 21, 6, 24, 10, 1);
for (let y = 6; y <= 10; y++) if (collision[y * W + (W - 1)] === 0) elev[y * W + (W - 1)] = 1; // whole east arch rides the shelf
const stairs = [{ x: 21, y: 8 }];

export default {
  id: 'lava_gate',
  name: '불의 분화구',
  w: W, h: H,
  tileset: 'lava',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 8 },
  objects: [
    { x: 2, y: 5, kind: 'prop', ref: 'prop_obsidian_pillar_hd' },
    { x: 24, y: 5, kind: 'prop', ref: 'prop_magma_vent' },
    { x: 22, y: 14, kind: 'prop', ref: 'prop_lava_crack_hd' },
    { x: 24, y: 11, kind: 'prop', ref: 'prop_fire_altar' },
    { x: 1, y: 9, kind: 'sign', talk: 'lava_sign' },
    // 3막 관통 캐릭터 — 방랑자 에녹 (배치별 고유 id enoch_act3; 최후의 등반 허브).
    { x: 1, y: 5, kind: 'npc', ref: 'enoch', npcId: 'enoch_act3', dir: 'south', talk: 'enoch_act3', label: '? 방랑자' },
    // Post-game quest givers (camped in the open entrance hollow, off the path).
    { x: 2, y: 6, kind: 'npc', ref: 'guard', dir: 'south', quest: 'q_drake', label: '! 화산 조사대장' },
    { x: 2, y: 11, kind: 'npc', ref: 'alchemist', dir: 'south', quest: 'q_lava_cache', label: '! 잿불 연금술사' },
    { x: 2, y: 7, kind: 'npc', ref: 'guard', dir: 'south', quest: 'q_scout_core', label: '! 조사대 신참' },
    { x: 1, y: 9, kind: 'npc', ref: 'priest', npcId: 'pilgrim_lava', dir: 'south', talk: 'pilgrim_lava', label: '? 순례자' },
    { x: 2, y: 2, kind: 'chest', loot: { gold: 400 } },
    { x: 24, y: 2, kind: 'chest', loot: { item: 'dragon_scale' } },
    // Hidden cache deep in the molten maze (off the minimap).
    { x: 2, y: 20, kind: 'chest', loot: { item: 'power_ring' }, hidden: true },
    // WARP pad pair: twin magma rifts shortcut across the obsidian maze. A
    // teleporter fits this molten rift's fiction (unlike the grounded crypt).
    { x: 2, y: 18, kind: 'trigger', effect: 'warp', tx: 24, ty: 18, fireMsg: '용암 균열이 타오르며 몸이 건너편으로 빨려든다…' },
    { x: 24, y: 18, kind: 'trigger', effect: 'warp', tx: 2, ty: 18, fireMsg: '용암 균열이 타오르며 몸이 건너편으로 빨려든다…' },
    // 별무덤 잿길 입구 (12,21) — 흑요석 기둥 두 개가 남쪽 통로를 액자처럼 감싸고
    // 표지판이 알린다 (맨 구멍이던 입구에 시각 표지).
    { x: 11, y: 20, kind: 'prop', ref: 'prop_obsidian_pillar_hd', tiles: 2.2 },
    { x: 13, y: 20, kind: 'prop', ref: 'prop_obsidian_pillar_hd', tiles: 2.2 },
    { x: 11, y: 19, kind: 'sign', talk: 'ashpath_sign' },
  ],
  portals: [
    { x: 0, y: 8, to: 'town', tx: 7, ty: 9 },            // recall home on foot
    { x: 25, y: 8, to: 'lava_core', tx: 1, ty: 7 },      // into the drake's lair
    // 남쪽 잿길 — 별무덤 (3막 퀘스트라인 목적지, L20 밴드 리전).
    { x: 12, y: 21, to: 'starfall', tx: 15, ty: 1 },
  ],
  encounters: { rate: 0.16, pool: ['magma_golem', 'fire_bat', 'ember_hound', 'lava_slug'], min: 2, max: 4 },
};

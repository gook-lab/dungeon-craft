// Inner City — the ruined imperial streets, a comb maze. The 타락한 기사
// (fallen knight) miniboss waits in the open right. He is NOT a true `boss`
// (so canMercy lets you spare him): sparing/recruiting him opens the 정문
// (front gate) to the throne; cutting him down opens the 뒷문 (back gate).
// The branch is driven by branchOutcome(state,'fallen_knight') → endBattle
// setting flags.empireKnight_spared / _slain, which the two gated portals read.
//
//   knight SPARED  → empireKnight_spared → 정문 (25,10) opens
//   knight SLAIN   → empireKnight_slain  → 뒷문 (25,6)  opens
// Both portals converge on the throne; the door you took colors the boss intro.

import { fillGrid, combMaze, borderWall, raiseRect } from '../_builder.js';

const W = 26, H = 22;
const ground = fillGrid(W, H, 8); // corrupted imperial marble (empire tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

combMaze(collision, W, H, 4, 20, 4); // ruined-street rubble walls at x=4,8,12,16,20

for (let y = 7; y <= 9; y++) collision[y * W] = 0; // west arch (from camp)
for (const y of [5, 6]) collision[y * W + (W - 1)] = 0; // 뒷문 (slain path), widened
for (const y of [10, 11]) collision[y * W + (W - 1)] = 0; // 정문 (spared path), widened

// HD-2D: a raised ruined RAMPART at the east gate-house — both branch gates (정문/
// 뒷문) sit atop it; a stair climbs from the street. The fallen knight is fought on
// the lower street (south), so the climb is the final approach to the throne road.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 22, 5, 24, 11, 1);
for (const y of [5, 6, 10, 11]) if (collision[y * W + (W - 1)] === 0) elev[y * W + (W - 1)] = 1; // gate cells on the rampart
const stairs = [{ x: 22, y: 8 }];

// 자비 셋피스 — a 짐승 우리 (beast cage) the empire chained in the ruins. The
// bottom-right pocket (cols 21-24, rows 19-20) is already boxed by the maze wall
// (col 20) on the left + the map border on the right/bottom; we only seal its
// TOP (row 18) leaving (23,18) as the switch-opened cage door. A lever (switch
// trigger) at (22,16) frees the captive; talking to it recruits it as an ally.
collision[18 * W + 21] = 1;
collision[18 * W + 22] = 1;
collision[18 * W + 24] = 1; // (23,18) stays a door, toggled open by the switch

// South stairwell down to the 지하 의식장 (2막 스토리 존 — 항상 열린 사이드 분기).
collision[(H - 1) * W + 10] = 0;

const knightX = 23, knightY = 13;

export default {
  id: 'empire_city',
  name: '내성 시가지',
  w: W, h: H,
  tileset: 'empire',
  walls: true,
  symbolEncounters: true,
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 8 },
  // Cage door cell the 우리 switch opens (runtime; reseals on re-entry).
  toggleWalls: {
    hound_cage: [{ x: 23, y: 18 }],
  },
  objects: [
    // Miniboss. kind:'boss' routes it through endBattle's bossObj path (flag +
    // branchFlag), but the MONSTER def has no `boss:true`, so it stays spareable.
    { x: knightX, y: knightY, kind: 'boss', ref: 'fallen_knight', talk: 'empire_knight_intro', flag: 'empireKnightDefeated', win: 'empire_knight_win', branchFlag: 'empireKnight' },
    // Optional MINIBOSS (핏빛 백작) — spareable, haunts the ruined streets.
    { x: 2, y: 16, kind: 'boss', ref: 'blood_count', talk: 'blood_count_intro', flag: 'bloodCountDefeated', win: 'blood_count_win' },
    { x: 2, y: 5, kind: 'prop', ref: 'prop_broken_brazier' },
    { x: 24, y: 4, kind: 'prop', ref: 'prop_tombstone_hd' },
    { x: 22, y: 9, kind: 'prop', ref: 'prop_mossy_shrine' },
    { x: 1, y: 9, kind: 'sign', talk: 'empire_city_sign' },
    { x: 24, y: 8, kind: 'sign', talk: 'empire_gate_choice' },
    { x: 2, y: 2, kind: 'chest', loot: { gold: 180 } },
    { x: 24, y: 15, kind: 'chest', loot: { item: 'elixir' } },
    // Hidden cache deep in the ruined streets (off the minimap).
    { x: 2, y: 20, kind: 'chest', loot: { item: 'sage_amulet' }, hidden: true },

    // ENCOUNTER set-piece: a scripted imperial patrol (exact `group` formation) —
    // a 근위병 captain rallying a 녹슨 병사 + 원혼 위병 backline. One-time ambush.
    { x: 2, y: 11, kind: 'trigger', effect: 'encounter', once: true, group: ['imperial_guard', 'rusty_soldier', 'wraith_sentinel'], fireMsg: '제국 순찰대다 — 근위병이 전열을 세운다!' },

    // --- 자비 셋피스: 갇힌 사냥개 (caged beast rescue) ---
    // The lever frees the cage door (23,18); the captive then joins as an ally.
    { x: 22, y: 16, kind: 'trigger', effect: 'switch', wallId: 'hound_cage', fireMsg: '녹슨 지렛대를 당기자 우리 문이 삐걱이며 열린다.' },
    { x: 23, y: 20, kind: 'npc', art: 'enemy', ref: 'ember_hound', dir: 'west', talk: 'caged_hound', recruitAlly: 'ember_hound', flag: 'freedHound', label: '갇힌 사냥개' },
  ],
  portals: [
    { x: 0, y: 8, to: 'empire_camp', tx: 14, ty: 6 },
    // 정문 — opens only if the knight was spared/recruited.
    { x: 25, y: 10, to: 'empire_throne', tx: 1, ty: 7, requires: 'empireKnight_spared', lockedTalk: 'empire_frontgate_locked' },
    // 뒷문 — opens only if the knight was slain.
    { x: 25, y: 6, to: 'empire_throne', tx: 1, ty: 7, requires: 'empireKnight_slain', lockedTalk: 'empire_backgate_locked' },
    // 남쪽 계단 — 지하 의식장 (2막 퀘스트라인 목적지, dead-end 사이드 존).
    { x: 10, y: 21, to: 'ruins_below', tx: 11, ty: 1 },
  ],
  encounters: { rate: 0.14, pool: ['rusty_soldier', 'spirit_guard', 'stone_gargoyle', 'rune_guardian', 'war_drummer', 'imperial_guard', 'wraith_sentinel'], min: 3, max: 5 },
};

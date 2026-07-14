// 어둠숲 (Dark Forest) — 1막 퀘스트라인의 스토리 존. 황야 남쪽에서 들어가는
// OPTIONAL 사이드 분기 dead-end 맵(empire_bridge 패턴 — 포탈은 항상 열려 있고,
// content.test의 크리티컬 패스 리스트엔 비참여, 전맵 포탈 유효성+traversability
// 가드만 받는다). 에녹의 1차 계시가 가리키는 곳: 부패가 숲을 비틀기 시작한 첫
// 자리이며, 그 한가운데를 '어둠숲의 감시자'(타락한 묘지기 사냥개)가 배회한다 —
// 스페어/영입 가능한 미니보스(자비 셋피스).
//
//   row0    ◖return portal → 황야 (x=12)
//   row1    ▶spawn · 표지판
//   중앙     cavern 덤불숲 (seeded — content.test 결정적)
//   row13   💀 어둠숲의 감시자 (spareable miniboss)
//   row15   🗝chest (감시자 뒤 보상)

import { fillGrid, borderWall, cavern } from './_builder.js';
import { createRng } from '../../util/rng.js';

const W = 24, H = 18;
const ground = fillGrid(W, H, 0); // meadow grass (숲 바닥) — 어둠은 mood/props가 만든다
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// Dense corrupted thickets — jittered clusters with guaranteed aisles
// (connectivity-safe by construction; seeded so layouts are deterministic).
cavern(collision, W, H, 2, 3, W - 3, H - 5, createRng(41).next, { cell: 4, density: 0.55 });

// North gap: the way back to the wilds (portal tile).
collision[12] = 0;
// Keep the entry row + the warden's clearing open (the generator is bounded
// above them, but be explicit so the boss/chest never get sealed).
for (let x = 10; x <= 14; x++) collision[1 * W + x] = 0;
for (let x = 10; x <= 14; x++) { collision[13 * W + x] = 0; collision[15 * W + x] = 0; }

export default {
  id: 'darkforest',
  name: '어둠숲',
  w: W, h: H,
  tileset: 'wild',
  walls: true,
  mood: 'darkforest', // 스토리 존 전용 무드 (REGION_MOOD 오버라이드)
  symbolEncounters: false, // 좁은 덤불숲 — 로머 대신 랜덤 인카운터
  ground,
  collision,
  spawn: { x: 12, y: 1 },
  objects: [
    { x: 10, y: 1, kind: 'sign', talk: 'darkforest_sign' },
    // Spareable miniboss (NOT boss:true → canMercy 대상). 자비/처치가 win 라인을
    // 물들인다 (dark_warden_win + 톤 변형). 영입 시 동료 벤치로.
    { x: 12, y: 13, kind: 'boss', ref: 'dark_warden', talk: 'dark_warden_intro', flag: 'darkWardenDefeated', win: 'dark_warden_win' },
    // 감시자 뒤 보상 — 이 시점(1막 초) 기준 넉넉한 금화 + 회복.
    { x: 12, y: 15, kind: 'chest', loot: { gold: 90 } },
    { x: 4, y: 8, kind: 'chest', loot: { item: 'herb' }, hidden: true },
    // 죽은 숲 분위기 — 전부 walkable 클러터(레인을 절대 못 막게).
    { x: 6, y: 4, kind: 'prop', ref: 'prop_dead_tree_hd', tiles: 2.2, walkable: true },
    { x: 17, y: 5, kind: 'prop', ref: 'prop_dead_tree_hd', tiles: 2.2, walkable: true },
    { x: 9, y: 9, kind: 'prop', ref: 'prop_rotten_log', tiles: 1.7, walkable: true },
    { x: 19, y: 11, kind: 'prop', ref: 'prop_dead_tree_hd', tiles: 2.2, walkable: true },
    { x: 5, y: 14, kind: 'prop', ref: 'prop_mushroom_hd', tiles: 1.3, walkable: true },
    { x: 16, y: 15, kind: 'prop', ref: 'prop_rotten_log', tiles: 1.7, walkable: true },
  ],
  portals: [
    // Dead-end: 유일한 출구는 황야 (사이드 존은 완전 선택).
    { x: 12, y: 0, to: 'wild', tx: 16, ty: 26 },
  ],
  // 황야보다 반 계단 위 — 늑대/거미/말벌 무리가 2-4마리로 몰려온다.
  // 초반 완화 (2026-07-15): 1막 스토리 존(L3 밴드) — 최대 4→3마리.
  encounters: { rate: 0.11, pool: ['wolf', 'spider', 'hornet', 'walker'], min: 1, max: 3 },
};

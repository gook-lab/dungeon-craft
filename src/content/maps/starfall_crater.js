// 별의 무덤 (Starfall Crater) — 3막 스토리 리전 2/2, 보스 크레이터. 균열이 열리던
// 밤 가장 크게 떨어진 별의 잔해가 크레이터 중앙 융기부에 박혀 있다 — 부패에
// 붙들린 채 아직 희미하게 빛나는 '떨어진 별'. 스페어(해방)/영입 가능한 리전 보스.
// HD-2D: 별이 박힌 융기 단상 + 계단 (lava_core 단상 패턴).

import { fillGrid, borderWall, raiseRect } from './_builder.js';

const W = 22, H = 16;
const ground = fillGrid(W, H, 8); // 크레이터 흑요석 (empire tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

for (let y = 7; y <= 9; y++) collision[y * W] = 0; // west arch (from the barrens)

// 크레이터 중앙 융기 — 별의 잔해가 박힌 단상. 계단 하나로만 오른다.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 12, 5, 18, 11, 1);
const stairs = [{ x: 12, y: 8 }];

export default {
  id: 'starfall_crater',
  name: '별의 무덤',
  w: W, h: H,
  tileset: 'empire',
  walls: true,
  mood: 'starfall', // 스토리 존 전용 무드 (REGION_MOOD 오버라이드)
  symbolEncounters: false, // 보스 크레이터 — 떨어진 별 앞은 고요하다
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 8 },
  objects: [
    { x: 2, y: 7, kind: 'sign', talk: 'starfall_tomb_sign' },
    // 떨어진 별 (spareable 리전 보스 — NOT boss:true → 자비로 '해방' 가능).
    { x: 15, y: 8, kind: 'boss', ref: 'fallen_star', talk: 'fallen_star_intro', flag: 'fallenStarDefeated', win: 'fallen_star_win' },
    // 별의 파편 보상 — 단상 위.
    { x: 17, y: 6, kind: 'chest', loot: { item: 'sage_amulet' } },
    { x: 17, y: 10, kind: 'chest', loot: { gold: 800 } },
    { x: 6, y: 4, kind: 'prop', ref: 'prop_black_singularity', tiles: 2.2, walkable: true },
    { x: 6, y: 12, kind: 'prop', ref: 'prop_broken_brazier', tiles: 1.6, walkable: true },
  ],
  portals: [
    { x: 0, y: 8, to: 'starfall', tx: 28, ty: 9 }, // back west (starfall 동단 안쪽)
  ],
  encounters: null, // boss arena
};

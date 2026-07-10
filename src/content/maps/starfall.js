// 별무덤 (Starfall Barrens) — 3막 스토리 리전 1/2. 에녹의 "별이 우는 밤" 모티프의
// 물리적 장소: 균열이 열리던 밤 별들이 떨어져 죽은 재의 들판. 황제(L18) 이후 ·
// 분화구(L25) 이전의 L20 밴드 리전 — 불의 분화구 남쪽 잿길로 걸어 들어오거나,
// 차원석 워프(empireBossDefeated 게이트)로 진입한다. 동쪽 끝 크레이터
// (starfall_crater)에 떨어진 별의 잔해가 잠들어 있다.

import { fillGrid, borderWall, cavern } from './_builder.js';
import { createRng } from '../../util/rng.js';

const W = 30, H = 20;
const ground = fillGrid(W, H, 8); // 잿빛 흑요석 들판 (empire tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// 떨어진 별 파편이 만든 암괴 무리 — jittered clusters (seeded, deterministic).
cavern(collision, W, H, 3, 3, W - 4, H - 4, createRng(77).next, { cell: 5, density: 0.45 });

// North gap: the ash-path back up to the crater gate (portal tile).
collision[15] = 0;
// East arch to the crater + a clear entry row.
for (let y = 9; y <= 10; y++) collision[y * W + (W - 1)] = 0;
for (let x = 13; x <= 17; x++) collision[1 * W + x] = 0;

export default {
  id: 'starfall',
  name: '별무덤',
  w: W, h: H,
  tileset: 'empire',
  walls: true,
  mood: 'starfall', // 스토리 존 전용 무드 (REGION_MOOD 오버라이드)
  symbolEncounters: false,
  ground,
  collision,
  spawn: { x: 15, y: 1 },
  objects: [
    { x: 13, y: 1, kind: 'sign', talk: 'starfall_sign' },
    // 로어 사이드퀘: 자비 카운터 퀘스트 (별의 방식 = 살려 보내는 것).
    { x: 17, y: 1, kind: 'npc', ref: 'elder', dir: 'south', quest: 'q_star_mercy', label: '! 별지기' },
    { x: 26, y: 12, kind: 'sign', talk: 'starfall_crater_sign' },
    { x: 3, y: 16, kind: 'chest', loot: { gold: 600 } },
    { x: 26, y: 3, kind: 'chest', loot: { item: 'awakening' }, hidden: true },
    // 죽은 별의 잔광 — walkable 클러터 (레인을 못 막게).
    { x: 8, y: 6, kind: 'prop', ref: 'prop_broken_brazier', tiles: 1.6, walkable: true },
    { x: 20, y: 5, kind: 'prop', ref: 'prop_black_singularity', tiles: 2.0, walkable: true },
    { x: 6, y: 14, kind: 'prop', ref: 'prop_broken_colonnade', tiles: 2.2, walkable: true },
    { x: 22, y: 15, kind: 'prop', ref: 'prop_black_singularity', tiles: 1.6, walkable: true },
  ],
  portals: [
    { x: 15, y: 0, to: 'lava_gate', tx: 12, ty: 20 },       // 잿길, 분화구로
    { x: W - 1, y: 9, to: 'starfall_crater', tx: 1, ty: 8 }, // 크레이터로
    { x: W - 1, y: 10, to: 'starfall_crater', tx: 1, ty: 8 },
  ],
  // L20 밴드 — 별의 잔해에 붙은 부패 권속들 (신규 스왑 2 + 공허 망령 2).
  encounters: { rate: 0.14, pool: ['star_husk', 'star_moth', 'revenant', 'reaper'], min: 2, max: 4 },
};

// 지하 의식장 (Ruins Below) — 2막 퀘스트라인의 스토리 존. 제국 폐허 시가지에서
// 내려가는 OPTIONAL 사이드 분기 dead-end 맵(darkforest/empire_bridge와 같은 패턴 —
// 항상 열린 포탈, 크리티컬 패스 리스트 비참여, 전맵 가드만 적용). 황제가 심연의
// 문을 연 바로 그 의식장: 비석들이 "황제의 진짜 동기"(부패를 자기 안에 봉인하려
// 한 잘못된 자비)의 단서를 흘린다 — 2막 반전(옥좌의 독백)의 사전 씨앗. 제단을
// '봉인의 파수병'이 여전히 지킨다 — 스페어/영입 가능한 미니보스.
//
//   row0    ◖return portal → 폐허 시가지 (x=11)
//   row1    ▶spawn · 비석(의식의 기록)
//   중앙     pillarHall 지하 신전 열주
//   row12   💀 봉인의 파수병 (spareable miniboss)
//   row13   ⛩ 제단 + 비석(황제의 맹세) · 보상 상자

import { fillGrid, borderWall, pillarHall } from './_builder.js';

const W = 22, H = 16;
const ground = fillGrid(W, H, 8); // corrupted imperial marble (empire tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// 지하 신전 열주 — 2×2 기둥 그리드, 열린 시야 (connectivity-safe by construction).
pillarHall(collision, W, H, 3, 3, W - 4, H - 6, { spacing: 4, size: 2 });

// North gap: the way back up to the ruined city (portal tile).
collision[11] = 0;
// 제단 주변 클리어링 — 파수병/제단/상자가 절대 봉쇄되지 않게 명시적으로 연다.
for (let x = 8; x <= 14; x++) { collision[12 * W + x] = 0; collision[13 * W + x] = 0; }

export default {
  id: 'ruins_below',
  name: '지하 의식장',
  w: W, h: H,
  tileset: 'empire',
  walls: true,
  mood: 'ritual', // 스토리 존 전용 무드 (REGION_MOOD 오버라이드)
  symbolEncounters: false, // 봉인된 성소 — 로머 없음, 인카운터는 랜덤
  ground,
  collision,
  spawn: { x: 11, y: 1 },
  objects: [
    // 환경 스토리텔링 — 의식장의 기록 2개 (황제 재해석의 사전 씨앗).
    { x: 9, y: 1, kind: 'sign', talk: 'ruins_rite_sign' },
    { x: 9, y: 13, kind: 'sign', talk: 'ruins_oath_sign' },
    // Spareable miniboss (NOT boss:true). 자비/처치가 win 라인을 물들인다.
    { x: 11, y: 12, kind: 'boss', ref: 'seal_guardian', talk: 'seal_guardian_intro', flag: 'sealGuardianDefeated', win: 'seal_guardian_win' },
    // 제단(장식) + 보상 — 황제전 직전 시점 기준.
    { x: 11, y: 14, kind: 'prop', ref: 'prop_altar_dark', tiles: 2.0 },
    { x: 13, y: 13, kind: 'chest', loot: { gold: 320 } },
    { x: 3, y: 13, kind: 'chest', loot: { item: 'elixir' }, hidden: true },
    { x: 5, y: 6, kind: 'prop', ref: 'prop_broken_brazier', tiles: 1.6, walkable: true },
    { x: 17, y: 8, kind: 'prop', ref: 'prop_broken_colonnade', tiles: 2.2, walkable: true },
    { x: 15, y: 4, kind: 'prop', ref: 'prop_candelabra', tiles: 1.5, walkable: true },
  ],
  portals: [
    // Dead-end: 유일한 출구는 폐허 시가지.
    { x: 11, y: 0, to: 'empire_city', tx: 10, ty: 20 },
  ],
  // 제국 시가지와 같은 밴드 — 봉인을 지키던 망자들.
  encounters: { rate: 0.12, pool: ['rusty_soldier', 'spirit_guard', 'wraith_sentinel', 'stone_gargoyle'], min: 2, max: 4 },
};

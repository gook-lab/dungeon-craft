// 룬게이트 월드맵 데이터 — 빠른 이동(fastTravelScene)의 노드/경로 테이블.
// ul/fasttravel-export의 NODES/EDGES 이식. 좌표는 0~1 정규화(지도 위 위치).
// node.id는 반드시 실존 map id (content/maps). state는 여기 없다 — 런타임에서
// 계산: current(현재맵) / locked(미방문=visitedMaps에 없음) / travelKind별.
//   travelKind: 'hub'(룬게이트 거점) | 'safe'(안전 허브) | 'boss'(위험 관문) | 'node'(일반)
//   recommendLv: 권장 레벨 · enc: 조우 위험(safe/low/mid/high) · tile: 프리뷰 팔레트 키
//   requires: 도착 게이트 플래그(있으면 그 보스 클리어 전엔 이동 잠금 — 워프 게이팅 재사용)

export const WORLD_NODES = [
  // ── 1막 · 크립트 권역 ──
  { id: 'town', name: '크립트 마을', region: '1막 · 크립트', kind: '시작 마을 · 룬게이트', travelKind: 'hub', x: 0.12, y: 0.74, lv: 1, enc: 'safe', tile: 'town', desc: '모험의 거점. 여관·상점·대장간이 있는 안전한 마을. 룬게이트의 중심축.' },
  { id: 'lake_town', name: '호숫가 마을', region: '1막 · 크립트', kind: '안전 허브', travelKind: 'safe', x: 0.04, y: 0.52, lv: 3, enc: 'safe', tile: 'town', desc: '황야 서편의 조용한 휴식촌. 호수 부두와 낚시꾼, 연금 재료를 파는 잡화점.' },
  { id: 'wild', name: '황야', region: '1막 · 크립트', kind: '평원 필드', travelKind: 'node', x: 0.22, y: 0.55, lv: 3, enc: 'low', tile: 'meadow', desc: '마을과 묘지를 잇는 드넓은 초원. 사행로와 개울, 북부 고지의 폐허.' },
  { id: 'darkforest', name: '어둠숲', region: '1막 · 크립트', kind: '수목 미로', travelKind: 'node', x: 0.34, y: 0.40, lv: 5, enc: 'mid', tile: 'forest', desc: '빛이 들지 않는 수목 미로. 늑대와 거미 무리의 매복이 잦다.' },
  { id: 'dungeon', name: '지하 묘지', region: '1막 · 크립트', kind: '던전 · 해골왕', travelKind: 'boss', x: 0.25, y: 0.30, lv: 6, enc: 'high', tile: 'dungeon', desc: '해골 왕이 왕좌를 지키는 뼈의 묘실. 금고 안쪽엔 비밀 수로가 있다.' },
  { id: 'frost', name: '서리 첨탑', region: '1막 · 크립트', kind: '설빙 동굴 · 늑대왕', travelKind: 'boss', x: 0.42, y: 0.20, lv: 10, enc: 'high', tile: 'frost_ice', requires: 'bossDefeated', desc: '대빙호가 얼어붙은 서리 동굴. 늑대 왕의 영역이며 빙판 함정이 도사린다.' },
  { id: 'swamp', name: '마녀의 늪', region: '1막 · 크립트', kind: '독늪 · 늪의 마녀', travelKind: 'boss', x: 0.56, y: 0.32, lv: 13, enc: 'high', tile: 'swamp', requires: 'frostBossDefeated', desc: '독안개가 깔린 일곱 늪의 습지. 늪의 마녀가 뿌리 단상에 웅크린다.' },

  // ── 2막 · 제국 권역 ──
  { id: 'overworld', name: '몰락 평원', region: '2막 · 제국', kind: '대여정 필드', travelKind: 'node', x: 0.50, y: 0.50, lv: 14, enc: 'mid', tile: 'meadow', requires: 'swampBossDefeated', desc: '늪과 제국을 잇는 광대한 평원. 북부 산악과 사행 강, 역참 폐허.' },
  { id: 'empire_camp', name: '피난민 야영지', region: '2막 · 제국', kind: '안전 허브', travelKind: 'safe', x: 0.66, y: 0.48, lv: 15, enc: 'safe', tile: 'empire_marble', requires: 'empireBossDefeated', desc: '무너진 제국 성벽 안의 생존자 야영지. 상인과 치유사가 머문다.' },
  { id: 'port_city', name: '운하 항구', region: '2막 · 제국', kind: '안전 허브', travelKind: 'safe', x: 0.72, y: 0.64, lv: 16, enc: 'safe', tile: 'empire_marble', requires: 'swampBossDefeated', desc: '운하가 가로지르는 보급항. 연금술사와 보석상, 영주의 저택.' },
  { id: 'empire_city', name: '폐허 시가지', region: '2막 · 제국', kind: '시가전 · 타락기사', travelKind: 'boss', x: 0.74, y: 0.36, lv: 17, enc: 'high', tile: 'empire_marble', requires: 'empireBossDefeated', desc: '격자 대로가 미로처럼 얽힌 폐허 수도. 타락한 기사가 배회한다.' },
  { id: 'grand_citadel', name: '대성채', region: '2막 · 제국', kind: '옵션 던전', travelKind: 'node', x: 0.84, y: 0.24, lv: 18, enc: 'high', tile: 'empire_marble', requires: 'empireBossDefeated', desc: '수도 북측의 옵션 던전. 성채 집사가 왕좌를 지킨다.' },
  { id: 'empire_throne', name: '황좌의 방', region: '2막 · 제국', kind: '보스 · 황제', travelKind: 'boss', x: 0.80, y: 0.12, lv: 20, enc: 'high', tile: 'empire_marble', requires: 'empireBossDefeated', desc: '몰락한 황제가 앉은 옥좌의 방. 정문·뒷문이 이곳으로 수렴한다.' },

  // ── 3막 · 종막 권역 ──
  { id: 'starfall', name: '별무덤', region: '3막 · 종막', kind: '잿길 필드', travelKind: 'node', x: 0.62, y: 0.12, lv: 22, enc: 'high', tile: 'meadow', requires: 'empireBossDefeated', desc: '별이 떨어져 잿빛으로 물든 들판. 3막 종막으로 내려가는 재의 길.' },
  { id: 'lava_gate', name: '불의 분화구', region: '3막 · 종막', kind: '용암 관문', travelKind: 'boss', x: 0.50, y: 0.08, lv: 24, enc: 'high', tile: 'lava', requires: 'empireBossDefeated', desc: '끓어오르는 분화구의 관문. 용암 요새와 마그마 드레이크의 둥지로 이어진다.' },
  { id: 'lava_core', name: '용암 심부', region: '3막 · 종막', kind: '슈퍼보스 · 마그마 드레이크', travelKind: 'boss', x: 0.40, y: 0.06, lv: 26, enc: 'high', tile: 'lava', requires: 'empireBossDefeated', desc: '드레이크가 도사린 용암 심부. 포스트게임 최강의 화염이 기다린다.' },
  { id: 'void_gate', name: '공허의 균열', region: '3막 · 종막', kind: '공허 관문', travelKind: 'boss', x: 0.30, y: 0.10, lv: 30, enc: 'high', tile: 'void_nebula', requires: 'magmaDrakeDefeated', desc: '현실이 찢긴 공허의 균열. 심연의 군주가 잠든 종막의 문.' },
  { id: 'void_core', name: '공허의 핵', region: '3막 · 종막', kind: '최종보스 · 공허 군주', travelKind: 'boss', x: 0.36, y: 0.07, lv: 32, enc: 'high', tile: 'void_nebula', requires: 'magmaDrakeDefeated', desc: '심연의 군주가 잠든 공허의 핵. 진정한 종막.' },
];

// 지도 경로선 (발견=골드 점선 / 미발견=회색). 시각용 — 이동 제약과 무관.
export const WORLD_EDGES = [
  ['town', 'wild'], ['wild', 'lake_town'], ['wild', 'darkforest'], ['wild', 'dungeon'],
  ['dungeon', 'frost'], ['frost', 'swamp'], ['swamp', 'overworld'], ['overworld', 'empire_camp'],
  ['empire_camp', 'port_city'], ['empire_camp', 'empire_city'], ['empire_city', 'grand_citadel'],
  ['empire_city', 'empire_throne'], ['empire_throne', 'starfall'], ['starfall', 'lava_gate'],
  ['lava_gate', 'lava_core'], ['lava_core', 'void_gate'], ['void_gate', 'void_core'],
];

// 권역 대륙 blob (심해 위 초록/제국/종막 덩어리). pts = 0~1 정규화 폴리곤.
export const WORLD_LAND = [
  { c: 0x16321a, pts: [[0.05, 0.8], [0.2, 0.48], [0.4, 0.35], [0.35, 0.62], [0.18, 0.85]] },
  { c: 0x1a2a16, pts: [[0.28, 0.42], [0.5, 0.18], [0.62, 0.38], [0.5, 0.58], [0.32, 0.52]] },
  { c: 0x2a2224, pts: [[0.5, 0.55], [0.68, 0.38], [0.88, 0.2], [0.82, 0.5], [0.62, 0.68]] },
  { c: 0x1a1230, pts: [[0.3, 0.2], [0.55, 0.04], [0.68, 0.18], [0.46, 0.3], [0.32, 0.3]] },
];

// 프리뷰 코드 드로잉 팔레트 (타일별 4색).
export const WORLD_TILE_PAL = {
  meadow: [0x3f6a30, 0x4a7a3a, 0x568a3c, 0x6b5a3f],
  forest: [0x26381e, 0x2c4a22, 0x375426, 0x1a2814],
  dungeon: [0x2a2833, 0x36323e, 0x4a4652, 0x1c1a24],
  frost_ice: [0x7fa0c0, 0xa8c8e4, 0xd6e8ff, 0x5a7290],
  swamp: [0x3a4a26, 0x45402e, 0x3f5a2a, 0x2a3018],
  empire_marble: [0x4a4046, 0x6a5c60, 0x463a3c, 0x8a7c80],
  lava: [0x2a1208, 0x5a2410, 0xc94a1a, 0xf0a030],
  void_nebula: [0x1a1030, 0x2a1a48, 0x6a5a8a, 0xb483f0],
  town: [0x3f6a30, 0x4a7a3a, 0x6b5a3f, 0x8a6a44],
};

export function worldNode(id) { return WORLD_NODES.find((n) => n.id === id) || null; }

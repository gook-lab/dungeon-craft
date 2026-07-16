// 원혼의 늪 — execution-route dead-end map (portal-gated on swampBoss_slain).
// Mirror of witchs_hut: the mercy route unlocks a friendly shop cottage; the
// execute route unlocks this cursed bog — a 원혼 miniboss guarding execute-only
// dark loot. Symmetric gated submap (boss+loot vs shop+ally).

const W = 20, H = 15;

const ground = Array(W * H).fill(5);
const collision = Array(W * H).fill(1);

// Walkable interior (cols 1-18, rows 1-13) — same footprint as the hut.
for (let y = 1; y < 14; y++) {
  for (let x = 1; x < 19; x++) {
    collision[y * W + x] = 0;
  }
}

export default {
  id: 'wraith_bog',
  name: '원혼의 늪',
  w: W, h: H,
  tileset: 'swamp',
  mood: 'swamp',
  weather: 'none',
  symbolEncounters: false,
  ground,
  collision,
  spawn: { x: 10, y: 12 },
  // 출구 — portalAt()은 map.portals만 읽는다 (objects의 kind:'portal'은 무시됨 → 소프트락).
  portals: [
    { x: 10, y: 13, to: 'swamp', tx: 51, ty: 20, label: '나가기' },
  ],
  objects: [
    // 원혼 미니보스 — 벤 마녀의 원한. 처단 루트 전용 도전.
    { x: 10, y: 6, kind: 'boss', ref: 'bog_revenant', talk: 'wraith_bog_intro', flag: 'wraithBogCleared', win: 'wraith_bog_win' },
    // 처단 전용 보상 — 저주의 성물(상점/일반 loot 미등록) + 골드. 원혼 너머에 놓여
    // 자연히 보스를 유발.
    { x: 3, y: 3, kind: 'chest', loot: { item: 'hex_reliquary' } },
    { x: 16, y: 3, kind: 'chest', loot: { artifact: 'brand' } },
    // 분위기 프롭.
    { x: 8, y: 8, kind: 'prop', ref: 'prop_bone_pile_hd', tiles: 1.4, walkable: true },
    { x: 13, y: 9, kind: 'prop', ref: 'prop_rotten_log' },
  ],
};

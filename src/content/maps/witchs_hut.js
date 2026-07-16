// 마녀의 오두막 — mercy route dead-end map (portal-gated on bogWitch_spared)
// Minimal cottage interior with shop/inn/quest NPC.

const W = 20, H = 15;

const ground = Array(W * H).fill(5);
const collision = Array(W * H).fill(1);

// Walkable interior (cols 1-18, rows 1-13)
for (let y = 1; y < 14; y++) {
  for (let x = 1; x < 19; x++) {
    collision[y * W + x] = 0;
  }
}

export default {
  id: 'witchs_hut',
  name: '마녀의 오두막',
  w: W, h: H,
  tileset: 'swamp',
  weather: 'none',
  symbolEncounters: false,
  ground,
  collision,
  spawn: { x: 10, y: 12 },
  objects: [
    // Portal back to swamp
    { x: 10, y: 13, kind: 'portal', to: 'swamp', tx: 53, ty: 20, label: '나가기' },
    // Witch shopkeeper NPC (merged shop+inn+quest into one friendly NPC)
    // art:'enemy' → enemyUrl(ref) 직접 사용이라 ref는 실존 스프라이트 키여야 함
    // (bog_witch_npc는 파일 없음 → boss_bog_witch_east.png 사용).
    { x: 10, y: 5, kind: 'npc', name: '살려 주신 마녀', art: 'enemy', ref: 'boss_bog_witch', action: 'shop', shop: 'witchs_hut_shop', talk: 'witchs_hut_greeting', npcId: 'witchs_hut_witch' },
    // Cauldron — 치유샘(무료 전체 회복). talk가 있으면 상호작용 가능(프롭이라 solid).
    { x: 8, y: 7, kind: 'prop', ref: 'prop_witch_cauldron', tiles: 1.4, talk: 'witch_spring' },
    // Decorative mushrooms
    { x: 14, y: 4, kind: 'prop', ref: 'prop_mushroom_hd', tiles: 1.3, walkable: true },
    { x: 5, y: 8, kind: 'prop', ref: 'prop_mushroom_hd', tiles: 1.3, walkable: true },
    // 사이드 퀘스트 giver (자비 루트 스펙) — 마녀의 약탕 재료 의뢰 표식.
    { x: 12, y: 5, kind: 'sign', quest: 'q_witch' },
    // Hidden reward chest
    { x: 3, y: 3, kind: 'chest', loot: { artifact: 'mercy_relic' }, hidden: true },
  ],
};

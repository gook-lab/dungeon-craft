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
    { x: 10, y: 5, kind: 'npc', name: '살려 주신 마녀', art: 'enemy', ref: 'bog_witch_npc', action: 'shop', shop: 'witchs_hut_shop', talk: 'witchs_hut_greeting', npcId: 'witchs_hut_witch' },
    // Cauldron — 치유샘(무료 전체 회복). talk가 있으면 상호작용 가능(프롭이라 solid).
    { x: 8, y: 7, kind: 'prop', ref: 'prop_witch_cauldron', tiles: 1.4, talk: 'witch_spring' },
    // Decorative mushrooms
    { x: 14, y: 4, kind: 'prop', ref: 'prop_mushroom_hd', tiles: 1.3, walkable: true },
    { x: 5, y: 8, kind: 'prop', ref: 'prop_mushroom_hd', tiles: 1.3, walkable: true },
    // Hidden reward chest
    { x: 3, y: 3, kind: 'chest', loot: { gold: 150 }, hidden: true },
  ],
};

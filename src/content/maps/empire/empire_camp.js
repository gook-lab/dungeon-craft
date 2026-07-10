// Refugee Camp — a safe hub inside the empire's ruins (no encounters). The
// survivors of the fallen empire huddle here: a veteran who remembers the
// emperor, and a refugee who fears him still. Their lines are tone-branched
// (empire_camp_* + _merciful/_ruthless variants). West entrance from the gate,
// east passage into the inner city.

import { fillGrid, rect, borderWall, raiseRect } from '../_builder.js';

const W = 16, H = 13;
const ground = fillGrid(W, H, 8); // corrupted imperial marble (empire tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// Ruined building footprints (solid blocks; props rendered on top).
rect(collision, W, 2, 2, 3, 3, 1);    // collapsed hall
rect(collision, W, 12, 2, 13, 3, 1);  // shelter
rect(collision, W, 2, 9, 3, 10, 1);   // store ruin

for (let y = 5; y <= 7; y++) { collision[y * W] = 0; collision[y * W + (W - 1)] = 0; } // 3-wide arches (gate ↔ city)
collision[(H - 1) * W + 8] = 0;  // south gap → optional 심연의 다리 side-area

// HD-2D: a low ruined terrace across the north of the camp (the refugees shelter on
// the rubble rise); a stair on the central spine climbs to it.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 5, 1, 10, 3, 1);
const stairs = [{ x: 8, y: 3 }];

export default {
  id: 'empire_camp',
  name: '피란민 야영',
  w: W, h: H,
  tileset: 'empire',
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 1, y: 6 },
  objects: [
    { x: 3, y: 3, kind: 'prop', ref: 'prop_cottage', tiles: 2.8 },
    { x: 13, y: 3, kind: 'prop', ref: 'prop_cottage', tiles: 2.8 },
    { x: 3, y: 10, kind: 'prop', ref: 'prop_broken_brazier' },
    { x: 11, y: 10, kind: 'prop', ref: 'prop_mossy_shrine' },
    // NPCs — refugee dialog (tone-branched in dialog.js).
    { x: 4, y: 4, kind: 'npc', ref: 'elder', dir: 'south', talk: 'empire_camp_veteran', label: '늙은 병사' },
    { x: 12, y: 5, kind: 'npc', ref: 'shopkeeper', dir: 'south', talk: 'empire_camp_refugee', label: '피란민' },
    { x: 8, y: 9, kind: 'npc', ref: 'shopkeeper', dir: 'south', talk: 'inn', label: '모닥불' }, // a cookfire = rest
    // Court mage — talk to recruit the 4th hero (mage class). art:'hero' renders
    // the mage field sprite; vanishes once joined (joinedMage). main.recruitHero
    // folds it into the party at the lead's level.
    { x: 5, y: 9, kind: 'npc', ref: 'mage', art: 'hero', dir: 'south', talk: 'recruit_mage', recruit: 'mage', flag: 'joinedMage', label: '마법사' },
    // Quest giver — the bog witch bounty (turn in here after clearing the swamp).
    { x: 11, y: 4, kind: 'npc', ref: 'elder', dir: 'south', quest: 'q_witch', label: '! 의뢰' },
    // 로어 사이드퀘 기버: 봉인의 파수병(2막 존) / 핏빛 백작(옵셔널 미니보스) 지목.
    { x: 4, y: 7, kind: 'npc', ref: 'priest', dir: 'south', quest: 'q_broken_oath', label: '! 유물 학자' },
    { x: 13, y: 7, kind: 'npc', ref: 'guard', dir: 'south', quest: 'q_bloods_madness', label: '! 떠도는 검객' },
    // Late-game restock — alchemist (potions / return scrolls) in the camp.
    { x: 11, y: 9, kind: 'npc', ref: 'alchemist', dir: 'south', talk: 'shop_alchemist', label: '연금술사' },
    // Every town has a smith + jeweler. The refugees rebuilt a forge + a gem stall
    // here too (reuses the town's shop_smith/shop_jeweler dialog + SHOPS registry).
    { x: 6, y: 4, kind: 'npc', ref: 'blacksmith', dir: 'south', talk: 'shop_smith', label: '대장장이' },
    { x: 10, y: 11, kind: 'npc', ref: 'jeweler', dir: 'south', talk: 'shop_jeweler', label: '보석상' },
    { x: 7, y: 8, kind: 'sign', talk: 'empire_camp_sign' },
    { x: 13, y: 10, kind: 'chest', loot: { gold: 150 } },
    // 도덕 선택 방 (C단계): a bound imperial deserter. Talking opens a terminal
    // choice (살려보낸다/처형한다) → resolveMoral feeds mercied/slain (tone+ending).
    { x: 9, y: 7, kind: 'npc', ref: 'guard', dir: 'south', talk: 'moral_deserter', moral: 'deserter', flag: 'deserterJudged', label: '! 포로' },
  ],
  portals: [
    { x: 0, y: 6, to: 'empire_gate', tx: 24, ty: 8 },
    { x: 15, y: 6, to: 'empire_city', tx: 1, ty: 8 },
    // South → optional 심연의 다리 (bridge warden + reward); dead-end side-area.
    { x: 8, y: 12, to: 'empire_bridge', tx: 11, ty: 14 },
  ],
  encounters: null, // safe hub
};

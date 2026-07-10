// Crypt Village — the slice's hub town. Grass with dirt paths, a few buildings
// (collision blocks + structure props), the elder and shopkeeper NPCs, an inn
// tile, and a south gate portal to the wild. No encounters (safe).

import { fillGrid, rect, hLine, vLine, borderWall, raiseRect } from './_builder.js';

const W = 16, H = 13;
const ground = fillGrid(W, H, 0); // grass
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// Dirt path: vertical spine + horizontal plaza + a packed central square (the
// village green) so the hub reads as a lived-in town, not a grass rectangle.
vLine(ground, W, 7, 1, 11, 1);
vLine(ground, W, 8, 1, 11, 1);
hLine(ground, W, 2, 13, 5, 1);
rect(ground, W, 6, 6, 11, 9, 1); // central plaza around the well + rune gate

// Buildings = solid blocks (rendered with structure props on top via objects)
rect(collision, W, 2, 2, 3, 3, 1);   // shop building footprint
rect(collision, W, 12, 2, 13, 3, 1); // inn building footprint
rect(collision, W, 2, 8, 3, 9, 1);   // elder's house
rect(collision, W, 12, 8, 13, 9, 1); // well area handled as single prop below

// South gate: open the bottom-center wall for the portal
for (let x = 6; x <= 9; x++) collision[(H - 1) * W + x] = 0; // wide village gate

// HD-2D: the village climbs a low hill — the northern building row (shop/inn) sits
// on a RAISED stone terrace, reached by steps on the central spine. The plaza, well,
// rune gate, recruits and quest-givers stay on the lower green. Talking up to a
// terrace NPC just faces the step. content.test verifies the terrace chest reachable.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 1, 1, 14, 4, 1);
const stairs = [{ x: 7, y: 4 }, { x: 8, y: 4 }];

export default {
  id: 'town',
  name: '크립트 마을',
  w: W, h: H,
  tileset: 'town',
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 7, y: 9 },
  objects: [
    // Cottages on the building footprints (visual; collision is the 2x2 block).
    { x: 3, y: 3, kind: 'prop', ref: 'prop_cottage', tiles: 2.8 },   // shop
    { x: 13, y: 3, kind: 'prop', ref: 'prop_cottage', tiles: 2.8 },  // inn
    { x: 3, y: 9, kind: 'prop', ref: 'prop_cottage', tiles: 2.8 },   // elder's house
    // NPCs (walkable tiles in front of buildings)
    { x: 3, y: 4, kind: 'npc', ref: 'shopkeeper', dir: 'south', talk: 'shop', label: '잡화점' },
    { x: 2, y: 7, kind: 'npc', ref: 'elder', dir: 'south', talk: 'elder_intro', label: '장로' },
    // 1막 관통 캐릭터 — 방랑자 에녹 (Pasqualina VS-style 아트 재사용, dialog-only).
    // npcId = 배치별 고유 id (talk cond 타겟; 2·3막의 에녹은 enoch_act2/act3).
    { x: 11, y: 8, kind: 'npc', ref: 'enoch', npcId: 'enoch_act1', dir: 'south', talk: 'enoch_act1', label: '? 방랑자' },
    { x: 12, y: 4, kind: 'npc', ref: 'shopkeeper', dir: 'south', talk: 'inn', label: '여관' },
    // Recruitable companions — talk to add them to the party. `art:'hero'` renders
    // the hero field sprite; `flag` hides the NPC once recruited; `recruit` is the
    // party-member id main.openDialog folds in on dialog close.
    // The chosen leader's NPC is hidden (its joined flag is preset at new-game);
    // the other two base heroes wait here to be recruited.
    { x: 4, y: 5, kind: 'npc', ref: 'knight', art: 'hero', dir: 'south', talk: 'recruit_knight', recruit: 'knight', flag: 'joinedKnight', label: '기사' },
    { x: 6, y: 5, kind: 'npc', ref: 'warrior', art: 'hero', dir: 'south', talk: 'recruit_warrior', recruit: 'warrior', flag: 'joinedWarrior', label: '전사' },
    { x: 9, y: 5, kind: 'npc', ref: 'huntress', art: 'hero', dir: 'south', talk: 'recruit_huntress', recruit: 'huntress', flag: 'joinedHuntress', label: '사냥꾼' },
    // 쌍검사 — a wandering bounty-hunter loitering near the inn. recruit NPC for
    // when the duelist isn't the chosen leader (joinedDuelist hides it once joined).
    { x: 11, y: 5, kind: 'npc', ref: 'duelist', art: 'hero', dir: 'south', talk: 'recruit_duelist', recruit: 'duelist', flag: 'joinedDuelist', label: '쌍검사' },
    // Quest givers — `quest` routes interaction to game.talkQuest (offer/turn-in).
    { x: 13, y: 5, kind: 'npc', ref: 'guard', dir: 'south', quest: 'q_crypt', label: '! 위병대장' },
    { x: 4, y: 9, kind: 'npc', ref: 'priest', dir: 'south', quest: 'q_mercy', label: '! 사제' },
    { x: 13, y: 10, kind: 'npc', ref: 'herbalist', dir: 'south', quest: 'q_herbs', label: '! 약초꾼' },
    // Specialized merchants (placeholder sprites until PixelLab art lands).
    { x: 5, y: 11, kind: 'npc', ref: 'blacksmith', dir: 'south', talk: 'shop_smith', label: '대장장이' },
    { x: 9, y: 9, kind: 'npc', ref: 'jeweler', dir: 'south', talk: 'shop_jeweler', label: '보석상' },
    // Decorative props
    { x: 10, y: 9, kind: 'prop', ref: 'prop_well_hd' },
    { x: 5, y: 2, kind: 'prop', ref: 'prop_oak_tree', tiles: 2.3 },
    { x: 11, y: 10, kind: 'prop', ref: 'prop_mossy_shrine' },
    // A grand village oak in the corner + a small graveyard (it IS Crypt Village)
    // — atmosphere props in otherwise-empty edge tiles.
    { x: 14, y: 11, kind: 'prop', ref: 'prop_giant_ancient_oak', tiles: 3.0 },
    { x: 1, y: 11, kind: 'prop', ref: 'prop_tombstone_hd', tiles: 1.5 },
    { x: 1, y: 10, kind: 'prop', ref: 'prop_giant_tombstone', tiles: 1.8 },
    { x: 6, y: 11, kind: 'sign', talk: 'gate_sign' },
    { x: 11, y: 2, kind: 'chest', loot: { gold: 40 } },
    // Fast-travel rune gate — face + Z opens the warp destination picker
    // (dialog action 'warp' → WarpScene). A prop with `talk` renders + interacts.
    { x: 10, y: 7, kind: 'prop', ref: 'prop_dimensional_rift', talk: 'town_portal' },
  ],
  portals: [
    { x: 7, y: 12, to: 'wild', tx: 10, ty: 1 },
    { x: 8, y: 12, to: 'wild', tx: 11, ty: 1 },
  ],
  encounters: null,
};

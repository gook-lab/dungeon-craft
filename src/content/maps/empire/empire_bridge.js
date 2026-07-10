// 심연의 다리 (Chasm Bridge) — an OPTIONAL empire side-area (C단계 붕괴다리
// 셋피스). A ruined imperial span over a bottomless chasm: the only crossing is a
// single narrow bridge (bridgeChasm generator). Step onto it and the rotten span
// gives way to an AMBUSH (encounter trigger); past it waits the 다리 파수꾼, a
// chained colossus you may SPARE/free or cut down (mercy setpiece). The far side
// holds the reward. Reached from the refugee camp; a dead-end (one portal in/out),
// so it never touches the main town→…→throne completability path.
//
//   row1-7  (north)   🗝knight_plate · · · 💰gold      ← reward, past the warden
//   row4              💀 다리 파수꾼 (spareable miniboss)
//   row8-9  ▓▓▓▓▓ chasm ▓▓ |bridge(x11)| ▓▓▓▓▓        ← only col 11 crosses
//   row10             ⚠ ambush trigger (the span buckles)
//   row14   ▶spawn                                     ← from the camp
//   row15             ◖return portal → 야영

import { fillGrid, bridgeChasm, borderWall, raiseRect } from '../_builder.js';

const W = 22, H = 16;
const ground = fillGrid(W, H, 8); // corrupted imperial marble (empire tileset)
const collision = fillGrid(W, H, 0);
borderWall(collision, W, H);

// The chasm: a 2-row wall band crossable only at the single bridge column x=11.
bridgeChasm(collision, W, H, 'h', 8, [11], { thickness: 2 });

collision[15 * W + 11] = 0; // south gap — the return portal tile

const wardenX = 11, wardenY = 4;

// HD-2D: the warden holds a RAISED altar-platform on the far (north) bank — cross the
// bridge, then climb the stair to face it. The chasm itself reads as the deep below.
const elev = fillGrid(W, H, 0);
raiseRect(elev, collision, W, 8, 2, 14, 5, 1);
const stairs = [{ x: 11, y: 6 }];

export default {
  id: 'empire_bridge',
  name: '심연의 다리',
  w: W, h: H,
  tileset: 'empire',
  walls: true,
  symbolEncounters: false, // no roamers — only the scripted ambush + the warden
  ground,
  collision,
  elev,
  stairs,
  spawn: { x: 11, y: 14 },
  objects: [
    // Spareable miniboss (NOT boss:true → canMercy lets you free it). Cutting it
    // down vs sparing colours the win line (bridge_warden_win_merciful/_ruthless).
    { x: wardenX, y: wardenY, kind: 'boss', ref: 'bridge_warden', talk: 'bridge_warden_intro', flag: 'bridgeWardenDefeated', win: 'bridge_warden_win' },
    { x: 10, y: 12, kind: 'sign', talk: 'empire_bridge_sign' },
    // AMBUSH: stepping onto the bridge's south end collapses the rotten span.
    { x: 11, y: 10, kind: 'trigger', effect: 'encounter', once: true, pool: ['rusty_soldier', 'spirit_guard', 'war_drummer'], min: 3, max: 4, fireMsg: '다리가 무너진다 — 잔해 속에서 망자들이 기어오른다!' },
    // Reward across the chasm, behind the warden.
    { x: 3, y: 2, kind: 'chest', loot: { item: 'knight_plate' } },
    { x: 18, y: 2, kind: 'chest', loot: { gold: 260 } },
    { x: 9, y: 4, kind: 'prop', ref: 'prop_broken_brazier' },
    { x: 13, y: 4, kind: 'prop', ref: 'prop_broken_brazier' },
  ],
  portals: [
    // Dead-end: the only way back is the camp (so the side-area is fully optional).
    { x: 11, y: 15, to: 'empire_camp', tx: 8, ty: 11 },
  ],
  encounters: null,
};

// Warp scene — overlay. Fast-travel destination picker, opened from the town
// rune-gate (dialog action 'warp'). Lists the regions the player has unlocked
// (early areas always open; later regions gate behind the prior boss flag) and
// warps the party to that map's spawn. Mirrors ShopScene's menuList layout.

import * as PIXI from 'pixi.js';
import { label, numLabel, menuList, frame } from '../ui/uikit.js';
import { HEX, FS } from '../ui/tokens.js';
import { getMap } from '../content/maps/index.js';

// Fast-travel anchors. `requires` = a progression flag that must be set before
// the destination appears (you can only warp somewhere you've unlocked).
// Landing coords come from each map's own `spawn`.
// requires = the region's OWN clear flag: a destination opens only AFTER you've
// cleared (defeated the boss of) that stronghold. At the start only 마을(home
// recall) is available; each region's gate unlocks when its boss falls.
export const WARP_POINTS = [
  { map: 'town', name: '크립트 마을', requires: null },               // home recall, always
  { map: 'dungeon', name: '뼈의 지하묘', requires: 'bossDefeated' },
  { map: 'frost', name: '서리 첨탑', requires: 'frostBossDefeated' },
  { map: 'swamp', name: '마녀의 늪', requires: 'swampBossDefeated' },
  { map: 'empire_gate', name: '무너진 제국', requires: 'empireBossDefeated' },
  // Post-game optional regions — open after their gate boss falls (warp-only).
  { map: 'starfall', name: '별무덤', requires: 'empireBossDefeated' }, // 3막 잿빛 들판 (L20 밴드)
  { map: 'lava_gate', name: '불의 분화구', requires: 'empireBossDefeated' },
  { map: 'void_gate', name: '공허의 균열', requires: 'magmaDrakeDefeated' }, // deepest — after the drake
];

export class WarpScene {
  constructor(game) {
    this.game = game;
    this.opaque = false;
    this.container = new PIXI.Container();
    this.layer = new PIXI.Container();
    this.container.addChild(this.layer);
    this.index = 0;
  }

  // Destinations unlocked for the current run (requires flag set, or always-open).
  points() {
    return WARP_POINTS.filter((p) => !p.requires || this.game.runtime.flags[p.requires]);
  }

  enter() { this.index = 0; this.render(); }

  render() {
    this.layer.removeChildren();
    const { w } = this.game.renderer.screen;
    this.dests = this.points();

    const title = frame(260, 50, 'bevel');
    title.x = 30; title.y = 20;
    const tt = label('귀환 포탈', FS.label, HEX.gold);
    tt.x = 46; tt.y = 36;
    this.layer.addChild(title, tt);

    const options = [...this.dests.map((p) => p.name), '나가기'];
    const m = menuList(options, { width: 280 });
    const mx = w / 2 - m.width / 2;
    m.container.x = mx; m.container.y = 90;
    this.layer.addChild(m.container);
    this.menu = m; m.setIndex(this.index); this.options = options;

    const info = label('Z 이동 · X 취소', FS.caption, HEX.textSoft);
    info.x = mx; info.y = 90 + m.height + 10;
    this.layer.addChild(info);
  }

  update() {
    const input = this.game.input;
    const n = this.options.length;
    if (input.pressed('up')) { this.index = (this.index + n - 1) % n; this.menu.setIndex(this.index); }
    if (input.pressed('down')) { this.index = (this.index + 1) % n; this.menu.setIndex(this.index); }
    if (input.pressed('cancel')) return this.close();
    if (input.pressed('confirm')) {
      if (this.index >= this.dests.length) return this.close();
      this.warpTo(this.dests[this.index]);
    }
  }

  warpTo(point) {
    const m = getMap(point.map);
    const sp = (m && m.spawn) || { x: 1, y: 1 };
    this.game.scenes.pop();                 // pop this warp scene → field is top
    this.game.reloadFieldTo(point.map, sp.x, sp.y);
  }

  close() { this.game.scenes.pop(); this.game.resumeField(); }
}

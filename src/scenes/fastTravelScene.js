// 룬게이트 빠른 이동 — 월드맵 오버레이 (opaque). ul/fasttravel-export 시안 이식.
// 좌: 권역 대륙 blob + 경로선 + 노드 마커. 우: 상세 패널(프리뷰·권장Lv·조우·이동).
// 방향키=최근접 방향 노드, Z=이동, X=닫기. 발견(visitedMaps) 노드만 이동 가능.
// 실제 이동은 game.reloadFieldTo(맵 spawn). 색·크기 전부 tokens.js 토큰.

import * as PIXI from 'pixi.js';
import { label, frame } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { WORLD_NODES, WORLD_EDGES, WORLD_LAND, WORLD_TILE_PAL, worldNode } from '../content/worldmap.js';
import { getMap } from '../content/maps/index.js';

const STATE_COLOR = { current: NUM.goldGlow, hub: NUM.gold, safe: NUM.hpHigh, boss: NUM.hpLow, node: NUM.textSoft, inactive: NUM.textMute, locked: NUM.textOff };
const ENC_KR = { safe: ['조우 없음', HEX.hpHigh], low: ['낮음', HEX.textSoft], mid: ['보통', HEX.textSoft], high: ['높음', HEX.hpLow] };

export class FastTravelScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.mapLayer = new PIXI.Container();   // 대륙 blob + 경로
    this.nodeLayer = new PIXI.Container();   // 노드 마커
    this.sideLayer = new PIXI.Container();   // 상세 패널
    this.warpLayer = new PIXI.Container();   // 이동 연출
    this.container.addChild(this.mapLayer, this.nodeLayer, this.sideLayer, this.warpLayer);
    this._t = 0;
    this.warping = false;
  }

  enter() {
    const rt = this.game.runtime;
    this.visited = new Set(rt.visitedMaps || []);
    this.visited.add(rt.mapId); // 현재 맵은 항상 발견
    this.gates = new Set(rt.runegates || ['town']);
    this.gates.add('town'); // 마을 룬게이트는 기본 활성
    this.selId = rt.mapId && worldNode(rt.mapId) ? rt.mapId : 'town';
    this.buildBackground();
    this.buildMap();
    this.buildNodes();
    this.select(this.selId);
  }

  // 노드 상태 (런타임):
  //   current — 현재 맵 · locked — 미방문(???) · inactive — 방문했으나 룬게이트 미활성
  //   travelKind별(hub/safe/boss/node) — 룬게이트 활성 = 이동 가능.
  nodeState(n) {
    const rt = this.game.runtime;
    if (n.id === rt.mapId) return 'current';
    if (!this.visited.has(n.id)) return 'locked';
    if (!this.gates.has(n.id)) return 'inactive';
    return n.travelKind || 'node';
  }
  canTravel(n) { const st = this.nodeState(n); return st !== 'current' && st !== 'locked' && st !== 'inactive'; }

  // 지도 영역(좌측)의 픽셀 좌표.
  mapRect() {
    const { w, h } = this.game.renderer.screen;
    const pad = 24;
    return { x: pad, y: pad + 40, w: w * 0.60 - pad * 1.5, h: h - pad * 2 - 40 };
  }
  nodePx(n) { const r = this.mapRect(); return [r.x + n.x * r.w, r.y + n.y * r.h]; }

  buildBackground() {
    this.container.removeChildren();
    this.container.addChild(this.mapLayer, this.nodeLayer, this.sideLayer, this.warpLayer);
    const { w, h } = this.game.renderer.screen;
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, w, h).fill({ color: 0x0a0b16 });
    this.container.addChildAt(bg, 0);
    const title = label('룬게이트 · 빠른 이동', FS.display, HEX.gold, { font: FONT.display });
    title.x = 24; title.y = 16; this.container.addChild(title);
  }

  buildMap() {
    this.mapLayer.removeChildren();
    const r = this.mapRect();
    const g = new PIXI.Graphics();
    // 심해 바탕 + 프레임
    g.rect(r.x, r.y, r.w, r.h).fill({ color: 0x0a1024 }).stroke({ color: NUM.frame, width: 2 });
    // 물결 텍스처
    for (let yy = r.y + 8; yy < r.y + r.h; yy += 12) {
      const line = new PIXI.Graphics();
      line.moveTo(r.x, yy);
      for (let xx = 0; xx <= r.w; xx += 8) line.lineTo(r.x + xx, yy + Math.sin((xx + yy) * 0.05) * 2);
      line.stroke({ color: 0x3c5a8c, width: 1, alpha: 0.10 });
      this.mapLayer.addChild(line);
    }
    // 권역 대륙 blob
    for (const L of WORLD_LAND) {
      const poly = [];
      for (const p of L.pts) { poly.push(r.x + p[0] * r.w, r.y + p[1] * r.h); }
      g.poly(poly).fill({ color: L.c }).stroke({ color: 0x5a78a0, width: 2, alpha: 0.25 });
    }
    this.mapLayer.addChildAt(g, 0);
    // 경로선 (발견=골드 점선 / 미발견=회색). Graphics 점선 대신 짧은 세그먼트로.
    const edges = new PIXI.Graphics();
    for (const [a, b] of WORLD_EDGES) {
      const na = worldNode(a), nb = worldNode(b); if (!na || !nb) continue;
      const locked = this.nodeState(na) === 'locked' || this.nodeState(nb) === 'locked';
      const [x1, y1] = this.nodePx(na), [x2, y2] = this.nodePx(nb);
      const segs = 14;
      for (let i = 0; i < segs; i += 2) {
        const t0 = i / segs, t1 = (i + 1) / segs;
        edges.moveTo(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0)
          .lineTo(x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1)
          .stroke({ color: locked ? 0x505678 : NUM.goldDeep, width: 2, alpha: locked ? 0.3 : 0.55 });
      }
    }
    this.mapLayer.addChild(edges);
  }

  buildNodes() {
    this.nodeLayer.removeChildren();
    this.nodeMarks = [];
    for (const n of WORLD_NODES) {
      const st = this.nodeState(n);
      const [px, py] = this.nodePx(n);
      const col = STATE_COLOR[st] ?? NUM.textSoft;
      const g = new PIXI.Graphics();
      // 마름모 마커
      const s = st === 'current' ? 9 : 6;
      g.poly([px, py - s, px + s, py, px, py + s, px - s, py]).fill({ color: col })
        .stroke({ color: 0x05060f, width: 1.5 });
      this.nodeLayer.addChild(g);
      // 라벨
      const nm = label(st === 'locked' ? '???' : n.name, FS.caption, st === 'locked' ? HEX.textOff : HEX.text);
      nm.anchor = { x: 0.5, y: 0 }; nm.x = px; nm.y = py + s + 2;
      this.nodeLayer.addChild(nm);
      this.nodeMarks.push({ n, g, px, py, s, col, ping: st === 'current' });
    }
    this.highlightSel();
  }

  highlightSel() {
    this.selRing?.destroy();
    const m = this.nodeMarks.find((k) => k.n.id === this.selId);
    if (!m) return;
    const ring = new PIXI.Graphics();
    ring.poly([m.px, m.py - m.s - 4, m.px + m.s + 4, m.py, m.px, m.py + m.s + 4, m.px - m.s - 4, m.py])
      .stroke({ color: NUM.gold, width: 2 });
    this.nodeLayer.addChild(ring);
    this.selRing = ring;
  }

  // 코드 드로잉 지역 프리뷰 (export drawPreview 이식).
  drawPreview(x, y, w, h, tile, seed) {
    const g = new PIXI.Graphics();
    const pal = WORLD_TILE_PAL[tile] || WORLD_TILE_PAL.meadow;
    let s = 0; for (const c of (seed || tile)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const cell = 10;
    for (let cy = 0; cy < h / cell; cy++) for (let cx = 0; cx < w / cell; cx++) {
      g.rect(x + cx * cell, y + cy * cell, cell, cell).fill({ color: pal[(rnd() * 3) | 0] });
    }
    for (let i = 0; i < 18; i++) {
      g.rect(x + ((rnd() * w) | 0), y + ((rnd() * h) | 0), 3 + (rnd() * 4 | 0), 3 + (rnd() * 4 | 0)).fill({ color: pal[3] });
    }
    return g;
  }

  select(id) {
    this.selId = id; this.highlightSel();
    const n = worldNode(id); if (!n) return;
    const st = this.nodeState(n);
    const locked = st === 'locked', current = st === 'current', inactive = st === 'inactive';
    this.sideLayer.removeChildren();
    const { w, h } = this.game.renderer.screen;
    const sx = w * 0.62, sw = w - sx - 20, sy = 60;
    const box = frame(sw, h - sy - 20, 'bevel'); box.x = sx; box.y = sy; this.sideLayer.addChild(box);
    let yy = sy + 16; const lx = sx + 16;
    const add = (t, sz, col, font) => { const L = label(t, sz, col, font ? { font } : undefined); L.x = lx; L.y = yy; this.sideLayer.addChild(L); yy += sz + 8; return L; };

    add(locked ? '미발견 지역' : n.region, FS.caption, HEX.goldDeep);
    add(locked ? '???' : n.name, FS.display, current ? HEX.goldGlow : HEX.gold, FONT.display); yy += 2;
    add(locked ? '아직 발견하지 못한 장소' : n.kind, FS.caption, HEX.textSoft);
    yy += 6;
    // 프리뷰
    const pw = sw - 32, ph = 96;
    if (locked) {
      const fog = new PIXI.Graphics(); fog.rect(lx, yy, pw, ph).fill({ color: 0x141425 }).stroke({ color: NUM.frame, width: 1 });
      this.sideLayer.addChild(fog);
      const q = label('?', FS.display, HEX.textOff, { font: FONT.display }); q.anchor = { x: 0.5, y: 0.5 }; q.x = lx + pw / 2; q.y = yy + ph / 2 - 10; this.sideLayer.addChild(q);
      const m = label('먼저 방문해야 이동할 수 있습니다', FS.caption, HEX.textMute); m.anchor = { x: 0.5, y: 0.5 }; m.x = lx + pw / 2; m.y = yy + ph / 2 + 22; this.sideLayer.addChild(m);
    } else {
      const prev = this.drawPreview(lx, yy, pw, ph, n.tile, n.id); this.sideLayer.addChild(prev);
      const fr = new PIXI.Graphics(); fr.rect(lx, yy, pw, ph).stroke({ color: NUM.frame, width: 1 }); this.sideLayer.addChild(fr);
    }
    yy += ph + 12;
    // 설명 + 로우
    const desc = label(n.desc, FS.caption, HEX.textSoft, { wordWrap: true, wordWrapWidth: sw - 32 });
    desc.x = lx; desc.y = yy; this.sideLayer.addChild(desc); yy += Math.ceil(desc.height) + 12;
    if (!locked) {
      const row = (k, v, vc) => {
        const kk = label(k, FS.caption, HEX.textMute); kk.x = lx; kk.y = yy;
        const vv = label(v, FS.caption, vc || HEX.text); vv.anchor = { x: 1, y: 0 }; vv.x = sx + sw - 16; vv.y = yy;
        this.sideLayer.addChild(kk, vv); yy += FS.caption + 8;
      };
      row('권장 레벨', `Lv ${n.lv}+`);
      const [encTxt, encCol] = ENC_KR[n.enc] || ENC_KR.mid;
      row('조우 위험', encTxt, encCol);
      row('권역', n.region, HEX.textSoft);
    }
    // 이동 버튼 — 내용 흐름 뒤에 배치(패널 하단 여백 클램프).
    const btnH = 40, btnW = sw - 32, bx = lx;
    const by = Math.min(yy + 10, h - 20 - btnH - 26);
    const btn = new PIXI.Graphics();
    const canGo = this.canTravel(n);
    btn.roundRect(bx, by, btnW, btnH, 4).fill({ color: canGo ? 0x2a2036 : 0x1a1a26 }).stroke({ color: canGo ? NUM.gold : NUM.frame, width: canGo ? 2 : 1 });
    this.sideLayer.addChild(btn);
    const btnTxt = current ? '현재 위치' : locked ? '이동 불가' : inactive ? '룬게이트 미활성' : '이곳으로 이동  ▶ Z';
    const btl = label(btnTxt, FS.command, canGo ? HEX.gold : HEX.textOff, { font: FONT.ui });
    btl.anchor = { x: 0.5, y: 0.5 }; btl.x = bx + btnW / 2; btl.y = by + btnH / 2; this.sideLayer.addChild(btl);
    const footTxt = locked ? '탐험으로 지도를 밝히세요' : current ? '이미 이 지역에 있습니다'
      : inactive ? '현지의 룬게이트를 활성화해야 이동할 수 있습니다' : '방향키 선택 · Z 이동 · X 닫기';
    const foot = label(footTxt, FS.caption, HEX.textMute);
    foot.anchor = { x: 0.5, y: 0 }; foot.x = bx + btnW / 2; foot.y = by + btnH + 8; this.sideLayer.addChild(foot);
  }

  // 방향키 네비 — 지도상 가장 가까운 방향 노드 (export nav 알고리즘).
  nav(dx, dy) {
    const cur = worldNode(this.selId); if (!cur) return;
    let best = null, bestScore = Infinity;
    for (const n of WORLD_NODES) {
      if (n.id === this.selId) continue;
      const vx = n.x - cur.x, vy = n.y - cur.y;
      const dot = vx * dx + vy * dy; if (dot <= 0.02) continue;
      const dist = Math.hypot(vx, vy); const align = dot / (dist || 1);
      const score = dist / (align * align + 0.1);
      if (score < bestScore) { bestScore = score; best = n; }
    }
    if (best) { this.game.audio?.play('menu_cursor'); this.select(best.id); }
  }

  travel(n) {
    if (this.warping) return;
    this.warping = true;
    this.game.audio?.play('menu_confirm');
    const [px, py] = this.nodePx(n);
    const flash = new PIXI.Graphics();
    this.warpLayer.addChild(flash);
    this._warpFx = { g: flash, x: px, y: py, t: 0, node: n };
  }

  update(dt) {
    this._t += dt;
    const input = this.game.input;
    // 현재 노드 ping 맥동
    for (const m of this.nodeMarks || []) {
      if (m.ping) { const s = 1 + Math.sin(this._t * 4) * 0.18; m.g.scale.set(s); m.g.pivot.set(m.px, m.py); m.g.position.set(m.px, m.py); }
    }
    // 워프 연출 진행
    if (this._warpFx) {
      const fx = this._warpFx; fx.t += dt;
      const { w, h } = this.game.renderer.screen;
      fx.g.clear();
      if (fx.t < 0.55) { // 골드 확산
        const r = fx.t / 0.55 * Math.hypot(w, h);
        fx.g.circle(fx.x, fx.y, r).fill({ color: 0xffd766, alpha: 0.9 });
      } else { // 페이드 아웃 후 이동
        fx.g.rect(0, 0, w, h).fill({ color: 0xffd766, alpha: 1 });
        if (!fx.done) {
          fx.done = true;
          const dest = getMap(fx.node.id);
          const sp = dest ? dest.spawn : { x: 1, y: 1 };
          this.game.scenes.pop();                    // pop this scene → field top
          this.game.reloadFieldTo(fx.node.id, sp.x, sp.y);
        }
      }
      return;
    }
    if (input.pressed('up')) this.nav(0, -1);
    else if (input.pressed('down')) this.nav(0, 1);
    else if (input.pressed('left')) this.nav(-1, 0);
    else if (input.pressed('right')) this.nav(1, 0);
    else if (input.pressed('confirm')) {
      const n = worldNode(this.selId);
      if (n && this.canTravel(n)) this.travel(n);
      else this.game.audio?.play('menu_cancel');
    } else if (input.pressed('cancel') || input.pressed('map')) {
      this.game.audio?.play('menu_cancel');
      this.game.scenes.pop();
      if (this.game.field) this.game.field.busy = false;
    }
  }

  resize() { if (this.game.runtime) this.enter(); }
}

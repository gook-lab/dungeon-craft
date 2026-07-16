// Title scene — opaque. Save-slot picker: choose one of N slots, then 이어하기 /
// 새로 시작 / 삭제 for a filled slot (an empty slot starts a new game directly).
//
// 시네마틱 타이틀 (2026-07-15, ul/title.html 시안 이식): 코드 드로잉 파릴랙스 밤
// 배경(별 140·창백한 달·첨탑 실루엣 2층·전경 절벽) + 가벼운 비 + 부유 타이틀,
// 우측 세이브 슬롯 카드(파티 초상 칩·Lv/골드/맵/플레이타임·▶커서·6px 시프트),
// 선택 슬롯의 리더 스프라이트가 절벽 위에 선다. 색·크기는 전부 tokens.js 토큰.

import * as PIXI from 'pixi.js';
import { label, frame } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { heroUrl } from '../util/assets.js';
import { makeSprite, shadowTexture } from '../engine/renderer.js';
import { getMap } from '../content/maps/index.js';
import { createWeather } from '../ui/weather.js';

const HERO_KR = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };
const ACTIONS = [
  { id: 'continue', labelKr: '이어하기' },
  { id: 'new', labelKr: '새로 시작' },
  { id: 'delete', labelKr: '삭제', danger: true },
  { id: 'cancel', labelKr: '취소' },
];

function fmtPlaytime(sec) {
  const m = Math.floor((sec || 0) / 60);
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, '0')}`;
}

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.backdrop = new PIXI.Container(); // 정적 배경 (한 번만)
    this.heroLayer = new PIXI.Container(); // 절벽 위 리더 스프라이트
    this.layer = new PIXI.Container();     // 타이틀 + 슬롯 카드 (재렌더)
    this.container.addChild(this.backdrop, this.heroLayer, this.layer);
    this.mode = 'slots'; // 'slots' | 'action'
    this.index = 0;
    this.slot = 1;
    this.weather = null;
    this._t = 0;
    this._titleWrap = null;
  }

  enter() { this.mode = 'slots'; this.index = 0; this.buildBackdrop(); this.render(); }

  // ── 파릴랙스 픽셀 밤 배경 (시안 drawBg 1:1 이식) ──────────────────────────
  buildBackdrop() {
    this.backdrop.removeChildren();
    if (this.weather) { this.weather.destroy(); this.weather = null; }
    const { w: W, h: H } = this.game.renderer.screen;
    const g = new PIXI.Graphics();

    // 하늘 그라데이션 4-스톱 (#0a0b16 → 45% #141a36 → 72% #1d2547 → #0e1228)
    const stops = [[0, 0x0a0b16], [0.45, 0x141a36], [0.72, 0x1d2547], [1, 0x0e1228]];
    const lerpC = (a, b, t) => ((Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t) << 16)
      | (Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) << 8)
      | Math.round((a & 255) * (1 - t) + (b & 255) * t));
    const B = 28;
    for (let i = 0; i < B; i++) {
      const t = i / (B - 1);
      let c = stops[stops.length - 1][1];
      for (let s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s][0] && t <= stops[s + 1][0]) {
          c = lerpC(stops[s][1], stops[s + 1][1], (t - stops[s][0]) / (stops[s + 1][0] - stops[s][0])); break;
        }
      }
      g.rect(0, (H * i) / B, W, H / B + 1).fill({ color: c });
    }

    // 별 140개 — 고정 시드(1337) LCG, 상단 60%만, 백/보라.
    let seed = 1337; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 140; i++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H * 0.6), s = rnd() < 0.85 ? 1 : 2;
      const white = rnd() < 0.5;
      g.rect(x, y, s, s).fill({ color: white ? 0xf3edda : 0xb483f0, alpha: white ? 0.9 : 0.7 });
    }

    // 창백한 달 — 반달(본체 + 하늘색 커트) + 보라 glow.
    g.circle(W * 0.78, H * 0.2, 70).fill({ color: 0xb483f0, alpha: 0.12 });
    g.circle(W * 0.78, H * 0.2, 46).fill({ color: 0xcfc4e8 });
    g.circle(W * 0.80, H * 0.18, 42).fill({ color: 0x141a36 });

    // 원경 첨탑 실루엣 2층 (뾰족 지붕 포함).
    const spires = (baseY, col, count, hMax, jitter) => {
      for (let i = 0; i < count; i++) {
        const bw = W / count; const x = i * bw + (rnd() - 0.5) * jitter;
        const ph = hMax * (0.4 + rnd() * 0.6);
        g.rect(x, baseY - ph, bw * 0.8, ph + 40).fill({ color: col });
        g.poly([x, baseY - ph, x + bw * 0.4, baseY - ph - 28, x + bw * 0.8, baseY - ph]).fill({ color: col });
      }
    };
    spires(H * 0.72, 0x171d38, 7, 200, 30);
    spires(H * 0.80, 0x10142a, 9, 150, 40);

    // 안개 띠 (하단으로 갈수록 짙게).
    const FOGB = 8;
    for (let i = 0; i < FOGB; i++) {
      g.rect(0, H * 0.62 + (H * 0.24 * i) / FOGB, W, (H * 0.24) / FOGB + 1)
        .fill({ color: 0x3c466e, alpha: 0.22 * (i / (FOGB - 1)) });
    }

    // 전경 절벽 (영웅이 서는 지면) + 윗단 라인 + 픽셀 텍스처.
    g.rect(0, H * 0.82, W, H * 0.18).fill({ color: 0x0c1020 });
    g.rect(0, H * 0.82, W, 4).fill({ color: 0x161c30 });
    for (let i = 0; i < 80; i++) {
      const x = Math.floor(rnd() * W), y = H * 0.82 + Math.floor(rnd() * H * 0.16);
      g.rect(x, y, 2, 2).fill({ color: rnd() < 0.5 ? 0x101526 : 0x0a0e1c });
    }
    this.backdrop.addChild(g);

    // 은은한 비 — 상시, 가볍게.
    this.weather = createWeather({ width: W, height: H });
    this.weather.setKind('rain');
    this.weather.container.alpha = 0.3;
    this.backdrop.addChild(this.weather.container);
  }

  // 절벽 위 리더 스프라이트 — 슬롯 변경 시 교체, 빈 슬롯이면 숨김.
  updateHero() {
    this.heroLayer.removeChildren();
    const sum = this.summaries?.[this.mode === 'slots' ? this.index : this.slot - 1]?.summary;
    if (!sum) return;
    const { w: W, h: H } = this.game.renderer.screen;
    const hx = W * 0.2, hy = H * 0.83;
    const sh = new PIXI.Sprite(shadowTexture());
    sh.anchor.set(0.5); sh.width = 84; sh.height = 26; sh.x = hx; sh.y = hy - 2; sh.alpha = 0.8;
    const sp = makeSprite(heroUrl(sum.party[0], 'south'), { anchorX: 0.5, anchorY: 1 });
    sp.x = hx; sp.y = hy; sp.scale.set(3);
    this.heroLayer.addChild(sh, sp);
  }

  // 초상 칩 (40×44 인셋 프레임 + 하단 정렬 스프라이트) — ≤3 + "+N".
  portraitChips(party, x, y) {
    const shown = (party || []).slice(0, 3);
    shown.forEach((id, i) => {
      const bx = x + i * 44;
      const box = new PIXI.Graphics();
      box.rect(bx, y, 40, 44).fill({ color: 0x0a0b16, alpha: 0.6 })
        .stroke({ color: 0x05060f, width: 1 });
      this.layer.addChild(box);
      const sp = makeSprite(heroUrl(id, 'south'), { anchorX: 0.5, anchorY: 1 });
      sp.x = bx + 20; sp.y = y + 42; sp.scale.set(1.2);
      this.layer.addChild(sp);
    });
    if ((party || []).length > 3) {
      // +N — 세 번째 칩의 우상단 배지 (텍스트 열과 겹치지 않게).
      const more = label(`+${party.length - 3}`, FS.caption, HEX.goldDeep);
      more.anchor = { x: 1, y: 0 };
      more.x = x + 3 * 44 - 4; more.y = y - 2;
      this.layer.addChild(more);
    }
  }

  slotCard(slot, summary, y, selected, cardX, cardW, cardH) {
    const x = cardX - (selected ? 6 : 0); // 선택 시 6px 좌측 시프트
    const box = frame(cardW, cardH, { style: 'bevel' });
    box.x = x; box.y = y;
    if (!selected) box.alpha = 0.78;
    this.layer.addChild(box);
    if (selected) {
      const hl = new PIXI.Graphics();
      hl.roundRect(x - 2, y - 2, cardW + 4, cardH + 4, 4).stroke({ color: NUM.gold, width: 2, alpha: 0.95 });
      this.layer.addChild(hl);
      const cur = label('▶', FS.command, HEX.gold);
      cur.anchor = { x: 1, y: 0.5 }; cur.x = x - 8; cur.y = y + cardH / 2;
      this.layer.addChild(cur);
    }

    if (!summary) {
      // 빈 슬롯: ＋ 칩 + 안내 카피.
      const pb = new PIXI.Graphics();
      pb.rect(x + 16, y + cardH / 2 - 22, 40, 44).fill({ color: 0x0a0b16, alpha: 0.6 }).stroke({ color: 0x05060f, width: 1 });
      this.layer.addChild(pb);
      const plus = label('＋', FS.command, HEX.textOff);
      plus.anchor = { x: 0.5, y: 0.5 }; plus.x = x + 36; plus.y = y + cardH / 2;
      this.layer.addChild(plus);
      const t = label(`슬롯 ${slot} — 비어있음`, FS.label, HEX.textOff, { font: FONT.display });
      t.x = x + 72; t.y = y + 18; this.layer.addChild(t);
      const s2 = label('새로운 모험을 시작합니다', FS.caption, HEX.textMute);
      s2.x = x + 72; s2.y = y + 46; this.layer.addChild(s2);
      return;
    }

    this.portraitChips(summary.party, x + 14, y + cardH / 2 - 22);

    const lead = HERO_KR[summary.party[0]] || summary.party[0];
    const extra = summary.party.length > 1 ? ` 외 ${summary.party.length - 1}인` : '';
    const tx = x + 160;
    const t1 = label(`슬롯 ${slot} · ${lead}${extra}`, FS.label, selected ? HEX.gold : HEX.text, { font: FONT.display });
    t1.x = tx; t1.y = y + 10; this.layer.addChild(t1);
    const lv = label(`Lv.${summary.level}`, FS.caption, HEX.goldGlow, { font: FONT.ui });
    lv.x = tx; lv.y = y + 36; this.layer.addChild(lv);
    const gd = label(`◆ ${summary.gold.toLocaleString()}G`, FS.caption, HEX.gold, { font: FONT.ui });
    gd.x = tx + 80; gd.y = y + 36; this.layer.addChild(gd);
    const place = getMap(summary.mapId)?.name || summary.mapId;
    const p1 = label(place, FS.caption, HEX.textSoft, { font: FONT.ui });
    p1.x = tx; p1.y = y + 58; this.layer.addChild(p1);
    const pt = label(`⏱ ${fmtPlaytime(summary.playtime)}`, FS.caption, HEX.textMute, { font: FONT.ui });
    pt.anchor = { x: 1, y: 0 }; pt.x = x + cardW - 14; pt.y = y + 58; this.layer.addChild(pt);
  }

  // kbd 칩 힌트 (↑ ↓ Z X 를 작은 프레임 칩으로).
  renderHint(parts) {
    const { w: W, h: H } = this.game.renderer.screen;
    const row = new PIXI.Container();
    let xx = 0;
    for (const p of parts) {
      if (p.kbd) {
        const t = label(p.kbd, FS.caption, HEX.text);
        const bg = new PIXI.Graphics();
        bg.roundRect(xx, -3, t.width + 12, FS.caption + 8, 3)
          .fill({ color: 0x12152e, alpha: 0.9 }).stroke({ color: 0x3a4170, width: 1 });
        t.x = xx + 6; t.y = 0;
        row.addChild(bg, t); xx += t.width + 18;
      } else {
        const t = label(p.text, FS.caption, HEX.textMute);
        t.x = xx; t.y = 0; row.addChild(t); xx += t.width + 8;
      }
    }
    row.x = W / 2 - xx / 2; row.y = H - 36;
    this.layer.addChild(row);
  }

  render() {
    this.layer.removeChildren();
    const { w: W, h: H } = this.game.renderer.screen;

    // ── 타이틀 (부유 트윈은 update가 _titleWrap.y를 흔든다) ──
    const wrap = new PIXI.Container();
    const t = label('드래곤 크립트', FS.display, HEX.gold, { font: FONT.display });
    t.anchor = { x: 0.5, y: 0.5 };
    t.scale.set(2.2); // display(30) × 2.2 ≈ 66px — 시안의 대형 타이틀 상당
    t.style.stroke = { color: 0x05060f, width: 3 };
    // 뒤에 골드 glow 카피 한 장.
    const glow = label('드래곤 크립트', FS.display, HEX.goldGlow, { font: FONT.display });
    glow.anchor = { x: 0.5, y: 0.5 }; glow.scale.set(2.26); glow.alpha = 0.22;
    wrap.addChild(glow, t);
    wrap.x = W / 2; wrap.y = H * 0.14;
    this.layer.addChild(wrap);
    this._titleWrap = wrap; this._titleBaseY = wrap.y;
    // 룰 라인 (골드딥 그라데이션 흉내 — 3분할 알파).
    const rule = new PIXI.Graphics();
    for (let i = 0; i < 3; i++) {
      const seg = 280 / 3;
      rule.rect(W / 2 - 140 + i * seg, H * 0.14 + 46, seg, 2).fill({ color: NUM.goldDeep, alpha: i === 1 ? 0.9 : 0.35 });
    }
    this.layer.addChild(rule);
    const sub = label('베어 끝낼 것인가, 길 잃은 영혼을 구할 것인가', FS.label, HEX.textSoft);
    sub.anchor = { x: 0.5, y: 0 }; sub.x = W / 2; sub.y = H * 0.14 + 58; this.layer.addChild(sub);

    this.summaries = this.game.slotSummaries(); // [{slot, summary}]

    // ── 슬롯 패널 (우측 7%, 폭 560, 상단 42%) ──
    const cardW = Math.min(560, W * 0.46), cardH = 88, gap = 12;
    const cardX = W - W * 0.07 - cardW;
    let sy = H * 0.40;
    const head = label('SAVE DATA · 모험을 선택하라', FS.caption, HEX.goldDeep);
    head.x = cardX; head.y = sy - 34; this.layer.addChild(head);
    this.summaries.forEach(({ slot, summary }, i) => {
      const selected = this.mode === 'slots' ? i === this.index : slot === this.slot;
      this.slotCard(slot, summary, sy + i * (cardH + gap), selected, cardX, cardW, cardH);
    });

    // ── 액션 모달 (채운 슬롯 Z → 이어하기/새로 시작/삭제/취소) ──
    if (this.mode === 'action') {
      const dim = new PIXI.Graphics(); dim.rect(0, 0, W, H).fill({ color: 0x05060f, alpha: 0.45 });
      this.layer.addChild(dim);
      const bw = 300, bh = 64 + ACTIONS.length * 36;
      const bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
      const box = frame(bw, bh, { style: 'bevel' }); box.x = bx; box.y = by; this.layer.addChild(box);
      const sum = this.summaries[this.slot - 1]?.summary;
      const lead = sum ? (HERO_KR[sum.party[0]] || sum.party[0]) : '';
      const extra = sum && sum.party.length > 1 ? ` 외 ${sum.party.length - 1}인` : '';
      const at = label(`슬롯 ${this.slot} · ${lead}${extra}`, FS.stat, HEX.gold, { font: FONT.display });
      at.anchor = { x: 0.5, y: 0 }; at.x = W / 2; at.y = by + 14; this.layer.addChild(at);
      ACTIONS.forEach((a, i) => {
        const sel = i === this.index;
        const col = a.danger ? HEX.hpLow : (sel ? HEX.gold : HEX.text);
        const row = label(a.labelKr, FS.command, sel && !a.danger ? HEX.gold : col, { font: FONT.ui });
        row.x = bx + 56; row.y = by + 48 + i * 36; this.layer.addChild(row);
        if (sel) {
          const cur = label('▶', FS.label, HEX.gold);
          cur.x = bx + 28; cur.y = by + 50 + i * 36; this.layer.addChild(cur);
        }
      });
      this.renderHint([{ kbd: '↑' }, { kbd: '↓' }, { text: '선택 ·' }, { kbd: 'Z' }, { text: '확인 ·' }, { kbd: 'X' }, { text: '뒤로' }]);
    } else {
      this.renderHint([{ kbd: '↑' }, { kbd: '↓' }, { text: '슬롯 선택 ·' }, { kbd: 'Z' }, { text: '확인 ·' }, { kbd: 'X' }, { text: '설정' }]);
    }

    this.options = this.mode === 'slots' ? this.summaries.map(({ slot }) => `슬롯 ${slot}`) : ACTIONS.map((a) => a.labelKr);
    this.updateHero();
  }

  update(dt) {
    this.weather?.update(dt);
    // 타이틀 부유 — 5초 주기 ±6px.
    this._t += dt;
    if (this._titleWrap) this._titleWrap.y = this._titleBaseY - 6 * Math.sin((this._t / 5) * Math.PI * 2);

    const input = this.game.input;
    const n = this.options.length;
    if (input.pressed('up')) { this.index = (this.index + n - 1) % n; this.render(); }
    if (input.pressed('down')) { this.index = (this.index + 1) % n; this.render(); }
    if (input.pressed('cancel')) {
      if (this.mode === 'action') { this.mode = 'slots'; this.index = this.slot - 1; this.render(); return; }
      this.game.openSettings(); return; // 슬롯 화면에서 X/Esc → 설정
    }
    if (!input.pressed('confirm')) return;

    if (this.mode === 'slots') {
      this.slot = this.index + 1;
      const sum = this.summaries[this.index].summary;
      if (!sum) { this.game.startGame(true, this.slot); return; } // empty → new game
      this.mode = 'action'; this.index = 0; this.render(); // filled → action modal
      return;
    }
    // action mode
    const choice = ACTIONS[this.index].id;
    if (choice === 'continue') this.game.startGame(false, this.slot);
    else if (choice === 'new') this.game.startGame(true, this.slot);
    else if (choice === 'delete') { this.game.deleteSlot(this.slot); this.mode = 'slots'; this.index = this.slot - 1; this.render(); }
    else { this.mode = 'slots'; this.index = this.slot - 1; this.render(); } // 취소
  }
}

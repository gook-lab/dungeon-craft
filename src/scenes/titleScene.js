// Title scene — opaque. Save-slot picker: choose one of N slots, then 이어하기 /
// 새로 시작 / 삭제 for a filled slot (an empty slot starts a new game directly).
//
// 시네마틱 타이틀 (2026-07-15, ul/title.html 시안 이식): 코드 드로잉 파릴랙스 밤
// 배경(별 140·창백한 달·첨탑 실루엣 2층·전경 절벽) + 가벼운 비 + 부유 타이틀,
// 우측 세이브 슬롯 카드(파티 초상 칩·Lv/골드/맵/플레이타임·▶커서·6px 시프트),
// 선택 슬롯의 리더 스프라이트가 절벽 위에 선다. 색·크기는 전부 tokens.js 토큰.
//
// 키 아트 타이틀 (2026-11-27): public/key-art.webp(Codex 생성, 원본 docs/art/key-art.png —
// 기사가 칼끝을 내리고 무릎 꿇은 고블린에게 손을 내미는 자비 장면)가 있으면 그걸 꽉 차게
// 깔고 글자 뒤에 어두운 막을 얹는다. 못 받으면 위의 코드 드로잉 밤 배경으로 돌아간다.
// 배치는 화면 비율별 세 가지(넓은 가로 · 낮은 가로 · 세로)로 나눠 어느 크기에서도 넘치지
// 않게 하고, 축소 모션이면 새 연출(아트 천천히 다가가기)과 부유 · 비를 끈다.

import * as PIXI from 'pixi.js';
import { label, frame } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { heroUrl } from '../util/assets.js';
import { makeSprite, shadowTexture } from '../engine/renderer.js';
import { getMap } from '../content/maps/index.js';
import { createWeather } from '../ui/weather.js';

const KEY_ART_URL = '/key-art.webp';
// 키 아트의 초점(기사의 내민 손 ↔ 고블린) — 잘라 낼 때 이 점이 화면 안에 남게 한다.
const ART_FOCUS = { x: 0.47, y: 0.58 };
const CARD_W = 460, CARD_H = 88, CARD_GAP = 12, PANEL_HEAD = 34;
// 패널 자연 크기: 선택 커서 ▶(선택 시프트 포함 왼쪽 ~44px) + 카드 폭, 머리말 + 카드 3장.
const PANEL_PAD_L = 46;

let keyArtPromise = null;
let keyArtTex = null;

// Bake the key art at its on-screen size with the 2D canvas' high-quality
// resampler. The GPU samples bilinear without mipmaps, so shrinking the 1536px
// art to a phone screen (~0.55×) would alias its pixel edges; a 1:1 texture doesn't.
function bakeArtTexture(tex, w, h) {
  const img = tex.source.resource;
  if (typeof document === 'undefined' || !img || w >= tex.width) return tex;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w); cv.height = Math.ceil(h);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv, scaleMode: 'linear' }) });
}

// Title key art — loaded once (main.js starts it during boot so the first title
// frame already has it). Linear sampling: it's a downscaled painting, not a sprite.
export function preloadKeyArt() {
  if (keyArtPromise) return keyArtPromise;
  keyArtPromise = new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      keyArtTex = new PIXI.Texture({ source: new PIXI.ImageSource({ resource: img, scaleMode: 'linear' }) });
      resolve(keyArtTex);
    };
    img.onerror = () => resolve(null);
    img.src = KEY_ART_URL;
  });
  return keyArtPromise;
}

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Vertical/horizontal alpha ramp drawn as bands (same technique as the sky).
// Band edges sit on whole pixels with NO overlap — overlapping translucent bands
// stack into a visible grid of darker lines.
function ramp(g, x, y, w, h, vertical, a0, a1, color = 0x05060f, n = 32) {
  const len = vertical ? h : w;
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / (n - 1));
    const p0 = Math.round((len * i) / n), p1 = Math.round((len * (i + 1)) / n);
    if (a <= 0.003 || p1 <= p0) continue;
    if (vertical) g.rect(Math.round(x), Math.round(y) + p0, Math.round(w), p1 - p0).fill({ color, alpha: a });
    else g.rect(Math.round(x) + p0, Math.round(y), p1 - p0, Math.round(h)).fill({ color, alpha: a });
  }
}

// Screen layout per aspect: 'wide' (title top, slots right), 'short' (landscape
// phone — title left column, slots right column), 'tall' (portrait — title top,
// slots bottom). Panel scale shrinks to fit; never grows past 1.
function computeLayout(W, H) {
  const natW = CARD_W + PANEL_PAD_L;
  const natH = PANEL_HEAD + 3 * CARD_H + 2 * CARD_GAP + 4;
  if (H > W * 1.1) {
    const s = Math.min(1, (W - 32) / natW, (H * 0.5) / natH);
    return {
      mode: 'tall', s,
      panelX: W / 2 - ((CARD_W - PANEL_PAD_L) / 2) * s, panelY: H - 60 - natH * s,
      titleX: W / 2, titleY: Math.max(56, H * 0.1), titleMaxW: W - 32,
      artFocus: { x: W * 0.5, y: H * 0.42 },
    };
  }
  if (H < 560) {
    // 낮은 가로 화면은 그림이 패널에 거의 가려지므로 패널을 조금 더 줄인다.
    const s = Math.min(0.86, (H - 16 - 56) / natH, (W * 0.58) / natW);
    const panelX = W - 16 - CARD_W * s;
    const colR = panelX - PANEL_PAD_L * s - 16;
    return {
      mode: 'short', s,
      panelX, panelY: Math.max(12, (H - 56 - natH * s) / 2 + 4),
      titleX: (16 + colR) / 2, titleY: H * 0.26, titleMaxW: colR - 40,
      artFocus: { x: colR * 0.62, y: H * 0.6 },
    };
  }
  const s = Math.min(1, (W * 0.5) / natW, (H - H * 0.4 - 56) / natH);
  return {
    mode: 'wide', s,
    panelX: W - W * 0.04 - CARD_W * s, panelY: H * 0.4,
    titleX: W / 2, titleY: H * 0.14, titleMaxW: W - 48,
    artFocus: { x: W * 0.44, y: H * 0.56 },
  };
}

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
    this.art = null;       // 키 아트 스프라이트 (없으면 코드 드로잉 배경)
    this.panel = null;     // 슬롯 카드 묶음 — 화면에 맞게 통째로 줄인다
    this._still = false;   // prefers-reduced-motion
  }

  enter() {
    this._still = prefersReducedMotion();
    this.mode = 'slots'; this.index = 0; this.buildBackdrop(); this.render();
  }

  // 화면 크기로 구운 키 아트 텍스처는 씬마다 새로 만들므로 나갈 때 GPU 에서 내린다
  // (컨테이너 destroy 가 끝난 뒤 — 스프라이트가 먼저 떨어지게 한 박자 늦춘다).
  exit() {
    const baked = this._bakedArt;
    this._bakedArt = null;
    if (baked) queueMicrotask(() => baked.destroy(true));
  }

  // ── 키 아트 배경: 꽉 차게(cover) 깔고 초점을 배치별 자리에 둔다 + 글자 뒤 어두운 막 ──
  buildArtBackdrop(tex, W, H, L) {
    const cover = Math.max(W / tex.width, H / tex.height);
    const w = tex.width * cover, h = tex.height * cover;
    if (this._bakedArt && this._bakedArt !== tex) this._bakedArt.destroy(true);
    const baked = bakeArtTexture(tex, w, h);
    this._bakedArt = baked === tex ? null : baked;
    const art = new PIXI.Sprite(baked);
    const base = w / baked.width;
    art.anchor.set(ART_FOCUS.x, ART_FOCUS.y);
    art.scale.set(base);
    // 초점을 목표 자리에 두되, 그림 가장자리가 화면 안으로 들어오지 않게 자른다.
    art.x = Math.min(ART_FOCUS.x * w, Math.max(W - (1 - ART_FOCUS.x) * w, L.artFocus.x));
    art.y = Math.min(ART_FOCUS.y * h, Math.max(H - (1 - ART_FOCUS.y) * h, L.artFocus.y));
    this.art = art; this._artBase = base;
    this.backdrop.addChild(art);

    const g = new PIXI.Graphics();
    g.rect(0, 0, W, H).fill({ color: 0x05060f, alpha: 0.12 }); // 전체 살짝
    if (L.mode === 'short') {
      ramp(g, 0, 0, W * 0.55, H, false, 0.55, 0);                         // 왼쪽 타이틀 칸
      ramp(g, L.panelX - 120, 0, W - L.panelX + 120, H, false, 0, 0.6);   // 오른쪽 슬롯 칸
    } else {
      ramp(g, 0, 0, W, H * 0.38, true, 0.72, 0);                          // 위 타이틀
      if (L.mode === 'wide') ramp(g, W * 0.5, 0, W * 0.5, H, false, 0, 0.55); // 오른쪽 슬롯
      else ramp(g, 0, L.panelY - 120, W, H - L.panelY + 120, true, 0, 0.72); // 아래 슬롯
    }
    ramp(g, 0, H * 0.8, W, H * 0.2, true, 0, 0.6);                        // 아래 힌트
    this.backdrop.addChild(g);
  }

  // ── 파릴랙스 픽셀 밤 배경 (시안 drawBg 1:1 이식) ──────────────────────────
  buildBackdrop() {
    this.backdrop.removeChildren();
    if (this.weather) { this.weather.destroy(); this.weather = null; }
    const { w: W, h: H } = this.game.renderer.screen;
    this._L = computeLayout(W, H); this._lw = W; this._lh = H;
    this.art = null;
    if (keyArtTex) {
      this.buildArtBackdrop(keyArtTex, W, H, this._L);
      this.addRain(W, H, 0.22);
      return;
    }
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
    this.addRain(W, H, 0.3);
  }

  // 은은한 비 — 상시, 가볍게. 축소 모션이면 끈다.
  addRain(W, H, alpha) {
    if (this._still) return;
    this.weather = createWeather({ width: W, height: H });
    this.weather.setKind('rain');
    this.weather.container.alpha = alpha;
    this.backdrop.addChild(this.weather.container);
  }

  // 절벽 위 리더 스프라이트 — 슬롯 변경 시 교체, 빈 슬롯이면 숨김.
  updateHero() {
    this.heroLayer.removeChildren();
    if (this.art) return; // 키 아트에 파티가 이미 그려져 있다 — 절벽 리더는 대체 배경에서만
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
      this.panel.addChild(box);
      const sp = makeSprite(heroUrl(id, 'south'), { anchorX: 0.5, anchorY: 1 });
      sp.x = bx + 20; sp.y = y + 42; sp.scale.set(1.2);
      this.panel.addChild(sp);
    });
    if ((party || []).length > 3) {
      // +N — 세 번째 칩의 우상단 배지 (텍스트 열과 겹치지 않게).
      const more = label(`+${party.length - 3}`, FS.caption, HEX.goldDeep);
      more.anchor = { x: 1, y: 0 };
      more.x = x + 3 * 44 - 4; more.y = y - 2;
      this.panel.addChild(more);
    }
  }

  slotCard(slot, summary, y, selected, cardX, cardW, cardH) {
    const x = cardX - (selected ? 6 : 0); // 선택 시 6px 좌측 시프트
    const box = frame(cardW, cardH, { style: 'bevel' });
    box.x = x; box.y = y;
    if (!selected) box.alpha = 0.78;
    this.panel.addChild(box);
    if (selected) {
      const hl = new PIXI.Graphics();
      hl.roundRect(x - 2, y - 2, cardW + 4, cardH + 4, 4).stroke({ color: NUM.gold, width: 2, alpha: 0.95 });
      this.panel.addChild(hl);
      const cur = label('▶', FS.command, HEX.gold);
      cur.anchor = { x: 1, y: 0.5 }; cur.x = x - 8; cur.y = y + cardH / 2;
      this.panel.addChild(cur);
    }

    if (!summary) {
      // 빈 슬롯: ＋ 칩 + 안내 카피.
      const pb = new PIXI.Graphics();
      pb.rect(x + 16, y + cardH / 2 - 22, 40, 44).fill({ color: 0x0a0b16, alpha: 0.6 }).stroke({ color: 0x05060f, width: 1 });
      this.panel.addChild(pb);
      const plus = label('＋', FS.command, HEX.textOff);
      plus.anchor = { x: 0.5, y: 0.5 }; plus.x = x + 36; plus.y = y + cardH / 2;
      this.panel.addChild(plus);
      const t = label(`슬롯 ${slot} — 비어있음`, FS.label, HEX.textOff, { font: FONT.display });
      t.x = x + 72; t.y = y + 18; this.panel.addChild(t);
      const s2 = label('새로운 모험을 시작합니다', FS.caption, HEX.textMute);
      s2.x = x + 72; s2.y = y + 46; this.panel.addChild(s2);
      return;
    }

    this.portraitChips(summary.party, x + 14, y + cardH / 2 - 22);

    const lead = HERO_KR[summary.party[0]] || summary.party[0];
    const extra = summary.party.length > 1 ? ` 외 ${summary.party.length - 1}인` : '';
    const tx = x + 160;
    const t1 = label(`슬롯 ${slot} · ${lead}${extra}`, FS.label, selected ? HEX.gold : HEX.text, { font: FONT.display });
    t1.x = tx; t1.y = y + 10; this.panel.addChild(t1);
    const lv = label(`Lv.${summary.level}`, FS.caption, HEX.goldGlow, { font: FONT.ui });
    lv.x = tx; lv.y = y + 36; this.panel.addChild(lv);
    const gd = label(`◆ ${summary.gold.toLocaleString()}G`, FS.caption, HEX.gold, { font: FONT.ui });
    gd.x = tx + 80; gd.y = y + 36; this.panel.addChild(gd);
    const place = getMap(summary.mapId)?.name || summary.mapId;
    const p1 = label(place, FS.caption, HEX.textSoft, { font: FONT.ui });
    p1.x = tx; p1.y = y + 58; this.panel.addChild(p1);
    const pt = label(`⏱ ${fmtPlaytime(summary.playtime)}`, FS.caption, HEX.textMute, { font: FONT.ui });
    pt.anchor = { x: 1, y: 0 }; pt.x = x + cardW - 14; pt.y = y + 58; this.panel.addChild(pt);
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
    const k = Math.min(1, (W - 24) / xx);
    row.scale.set(k);
    row.x = W / 2 - (xx * k) / 2; row.y = H - 36;
    this.layer.addChild(row);
  }

  render() {
    this.layer.removeChildren();
    const { w: W, h: H } = this.game.renderer.screen;
    const L = this._L || computeLayout(W, H);

    // ── 타이틀 (부유 트윈은 update가 _titleWrap.y를 흔든다) ──
    const wrap = new PIXI.Container();
    const t = label('드래곤 크립트', FS.display, HEX.gold, { font: FONT.display });
    t.anchor = { x: 0.5, y: 0.5 };
    t.scale.set(2.2); // display(30) × 2.2 ≈ 66px — 시안의 대형 타이틀 상당
    t.style.stroke = { color: 0x05060f, width: 3 };
    // 좁은 화면에선 칸 폭에 맞춰 줄인다 (k = 2.2 대비 비율).
    const k = Math.min(1, L.titleMaxW / t.width);
    t.scale.set(2.2 * k);
    // 뒤에 골드 glow 카피 한 장.
    const glow = label('드래곤 크립트', FS.display, HEX.goldGlow, { font: FONT.display });
    glow.anchor = { x: 0.5, y: 0.5 }; glow.scale.set(2.26 * k); glow.alpha = 0.22;
    wrap.addChild(glow, t);
    wrap.x = L.titleX; wrap.y = L.titleY;
    this.layer.addChild(wrap);
    this._titleWrap = wrap; this._titleBaseY = wrap.y;
    // 룰 라인 (골드딥 그라데이션 흉내 — 3분할 알파).
    const rule = new PIXI.Graphics();
    const ruleW = 280 * Math.max(k, 0.6), ruleY = L.titleY + 46 * k;
    for (let i = 0; i < 3; i++) {
      const seg = ruleW / 3;
      rule.rect(L.titleX - ruleW / 2 + i * seg, ruleY, seg, 2).fill({ color: NUM.goldDeep, alpha: i === 1 ? 0.9 : 0.35 });
    }
    this.layer.addChild(rule);
    const sub = label('베어 끝낼 것인가, 길 잃은 영혼을 구할 것인가', FS.label, HEX.textSoft, { align: 'center' });
    if (sub.width > L.titleMaxW) sub.text = '베어 끝낼 것인가,\n길 잃은 영혼을 구할 것인가';
    if (sub.width > L.titleMaxW) sub.scale.set(L.titleMaxW / sub.width);
    sub.anchor = { x: 0.5, y: 0 }; sub.x = L.titleX; sub.y = ruleY + 12; this.layer.addChild(sub);

    this.summaries = this.game.slotSummaries(); // [{slot, summary}]

    // ── 슬롯 패널 — 배치(computeLayout)가 정한 자리 · 배율로 통째로 놓는다 ──
    const panel = new PIXI.Container();
    this.panel = panel;
    panel.x = L.panelX; panel.y = L.panelY; panel.scale.set(L.s);
    this.layer.addChild(panel);
    const head = label('SAVE DATA · 모험을 선택하라', FS.caption, HEX.goldDeep);
    head.x = 0; head.y = 0; panel.addChild(head);
    this.summaries.forEach(({ slot, summary }, i) => {
      const selected = this.mode === 'slots' ? i === this.index : slot === this.slot;
      this.slotCard(slot, summary, PANEL_HEAD + i * (CARD_H + CARD_GAP), selected, 0, CARD_W, CARD_H);
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
    // 창 크기 변경 — Pixi 의 resizeTo 는 다음 프레임에 캔버스를 바꾸므로, window resize
    // 이벤트 시점의 크기 대신 실제 캔버스 크기가 달라졌을 때 다시 배치한다.
    const { w: SW, h: SH } = this.game.renderer.screen;
    if (SW !== this._lw || SH !== this._lh) { this.buildBackdrop(); this.render(); }
    this.weather?.update(dt);
    this._t += dt;
    if (!this._still) {
      // 타이틀 부유 — 5초 주기 ±6px.
      if (this._titleWrap) this._titleWrap.y = this._titleBaseY - 6 * Math.sin((this._t / 5) * Math.PI * 2);
      // 키 아트가 28초 주기로 초점 쪽으로 3.5% 천천히 다가갔다 물러난다(초점 기준이라 가장자리는 안 비친다).
      if (this.art) this.art.scale.set(this._artBase * (1 + 0.0175 * (1 - Math.cos((this._t / 28) * Math.PI * 2))));
    }

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

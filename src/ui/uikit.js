// Shared PIXI UI helpers — DQ-style windows, labels and bars, restyled to the
// UI-리터치 design board (share/css). Tokens live in tokens.js so colour/type
// never drift. Backward-compatible API (windowBox / menuList / label / textStyle)
// so existing scenes upgrade automatically; new primitives (frame / hpbar /
// divider) power the equip board and future polish.

import * as PIXI from 'pixi.js';
import { HEX, NUM, FS, FONT } from './tokens.js';
import { getSettings } from '../data/settings.js';

// 색맹 모드 여부 (설정) — HP 바 구간 해칭 등에서 참조. 설정 미로드/헤드리스여도 안전.
function colorblindOn() { try { return !!getSettings().colorblind; } catch { return false; } }

// --- Text ---------------------------------------------------------------
export function textStyle(size = FS.label, fill = HEX.text, opts = {}) {
  return new PIXI.TextStyle({
    fontFamily: opts.font || FONT.ui,
    fontSize: size,
    fill,
    stroke: { color: HEX.black, width: opts.stroke ?? 4 },
    lineHeight: size + 6,
    ...(opts.align ? { align: opts.align } : {}),
    ...(opts.wordWrap ? { wordWrap: true, wordWrapWidth: opts.wordWrapWidth || 300 } : {}),
  });
}

export function label(str, size = FS.label, fill = HEX.text, opts = {}) {
  return new PIXI.Text({ text: str, style: textStyle(size, fill, opts) });
}

// Number/stat text in the monospace Galmuri face.
export function numLabel(str, size = FS.stat, fill = HEX.text) {
  return label(str, size, fill, { font: FONT.mono });
}

// --- Frames -------------------------------------------------------------
// Three frame recipes from the design board. `bevel` (SNES pixel relief) is the
// default for menus/command; `classic` (rounded parchment double border) suits
// dialog/messages; `gilded` (dark slab + gold hairline + corner ticks) marks
// special moments. Returns a PIXI.Graphics sized w×h at origin (0,0).
export function frame(w, h, style = 'bevel') {
  const g = new PIXI.Graphics();
  if (style === 'classic') {
    g.roundRect(0, 0, w, h, 7).fill({ color: NUM.ink800, alpha: 0.94 });
    g.roundRect(2.5, 2.5, w - 5, h - 5, 6).stroke({ color: NUM.frame, width: 3 });
    g.roundRect(5, 5, w - 10, h - 10, 5).stroke({ color: NUM.ink800, width: 2 });
  } else if (style === 'gilded') {
    g.rect(0, 0, w, h).fill({ color: NUM.ink900, alpha: 0.96 });
    g.rect(0, 0, w, h).stroke({ color: NUM.goldDeep, width: 2 });
    g.rect(2, 2, w - 4, h - 4).stroke({ color: NUM.gold, width: 1, alpha: 0.25 });
    // corner ticks (top-left, bottom-right)
    const t = 10;
    g.moveTo(5, 5 + t).lineTo(5, 5).lineTo(5 + t, 5).stroke({ color: NUM.gold, width: 2 });
    g.moveTo(w - 5, h - 5 - t).lineTo(w - 5, h - 5).lineTo(w - 5 - t, h - 5).stroke({ color: NUM.gold, width: 2 });
  } else { // bevel
    g.rect(0, 0, w, h).fill({ color: NUM.ink800 });
    // outer 4-sided bevel: light top/left, dark bottom/right
    g.moveTo(0, h).lineTo(0, 0).lineTo(w, 0).stroke({ color: NUM.bevelLight, width: 4, alignment: 0 });
    g.moveTo(w, 0).lineTo(w, h).lineTo(0, h).stroke({ color: NUM.bevelDark, width: 4, alignment: 0 });
    // inner parchment + shadow keylines
    g.rect(4, 4, w - 8, h - 8).stroke({ color: NUM.frame, width: 2, alignment: 0 });
    g.rect(6, 6, w - 12, h - 12).stroke({ color: NUM.frameShadow, width: 2, alignment: 0 });
  }
  return g;
}

// DQ-style window — kept for back-compat. Now a rounded parchment "classic"
// frame (the natural evolution of the old black+white double border).
export function windowBox(w, h, style = 'classic') {
  return frame(w, h, style);
}

// A thin horizontal divider line (column/section separators on the board).
export function divider(w, color = NUM.frameShadow) {
  const g = new PIXI.Graphics();
  g.rect(0, 0, w, 1).fill({ color });
  return g;
}

// --- HP / MP / XP bar ---------------------------------------------------
// Pixel-tick vital bar matching .hpbar in ui.css: dark track, coloured fill,
// 1px frame, faint vertical tick overlay. Returns a Container; call its
// setFrac(f) to animate-free update the width.
export function bar(frac, { w = 110, h = 13, color = NUM.hpHigh, tick = 9, hp = false } = {}) {
  const c = new PIXI.Container();
  const track = new PIXI.Graphics();
  track.rect(0, 0, w, h).fill({ color: NUM.black, alpha: 0.7 });
  track.rect(0, 0, w, h).stroke({ color: NUM.frame, width: 1.5, alignment: 0 });
  const fill = new PIXI.Graphics();
  const pat = new PIXI.Graphics();   // 색맹 패턴(HP 구간별 사선 해칭) — 명도/무늬로도 구분
  const ticks = new PIXI.Graphics();
  for (let x = tick; x < w; x += tick + 1) ticks.rect(x, 0, 1, h).fill({ color: NUM.black, alpha: 0.28 });
  c.addChild(track, fill, pat, ticks);
  c.setFrac = (f, col) => {
    const ff = Math.max(0, Math.min(1, f));
    fill.clear(); pat.clear();
    if (ff <= 0) return;
    // hp 모드: 색을 fraction에서 자동 도출(호출자의 col 무시) + 색맹이면 구간 해칭.
    let fillCol = col != null ? col : color;
    let zone = 0; // 0 high · 1 mid · 2 low
    if (hp) {
      zone = ff > 0.5 ? 0 : ff > 0.25 ? 1 : 2;
      fillCol = zone === 0 ? NUM.hpHigh : zone === 1 ? NUM.hpMid : NUM.hpLow;
    }
    const fw = (w - 2) * ff;
    fill.rect(1, 1, fw, h - 2).fill({ color: fillCol });
    if (hp && zone > 0 && colorblindOn()) {
      // 중간=성긴 45° 사선 / 위험=촘촘한 사선 (밝은 오버레이). 채워진 폭 안에만
      // 온전히 들어가는 세그먼트만 그린다(오버플로 없음).
      const step = zone === 1 ? 7 : 4, dh = h - 3;
      for (let x = 2; x + dh <= fw; x += step) pat.moveTo(1 + x, h - 2).lineTo(1 + x + dh, 1);
      pat.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
      // 위험 구간엔 좌측 경고 노치(수직 굵은 선) — 극저 HP를 무늬로도 각인.
      if (zone === 2) pat.rect(1, 1, 2, h - 2).fill({ color: 0xffffff, alpha: 0.85 });
    }
  };
  c.setFrac(frac, hp ? undefined : color);
  c.barWidth = w; c.barHeight = h;
  return c;
}

// Convenience: an HP bar whose colour follows the high/mid/low thresholds.
// hp:true → setFrac 재호출마다 색을 자동 도출 + 색맹 모드면 구간 해칭.
export function hpbar(frac, opts = {}) {
  return bar(frac, { ...opts, hp: true });
}

// --- Menu list ----------------------------------------------------------
// Vertical selectable list. Restyled: gold cursor ▶, selected row gold + 1.12×
// scale + soft glow. Same return shape as before so callers are unchanged.
// `options` may be strings or { label, meta?, disabled?, reason? } objects.
export function menuList(options, { width = 240, itemH = 30, pad = 14, size = FS.command, frameStyle = 'bevel', maxWidth = 0 } = {}) {
  const container = new PIXI.Container();
  const h = pad * 2 + options.length * itemH;

  // Build the row labels first so the frame can be sized to the widest content.
  // The box only ever GROWS past the requested `width` — never shrinks — so short
  // menus (title/shop) are unchanged while long rows (bond legend, equipment
  // strings) stop clipping at the right edge. 28 = cursor indent, 14 = right pad,
  // ×1.12 accounts for the selected-row scale-up.
  const built = options.map((opt, i) => {
    const o = typeof opt === 'string' ? { label: opt } : opt;
    const fill = o.disabled ? HEX.textOff : HEX.text;
    const t = label(o.label, size, fill);
    t.x = 28; t.y = pad + i * itemH;
    const metaT = o.meta ? numLabel(o.meta, FS.stat, HEX.textSoft) : null;
    if (metaT) { metaT.anchor.set(1, 0); metaT.y = pad + i * itemH + 3; }
    const reasonT = o.reason ? label(o.reason, FS.caption, HEX.textOff) : null;
    if (reasonT) reasonT.y = pad + i * itemH + 2;
    return { o, t, metaT, reasonT };
  });
  let need = width;
  for (const r of built) {
    let rowW = 28 + r.t.width * 1.12 + 14;
    if (r.metaT) rowW += r.metaT.width + 12;
    if (r.reasonT) rowW += r.reasonT.width + 8;
    if (rowW > need) need = Math.ceil(rowW);
  }
  if (maxWidth) need = Math.min(need, maxWidth);
  width = need;

  const box = frame(width, h, frameStyle);
  container.addChild(box);

  const cursor = label('▶', size, HEX.gold);
  cursor.x = 8;
  container.addChild(cursor);

  const rows = built.map((r) => {
    container.addChild(r.t);
    if (r.metaT) { r.metaT.x = width - 14; container.addChild(r.metaT); }
    if (r.reasonT) { r.reasonT.x = 28 + r.t.width + 8; container.addChild(r.reasonT); }
    return { t: r.t, o: r.o, metaT: r.metaT };
  });

  let cur = 0;
  function setIndex(i) {
    cur = i;
    cursor.y = pad + i * itemH;
    rows.forEach((row, j) => {
      const selected = j === i && !row.o.disabled;
      row.t.style.fill = row.o.disabled ? HEX.textOff : selected ? HEX.gold : HEX.text;
      row.t.scale.set(selected ? 1.12 : 1);
      if (row.metaT) row.metaT.style.fill = selected ? HEX.goldGlow : HEX.textSoft;
    });
  }
  setIndex(0);
  return { container, setIndex, get index() { return cur; }, texts: rows.map((r) => r.t), height: h, width };
}

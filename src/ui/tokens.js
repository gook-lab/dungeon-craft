// Design tokens — ported from share/css/tokens.css (UI 리터치 보드 v1).
// Single source of truth for colour, typography and frame recipes so every
// scene reads the same palette. HEX strings feed PIXI.Text fills; NUM (0x…)
// feed PIXI.Graphics fills/strokes. Pure data — no Pixi import.

// --- Colour: hex strings (for Text fill, CSS) ---
export const HEX = {
  ink900: '#0a0b16', ink800: '#12152e', ink700: '#1b2046', ink600: '#2a3160',
  frame: '#f3edda', frameDim: '#b9b48f', frameShadow: '#39406e',
  bevelLight: '#3a4170', bevelDark: '#05060f',
  text: '#f3edda', textSoft: '#a7b0d8', textMute: '#6770a0', textOff: '#555b80',
  gold: '#ffd766', goldDeep: '#c98b2c', goldGlow: '#fff0b8',
  hpHigh: '#62c46a', hpMid: '#f0c44c', hpLow: '#e25563', mp: '#56a8e8', xp: '#b483f0',
  mercy: '#ffd766', spare: '#cfe0ff',
  poison: '#9ad94f', sleep: '#b59cff', weaken: '#d98446',
  info: '#7fded0', danger: '#e25563', warn: '#f0c44c',
  phaseHeroBg: '#1b3a6b', phaseHeroFg: '#bcd8ff',
  phaseEnemyBg: '#6b1b1b', phaseEnemyFg: '#ffc0c0',
  black: '#000000',
};

// --- Colour: 0x numbers (for Graphics) — derived from HEX so they never drift ---
export const NUM = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
);

// --- Typography sizes (px). Galmuri is crispest at these integer steps. ---
export const FS = {
  display: 30, // 화면 타이틀 / 페이즈 배너
  command: 24, // 명령바
  body: 24,    // 메시지 / 대화 본문
  label: 20,   // 이름표 / 상태명
  stat: 18,    // 스탯 수치
  caption: 18, // 힌트 / 캡션
  num: 24,     // HP/MP/데미지 수치
};

// --- Font families (Galmuri webfont, monospace fallback until it loads). ---
export const FONT = {
  display: 'Galmuri14, Galmuri11, monospace',
  ui: 'Galmuri11, monospace',
  mono: 'GalmuriMono11, Galmuri11, monospace',
  small: 'Galmuri9, Galmuri11, monospace',
};

// Galmuri faces that must be loaded before first paint (see ui/font.js).
export const GALMURI_FACES = ['Galmuri11', 'Galmuri14', 'Galmuri9', 'GalmuriMono11'];

// HP fill colour by fraction — mirrors share hpbar high/mid/low thresholds.
export function hpHex(frac) {
  return frac > 0.5 ? HEX.hpHigh : frac > 0.25 ? HEX.hpMid : HEX.hpLow;
}
export function hpNum(frac) {
  return frac > 0.5 ? NUM.hpHigh : frac > 0.25 ? NUM.hpMid : NUM.hpLow;
}

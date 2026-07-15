// Shared rendering constants. Logical world tile is TILE px; the field's world
// layer is scaled by WORLD_SCALE for a chunky retro look.

import { TILESETS } from './util/assets.js';

export const TILE = 32;
export const WORLD_SCALE = 3.0; // zoom (higher = less map on screen, tighter intimate view)

// Characters/props are 68px native; draw heroes ~1.35 tiles tall.
export const HERO_SCALE = (TILE * 1.35) / 68;
export const PROP_SCALE = (TILE * 1.5) / 68;
export const NPC_SCALE = (TILE * 1.3) / 68;

// Per-tileset slicing + semantic→sheet-index map. Indices are tuned visually;
// solid-color fallback renders until the sheet loads (and if an index is off).
export const TILESET_META = {
  // town_ground sheet packing order: full-grass = idx 12, full-dirt = idx 6
  // (derived from the PixelLab Wang metadata corner map).
  // accent id 2 = flagstone plaza/ruin floor (dungeon stone sheet, within-map variety
  // — v3 리디자인 맵의 광장/폐허 바닥. swamp_bog 악센트와 같은 메커니즘).
  town: { url: TILESETS.town, tilePx: 32, index: { 0: 12, 1: 6 }, accents: { 2: { url: TILESETS.dungeon, idx: 12 } } },   // 0 grass, 1 dirt path
  wild: { url: TILESETS.wild, tilePx: 32, index: { 0: 12, 1: 6 }, accents: { 2: { url: TILESETS.dungeon, idx: 12 } } },
  // dungeon_stone: PixelLab Wang sheet, same packing as town (full-upper=12).
  // accent id 1 = 흙길/통행로 (town 시트의 full-dirt) — v3 리디자인 맵들이 전 리전에
  // 길(1)을 깔았는데 리전 시트엔 dirt가 없어 단색 폴백이던 것을 텍스처로 연결.
  dungeon: { url: TILESETS.dungeon, tilePx: 32, index: { 2: 12 }, accents: { 1: { url: TILESETS.town, idx: 6 } } },    // 2 flagstone floor
  frost: { url: TILESETS.frost, tilePx: 32, index: { 4: 12 }, accents: { 1: { url: TILESETS.town, idx: 6 } } },        // 4 snow floor
  // 5 mud floor; accent id 3 = bog-water pools (separate sheet, within-map variety).
  swamp: { url: TILESETS.swamp, tilePx: 32, index: { 5: 12 }, accents: { 3: { url: TILESETS.swamp_bog, idx: 12 }, 1: { url: TILESETS.town, idx: 6 } } },
  // Ported biomes for upcoming regions (verify Wang `index` on first render; the
  // TILE_COLOR fallback below covers it if the sub-tile is off). New semantic
  // ground ids: 6 lava, 7 void. `ice` is an alt-frost (reuses snow floor id 4).
  lava: { url: TILESETS.lava, tilePx: 32, index: { 6: 12 } },          // 6 magma rock floor
  void: { url: TILESETS.void, tilePx: 32, index: { 7: 12 } },          // 7 void floor
  ice: { url: TILESETS.ice, tilePx: 32, index: { 4: 12 } },            // 4 ice floor (alt frost)
  empire: { url: TILESETS.empire, tilePx: 32, index: { 8: 6 }, accents: { 1: { url: TILESETS.town, idx: 6 } } },       // 8 corrupted obsidian floor (idx 6 = full-lower; 12=marble was too lava-like); accent 1 = 흙길
};

// Solid-color ground fallback per semantic tile id.
// 9 = molten lava pool (v3 리디자인 — 용암 리전의 비통행 웅덩이; Wang 시트 없음,
// 밝은 단색 폴백으로 렌더. 통행 차단은 collision이 담당).
export const TILE_COLOR = { 0: 0x3a6d34, 1: 0x8a6a3a, 2: 0x4a4652, 3: 0x3f66c4, 4: 0xcdd9e6, 5: 0x4a5638, 6: 0x6b241a, 7: 0x241640, 8: 0x352a3a, 9: 0xd8501a }; // 3 물은 보드 프리뷰 톤으로 상향 (2026-07-16)

// HD-2D atmosphere tokens per region (the "공기" layer — fieldScene.buildAtmosphere
// composites ambient tint + a vertical depth-fog + a radial vignette over the world,
// keyed by tileset). Values are the design-review-locked starting point (DESIGN.md
// "환경 무드"); tune live via run-qa-snapshot. `bloom` is reserved for P3 point-lights.
// Discipline: this is a SCREEN-SPACE overlay, never blurs the crisp sprites.
export const REGION_MOOD = {
  town:    { tint: { color: 0xfff4e0, alpha: 0.06 }, fog: { color: 0xe8dcc0, alpha: 0.10 }, vignette: 0.18, bloom: 0.82 },
  wild:    { tint: { color: 0xeaf2e0, alpha: 0.05 }, fog: { color: 0xcfe0c8, alpha: 0.08 }, vignette: 0.16, bloom: 0.85 },
  dungeon: { tint: { color: 0xb8c6e0, alpha: 0.14 }, fog: { color: 0x2a3550, alpha: 0.22 }, vignette: 0.34, bloom: 0.78 },
  frost:   { tint: { color: 0xdce8ff, alpha: 0.12 }, fog: { color: 0xcfe0ff, alpha: 0.18 }, vignette: 0.26, bloom: 0.80 },
  ice:     { tint: { color: 0xdce8ff, alpha: 0.12 }, fog: { color: 0xcfe0ff, alpha: 0.18 }, vignette: 0.26, bloom: 0.80 },
  swamp:   { tint: { color: 0xc8e0b0, alpha: 0.12 }, fog: { color: 0x3a4a2c, alpha: 0.24 }, vignette: 0.32, bloom: 0.76 },
  empire:  { tint: { color: 0xe0b0a0, alpha: 0.14 }, fog: { color: 0x3a2024, alpha: 0.26 }, vignette: 0.38, bloom: 0.74 },
  lava:    { tint: { color: 0xffb060, alpha: 0.18 }, fog: { color: 0x401808, alpha: 0.20 }, vignette: 0.30, bloom: 0.68 },
  void:    { tint: { color: 0xc090ff, alpha: 0.20 }, fog: { color: 0x1a0a2e, alpha: 0.30 }, vignette: 0.42, bloom: 0.66 },
  // 스토리 존 전용 무드 (맵의 `mood` 필드가 tileset 무드를 오버라이드 — 같은 타일셋을
  // 쓰는 존이 리전과 다른 얼굴을 갖게 한다. fieldScene이 `map.mood || map.tileset`로 조회).
  darkforest: { tint: { color: 0x9fb890, alpha: 0.16 }, fog: { color: 0x18241a, alpha: 0.30 }, vignette: 0.40, bloom: 0.72 }, // 어둠숲 — 빛이 겨우 스미는 초록 그늘
  ritual:  { tint: { color: 0xd8c090, alpha: 0.16 }, fog: { color: 0x241a10, alpha: 0.30 }, vignette: 0.44, bloom: 0.70 },   // 지하 의식장 — 제단의 암금색
  starfall: { tint: { color: 0xbfc9e8, alpha: 0.16 }, fog: { color: 0x14182e, alpha: 0.26 }, vignette: 0.36, bloom: 0.72 },  // 별무덤 — 잿빛 남보라 + 별빛
  default: { tint: { color: 0xffffff, alpha: 0.04 }, fog: { color: 0x202028, alpha: 0.10 }, vignette: 0.22, bloom: 0.80 },
};

// Vertical screen position (0=top..1=bottom) below which fog fades out — the upper
// band reads as distance (tilt-shift depth haze) without a GPU blur.
export const FOG_FADE = 1.4;

// HD-2D elevation: each level raises a tile this many screen px (pre-WORLD_SCALE).
// Half a tile per level reads as "raised" without a steep oblique that fights the
// top-down grid. Tiles/sprites offset by elev*ELEV_STEP; the cliff face fills the gap.
export const ELEV_STEP = 26;

// Tilt-shift depth-of-field: the top `bandFrac` of the screen is re-rendered through
// a blur (a RenderTexture copy of the world's far band), feathered into the sharp
// midground by a gradient mask. `enabled:false` falls back to fog-only depth (zero
// cost). Strength is intentionally low so the pixel sprites in the sharp band stay
// crisp — this only softens the DISTANCE.
export const FAR_BLUR = { enabled: true, bandFrac: 0.32, strength: 6 };

// HD-2D parallax backdrop (Octopath-style depth, NO hard horizon cut): the map
// stays FULL-SCREEN and the camera centres normally; the world's far (top) edge
// is SOFTLY FADED over the top `band` fraction via a gradient alpha mask, so the
// distant terrain dissolves into a parallax sky + mountain layer behind it. No
// slice line — the path stays fully visible and the background bleeds through the
// faded distance. `enabled:false` → no backdrop/fade (legacy far-blur depth).
// Per region: `sky` = [topColor, bottomColor] vertical gradient; `hills` = far→near
// silhouette band colours; or `off:true` for indoor maps (dungeon/ice cave).
export const BACKDROP = {
  // OFF (2026-07-16, 사용자 결정): 필드 백그라운드(하늘/능선/무대 틴트) 제거.
  // 울트라와이드/리사이즈 시 백드롭 지오메트리가 스테일해져 화면이 어긋나는
  // 문제도 함께 소거. 재실험은 localStorage.dbg_backdrop='1' 게이트로.
  enabled: false,
  band: 0.24,
  regions: {
    town:    { sky: [0x9fc0e8, 0xdce8f4], hills: [0x6f93b8, 0x53708f] },
    wild:    { sky: [0x8fc0e0, 0xd8ecdc], hills: [0x5f8f63, 0x456b49] },
    dungeon: { off: true }, // underground crypt — no sky
    frost:   { sky: [0xbcd4f4, 0xe6f2ff], hills: [0x8aa6c8, 0xb6d0ea] },
    ice:     { off: true }, // ice cave interior — no sky
    swamp:   { sky: [0x9fb088, 0xc7d8b0], hills: [0x4a5e38, 0x36482a] },
    empire:  { sky: [0x5a3a3e, 0x8a5a52], hills: [0x3a2024, 0x281418] }, // smouldering dusk
    lava:    { sky: [0x6a2410, 0xd86828], hills: [0x401810, 0x6b241a] },
    void:    { sky: [0x1a0a2e, 0x4a2a6a], hills: [0x2a1850, 0x140a28] },
    default: { sky: [0x88a8c8, 0xd0dce8], hills: [0x6a86a0, 0x4a6080] },
  },
};

// HD-2D camera TILT (spike, feature-flagged): render the world to a texture and
// map it onto a trapezoid PerspectiveMesh (top edge narrower) so the ground plane
// recedes — the Octopath 3D-diorama tilt, faked in 2D. Cosmetic only (collision/
// logic stay flat top-down). `enabled:false` → normal flat render. Phase-0 warps
// the whole world (sprites lean slightly at the top); billboard-uprighting is a
// later phase. `inset` = how far each top corner pulls in (fraction of width),
// `topY`/`botY` = top/bottom edge screen-y fractions (botY<1 lifts the horizon).
export const TILT = {
  // OFF (2026-07-16, 사용자 결정): 사다리꼴 기울기가 가장자리 빈 공간·시작 화면
  // 이상을 만들고 이질감이 커서 평면 풀스크린으로 회귀. 원형 시야 스포트라이트·
  // 빌보드·엣지 포그는 TILT 게이트라 함께 잠든다 (되돌리려면 이 플래그 하나).
  enabled: false, inset: 0.16, topY: 0.06, botY: 1.0, grid: 12,
  // View range (tiles from the player): the spotlight overlay lights a circle of
  // ~this radius and the billboard actors beyond it are CULLED (fully hidden, not
  // just dimmed), fading over the last `viewFade` tiles → a tight, focused diorama
  // where things outside your sightline disappear. Lower = tighter.
  // 2026-07-15 확장: 3.5/1.2 → 5.5/2.0 — v3 광활 맵에서 시야가 답답하다는 피드백.
  // 밝은 원이 넓어지고 가장자리 페이드도 완만해진다 (마을 openMap은 아예 제외).
  viewRadius: 5.5, viewFade: 2.0,
};

export const MOVE_TIME = 0.12; // seconds per grid step (tween) — snappier walk
// Hold this long before a held direction auto-repeats (continuous walk). Kept
// just above MOVE_TIME so a quick tap = one tile, but held walk chains with no
// hitch (fieldScene chains the next step the same frame a tile finishes).
export const REPEAT_DELAY = 0.16;

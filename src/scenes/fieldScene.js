// Field scene — grid exploration. Base opaque scene. Owns tile rendering,
// camera, player tween movement, NPC/prop sprites, interaction, portals, and
// encounter triggering. Rules live in systems/field.js (pure, tested); this
// scene is the Pixi presentation + input layer.

import * as PIXI from 'pixi.js';
import { TILE, WORLD_SCALE, HERO_SCALE, PROP_SCALE, NPC_SCALE, TILESET_META, TILE_COLOR, MOVE_TIME, REPEAT_DELAY, REGION_MOOD, FOG_FADE, ELEV_STEP, FAR_BLUR, BACKDROP, TILT } from '../config.js';
import { tryMove, objectAt, resolveTrigger, elevAt, isStair, capEncounter } from '../systems/field.js';
import { createRng } from '../util/rng.js';
import { spawnRoamers, stepRoamers, roamerAt, roamerGroup, roamerCount } from '../systems/roamers.js';
import { getMap } from '../content/maps/index.js';
import { getMonster } from '../content/monsters.js';
import { heroUrl, heroWalkUrl, npcUrl, structureUrl, enemyUrl, pickupUrl } from '../util/assets.js';
import { getItem } from '../content/items.js';
import { recordVisit, isTalkTarget } from '../content/questlines.js';
import { statsAtLevel, xpToReach } from '../systems/progression.js';
import { loadSheet, makeSprite, swapTexture, shadowTexture } from '../engine/renderer.js';
import { label, frame, hpbar, bar } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { createWeather } from '../ui/weather.js';

const PARTY_NAME = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };

// Decor kinds that sway in the wind (each rendered as its own Graphics, rotated
// from the base each frame). Roots stay put; tips lean. Cosmetic.
const SWAY_KINDS = new Set(['grass', 'reed']);

// Dark/underground regions where the player carries a torch glow (buildLights).
const DARK_TILESETS = new Set(['dungeon', 'ice', 'lava', 'void']);

// Biome to weather POOL — 맵 체류 중에도 주기적으로 풀에서 랜덤 로테이션한다
// (rollWeather). 중복 엔트리 = 가중치 (예: frost는 snow가 2/3 확률).
const BIOME_WEATHER = {
  swamp: ['rain', 'rain', 'storm', 'clear'],
  frost: ['snow', 'snow', 'clear'],
  ice: ['snow', 'clear'],
  dungeon: ['embers', 'clear'],
  empire: ['embers', 'embers', 'clear', 'storm'], // the fallen empire smoulders
  wild: ['clear', 'clear', 'rain', 'storm'],
  town: ['clear', 'clear', 'clear', 'rain'],
  lava: ['embers'],
  void: ['embers', 'clear'],
};
// 날씨 로테이션 주기 (초) — 매 롤마다 이 범위에서 랜덤.
const WEATHER_CYCLE_MIN = 22, WEATHER_CYCLE_MAX = 45;

// Ground-decal scatter config per region — fills the bare Wang-tile floor with
// small code-drawn flora/debris so a map reads as a place, not a grid. `kinds`
// are decal shapes (drawDecal), `pal` their colours, `density` ≈ fraction of
// walkable tiles that get one. Cosmetic only (no collision/save).
const DECOR = {
  town:    { density: 0.30, kinds: ['grass', 'grass', 'flower', 'pebble'], pal: [0x4a7a3a, 0x5e8c44, 0xe8d24a, 0xe88ab0, 0x8a8a7a] },
  wild:    { density: 0.40, kinds: ['grass', 'grass', 'flower', 'pebble', 'reed'], pal: [0x3f6e2f, 0x568a3c, 0xf0d850, 0xd86890, 0x7a7a66] },
  dungeon: { density: 0.26, kinds: ['pebble', 'crack', 'pebble'], pal: [0x55505e, 0x3a3640, 0x6a6472] },
  frost:   { density: 0.30, kinds: ['glint', 'pebble', 'glint'], pal: [0xbfe0ff, 0xdfeeff, 0x9fc4e6] },
  ice:     { density: 0.30, kinds: ['glint', 'pebble', 'glint'], pal: [0xbfe0ff, 0xdfeeff, 0x9fc4e6] },
  swamp:   { density: 0.38, kinds: ['reed', 'reed', 'pebble', 'flower'], pal: [0x3a5a2a, 0x4a6a30, 0x5a5040, 0x9ac060] },
  empire:  { density: 0.28, kinds: ['rubble', 'crack', 'pebble'], pal: [0x6a5a52, 0x3a2024, 0x7a6a60] },
  lava:    { density: 0.30, kinds: ['ember', 'crack', 'ember'], pal: [0xff7a30, 0xff5418, 0x401810] },
  void:    { density: 0.28, kinds: ['mote', 'mote', 'pebble'], pal: [0xc090ff, 0xe0c0ff, 0x6a5a8a] },
  default: { density: 0.24, kinds: ['pebble', 'grass'], pal: [0x6a6a6a, 0x4a7a3a] },
};

// Cliff palette per region: `face` = the rock body colour, `overhang` = the
// material that drapes over the rim (grass/snow/moss/etc). Turns the code-drawn
// elevation from a black box into region-themed rock with a natural lip.
const CLIFF = {
  town:    { face: 0x6b5a3f, overhang: 0x4a7a3a },
  wild:    { face: 0x6b5a3f, overhang: 0x568a3c },
  dungeon: { face: 0x36323e, overhang: 0x4a4652 },
  frost:   { face: 0x6a86a0, overhang: 0xd6e8ff },
  ice:     { face: 0x6a86a0, overhang: 0xd6e8ff },
  swamp:   { face: 0x45402e, overhang: 0x3f5a2a },
  empire:  { face: 0x463a3c, overhang: 0x3a2024 },
  lava:    { face: 0x3a1810, overhang: 0x8a2c18 },
  starfall: { face: 0x5c5c7e, overhang: 0x9a9ac8 }, // 별무덤 — 어두운 무드 위에서도 읽히는 잿빛 절벽
  void:    { face: 0x2a1a48, overhang: 0x6a5a8a },
  default: { face: 0x40404a, overhang: 0x5a5a52 },
};

// Tiny deterministic string hash → seed (for stable per-map decal layout).
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h;
}

// Draw one ground decal of `kind` at (cx,cy) into a shared Graphics `g`.
function drawDecal(g, kind, cx, cy, c, rng) {
  switch (kind) {
    case 'grass': { // 3 short blades
      for (let i = -1; i <= 1; i++) g.moveTo(cx + i * 2, cy).lineTo(cx + i * 2 + rng.int(-1, 1), cy - rng.int(3, 6)).stroke({ width: 1, color: c, alpha: 0.7 });
      break;
    }
    case 'reed': { // 2 tall blades
      for (let i = 0; i < 2; i++) g.moveTo(cx + i * 3, cy).lineTo(cx + i * 3 + rng.int(-1, 1), cy - rng.int(6, 11)).stroke({ width: 1, color: c, alpha: 0.7 });
      break;
    }
    case 'flower': { g.moveTo(cx, cy).lineTo(cx, cy - 4).stroke({ width: 1, color: 0x4a7a3a, alpha: 0.6 }); g.circle(cx, cy - 5, 1.6).fill({ color: c, alpha: 0.9 }); break; }
    case 'pebble': { g.ellipse(cx, cy, rng.int(2, 3), rng.int(1, 2)).fill({ color: c, alpha: 0.6 }); break; }
    case 'crack': { const dx = rng.int(-4, 4); g.moveTo(cx - 3, cy).lineTo(cx, cy + rng.int(-2, 2)).lineTo(cx + 3, cy + dx * 0.3).stroke({ width: 1, color: c, alpha: 0.45 }); break; }
    case 'glint': { g.moveTo(cx - 2, cy).lineTo(cx + 2, cy).moveTo(cx, cy - 2).lineTo(cx, cy + 2).stroke({ width: 1, color: c, alpha: 0.5 }); break; }
    case 'ember': { g.circle(cx, cy, rng.int(1, 2)).fill({ color: c, alpha: 0.8 }); break; }
    case 'mote': { g.circle(cx, cy, rng.int(1, 2)).fill({ color: c, alpha: 0.55 }); break; }
    case 'rubble': { for (let i = 0; i < 3; i++) g.rect(cx + rng.int(-3, 3), cy + rng.int(-2, 2), 2, 2).fill({ color: c, alpha: 0.55 }); break; }
  }
}

// Linear blend between two 0xRRGGBB colours (t: 0→a, 1→b). Used for the backdrop
// sky gradient.
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// A soft cloud lump = a few overlapping low-alpha ellipses. Drawn into the
// backdrop's drifting cloud layer.
function drawCloud(g, cx, cy, s, color, alpha) {
  g.ellipse(cx, cy, s, s * 0.5).fill({ color, alpha });
  g.ellipse(cx - s * 0.6, cy + s * 0.12, s * 0.62, s * 0.4).fill({ color, alpha });
  g.ellipse(cx + s * 0.62, cy + s * 0.1, s * 0.7, s * 0.42).fill({ color, alpha });
  g.ellipse(cx + s * 0.05, cy - s * 0.18, s * 0.5, s * 0.34).fill({ color, alpha });
}

// Blend a 0xRRGGBB colour toward white by `amt` (0..1) — used for the elevation
// rim light (a lightened ambient tint = the lit edge of a raised plateau).
function lighten(color, amt) {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const lr = Math.round(r + (255 - r) * amt);
  const lg = Math.round(g + (255 - g) * amt);
  const lb = Math.round(b + (255 - b) * amt);
  return (lr << 16) | (lg << 8) | lb;
}

// Lazily-built radial glow (white core → transparent), add-blended + tinted per
// light. The P3 point-light primitive: torches/braziers/lava cut warm pools through
// the region's ambient dark. Soft falloff so the pool reads as light, not a disc.
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _glowTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv }) });
  return _glowTex;
}

// Vertical feather mask for the tilt-shift band: opaque at the very top → fully
// transparent at the bottom, so the blurred far band melts into the sharp midground
// instead of ending on a hard line. Cached (the band height is fixed per session).
let _featherTex = null;
function featherTexture() {
  if (_featherTex) return _featherTex;
  const W = 8, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  _featherTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv }) });
  return _featherTex;
}

// Gradient ALPHA mask for the world: transparent at the very top → opaque from
// `fadeFrac` down. Used as a sprite mask so the map's far (top) edge dissolves
// into the backdrop instead of ending on a hard line (the Octopath soft-distance
// melt). Cached by fadeFrac (the texture is stretched to screen size). 1px wide.
const _fadeMaskTex = {};
function fadeMaskTexture(fadeFrac) {
  const key = Math.round(fadeFrac * 1000);
  if (_fadeMaskTex[key]) return _fadeMaskTex[key];
  const H = 256, W = 1;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0)');                 // top → fully faded (backdrop shows)
  g.addColorStop(Math.min(0.98, fadeFrac), 'rgba(255,255,255,1)'); // fade complete → solid map
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const tex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv }) });
  _fadeMaskTex[key] = tex;
  return tex;
}

// Lazily-built radial vignette: transparent centre → opaque-black corners, baked
// once into a canvas texture (the same nearest-canvas pattern the renderer uses).
// Tinted/scaled per-region by the atmosphere sprite (alpha = mood.vignette).
let _vignetteTex = null;
function vignetteTexture() {
  if (_vignetteTex) return _vignetteTex;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _vignetteTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv }) });
  return _vignetteTex;
}

// Player-centred "spotlight" darkness: a transparent hole at the centre that ramps
// to solid dark, so everything beyond the player's sightline fades to black (the
// circular view the player asked for). A small hole fraction lets the sprite scale
// big enough to cover the screen while keeping the lit circle tight. Cached.
// Texture hole fraction: small so the sprite can grow big enough to cover the
// screen while the lit circle stays tight (updateSpotlight uses the same value).
const SPOT_HOLE = 0.05;
let _spotTex = null;
function spotlightTexture() {
  if (_spotTex) return _spotTex;
  const S = 512, HOLE = SPOT_HOLE, FADE = 0.10, DARK = 0.96;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * HOLE, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop((FADE - HOLE) / (0.5 - HOLE), `rgba(0,0,0,${DARK})`);
  g.addColorStop(1, `rgba(0,0,0,${DARK})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _spotTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv }) });
  return _spotTex;
}

export class FieldScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.world = new PIXI.Container();
    this.world.scale.set(WORLD_SCALE);
    this.world.sortableChildren = true;
    this.ground = new PIXI.Container();
    this.water = new PIXI.Graphics();     // animated water shimmer over id-3 tiles (drawWater)
    this._waterCells = [];
    this.decor = new PIXI.Container();    // scattered ground decals (grass/pebbles/flowers) — fills bare floor
    this.walls = new PIXI.Container();    // dungeon wall blocks (maze)
    this.elevation = new PIXI.Container(); // HD-2D cliff faces + drop shadows + rim lights (above ground, below props)
    this.props = new PIXI.Container();
    this.props.sortableChildren = true;
    this.lights = new PIXI.Container();   // P3 point lights (add-blend glow pools over the scene)
    this.world.addChild(this.ground, this.water, this.decor, this.walls, this.elevation, this.props, this.lights);
    this.lightSprites = [];               // {sp, base, phase} for the flicker loop

    // HD-2D parallax backdrop: a distant sky + mountain band BEHIND the world,
    // revealed in the top `BACKDROP.band` of the screen (the world is masked to
    // the lower region). Built per map; layers parallax in update(). Behind world.
    this.backdrop = new PIXI.Container();
    this._backLayers = [];                // {g, factor} parallax silhouette layers
    this.backdropOn = false;
    this.container.addChild(this.backdrop);
    // Gradient alpha mask: the world is fully opaque across the lower screen and
    // fades to transparent over the top `band`, so the distant map dissolves into
    // the backdrop (no hard cut). A Sprite (alpha mask), textured in ensureWorldMask().
    this.worldMask = new PIXI.Sprite();
    this.container.addChild(this.worldMask);

    this.container.addChild(this.world);

    // HD-2D camera tilt (spike): the world is rendered to this RT each frame and
    // shown warped onto a trapezoid PerspectiveMesh so the ground recedes. Built
    // lazily (ensureTilt) when TILT.enabled. Cosmetic — added just above world.
    this.tiltRT = null;
    this.tiltMesh = null;
    this._tiltSize = { w: 0, h: 0 };
    this._homo = null; // cached tilt homography (flat screen px → warped screen px)

    // Billboard actor layer: with TILT on, sprites (player/enemies/NPCs/props) are
    // drawn UPRIGHT here (above the warped floor mesh), each projected to its spot
    // on the tilted ground via the homography + depth-scaled. Their shadows stay in
    // the world (warped, lying on the ground). Screen-space, z-sorted by ground-y.
    this.actorLayer = new PIXI.Container();
    this.actorLayer.sortableChildren = true;
    this.container.addChild(this.actorLayer);

    // Player-centred spotlight: darkens the floor + actors outside a tight circle
    // around the player (the "원형 시야 페이드"). Above the actors, below atmosphere/HUD.
    this.spotlight = new PIXI.Sprite(spotlightTexture());
    this.spotlight.anchor.set(0.5);
    this.spotlight.visible = false;
    this.container.addChild(this.spotlight);

    // Weather layer: positioned above world entities but below HUD
    const { w, h } = game.renderer.screen;
    this.weather = createWeather({ width: w, height: h });
    this.world.addChild(this.weather.container);

    // Tilt-shift far-band blur: a blurred RenderTexture copy of the world's top
    // band, feathered into the sharp midground. Sits above the world, below the
    // atmosphere/HUD. Lazily sized to the screen (ensureFarBlur). null until built.
    this.farRT = null;
    this.farBlurSprite = null;
    this.farMask = null;
    this._farW = 0; this._farH = 0;

    // HD-2D atmosphere — SCREEN-SPACE overlay (ambient tint + depth-fog + vignette),
    // composited above the world but below the HUD. Keyed by region via REGION_MOOD.
    // Never blurs the crisp sprites (the pixel-crunch discipline); rebuilt per map.
    this.atmosphere = new PIXI.Container();
    this.container.addChild(this.atmosphere);

    // 엣지 포그 — TILT 사다리꼴이 못 덮는 화면 가장자리(상단/좌우 쐐기)를 어둠
    // 그라데이션으로 녹인다. 하드 엣지가 어떤 화면비에서도 안 보이게 하는 스크린
    // 스페이스 오버레이 (HUD 아래). buildEdgeFade가 loadMap/resize에서 재구축.
    this.edgeFade = new PIXI.Container();
    this.container.addChild(this.edgeFade);

    this.hud = new PIXI.Container();
    this.banner = label('', FS.label, HEX.gold);
    this.banner.x = 16; this.banner.y = 12;
    this.minimap = new PIXI.Container();   // top-right map overview
    this.mmStatic = new PIXI.Graphics();   // walls/floor/markers (rebuilt per map)
    this.mmPlayer = new PIXI.Graphics();    // moving player dot
    this.minimap.addChild(this.mmStatic, this.mmPlayer);
    this.fieldHud = new PIXI.Container();  // party HP/MP + gold (top-left)
    // Ambient control hint at the bottom — auto-hides after the player has
    // walked a few tiles (once per session, tracked on `game`).
    this.hintLabel = label('방향키 이동 · Z 조사/대화 · X 메뉴', FS.caption, HEX.textMute);
    this.hintLabel.anchor = { x: 0.5, y: 1 };
    this.hud.addChild(this.banner, this.minimap, this.fieldHud, this.hintLabel);
    this.container.addChild(this.hud);
    // Interaction prompt ("Z") that floats over a faced interactable. Lives on
    // `world` (not props) so buildObjects' clear doesn't remove it.
    this.prompt = label('▶ Z', 13, HEX.gold);
    this.prompt.anchor = { x: 0.5, y: 1 };
    this.prompt.visible = false;
    this.world.addChild(this.prompt);

    this.map = null;
    // `facing` is the 4-dir sprite direction (north/south/east/west) — heroes now
    // ship full 4-dir stills + walk cycles, so up/down movement plays the matching
    // vertical animation. `dir` tracks true input (used for interaction/prompt).
    this.player = { x: 0, y: 0, dir: 'south', facing: 'south', px: 0, py: 0, sprite: null };
    this.moving = null;
    this.pending = null; // result of the in-progress step (portal/encounter/boss)
    this.busy = false;   // suspended while an overlay/battle is active
    this.walkT = 0;      // walk-cycle clock (east/west frames only)
    this.roamers = [];   // field monster symbols
    this.roamerSprites = new Map(); // id -> sprite
    this.roamerT = 0;    // roamer move-cadence clock
  }

  enter(args = {}) {
    const mapId = args.mapId || this.game.runtime.mapId || 'town';
    const pos = args.x != null ? { x: args.x, y: args.y } : this.game.runtime.pos;
    this.loadMap(mapId, pos.x, pos.y, args.dir || 'south');
    this.busy = false;
  }

  // Called by main when returning from an overlay/battle (scene resumes on top).
  // Rebuild objects + player so a defeated boss disappears and the lead sprite
  // reflects any party change.
  resume() {
    this.buildObjects();
    this.buildPlayer();
    this.buildRoamers();
    this.buildFieldHud();
    this.buildAtmosphere();
    this.buildBackdrop();
    this.buildLights();
    // Rebuild the minimap so a just-recruited NPC / spared event drops its marker
    // (resume runs after recruit/mercy dialogs; buildObjects already removed the sprite).
    this.revealMinimap(false);
    this.buildMinimap();
    this.centerCamera();
    this.busy = false;
  }

  loadMap(mapId, x, y, dir) {
    // Bake object tiles (npc/prop/sign) into a collision copy so the player
    // can't walk through them and instead talks by facing. Boss tiles stay
    // walkable — stepping onto one triggers the fight.
    const base = getMap(mapId);
    const collision = base.collision.slice();
    for (const o of base.objects || []) {
      // A recruited companion NPC (join flag set) no longer blocks its tile.
      if (o.kind === 'npc' && o.flag && this.game.runtime.flags[o.flag]) continue;
      // `walkable` props are decoration you walk through (bushes/reeds/clutter) — never baked.
      if (o.kind === 'prop' && o.walkable) continue;
      if (o.kind === 'npc' || o.kind === 'prop' || o.kind === 'sign' || o.kind === 'chest') collision[o.y * base.w + o.x] = 1;
    }
    this.map = { ...base, collision };
    // Structural walls only (no baked objects). A COPY, not the module ref — a
    // `switch` trigger opens walls by mutating this + map.collision, and we must
    // not corrupt the shared map module (and the copy resets on next loadMap, so
    // switch-opened walls revert on map re-entry for free).
    this.structCollision = base.collision.slice();
    this.firedTriggers = new Set(); // once-triggers consumed this visit (reset per map)
    this.game.runtime.mapId = mapId;
    this.player.x = x; this.player.y = y; this.player.dir = dir; this.player.facing = dir;
    this.player.px = x; this.player.py = y;
    this.moving = null; this.pending = null;
    this.banner.text = this.map.name;

    // Weather: biome 풀에서 랜덤 시작 + 체류 중 주기 로테이션 (update가 굴린다).
    this.rollWeather(true);

    this.buildGround();
    this.buildDecor();
    this.buildElevation();
    this.buildStairSteps();
    this.buildWaterCrossings();
    this.buildAtmosphere();
    this.buildEdgeFade();
    this.buildBackdrop();
    this.buildWalls();
    this.buildObjects();
    this.buildLights();
    // 로머 밀도는 맵 면적 비례(roamerCount) — loadMap마다 재스폰이라 맵을
    // 나갔다 오면 쓰러뜨린 로머도 돌아온다 (보스 오브젝트는 플래그 게이트 별개).
    this.roamers = this.map.symbolEncounters ? spawnRoamers(this.map, this.game.rng, roamerCount(this.map)) : [];
    this.roamerT = 0;
    this.buildPlayer();
    this.buildRoamers();
    // Fog of war: point at this map's explored set + light up the spawn area first,
    // then draw the minimap (revealMinimap(false) skips the redundant rebuild).
    this._explored = (this._exploredByMap || (this._exploredByMap = {}))[mapId] || (this._exploredByMap[mapId] = new Set());
    // 안전 허브(마을)는 미니맵 전체 공개 — map.openMap 플래그가 안개를 건너뛴다.
    if (this.map.openMap) {
      const n = this.map.w * this.map.h;
      if (this._explored.size < n) for (let i = 0; i < n; i++) this._explored.add(i);
    }
    this.revealMinimap(false);
    this.buildMinimap();
    this.buildFieldHud();
    this.placeHint();
    this.centerCamera();
    this.persistPos();
    // 스포트라이트(원형 시야 페이드)를 로드 시점에 즉시 1회 갱신. update(dt)는 TOP
    // 씬만 받으므로, 필드 위에 곧바로 오버레이가 얹히는 경로(새 게임 프롤로그 등)에선
    // 첫 update가 오기 전까지 constructor 초기값(visible=false)이 유지돼 — 프롤로그
    // 내내 밝은 맵이었다가 대화가 끝나는 순간 어두운 시야로 '뚝' 바뀌는 불일치가
    // 있었다. 여기서 켜 두면 오버레이 아래에서도 처음부터 일관된 화면.
    this.updateSpotlight();
    // 리전 BGM: `field_<mood||tileset>` 모드 (REGION_MOOD와 같은 조회 키). asset이
    // 없는 리전/미디코드 구간은 audio.setMusic이 필드 칩튠으로 폴백. 전투 복귀용으로
    // game.fieldMusic에 기억해 둔다 (main.enterField/endBattle이 이걸 복원).
    this.game.fieldMusic = `field_${this.map.mood || this.map.tileset || ''}`;
    this.game.audio?.setMusic(this.game.fieldMusic);
    // reach 트래커: 방문 기록(영구, 최초 1회 — 재진입 no-op) + 퀘스트라인 tick.
    // 전진이 있으면 main이 진행 토스트 다이얼로그를 띄운다(맵 진입 = 도착 비트).
    recordVisit(this.game.runtime, mapId);
    this.game.tickQuestlines?.();
  }

  // Position the bottom control hint; hidden once the session's walk quota met.
  placeHint() {
    const { w, h } = this.game.renderer.screen;
    this.hintLabel.x = w / 2;
    this.hintLabel.y = h - 14;
    this.hintLabel.visible = !this.game.tutHintDone;
  }

  // Top-right minimap: walls/floor + portals (cyan), boss (red), chests (gold),
  // NPCs (green), and the player (yellow). Static layer rebuilt per map; the
  // player dot moves every frame.
  buildMinimap() {
    const { w, h } = this.map;
    const { w: sw } = this.game.renderer.screen;
    const cell = Math.max(3, Math.min(7, Math.floor(190 / Math.max(w, h))));
    this.mmCell = cell;
    const mw = w * cell, mh = h * cell;
    const pad = 6;
    this.minimap.x = sw - mw - pad * 2 - 16;
    this.minimap.y = 16;

    const g = this.mmStatic;
    g.clear();
    // Minimap frame with dark background
    g.roundRect(-pad, -pad, mw + pad * 2, mh + pad * 2, 5).fill({ color: NUM.black, alpha: 0.55 }).stroke({ color: NUM.frame, width: 1.5 });
    const struct = this.structCollision || this.map.collision;
    // Fog of war: only EXPLORED tiles are drawn — the map fills in as you walk it.
    const exp = this._explored;
    const seen = (i) => !exp || exp.has(i);
    // Tile colors: wall (dark) vs floor = ground 시맨틱 색 (보드 프리뷰처럼 개울/길/
    // 호수가 미니맵에서도 읽히게). TILE_COLOR를 잉크 쪽으로 35% 눌러 HUD 톤 유지.
    const mixInk = (c) => {
      const t = 0.35, ink = 0x10142a;
      return ((Math.round(((c >> 16) & 255) * (1 - t) + ((ink >> 16) & 255) * t) << 16)
        | (Math.round(((c >> 8) & 255) * (1 - t) + ((ink >> 8) & 255) * t) << 8)
        | Math.round((c & 255) * (1 - t) + (ink & 255) * t));
    };
    for (let i = 0; i < struct.length; i++) {
      if (!seen(i)) continue;
      const cx = (i % w) * cell, cy = Math.floor(i / w) * cell;
      const col = struct[i] === 1 ? NUM.ink900 : mixInk(TILE_COLOR[this.map.ground[i]] ?? NUM.ink600);
      g.rect(cx, cy, cell, cell).fill({ color: col });
    }
    // Portals (info/cyan), gated portals slightly dimmer.
    for (const p of this.map.portals || []) {
      if (!seen(p.y * w + p.x)) continue;
      const open = !p.requires || this.game.runtime.flags[p.requires];
      g.rect(p.x * cell, p.y * cell, cell, cell).fill({ color: open ? NUM.info : 0x2a6a86 });
    }
    // Object markers: boss=danger, chest=gold, npc=hpHigh (only once discovered).
    for (const o of this.map.objects || []) {
      if (!seen(o.y * w + o.x)) continue;
      let col = null;
      if (o.kind === 'boss') { if (this.game.runtime.flags[o.flag || 'bossDefeated']) continue; col = NUM.danger; }
      else if (o.kind === 'chest') { if (o.hidden || this.game.runtime.openedChests.includes(this.chestId(o))) continue; col = NUM.gold; }
      else if (o.kind === 'npc') { if (o.flag && this.game.runtime.flags[o.flag]) continue; col = NUM.hpHigh; }
      if (col != null) g.rect(o.x * cell, o.y * cell, cell, cell).fill({ color: col });
    }
    this.updateMinimapPlayer();
  }

  // Fog of war: reveal the tiles within `R` of the player (the walked path lights
  // up). Explored sets persist per-map for the session. Rebuilds the minimap when
  // new ground is uncovered.
  revealMinimap(rebuild = true) {
    if (!this.map) return false;
    if (!this._exploredByMap) this._exploredByMap = {};
    if (!this._explored) this._explored = this._exploredByMap[this.map.id] || (this._exploredByMap[this.map.id] = new Set());
    const { w, h } = this.map;
    const R = 3.4, R2 = R * R, ri = Math.ceil(R);
    const px = Math.round(this.player.x), py = Math.round(this.player.y);
    let changed = false;
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      if (dx * dx + dy * dy > R2) continue;
      const x = px + dx, y = py + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (!this._explored.has(i)) { this._explored.add(i); changed = true; }
    }
    if (changed && rebuild) this.buildMinimap();
    return changed;
  }

  updateMinimapPlayer() {
    const cell = this.mmCell || 4;
    const g = this.mmPlayer;
    g.clear();
    const px = (this.player.px + 0.5) * cell, py = (this.player.py + 0.5) * cell;
    g.circle(px, py, Math.max(2, cell * 0.7)).fill({ color: NUM.gold }).stroke({ color: NUM.black, width: 1 });
  }

  // Top-left party status HUD: party rows (name + HP bar) + footer with gold & Fabula.
  // Restyled to frame() + uikit bars. Rebuilt on map load / battle return.
  buildFieldHud() {
    this.fieldHud.removeChildren();
    this.fieldHud.visible = true; // restore after a menu overlay hid it
    // Show the DEPLOYED heroes (active lineup, ≤4) — benched heroes are managed in
    // the 편성 menu. (Monster allies in the lineup aren't drawn here; their status
    // shows in 편성.) Fall back to the lead if no hero is currently deployed.
    const active = this.game.runtime.active || [];
    let party = this.game.runtime.party.filter((p) => active.includes(p.refId));
    if (!party.length) party = this.game.runtime.party.slice(0, 1);
    // Flex row layout: each member is one compact row — name+Lv on the LEFT, HP/MP
    // bars stacked on the RIGHT. (Different x columns, so name and bars never overlap.)
    const x = 14, top = 44;
    const pad = 14, rowH = 30, nameW = 72, barW = 96;
    const panelW = pad + nameW + barW + pad + 8;
    const panelH = party.length * rowH + pad + 24; // + footer row

    // Frame (bevel style) — dark panel with parchment border
    const bg = frame(panelW, panelH, 'bevel');
    bg.x = x; bg.y = top;
    this.fieldHud.addChild(bg);

    const nameX = x + pad, barX = x + pad + nameW;
    party.forEach((p, i) => {
      const st = statsAtLevel(p.refId, p.level).stats;
      const hp = p.hp != null ? p.hp : st.maxHp;
      const hpFrac = hp / st.maxHp;
      const ry = top + pad + i * rowH;

      // Name + level on the left, vertically centred against the HP/MP bar block.
      const nm = label(`${PARTY_NAME[p.refId] || p.refId} L${p.level}`, 12, HEX.textSoft);
      nm.x = nameX; nm.y = ry + 1;
      this.fieldHud.addChild(nm);

      // HP bar (top) + MP bar (below), right column.
      const hpb = hpbar(hpFrac, { w: barW, h: 10 });
      hpb.x = barX; hpb.y = ry;
      this.fieldHud.addChild(hpb);

      const mp = p.mp != null ? p.mp : st.maxMp;
      const mpFrac = st.maxMp ? mp / st.maxMp : 0;
      const mpb = bar(mpFrac, { w: barW, h: 7, color: NUM.mp });
      mpb.x = barX; mpb.y = ry + 13;
      this.fieldHud.addChild(mpb);
    });

    // Footer: gold (◆) and Fabula (✦) badges (+ 회차 배지 — NG+ 플레이 중 상시 인지)
    const footY = top + panelH - 20;
    const ng = this.game.runtime.ngPlus || 0;
    const gold = label(ng > 0 ? `◆ ${this.game.runtime.gold} · ${ng + 1}회차` : `◆ ${this.game.runtime.gold}`, 12, HEX.gold);
    gold.x = x + pad; gold.y = footY;
    this.fieldHud.addChild(gold);

    const fp = this.game.runtime.fabula || 0;
    if (fp > 0) {
      const fl = label(`✦ ${fp}`, 12, HEX.goldGlow);
      fl.anchor = { x: 1, y: 0 };
      fl.x = x + panelW - pad; fl.y = footY;
      this.fieldHud.addChild(fl);
    }
  }


  // Show a "▶ Z" prompt over the tile the player faces when it's interactable.
  updatePrompt() {
    const delta = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[this.player.dir] || [0, 1];
    const fx = this.player.x + delta[0], fy = this.player.y + delta[1];
    const obj = objectAt(this.map, fx, fy);
    const interactable = obj && (obj.kind === 'chest' || obj.kind === 'boss' || obj.talk || obj.quest);
    this.prompt.visible = !!interactable && !this.moving;
    if (interactable) {
      this.prompt.x = (fx + 0.5) * TILE;
      this.prompt.y = (fy + 0.2) * TILE;
    }
  }

  // HD-2D "공기" layer (P1). Screen-space, keyed by region (REGION_MOOD):
  //   tint     — full-screen ambient colour wash (region mood)
  //   fog      — vertical depth haze, denser at the TOP (distance) → fades out
  //              below FOG_FADE: the tilt-shift read WITHOUT a GPU blur, so the
  //              crisp pixel sprites are never softened.
  //   vignette — radial dark edges (cached canvas texture, one sprite)
  // Rebuilt per loadMap + resume; sized to the current screen.
  // 바이옴 날씨 풀에서 하나 뽑아 적용 + 다음 롤 타이머 장전. 코스메틱 전용이라
  // 시드 rng가 아닌 Math.random을 쓴다 (인카운터 롤 결정성 비오염).
  // 맵 스키마 `weather` 오버라이드 (지역 정체성 — 풀 로테이션보다 우선):
  //   null            → 무날씨 고정 (실내: waterway/ruins_below/void_*)
  //   'fog'|'snow'|…  → 해당 킨드 고정
  //   { kind, chance }→ 입장 시 chance 확률로 발생, 아니면 맑음 (재진입마다 재롤)
  rollWeather(initial = false) {
    const mw = this.map ? this.map.weather : undefined;
    if (mw !== undefined) {
      let kind = 'clear';
      if (typeof mw === 'string') kind = mw;
      else if (mw && mw.kind) kind = Math.random() < (mw.chance ?? 1) ? mw.kind : 'clear';
      this.weatherKind = kind;
      this.weather.setKind(kind);
      this.game.currentWeather = kind; // 전투 배경이 승계 (battleScene)
      this.weatherT = undefined;       // 고정 — 로테이션 없음
      return;
    }
    const pool = BIOME_WEATHER[this.map?.tileset || 'town'] || ['clear'];
    let kind = pool[Math.floor(Math.random() * pool.length)];
    if (!initial && pool.length > 1 && kind === this.weatherKind) {
      kind = pool[(pool.indexOf(kind) + 1) % pool.length]; // 같은 날씨 반복 방지
    }
    this.weatherKind = kind;
    this.weather.setKind(kind);
    this.game.currentWeather = kind; // 전투 배경이 승계 (battleScene)
    this.weatherT = WEATHER_CYCLE_MIN + Math.random() * (WEATHER_CYCLE_MAX - WEATHER_CYCLE_MIN);
  }

  // 계단 시각화 — stairs 셀에 돌계단 트레드를 그린다 (걷기 규칙만 있고 보이지
  // 않던 계단에 에셋 대응). 4단 트레드 + 좌우 난간 라인, elevation 레이어에 얹음.
  buildStairSteps() {
    if (!this.map || !this.map.stairs || !this.map.stairs.length) return;
    const g = new PIXI.Graphics();
    for (const st of this.map.stairs) {
      const eo = elevAt(this.map, st.x, st.y) * ELEV_STEP;
      const px = st.x * TILE, py = st.y * TILE - eo;
      // 바닥판
      g.rect(px + 1, py + 1, TILE - 2, TILE - 2).fill({ color: 0x6a6a78 });
      // 4단 트레드 (위로 갈수록 밝게 — 올라가는 느낌)
      const STEPS = 4, sh = (TILE - 6) / STEPS;
      for (let i = 0; i < STEPS; i++) {
        const ty = py + 3 + i * sh;
        const shade = [0x9a9aa8, 0x8a8a98, 0x7a7a88, 0x6f6f7d][i];
        g.rect(px + 3, ty, TILE - 6, sh - 1).fill({ color: shade });
        g.rect(px + 3, ty + sh - 1, TILE - 6, 1).fill({ color: 0x4a4a56 }); // 단 그림자
      }
      // 좌우 난간
      g.rect(px + 1, py + 1, 2, TILE - 2).fill({ color: 0x55555f });
      g.rect(px + TILE - 3, py + 1, 2, TILE - 2).fill({ color: 0x55555f });
    }
    this.elevation.addChild(g);
  }

  // 징검다리 — 통행 가능한 물 셀(ground 3 + 구조 collision 0)에 디딤돌을 그린다.
  // 보드 시안의 개울 건널목이 게임에서 '물 위를 걷는' 것처럼 보이던 것에 대응.
  buildWaterCrossings() {
    if (!this.map) return;
    const { w, h, ground } = this.map;
    const struct = this.structCollision || this.map.collision;
    const g = new PIXI.Graphics();
    let n = 0;
    for (let i = 0; i < ground.length; i++) {
      if (ground[i] !== 3 || struct[i] === 1) continue;
      const x = i % w, y = Math.floor(i / w);
      const eo = elevAt(this.map, x, y) * ELEV_STEP;
      const px = x * TILE, py = y * TILE - eo;
      // 디딤돌 3개 (지그재그) — 밝은 상판 + 어두운 밑둥.
      const stones = [[0.28, 0.3, 7], [0.66, 0.5, 8], [0.36, 0.72, 6]];
      for (const [fx, fy, r] of stones) {
        g.ellipse(px + TILE * fx, py + TILE * fy + 1.5, r, r * 0.7).fill({ color: 0x3c4250 });
        g.ellipse(px + TILE * fx, py + TILE * fy, r, r * 0.7).fill({ color: 0x8e94a4 });
        g.ellipse(px + TILE * fx - r * 0.25, py + TILE * fy - r * 0.2, r * 0.45, r * 0.3).fill({ color: 0xb8bec9, alpha: 0.8 });
      }
      n++;
    }
    if (n) this.decor.addChild(g);
  }

  // 화면 가장자리 어둠 그라데이션 (TILT 전용) — 위는 깊게, 좌우는 얕게.
  buildEdgeFade() {
    this.edgeFade.removeChildren();
    if (!TILT.enabled) return;
    const { w, h } = this.game.renderer.screen;
    const g = new PIXI.Graphics();
    const BLACK = 0x05060f;
    // 상단 밴드 — 사다리꼴 topY 위 + 접합부를 부드럽게 (알파 0.95 → 0).
    const TOPB = 12, topH = h * 0.20;
    for (let i = 0; i < TOPB; i++) {
      const t = i / (TOPB - 1);
      g.rect(0, (topH * i) / TOPB, w, topH / TOPB + 1).fill({ color: BLACK, alpha: 0.95 * (1 - t) });
    }
    // 좌/우 쐐기 — inset이 만드는 세로 빈 공간을 얕은 그라데이션으로.
    const SIDEB = 8, sideW = w * 0.09;
    for (let i = 0; i < SIDEB; i++) {
      const t = i / (SIDEB - 1);
      const a = 0.85 * (1 - t);
      g.rect((sideW * i) / SIDEB, 0, sideW / SIDEB + 1, h).fill({ color: BLACK, alpha: a });
      g.rect(w - (sideW * (i + 1)) / SIDEB, 0, sideW / SIDEB + 1, h).fill({ color: BLACK, alpha: a });
    }
    this.edgeFade.addChild(g);
  }

  buildAtmosphere() {
    this.atmosphere.removeChildren();
    // 안전 허브(마을)는 무드 쉐이드(틴트/안개/비네트) 제외 — 밝고 안전하게.
    if (this.map?.openMap) return;
    const mood = REGION_MOOD[this.map?.mood || this.map?.tileset] || REGION_MOOD.default;
    const { w, h } = this.game.renderer.screen;

    const tint = new PIXI.Graphics();
    tint.rect(0, 0, w, h).fill({ color: mood.tint.color, alpha: mood.tint.alpha });

    const fog = new PIXI.Graphics();
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      const t = i / bands;                          // 0 top → 1 bottom
      const a = mood.fog.alpha * Math.max(0, 1 - t * FOG_FADE);
      if (a <= 0) continue;
      fog.rect(0, h * t, w, h / bands + 1).fill({ color: mood.fog.color, alpha: a });
    }

    const vig = new PIXI.Sprite(vignetteTexture());
    vig.width = w; vig.height = h; vig.alpha = mood.vignette;

    this.atmosphere.addChild(tint, fog, vig);
  }

  // (Re)create the tilt-shift band RenderTexture + sprite + feather mask, sized to
  // the current screen. Returns false if disabled (→ fog-only depth). Idempotent.
  ensureFarBlur() {
    if (!FAR_BLUR.enabled) return false;
    // GPU-only: BlurFilter/MaskFilter are no-ops on a Canvas2D fallback (and the
    // render-to-texture would be wasted work). WebGL exposes `.gl`, WebGPU `.gpu`.
    const r = this.game.renderer.app.renderer;
    if (!r || (!r.gl && !r.gpu)) {
      if (this.farBlurSprite) this.farBlurSprite.visible = false;
      if (this.farMask) this.farMask.visible = false;
      return false;
    }
    const { w, h } = this.game.renderer.screen;
    const bandH = Math.max(1, Math.round(h * FAR_BLUR.bandFrac));
    if (this.farRT && this._farW === w && this._farH === bandH) return true;
    if (this.farRT) this.farRT.destroy(true);
    this.farRT = PIXI.RenderTexture.create({ width: w, height: bandH });
    if (!this.farBlurSprite) {
      this.farBlurSprite = new PIXI.Sprite(this.farRT);
      this.farBlurSprite.filters = [new PIXI.BlurFilter({ strength: FAR_BLUR.strength })];
      // Feather mask: the band fades to nothing at its bottom edge.
      this.farMask = new PIXI.Sprite(featherTexture());
      this.farBlurSprite.mask = this.farMask;
      // Insert just below the atmosphere (above the world).
      this.container.addChildAt(this.farBlurSprite, this.container.getChildIndex(this.atmosphere));
      this.container.addChildAt(this.farMask, this.container.getChildIndex(this.atmosphere));
    } else {
      this.farBlurSprite.texture = this.farRT;
    }
    this.farBlurSprite.x = 0; this.farBlurSprite.y = 0;
    this.farMask.x = 0; this.farMask.y = 0;
    this.farMask.width = w; this.farMask.height = bandH;
    this._farW = w; this._farH = bandH;
    return true;
  }

  // Re-render the world's top band into the blur texture. Called each frame the
  // field is active (the band tracks the camera). Defensive: any render error
  // disables the band rather than breaking the main loop.
  updateFarBlur() {
    // The parallax backdrop / camera tilt own the depth treatment; far-blur would
    // copy the world top and fight them, so skip it when either is on.
    if (this.backdropOn || TILT.enabled) { if (this.farBlurSprite) this.farBlurSprite.visible = false; if (this.farMask) this.farMask.visible = false; return; }
    if (!this.ensureFarBlur()) return;
    try {
      this.game.renderer.app.renderer.render({ container: this.world, target: this.farRT, clear: true });
      this.farBlurSprite.visible = true;
      this.farMask.visible = true;
    } catch (e) {
      if (this.farBlurSprite) this.farBlurSprite.visible = false;
    }
  }

  // HD-2D elevation render (P2). Separate pass from buildGround (color) so the two
  // concerns stay untangled. For every raised tile whose SOUTH neighbour is lower,
  // draw the 3 legibility cues (design-locked) that make it read as RAISED, not a
  // wall/pit:
  //   rim light  — a bright 2px lip at the plateau's front edge (the decisive cue)
  //   cliff face — a dark top→light gradient filling the vertical drop
  //   drop shadow— a soft dark band cast on the lower tile just below the cliff
  // Flat maps (no map.elev) → no raised tiles → nothing drawn.
  // Scatter small ground decals over bare walkable floor (region-themed, seeded so
  // the layout is stable per map). Skips object tiles; rides each tile's elevation.
  buildDecor() {
    // Destroy the previous map's sway decals (each is its own Graphics so it can
    // rotate; the shared static Graphics is just removed, matching prior behavior).
    if (this._swayDecals) for (const s of this._swayDecals) if (!s.g.destroyed) s.g.destroy();
    this._swayDecals = [];
    this.decor.removeChildren();
    const map = this.map;
    const { w, h } = map;
    const cfg = DECOR[map.tileset] || DECOR.default;
    const rng = createRng((hashStr(map.id || 'm') ^ 0x9e3779b1) >>> 0);
    const g = new PIXI.Graphics();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((map.collision[y * w + x] || 0) !== 0) continue; // walkable floor only
        if (objectAt(map, x, y)) continue;                   // not under props/npcs/chests
        if (!rng.chance(cfg.density)) continue;
        const kind = rng.pick(cfg.kinds);
        const color = rng.pick(cfg.pal);
        const eo = elevAt(map, x, y) * ELEV_STEP;
        const cx = x * TILE + rng.int(5, TILE - 5);
        const cy = y * TILE - eo + rng.int(8, TILE - 4);
        // Vegetation (grass/reed) gets its own Graphics so it can sway from the
        // base; everything else batches into the shared static layer.
        if (SWAY_KINDS.has(kind)) {
          const blade = new PIXI.Graphics();
          drawDecal(blade, kind, 0, 0, color, rng); // base at local origin, blades up
          blade.x = cx; blade.y = cy; // pivot defaults to (0,0) = the blade roots
          this.decor.addChild(blade);
          this._swayDecals.push({
            g: blade,
            phase: rng.int(0, 628) / 100,            // 0..2π, decorrelate neighbours
            amp: (kind === 'reed' ? 0.10 : 0.07),    // reeds (taller) sway a touch more
            freq: 1.6 + rng.int(0, 60) / 100,        // gentle, slightly varied
          });
        } else {
          drawDecal(g, kind, cx, cy, color, rng);
        }
      }
    }
    this.decor.addChild(g);
  }

  buildElevation() {
    this.elevation.removeChildren();
    const map = this.map;
    if (!map.elev) return;
    const { w, h } = map;
    const mood = REGION_MOOD[map.mood || map.tileset] || REGION_MOOD.default;
    const rimColor = lighten(mood.tint.color, 0.5);
    const cliff = CLIFF[map.mood] || CLIFF[map.tileset] || CLIFF.default; // 무드 전용 절벽색 우선
    const rng = createRng((hashStr(map.id || 'c') ^ 0x51515151) >>> 0);
    const g = new PIXI.Graphics();
    // Out-of-bounds neighbour → treat as SAME level (no edge) so a plateau touching
    // the map border doesn't draw a cliff into the void.
    const elevOf = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : elevAt(map, x, y));
    // Coherent plateau lighting (light from the NW): the N/W top edges catch a
    // bright rim, the E side falls into shadow, and the S edge gets the dramatic
    // tall cliff face (bright lip → dark drop) + a cast shadow on the lower tile.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const e = elevAt(map, x, y);
        if (e <= 0) continue;
        // A stair tile is drawn as a climbable ramp (second pass) — skip its cliff
        // edges so it never reads as a wall.
        if (isStair(map, x, y)) continue;
        const sx = x * TILE, topY = y * TILE - e * ELEV_STEP; // raised tile top-left
        const eN = elevOf(x, y - 1) ?? e;
        const eS = elevOf(x, y + 1) ?? e;
        const eW = elevOf(x - 1, y) ?? e;
        const eE = elevOf(x + 1, y) ?? e;

        // SOUTH (front): the visible vertical drop — region-rock face, not a black box.
        if (eS < e) {
          const cliffTop = topY + TILE, cliffH = (e - eS) * ELEV_STEP;
          // rock body
          g.rect(sx, cliffTop, TILE, cliffH).fill({ color: cliff.face, alpha: 0.94 });
          // vertical striations (rock texture)
          for (let i = 0; i < 4; i++) {
            const lx = sx + 4 + i * 8 + rng.int(-2, 2);
            g.rect(lx, cliffTop + 1, 1, cliffH - 1).fill({ color: 0x000000, alpha: 0.16 });
          }
          // ambient occlusion toward the foot + a cast shadow on the lower tile
          g.rect(sx, cliffTop + cliffH * 0.55, TILE, cliffH * 0.45).fill({ color: 0x000000, alpha: 0.22 });
          g.rect(sx, cliffTop + cliffH, TILE, ELEV_STEP).fill({ color: 0x000000, alpha: 0.28 });
          g.rect(sx, cliffTop + cliffH + ELEV_STEP, TILE, ELEV_STEP * 0.5).fill({ color: 0x000000, alpha: 0.12 });
          // OVERHANG: region material (grass/snow/moss) draping over the rim with a
          // jagged bottom edge — breaks the hard top line so it reads as natural terrain.
          for (let xx = 0; xx < TILE; xx += 4) {
            const drop = 3 + rng.int(0, 4);
            g.rect(sx + xx, cliffTop - 2, 4, drop).fill({ color: cliff.overhang, alpha: 0.85 });
          }
          // bright lit lip on the very top edge
          g.rect(sx, cliffTop - 3, TILE, 2).fill({ color: rimColor, alpha: 0.5 });
        }
        // Plateau edges as a 2-TONE outline (dark band + bright lit line) so the
        // boundary reads on ANY background — on bright snow the dark band shows, on
        // dark stone the bright line shows. (The old single bright rim vanished on snow.)
        // SIDE WALLS (W/E) + back face (N): draw the raised slab's faces with the
        // region rock colour so the plateau reads as a SOLID raised block on every
        // side — the only gap in the wall is the gold stair (skipped above). This is
        // what makes "you can only climb at the steps" visually unambiguous.
        if (eW < e) { // WEST face (lit edge)
          const dh = (e - eW) * ELEV_STEP;
          g.rect(sx, topY, 5, TILE + dh * 0.5).fill({ color: cliff.face, alpha: 0.5 });
          g.rect(sx, topY, 2, TILE).fill({ color: rimColor, alpha: 0.7 });
        }
        if (eE < e) { // EAST face (shadowed)
          const dh = (e - eE) * ELEV_STEP;
          g.rect(sx + TILE - 5, topY, 5, TILE + dh * 0.5).fill({ color: cliff.face, alpha: 0.6 });
          g.rect(sx + TILE - 5, topY, 5, TILE).fill({ color: 0x000000, alpha: 0.2 });
        }
        if (eN < e) { // NORTH back edge (short face + lit rim)
          g.rect(sx, topY, TILE, 4).fill({ color: cliff.face, alpha: 0.45 });
          g.rect(sx, topY, TILE, 1).fill({ color: rimColor, alpha: 0.85 });
        }
      }
    }

    // STAIR markers — a gold ramp that SPANS from the low tile you stand on UP to the
    // raised ledge, so the steps appear at your own feet (not floating 1 tile up where
    // the lifted stair cell is drawn). This fixes the "I have to stand one tile below
    // the gold to climb" confusion: the gold now sits ON the climb-from tile + rises
    // to the ledge. GOLD = universal "climb here", high-contrast on any background.
    const GOLD = 0xffe08a;
    for (const s of map.stairs || []) {
      const e = elevAt(map, s.x, s.y);
      // the LOW neighbour you actually climb FROM (your standing tile)
      let bx = s.x, by = s.y, lo = e;
      for (const [nx, ny] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const cx = s.x + nx, cy = s.y + ny, ne = elevOf(cx, cy);
        if (ne != null && ne < lo && (map.collision[cy * w + cx] || 0) === 0) { lo = ne; bx = cx; by = cy; }
      }
      const hiY = s.y * TILE - e * ELEV_STEP;   // raised stair cell (top, lifted)
      const loY = by * TILE - lo * ELEV_STEP;   // low standing cell (drawn lower)
      const hX = s.x * TILE, lX = bx * TILE;
      // bounding box covering BOTH cells + the vertical lift between them
      const x0 = Math.min(hX, lX), x1 = Math.max(hX, lX) + TILE;
      const y0 = Math.min(hiY, loY), y1 = Math.max(hiY, loY) + TILE;
      g.rect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4).fill({ color: GOLD, alpha: 0.22 });
      const climbNS = (bx === s.x); // N/S climb → horizontal treads; E/W → vertical treads
      for (let i = 0; i < 5; i++) {
        const f = (i + 0.5) / 5;
        if (climbNS) {
          const yy = y0 + 3 + f * (y1 - y0 - 6);
          g.rect(x0 + 3, yy, x1 - x0 - 6, 2).fill({ color: 0x000000, alpha: 0.4 });
          g.rect(x0 + 3, yy, x1 - x0 - 6, 1).fill({ color: GOLD, alpha: 0.95 });
        } else {
          const xx = x0 + 3 + f * (x1 - x0 - 6);
          g.rect(xx, y0 + 3, 2, y1 - y0 - 6).fill({ color: 0x000000, alpha: 0.4 });
          g.rect(xx, y0 + 3, 1, y1 - y0 - 6).fill({ color: GOLD, alpha: 0.95 });
        }
      }
      // double outline (dark + gold) around the whole ramp → reads on any background
      g.rect(x0, y0, x1 - x0, y1 - y0).stroke({ width: 3, color: 0x000000, alpha: 0.4 });
      g.rect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2).stroke({ width: 1.5, color: GOLD, alpha: 0.95 });
    }

    this.elevation.addChild(g);
  }

  // P3 point lights. Two sources: explicit map objects `kind:'light'`
  // ({x,y,color?,radius?,intensity?}) and AUTO-glow for light-emitting props
  // (braziers/shrines/torches). Each is an add-blended, tinted radial glow pool,
  // raised by its tile's elevation; the update loop flickers them gently.
  buildLights() {
    this.lights.removeChildren();
    this.lightSprites = [];
    const map = this.map;
    const add = (tx, ty, color, radiusTiles, intensity) => {
      const sp = new PIXI.Sprite(glowTexture());
      sp.anchor.set(0.5);
      sp.x = (tx + 0.5) * TILE;
      sp.y = (ty + 0.5) * TILE - elevAt(map, tx, ty) * ELEV_STEP;
      const d = radiusTiles * TILE * 2;
      sp.width = d; sp.height = d;
      sp.tint = color; sp.alpha = intensity; sp.blendMode = 'add';
      this.lights.addChild(sp);
      this.lightSprites.push({ sp, base: intensity, phase: tx * 0.7 + ty * 1.3 });
    };
    for (const o of map.objects || []) {
      if (o.kind === 'light') add(o.x, o.y, o.color ?? 0xffaa55, o.radius ?? 2.5, o.intensity ?? 0.6);
      else if (o.kind === 'prop' && /brazier|shrine|torch|lantern|candle/.test(o.ref || '')) add(o.x, o.y, 0xff8a3a, 2.2, 0.5);
    }
    // Player-carried torch: a warm glow pool on the floor that follows the hero
    // through dark regions (dungeon/ice/lava/void) — the lit companion to the
    // spotlight darkness. In the world layer so it warps onto the tilted floor.
    this.playerLight = null;
    if (DARK_TILESETS.has(map.tileset)) {
      const sp = new PIXI.Sprite(glowTexture());
      sp.anchor.set(0.5);
      const d = 4.2 * TILE * 2;
      sp.width = d; sp.height = d;
      sp.tint = 0xffb060; sp.alpha = 0.6; sp.blendMode = 'add';
      this.lights.addChild(sp);
      this.playerLight = sp;
      this.lightSprites.push({ sp, base: 0.6, phase: 1.3 }); // shares the flicker loop
    }
  }

  // Animated water shimmer over id-3 tiles: a richer base + drifting highlight
  // bands whose height waves by world-x so the ripple flows across the whole pond
  // (not a flat blue block). Redrawn each frame; cheap for the small water regions.
  drawWater(t) {
    const g = this.water; g.clear();
    if (!this._waterCells.length) return;
    for (const [x, y] of this._waterCells) {
      const eo = elevAt(this.map, x, y) * ELEV_STEP;
      const px = x * TILE, py = y * TILE - eo;
      g.rect(px, py, TILE, TILE).fill({ color: 0x3a5fb4 }); // 밝은 강물 — 보드 프리뷰 톤
      // two drifting highlight bands (phase by world-x → a continuous wave)
      for (let b = 0; b < 2; b++) {
        const yy = py + TILE * (0.34 + 0.36 * b) + Math.sin(x * 0.85 + t * 1.6 + b * 2.1) * 3;
        g.rect(px, yy, TILE, 2).fill({ color: 0x7fb4e8, alpha: 0.22 });
      }
      // a faint glint that twinkles
      const ga = 0.10 + 0.10 * Math.sin(x * 1.7 + y * 1.1 + t * 2.3);
      g.rect(px + TILE * 0.55, py + TILE * 0.2, 3, 2).fill({ color: 0xcfe6ff, alpha: Math.max(0, ga) });
    }
  }

  buildGround() {
    this.ground.removeChildren();
    const { w, h, ground } = this.map;
    const meta = TILESET_META[this.map.tileset];
    const cellRect = (id, x, y) => {
      const g = new PIXI.Graphics();
      g.rect(x, y, TILE, TILE).fill({ color: TILE_COLOR[id] ?? 0x222222 });
      return g;
    };
    // Elevation Y-offset per cell (higher tiles drawn further up the screen).
    // Absent map.elev → elevAt returns 0 → identical to the flat render.
    const eoff = (i) => elevAt(this.map, i % w, Math.floor(i / w)) * ELEV_STEP;
    // Solid-color fallback immediately.
    for (let i = 0; i < ground.length; i++) {
      this.ground.addChild(cellRect(ground[i], (i % w) * TILE, Math.floor(i / w) * TILE - eoff(i)));
    }
    // Collect water tiles (id 3) for the animated shimmer overlay (drawWater) — so
    // a pond reads as moving water, not a flat blue block. Skipped where an accent
    // sheet already paints water (swamp bog).
    this._waterCells = [];
    const meta0 = TILESET_META[this.map.tileset];
    if (!(meta0 && meta0.accents && meta0.accents[3])) {
      for (let i = 0; i < ground.length; i++) if (ground[i] === 3) this._waterCells.push([i % w, Math.floor(i / w)]);
    }
    this.water.clear();
    if (!meta) return;
    // ACCENT SHEETS (within-map ground variety): meta.accents maps a ground id to
    // a DIFFERENT sheet ({url, idx}) — e.g. swamp mud + moss patches + plank paths.
    // Load the main sheet + every distinct accent sheet, then render each cell from
    // the right one. No accents → behaves exactly like the single-sheet path.
    const accents = meta.accents || {};
    const accentUrls = [...new Set(Object.values(accents).map((a) => a.url))];
    const urls = [meta.url, ...accentUrls];
    const tileset = this.map.tileset; // guard against a map change mid-load
    Promise.all(urls.map((u) => loadSheet(u, meta.tilePx))).then((sheets) => {
      if (this.map.tileset !== tileset) return;
      const byUrl = {};
      urls.forEach((u, k) => { byUrl[u] = sheets[k]; });
      const main = byUrl[meta.url];
      if (!main || !main.length) return;
      this.ground.removeChildren();
      for (let i = 0; i < ground.length; i++) {
        const id = ground[i];
        const acc = accents[id];
        let tex = null;
        if (acc) { const t = byUrl[acc.url]; if (t && t.length) tex = t[acc.idx % t.length]; }
        else { const idx = meta.index[id]; if (idx != null) tex = main[idx % main.length]; }
        const x = (i % w) * TILE, y = Math.floor(i / w) * TILE - eoff(i);
        if (tex) {
          const sp = new PIXI.Sprite(tex);
          sp.x = x; sp.y = y; sp.width = TILE; sp.height = TILE;
          this.ground.addChild(sp);
        } else {
          this.ground.addChild(cellRect(id, x, y));
        }
      }
    });
  }

  // Dungeon wall blocks: a raised dark-stone block per structural collision
  // cell, inset slightly so the floor grout shows between blocks (maze grid).
  // Only for maps flagged `walls: true`.
  buildWalls() {
    this.walls.removeChildren();
    if (!this.map.walls) return;
    const { w, h } = this.map;
    const col = this.structCollision;
    for (let i = 0; i < col.length; i++) {
      if (col[i] !== 1) continue;
      const cx = (i % w) * TILE, cy = Math.floor(i / w) * TILE;
      // Graphics base — fills the cell so nothing shows through before the PNG
      // loads (and as a permanent fallback if the asset is missing).
      const g = new PIXI.Graphics();
      g.rect(cx, cy, TILE, TILE).fill({ color: NUM.ink800 });
      g.rect(cx, cy, TILE, 4).fill({ color: NUM.ink700 });
      this.walls.addChild(g);
      // PixelLab stone wall block overlay, scaled to fill the tile.
      const sp = makeSprite(structureUrl('prop_dungeon_wall'), { anchorX: 0.5, anchorY: 0.5 });
      sp.x = cx + TILE / 2; sp.y = cy + TILE / 2;
      sp.scale.set(TILE / 192);
      this.walls.addChild(sp);
    }
  }

  buildObjects() {
    this.props.removeChildren();
    // TILT: object sprites + name tags are upright billboards in the actor layer.
    // buildObjects runs before buildPlayer/buildRoamers, so clearing here is safe
    // (they re-add their actors after). Shadows go to `props` (warped with the floor).
    if (TILT.enabled) this.actorLayer.removeChildren();
    const actorParent = TILT.enabled ? this.actorLayer : this.props;
    this._hiddenChests = []; // hidden chests stay invisible until the player nears them
    for (const o of this.map.objects || []) {
      let sp = null;
      if (o.kind === 'prop') {
        // Props ship at varied native sizes (48/64/96/192px). Size by the REAL
        // texture height once it loads: `o.tiles` = explicit target height in tiles,
        // else derive from native (bigger art = bigger landmark; TILE/72 keeps every
        // prop at a consistent on-screen size relative to its pixels). This stops
        // 96px props (shrines/braziers) from rendering ~1.4x too big and overlapping.
        const tiles = o.tiles;
        // Use the sprite passed by onTex (spr) — for a CACHED texture, onTex fires
        // synchronously INSIDE makeSprite, before `sp` is assigned (it'd be null).
        const fit = (tex, spr) => { const bs = tiles ? (TILE * tiles) / tex.height : TILE / 72; spr._bs = bs; spr.scale.set(bs); };
        sp = makeSprite(structureUrl(o.ref), { anchorX: 0.5, anchorY: 0.85, onTex: fit });
        if (sp._bs === undefined) sp.scale.set(TILE / 72); // provisional until the texture loads (uncached)
      } else if (o.kind === 'npc') {
        // A recruited companion NPC vanishes once its join flag is set.
        if (o.flag && this.game.runtime.flags[o.flag]) continue;
        // `art:'hero'` companion NPCs use the hero field sprite (/heroes/),
        // `art:'enemy'` (a caged monster) uses the battle enemy sprite (/enemies/),
        // others use the /npcs/ set.
        const url = o.art === 'hero' ? heroUrl(o.ref, o.dir || 'south')
          : o.art === 'enemy' ? enemyUrl(o.ref)
          : npcUrl(o.ref, o.dir || 'south');
        sp = makeSprite(url, { anchorX: 0.5, anchorY: 0.85 });
        sp.scale.set(NPC_SCALE);
      } else if (o.kind === 'boss') {
        if (this.game.runtime.flags[o.flag || 'bossDefeated']) continue;
        sp = makeSprite(`/enemies/${getMapBossSprite(o.ref)}_east.png`, { anchorX: 0.5, anchorY: 0.85 });
        // Field boss scale. 1.3 → 1.0: 보스가 캐릭터(HERO_SCALE=1.35타일)보다
        // ~1.44배라 "거대"하게 보였음. 1.0 이면 1.5타일 ~1.11배 — 캐릭터보다
        // 살짝 큰 정도. 모든 필드 보스(드라큘라 백작/얼음여왕 등)에 공통 적용.
        // 팔레트 스왑 보스(monster.tint/spriteScale — 감시자/파수병/떨어진 별/파수꾼)는
        // 필드에서도 같은 변형을 적용 — 전투 스프라이트와 외형이 일치해야 한다.
        // spriteScale은 ×1.5로 캡 (필드 타일 그리드에서 과대 방지).
        const bossDef = getMonster(o.ref);
        if (bossDef && bossDef.tint != null) sp.tint = bossDef.tint;
        sp.scale.set(PROP_SCALE * Math.min((bossDef && bossDef.spriteScale) || 1, 1.5));
      } else if (o.kind === 'sign') {
        // A small wooden signpost (post + board) — less obtrusive than a gold block,
        // bottom-anchored at (0,0) so it stands on its tile like the other billboards.
        sp = new PIXI.Graphics();
        sp.rect(-1.5, -11, 3, 11).fill({ color: 0x5a3f22 }); // post
        sp.roundRect(-7, -19, 14, 9, 1.5).fill({ color: 0x8a6033 }).stroke({ color: 0x33220f, width: 1.2 }); // board
        sp.rect(-4.5, -16.5, 9, 1).fill({ color: 0x33220f, alpha: 0.55 });
        sp.rect(-4.5, -14, 6.5, 1).fill({ color: 0x33220f, alpha: 0.55 }); // faux text lines
        sp.pivot.set(0, 0);
      } else if (o.kind === 'chest') {
        const opened = this.game.runtime.openedChests.includes(this.chestId(o));
        sp = makeSprite(pickupUrl(o.loot && o.loot.gold ? 'pickup_chest_gold' : 'pickup_chest'), { anchorX: 0.5, anchorY: 0.75 });
        sp.scale.set((TILE * 0.95) / 48);
        if (opened) { sp.tint = 0x666666; sp.alpha = 0.6; sp._baseAlpha = 0.6; }
        // Hidden cache: invisible until the player steps adjacent (updateHiddenChests
        // fades it in + sparkles). Already-opened ones just render normally.
        else if (o.hidden) { sp.alpha = 0; sp._baseAlpha = 0; this._hiddenChests.push({ sp, x: o.x, y: o.y, revealed: false }); }
      }
      if (!sp) continue;
      // World-local foot anchor + intrinsic scale (set per-kind above) drive the
      // billboard projection (layoutActor). zIndex sorts actors front-to-back.
      sp._ax = (o.x + 0.5) * TILE;
      sp._ay = (o.y + 0.9) * TILE - elevAt(this.map, o.x, o.y) * ELEV_STEP;
      sp._z = o.y;
      sp._bs = sp.scale.x;
      // Ground shadow under characters + enemies (NPCs / bosses) — props, signs,
      // chests stay shadowless (scenery/pickups). Bosses get a wider blob. Shadow
      // lives in `props` (world) so it lies on the warped ground.
      if (o.kind === 'npc' || o.kind === 'boss') {
        const sh = this.makeFieldShadow(o.kind === 'boss' ? 1.5 : 1);
        sh.x = sp._ax; sh.y = sp._ay + TILE * 0.1; sh.zIndex = o.y - 0.5;
        sp._shadow = sh; // linked so the shadow fades with its actor at view range
      }
      actorParent.addChild(sp);
      this.layoutActor(sp);
      // Floating name tag above NPCs (상인 / 대장장이 / 의뢰 …) so similar-looking
      // townsfolk are easy to tell apart at a glance. Dark pill for readability.
      // Built as ONE container (bg + text) so it billboards as a unit above the head.
      if (o.kind === 'npc' && o.label) {
        const lc = new PIXI.Container();
        // 퀘스트라인의 현재 talk 타겟이면 ! 마커 (퀘스트 기버 라벨 관례와 통일).
        const labelText = (o.npcId && isTalkTarget(this.game.runtime, o.npcId))
          ? `! ${o.label.replace(/^[?!]\s*/, '')}` : o.label;
        const t = label(labelText, 11, HEX.gold, { font: FONT.ui });
        t.anchor = { x: 0.5, y: 1 };
        t.x = 0; t.y = 0;
        const pw = t.width + 6, ph = t.height + 2;
        const bg = new PIXI.Graphics();
        bg.roundRect(-pw / 2, -ph, pw, ph, 2).fill({ color: 0x000000, alpha: 0.5 });
        lc.addChild(bg, t);
        // npc art is 68px native at NPC_SCALE; ~0.62 sits at the head.
        lc._ax = (o.x + 0.5) * TILE;
        lc._ay = sp._ay - 68 * NPC_SCALE * 0.62;
        lc._z = o.y + 0.6;
        lc._bs = 1;
        actorParent.addChild(lc);
        this.layoutActor(lc);
      }
    }
  }

  // Position one billboard actor: in TILT mode, project its world-local foot anchor
  // (`_ax`,`_ay`) onto the tilted floor and stand it upright, depth-scaled (`_bs` =
  // intrinsic scale); flat mode places it in world-local space like before. Its
  // shadow lives in `props` (world) so it stays lying on the warped ground.
  layoutActor(sp) {
    if (sp._ax === undefined || sp.destroyed) return;
    if (TILT.enabled) {
      const fx = this.world.x + sp._ax * WORLD_SCALE;
      const fy = this.world.y + sp._ay * WORLD_SCALE;
      const pr = this.projectTilt(fx, fy);
      sp.x = Math.round(pr.x); sp.y = Math.round(pr.y); // snap to whole px (anti pixel-crawl)
      sp.scale.set(sp._bs * WORLD_SCALE * pr.scale);
      // Cull actors beyond the view radius: things outside the player's sightline
      // are HIDDEN (not just darkened by the spotlight), fading over the last tiles.
      const tx = sp._ax / TILE - 0.5, ty = sp._ay / TILE - 0.9;
      const dist = Math.hypot(tx - this.player.px, ty - this.player.py);
      // 안전 허브(마을)는 시야 컬링 제외 — 쉐이드 오프와 짝: NPC/프롭이 항상 보인다.
      const va = this.map?.openMap ? 1 : Math.max(0, Math.min(1, (TILT.viewRadius + TILT.viewFade - dist) / TILT.viewFade));
      sp.alpha = (sp._baseAlpha ?? 1) * va;
      sp.visible = va > 0.02;
      if (sp._shadow && !sp._shadow.destroyed) { sp._shadow.alpha = va; sp._shadow.visible = va > 0.02; }
    } else {
      sp.x = sp._ax; sp.y = sp._ay; sp.scale.set(sp._bs);
    }
    if (sp._z !== undefined) sp.zIndex = sp._z;
  }

  // Centre the spotlight darkness on the player and size its lit hole to the view
  // radius (in screen px at the player's depth). The small texture hole fraction
  // lets the sprite grow big enough to cover the screen while the circle stays tight.
  updateSpotlight() {
    if (!this.spotlight) return;
    // 안전 허브(마을)는 원형 시야 쉐이드도 제외 — 맵 전체가 밝게 보인다.
    if (!TILT.enabled || this.map?.openMap) { this.spotlight.visible = false; return; }
    const sp = this.player.sprite;
    if (!sp) { this.spotlight.visible = false; return; }
    this.spotlight.visible = true;
    // Centre on the player's body (a little above the foot).
    this.spotlight.x = sp.x;
    this.spotlight.y = sp.y - 18 * (sp.scale.x / (HERO_SCALE * WORLD_SCALE || 1));
    const depth = (HERO_SCALE * WORLD_SCALE) ? sp.scale.x / (HERO_SCALE * WORLD_SCALE) : 1;
    const rPx = TILT.viewRadius * TILE * WORLD_SCALE * depth; // lit radius in screen px
    const { w, h } = this.game.renderer.screen;
    const cover = 2.3 * Math.hypot(w, h);
    // Displayed hole radius = SPOT_HOLE * width, so width = rPx / SPOT_HOLE makes the
    // lit circle exactly rPx; clamp up to `cover` so the dark always fills the screen.
    const size = Math.max(rPx / SPOT_HOLE, cover);
    this.spotlight.width = size; this.spotlight.height = size;
  }

  // Re-project every billboard actor (objects + roamers + their name tags) each
  // frame, since the eased camera shifts their projection. The player is handled
  // by placePlayerSprite (it also drives its shadow + walk frame).
  layoutActors() {
    if (!TILT.enabled) return;
    for (const sp of this.actorLayer.children) {
      if (sp === this.player.sprite) continue;
      this.layoutActor(sp);
    }
    this.buildPortalMarkers();
  }

  // 포탈 마커 — 출구 타일 위 은은히 맥동하는 발광 룬 패드 (코드 드로잉, 코스메틱).
  // 게이트 잠금 상태(requires 미충족)는 어두운 자수정 톤으로 구분. buildObjects가
  // props를 비울 때마다 함께 재생성되므로 잠금 해제 후 재진입/리줌 시 색이 갱신된다.
  buildPortalMarkers() {
    this.portalMarks = [];
    const { w } = this.map;
    for (const p of this.map.portals || []) {
      const locked = p.requires && !this.game.runtime.flags[p.requires];
      const eo = (this.map.elev ? this.map.elev[p.y * w + p.x] : 0) * ELEV_STEP;
      const color = locked ? 0x9a5a8a : 0x59d8ff;
      const g = new PIXI.Graphics();
      g.ellipse(0, 0, TILE * 0.36, TILE * 0.18).stroke({ color, width: 2, alpha: 0.85 });
      g.ellipse(0, 0, TILE * 0.22, TILE * 0.11).stroke({ color, width: 1, alpha: 0.5 });
      g.moveTo(0, -TILE * 0.11).lineTo(TILE * 0.09, 0).lineTo(0, TILE * 0.11).lineTo(-TILE * 0.09, 0)
        .closePath().fill({ color, alpha: 0.55 });
      g.x = (p.x + 0.5) * TILE;
      g.y = (p.y + 0.6) * TILE - eo;
      g.zIndex = p.y - 0.45; // 그림자(−0.5) 위, 그 타일의 액터 아래
      this.props.addChild(g);
      this.portalMarks.push({ g, t: Math.random() * Math.PI * 2, locked });
    }
  }

  // A soft elliptical ground shadow placed in `props` just BELOW its entity
  // (zIndex −0.5) so characters/enemies don't look like they float. `mult` widens
  // it for bigger sprites (bosses). Positioned by the caller / place* helpers.
  makeFieldShadow(mult = 1) {
    const sh = new PIXI.Sprite(shadowTexture());
    sh.anchor.set(0.5);
    const wpx = TILE * 0.8 * mult;
    sh.width = wpx; sh.height = wpx * 0.34;
    this.props.addChild(sh);
    return sh;
  }

  buildPlayer() {
    if (this.player.sprite && this.player.sprite.parent) this.player.sprite.parent.removeChild(this.player.sprite);
    if (this.player.shadow && !this.player.shadow.destroyed) this.props.removeChild(this.player.shadow);
    const lead = this.game.runtime.party[0].refId;
    const sp = makeSprite(heroUrl(lead, this.player.facing), { anchorX: 0.5, anchorY: 0.85 });
    sp.scale.set(HERO_SCALE);
    this.player.sprite = sp;
    this.player.shadow = this.makeFieldShadow(1); // stays in world.props → warped onto the ground
    // TILT: the sprite stands UPRIGHT in the actor layer (projected each frame);
    // flat: it lives in the warped/normal world like before.
    (TILT.enabled ? this.actorLayer : this.props).addChild(sp);
    this.placePlayerSprite();
  }

  placePlayerSprite() {
    const sp = this.player.sprite;
    // World-local foot position (the point on the ground the character stands on).
    const eo = elevAt(this.map, Math.round(this.player.px), Math.round(this.player.py)) * ELEV_STEP;
    const wx = (this.player.px + 0.5) * TILE;
    const wy = (this.player.py + 0.9) * TILE - eo;
    const z = this.player.py + 0.5;
    // Player torch glow follows the hero on the floor (world-local → warped).
    if (this.playerLight && !this.playerLight.destroyed) {
      this.playerLight.x = wx; this.playerLight.y = wy - TILE * 0.3;
    }
    // Shadow lies on the ground → world-local (warped with the floor).
    if (this.player.shadow) {
      this.player.shadow.x = wx; this.player.shadow.y = wy + TILE * 0.1;
      this.player.shadow.zIndex = z - 0.5;
    }
    if (TILT.enabled) {
      // Project the foot from flat world-space → its spot on the tilted floor, and
      // stand the sprite there upright, depth-scaled to match the floor's perspective.
      const fx = this.world.x + wx * WORLD_SCALE;
      const fy = this.world.y + wy * WORLD_SCALE;
      const pr = this.projectTilt(fx, fy);
      // Snap to whole pixels — sub-pixel positions make nearest-sampled pixel art
      // "crawl"/tear on high-contrast edges (the cape) as the camera eases each frame.
      sp.x = Math.round(pr.x); sp.y = Math.round(pr.y);
      sp.scale.set(HERO_SCALE * WORLD_SCALE * pr.scale);
      sp.zIndex = z;
    } else {
      sp.x = wx; sp.y = wy; sp.scale.set(HERO_SCALE); sp.zIndex = z;
    }
  }

  setPlayerDirSprite() {
    const lead = this.game.runtime.party[0].refId;
    swapTexture(this.player.sprite, heroUrl(lead, this.player.facing));
  }

  buildRoamers() {
    for (const sp of this.roamerSprites.values()) if (sp && !sp.destroyed) {
      if (sp._shadow && !sp._shadow.destroyed) { this.props.removeChild(sp._shadow); sp._shadow.destroy(); }
      if (sp.parent) sp.parent.removeChild(sp); sp.destroy();
    }
    this.roamerSprites.clear();
    const actorParent = TILT.enabled ? this.actorLayer : this.props;
    for (const r of this.roamers) {
      const m = getMonster(r.ref);
      const sp = makeSprite(enemyUrl(m.sprite), { anchorX: 0.5, anchorY: 0.85 });
      sp.scale.set(NPC_SCALE * 0.95);
      sp.tint = 0xffc0c0; // faint red so field monsters read as hostile
      sp._bs = NPC_SCALE * 0.95; // intrinsic scale for the billboard projection
      sp._shadow = this.makeFieldShadow(1); // ground shadow under the roamer (in props, warped)
      actorParent.addChild(sp);
      this.roamerSprites.set(r.id, sp);
      r.px = r.x; r.py = r.y;
      this.placeRoamerSprite(r);
    }
  }

  placeRoamerSprite(r) {
    const sp = this.roamerSprites.get(r.id);
    if (!sp) return;
    // World-local foot anchor (drives both the shadow and the billboard projection).
    sp._ax = (r.px + 0.5) * TILE;
    sp._ay = (r.py + 0.9) * TILE - elevAt(this.map, Math.round(r.px), Math.round(r.py)) * ELEV_STEP;
    sp._z = r.py;
    if (sp._shadow) {
      sp._shadow.x = sp._ax; sp._shadow.y = sp._ay + TILE * 0.1;
      sp._shadow.zIndex = r.py - 0.5;
    }
    this.layoutActor(sp); // upright billboard in tilt mode, world-local in flat mode
  }

  triggerRoamer(r) {
    this.busy = true;
    const sp = this.roamerSprites.get(r.id);
    if (sp && !sp.destroyed) {
      if (sp._shadow && !sp._shadow.destroyed) { this.props.removeChild(sp._shadow); sp._shadow.destroy(); }
      if (sp.parent) sp.parent.removeChild(sp); sp.destroy();
    }
    this.roamerSprites.delete(r.id);
    this.roamers = this.roamers.filter((x) => x !== r);
    this.game.startBattle(capEncounter(roamerGroup(r, this.map, this.game.rng), this.activePartySize()), this.map.tileset);
  }

  // Build (or re-fit) the tilt RenderTexture + trapezoid PerspectiveMesh to the
  // current screen. Returns false when tilt is off. The mesh top edge is pulled in
  // by `inset` so the world foreshortens into the distance.
  ensureTilt() {
    if (!TILT.enabled) return false;
    const { w, h } = this.game.renderer.screen;
    if (this.tiltMesh && this._tiltSize.w === w && this._tiltSize.h === h) return true;
    const res = this.game.renderer.app.renderer.resolution || 1;
    if (this.tiltRT) { this.tiltRT.destroy(true); this.tiltRT = null; }
    this.tiltRT = PIXI.RenderTexture.create({ width: w, height: h, resolution: res });
    if (this.tiltMesh) { this.container.removeChild(this.tiltMesh); this.tiltMesh.destroy(); this.tiltMesh = null; }
    const inset = w * TILT.inset, topY = h * TILT.topY, botY = h * TILT.botY;
    // corner order: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left
    this.tiltMesh = new PIXI.PerspectiveMesh({
      texture: this.tiltRT,
      verticesX: TILT.grid, verticesY: TILT.grid,
      x0: inset, y0: topY, x1: w - inset, y1: topY,
      x2: w, y2: botY, x3: 0, y3: botY,
    });
    // Above the (now-hidden) world, below atmosphere/backdrop-fade and HUD.
    this.container.addChildAt(this.tiltMesh, this.container.getChildIndex(this.world) + 1);
    this._tiltSize = { w, h };
    return true;
  }

  // The homography coefficients mapping flat screen px → the warped trapezoid (the
  // same map the PerspectiveMesh applies). Unit-square→quad (Heckbert). Cached per
  // screen size + tilt params so actors can be projected onto the tilted floor.
  computeTiltHomography() {
    const { w, h } = this.game.renderer.screen;
    if (this._homo && this._homo.w === w && this._homo.h === h && this._homo.inset === TILT.inset && this._homo.topY === TILT.topY && this._homo.botY === TILT.botY) return this._homo;
    const insetPx = w * TILT.inset, topPx = h * TILT.topY, botPx = h * TILT.botY;
    // quad for unit-square corners (0,0)(1,0)(1,1)(0,1) = TL,TR,BR,BL
    const x0 = insetPx, y0 = topPx, x1 = w - insetPx, y1 = topPx, x2 = w, y2 = botPx, x3 = 0, y3 = botPx;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dy1 * dx2;
    const pg = (dx3 * dy2 - dy3 * dx2) / den; // perspective g coefficient
    const ph = (dx1 * dy3 - dy1 * dx3) / den; // perspective h coefficient
    // NOTE: store screen height as `h`; the homography coefficients are `pg`/`ph`
    // (do NOT reuse the key `h` for a coefficient — it would clobber screen height).
    this._homo = {
      w, h, inset: TILT.inset, topY: TILT.topY, botY: TILT.botY,
      a: x1 - x0 + pg * x1, b: x3 - x0 + ph * x3, c: x0,
      d: y1 - y0 + pg * y1, e: y3 - y0 + ph * y3, f: y0, pg, ph,
    };
    return this._homo;
  }

  // Project a flat screen point onto the tilted floor, plus the local depth scale
  // (how much a flat pixel stretches there — 1 at the front, smaller into the
  // distance) via finite differences. Identity when tilt is off.
  projectTilt(sx, sy) {
    if (!TILT.enabled) return { x: sx, y: sy, scale: 1 };
    const H = this.computeTiltHomography();
    const at = (px, py) => {
      const u = px / H.w, v = py / H.h; // H.h = screen height
      const D = H.pg * u + H.ph * v + 1;
      return { x: (H.a * u + H.b * v + H.c) / D, y: (H.d * u + H.e * v + H.f) / D };
    };
    const p = at(sx, sy), pu = at(sx, sy - 2), pr = at(sx + 2, sy);
    const sY = Math.hypot(p.x - pu.x, p.y - pu.y) / 2;
    const sX = Math.hypot(p.x - pr.x, p.y - pr.y) / 2;
    return { x: p.x, y: p.y, scale: (sX + sY) / 2 };
  }

  // Render the world to the tilt RT and show it warped; hide the flat world from
  // the main pass. Off → restore the flat world. Called each frame in update().
  applyTilt() {
    if (!TILT.enabled) {
      if (this.tiltMesh) this.tiltMesh.visible = false;
      this.world.renderable = true;
      return;
    }
    if (!this.ensureTilt()) return;
    try {
      this.world.renderable = true; // ensure it draws into the RT
      this.game.renderer.app.renderer.render({ container: this.world, target: this.tiltRT, clear: true });
      this.tiltMesh.texture = this.tiltRT;
      this.tiltMesh.visible = true;
      this.world.renderable = false; // hide flat world from the main pass; the mesh shows it
    } catch (e) {
      this.tiltMesh.visible = false;
      this.world.renderable = true;
    }
  }

  // Pixel height of the reserved backdrop band at the top of the screen (0 when
  // the backdrop is off). The world lives below this line.
  bandPx() {
    return this.backdropOn ? this.game.renderer.screen.h * BACKDROP.band : 0;
  }

  // The clamped world position that keeps the player centred and the map filling
  // the screen (no black gutters). The backdrop soft-fade happens via the world's
  // gradient mask, NOT by reserving screen space — so the map stays full-screen and
  // the path is always fully visible.
  camTarget() {
    const { w, h } = this.game.renderer.screen;
    const mapW = this.map.w * TILE * WORLD_SCALE;
    const mapH = this.map.h * TILE * WORLD_SCALE;
    let x = w / 2 - (this.player.px + 0.5) * TILE * WORLD_SCALE;
    let y = h / 2 - (this.player.py + 0.7) * TILE * WORLD_SCALE;
    x = mapW >= w ? Math.min(0, Math.max(w - mapW, x)) : (w - mapW) / 2;
    y = mapH >= h ? Math.min(0, Math.max(h - mapH, y)) : (h - mapH) / 2;
    return { x, y };
  }

  // Region sky + rolling mountain silhouettes behind the world, revealed in the
  // top band. Each ridge is its own Graphics so it can parallax. The world mask
  // (ensureWorldMask) clips the playfield to the lower region. Cosmetic; rebuilt
  // per map. Off → full-screen map (legacy look).
  buildBackdrop() {
    this.backdrop.removeChildren();
    this._backLayers = [];
    this._clouds = null;
    const cfg = (this.map && (BACKDROP.regions[this.map.tileset] || BACKDROP.regions.default)) || null;
    // Off globally, no map, or an indoor region (dungeon/ice cave) → full-screen map.
    // 디버그 게이트: localStorage.dbg_backdrop='1'로 세션 한정 강제 활성 (QA 재현용).
    const bdEnabled = BACKDROP.enabled || (typeof localStorage !== 'undefined' && localStorage.getItem('dbg_backdrop') === '1');
    this.backdropOn = !!(bdEnabled && this.map && cfg && !cfg.off);
    this.ensureWorldMask();
    if (!this.backdropOn) return;
    const { w, h } = this.game.renderer.screen;
    const band = h * BACKDROP.band;
    const W = w * 1.5, OX = -w * 0.25; // oversized so horizontal parallax never reveals an edge

    // STAGE TINT: a full-screen wash behind everything, in the region's sky tone
    // darkened almost to black. TILT의 사다리꼴 측면/하단 쐐기가 맨 어둠 대신 리전
    // 톤의 무대 어둠으로 읽힌다 (디오라마가 "잘려" 보이지 않게).
    const stage = new PIXI.Graphics();
    const stageTop = lerpColor(cfg.sky[0], 0x000000, 0.78);
    const stageBot = lerpColor(cfg.sky[0], 0x000000, 0.90);
    const SB = 10;
    for (let i = 0; i < SB; i++) {
      stage.rect(0, (h * i) / SB, w, h / SB + 1).fill({ color: lerpColor(stageTop, stageBot, i / (SB - 1)) });
    }
    this.backdrop.addChild(stage);

    // Sky: vertical gradient (stacked bands) covering the reserved strip + a touch
    // of overscan past the seam so the haze can melt it into the playfield.
    const sky = new PIXI.Graphics();
    const skyH = band + 24, STEPS = 24;
    for (let i = 0; i < STEPS; i++) {
      const f = i / (STEPS - 1);
      sky.rect(OX, (skyH * i) / STEPS, W, skyH / STEPS + 1).fill({ color: lerpColor(cfg.sky[0], cfg.sky[1], f) });
    }
    this.backdrop.addChild(sky);
    this._backLayers.push({ g: sky, factor: 0 }); // fixed (no parallax)

    // Drifting clouds/haze: soft lumps that slide slowly across the upper sky
    // (their own clock, plus a faint parallax). Two seamless copies offset by `w`
    // so the drift wraps without a seam. Behind the mountains. Colour = a brighter
    // wisp of the sky (smoke over lava, mist over swamp, etc).
    const cloudG = new PIXI.Graphics();
    // Near-white, tinted slightly toward the sky so clouds read on bright skies
    // and as luminous mist/smoke on dark ones (void/lava).
    const cloudCol = lerpColor(0xffffff, cfg.sky[0], 0.28);
    const crng = createRng((hashStr((this.map.id || 'b') + 'cloud') ^ 0x68bc21eb) >>> 0);
    const puffs = [];
    for (let i = 0; i < 6; i++) puffs.push({ x: crng.int(0, w), y: band * (0.08 + crng.int(0, 40) / 100), s: crng.int(22, 48) });
    for (const rep of [0, w]) for (const p of puffs) drawCloud(cloudG, p.x + rep, p.y, p.s, cloudCol, 0.22);
    cloudG.x = 0;
    this.backdrop.addChild(cloudG);
    this._clouds = { g: cloudG, drift: 0, speed: 7, factor: 0.05, span: w };

    // Two mountain ridges (far → near). Nearer ridge sits lower, is darker, and
    // parallaxes more. A seeded rng keeps the silhouette stable per map.
    const rng = createRng((hashStr((this.map.id || 'b') + 'bd') ^ 0x2545f491) >>> 0);
    const ridges = [
      { color: cfg.hills[0], baseY: band * 0.74, amp: band * 0.20, freq: 1.7, factor: 0.18 },
      { color: cfg.hills[1], baseY: band * 0.96, amp: band * 0.16, freq: 2.6, factor: 0.32 },
    ];
    for (const r of ridges) {
      const g = new PIXI.Graphics();
      const ph = rng.int(0, 628) / 100;
      g.moveTo(OX, band + 2);
      const SEG = 28;
      for (let s = 0; s <= SEG; s++) {
        const x = OX + (W * s) / SEG;
        const yy = r.baseY - r.amp * (0.6 * Math.sin((s / SEG) * Math.PI * 2 * r.freq + ph) + 0.4 * Math.sin((s / SEG) * Math.PI * 2 * r.freq * 0.5 + ph * 1.7));
        g.lineTo(x, yy);
      }
      g.lineTo(OX + W, band + 2).lineTo(OX, band + 2).fill({ color: r.color, alpha: 0.95 });
      this.backdrop.addChild(g);
      this._backLayers.push({ g, factor: r.factor });
    }

    // Haze at the seam: a few fading bands so the ridge feet melt into the
    // playfield instead of ending on a hard mask line.
    const haze = new PIXI.Graphics();
    const fog = (REGION_MOOD[this.map.mood || this.map.tileset] || REGION_MOOD.default).fog;
    for (let i = 0; i < 6; i++) {
      haze.rect(OX, band - 10 + i * 3, W, 4).fill({ color: fog.color, alpha: 0.14 * (1 - i / 6) });
    }
    this.backdrop.addChild(haze);
    this._backLayers.push({ g: haze, factor: 0 });
  }

  // Soft-fade the world's top `band` into transparency (gradient alpha mask) so the
  // distant map dissolves into the backdrop — no hard cut. Screen-space sprite mask.
  // In TILT mode the perspective floor recedes into the backdrop, so no mask is used.
  ensureWorldMask() {
    if (!this.backdropOn || TILT.enabled) { this.world.mask = null; this.worldMask.visible = false; return; }
    const { w, h } = this.game.renderer.screen;
    this.worldMask.texture = fadeMaskTexture(BACKDROP.band);
    this.worldMask.x = 0; this.worldMask.y = 0;
    this.worldMask.width = w; this.worldMask.height = h;
    this.worldMask.visible = true;
    this.world.mask = this.worldMask;
  }

  // Snap the camera to the player instantly. Used on map load / warp / resume /
  // resize — anywhere a smooth glide would read as the camera creeping in.
  centerCamera() {
    const t = this.camTarget();
    this.world.x = t.x; this.world.y = t.y;
    // Re-project the billboards to the snapped camera immediately, so on the first
    // frame after a map load / warp the actors don't sit on a stale (pre-snap)
    // projection while the floor renders at the new position (the "따로 노는" flash).
    if (TILT.enabled && this.map && this.player.sprite) { this.placePlayerSprite(); this.layoutActors(); }
  }

  // Per-frame eased follow: the world chases the player target with weight
  // instead of snapping, so movement feels heavy/cinematic (the single biggest
  // "alive" lever in a top-down RPG). Frame-rate-independent damping. Cosmetic —
  // minimap + far-blur RT read `world`, so they track it for free. Sub-pixel
  // residual settles to avoid RenderTexture jitter on the far band.
  followCamera(dt) {
    if (!this.map) return;
    const t = this.camTarget();
    const k = 1 - Math.pow(1 - 0.12, dt * 60);
    const nx = this.world.x + (t.x - this.world.x) * k;
    const ny = this.world.y + (t.y - this.world.y) * k;
    this.world.x = Math.abs(t.x - nx) < 0.5 ? t.x : nx;
    this.world.y = Math.abs(t.y - ny) < 0.5 ? t.y : ny;
  }

  persistPos() {
    this.game.runtime.pos = { x: this.player.x, y: this.player.y };
  }

  // Reveal hidden caches the player walks up to (Chebyshev ≤1): a one-time sparkle
  // + chime, then fade the chest in. Stays revealed for the session (re-hidden on
  // map reload, but by then it's usually opened → renders normally).
  updateHiddenChests(dt) {
    if (!this._hiddenChests || !this._hiddenChests.length) return;
    for (const hc of this._hiddenChests) {
      if (hc.sp.destroyed) continue;
      if (!hc.revealed) {
        if (Math.max(Math.abs(hc.x - this.player.x), Math.abs(hc.y - this.player.y)) <= 1) {
          hc.revealed = true;
          this.game.audio?.play('heal_chime');
          this.sparkleAt(hc.x, hc.y);
        }
      } else if ((hc.sp._baseAlpha ?? 1) < 1) {
        // Raise the intended alpha; layoutActor composes it with the view-cull fade.
        hc.sp._baseAlpha = Math.min(1, (hc.sp._baseAlpha ?? 0) + dt * 3);
        if (!TILT.enabled) hc.sp.alpha = hc.sp._baseAlpha;
      }
    }
  }

  // A short golden sparkle burst at a tile (hidden-chest reveal cue). Cosmetic.
  sparkleAt(gx, gy) {
    const c = new PIXI.Container();
    c.x = (gx + 0.5) * TILE; c.y = (gy + 0.4) * TILE; c.zIndex = 9999;
    const g = new PIXI.Graphics();
    c.addChild(g);
    this.props.addChild(c);
    let t = 0;
    const id = setInterval(() => {
      t += 0.05;
      g.clear();
      const fade = Math.max(0, 0.9 - t * 1.2);
      g.circle(0, 0, 4 + t * 38).stroke({ color: 0xffe9a0, width: 2, alpha: fade });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2, rr = 6 + t * 28;
        g.circle(Math.cos(a) * rr, Math.sin(a) * rr, 2).fill({ color: 0xfff4d0, alpha: Math.max(0, 0.9 - t * 1.4) });
      }
      if (t >= 0.8) { clearInterval(id); if (!c.destroyed) c.destroy({ children: true }); }
    }, 40);
  }

  // Ground id 3 is walkable water (swamp bog pools, wild shallows). Cosmetic check.
  isWaterTile(gx, gy) {
    const { w, h, ground } = this.map;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return false;
    return ground[gy * w + gx] === 3;
  }

  // An expanding flat ring at a tile (top-down water ripple from a footfall).
  // scaleY-squashed so it reads as lying on the surface. Fired once per step
  // onto water (the settle point gates it — no per-frame spam). Cosmetic.
  waterRippleAt(gx, gy) {
    const c = new PIXI.Container();
    c.x = (gx + 0.5) * TILE; c.y = (gy + 0.62) * TILE;
    c.scale.y = 0.5; // flatten into the ground plane
    c.zIndex = gy; // under the character's foot (player zIndex = py + 0.5)
    const g = new PIXI.Graphics();
    c.addChild(g);
    this.props.addChild(c);
    let t = 0;
    const id = setInterval(() => {
      t += 0.05;
      g.clear();
      const fade = Math.max(0, 0.55 - t * 0.7);
      g.circle(0, 0, 3 + t * 26).stroke({ color: 0xbfeaff, width: 2, alpha: fade });
      g.circle(0, 0, 1 + t * 15).stroke({ color: 0xeaf8ff, width: 1.5, alpha: fade * 0.8 });
      if (t >= 0.8) { clearInterval(id); if (!c.destroyed) c.destroy({ children: true }); }
    }, 40);
  }

  // A small, short dust puff at a footfall on dry ground (the universal-terrain
  // mirror of the water ripple — every step gives tactile feedback). Subtle:
  // a few low-alpha motes that drift up and fade in ~0.35s. Cosmetic.
  dustPuffAt(gx, gy) {
    const c = new PIXI.Container();
    c.x = (gx + 0.5) * TILE; c.y = (gy + 0.88) * TILE;
    c.zIndex = gy; // just under the foot
    const g = new PIXI.Graphics();
    c.addChild(g);
    this.props.addChild(c);
    const motes = [];
    for (let i = 0; i < 4; i++) motes.push({ x: (i - 1.5) * 2.2, y: 0, vx: (i - 1.5) * 0.5, r: 1 + (i % 2) });
    let t = 0;
    const id = setInterval(() => {
      t += 0.05;
      g.clear();
      const fade = Math.max(0, 0.4 - t * 1.1);
      for (const m of motes) {
        m.x += m.vx; m.y -= 0.6;
        g.circle(m.x, m.y, m.r).fill({ color: 0xcabfa6, alpha: fade });
      }
      if (t >= 0.35) { clearInterval(id); if (!c.destroyed) c.destroy({ children: true }); }
    }, 40);
  }

  update(dt) {
    if (this.busy) { if (this.prompt) this.prompt.visible = false; return; }
    const input = this.game.input;
    if (this.moving && this.prompt) this.prompt.visible = false;

    // Tick weather animation + 주기 랜덤 로테이션.
    this.weather?.update(dt);
    if (this.weatherT !== undefined && (this.weatherT -= dt) <= 0) this.rollWeather();
    // 포탈 룬 패드 맥동 (잠긴 게이트는 더 낮은 밝기로 숨쉰다).
    for (const m of this.portalMarks || []) {
      m.t += dt * 2.4;
      const s = 1 + Math.sin(m.t) * 0.08;
      m.g.scale.set(s);
      m.g.alpha = (m.locked ? 0.45 : 0.8) + Math.sin(m.t) * 0.15;
    }

    // Eased camera follow (before far-blur so the RT captures the new position).
    this.followCamera(dt);

    // Billboard actors track the camera each frame (their projection depends on
    // world.x/y, which the eased follow just changed).
    if (TILT.enabled && this.map) { this.placePlayerSprite(); this.layoutActors(); this.updateSpotlight(); }

    // Parallax the backdrop ridges against the camera (nearer ridges move more),
    // so the distant mountains lag behind the playfield and read as far away.
    if (this.backdropOn && this._backLayers.length) {
      for (const L of this._backLayers) {
        if (L.factor && !L.g.destroyed) L.g.x = this.world.x * L.factor;
      }
      // Clouds drift on their own slow clock (wrapping seamlessly) + a faint parallax.
      const c = this._clouds;
      if (c && !c.g.destroyed) {
        c.drift -= c.speed * dt;
        if (c.drift <= -c.span) c.drift += c.span;
        c.g.x = this.world.x * c.factor + c.drift;
      }
    }

    // P3 point-light flicker — a gentle per-light sine so torches breathe.
    if (this.lightSprites.length) {
      this._lightT = (this._lightT || 0) + dt;
      for (const L of this.lightSprites) {
        if (!L.sp.destroyed) L.sp.alpha = L.base * (0.85 + 0.15 * Math.sin(this._lightT * 6 + L.phase));
      }
    }

    // Water shimmer — drifting highlight bands so ponds read as moving water.
    if (this._waterCells.length) { this._waterT = (this._waterT || 0) + dt; this.drawWater(this._waterT); }

    // Grass/reed sway — a gentle per-decal sine, PLUS a "part" that leans the
    // blade away from the player as they brush past (the world reacts to YOU —
    // the single most tactile "alive" cue in a top-down game). Parting decays
    // with distance so only nearby blades bend.
    if (this._swayDecals && this._swayDecals.length) {
      this._swayT = (this._swayT || 0) + dt;
      const pxp = (this.player.px + 0.5) * TILE, pyp = (this.player.py + 0.6) * TILE;
      const R = TILE * 1.4, R2 = R * R, PART = 0.55;
      for (const s of this._swayDecals) {
        if (s.g.destroyed) continue;
        let rot = s.amp * Math.sin(this._swayT * s.freq + s.phase);
        const dx = s.g.x - pxp, dy = s.g.y - pyp;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const close = 1 - Math.sqrt(d2) / R;          // 1 at the player, 0 at the rim
          rot += (dx >= 0 ? 1 : -1) * close * close * PART; // bend away (squared = sharper near)
        }
        s.g.rotation = rot;
      }
    }

    // Tilt-shift: refresh the blurred far band (tracks the camera each frame).
    this.updateFarBlur();

    // HD-2D camera tilt: render the world warped into a receding trapezoid.
    this.applyTilt();

    // Hidden caches: reveal (sparkle + fade-in) when the player steps adjacent.
    this.updateHiddenChests(dt);

    // Field monsters (symbol encounters): lerp visuals + step on a cadence.
    if (this.roamers.length) {
      for (const r of this.roamers) {
        r.px += (r.x - r.px) * Math.min(1, dt * 8);
        r.py += (r.y - r.py) * Math.min(1, dt * 8);
        this.placeRoamerSprite(r);
      }
      if (!this.moving) {
        this.roamerT += dt;
        if (this.roamerT >= 0.45) {
          this.roamerT = 0;
          const before = this.roamers.map((r) => r.x + ',' + r.y);
          const hit = stepRoamers(this.roamers, this.map, { x: this.player.x, y: this.player.y }, this.game.rng);
          if (hit) { this.triggerRoamer(hit); return; }
          // The world reacts to enemies too: ripple when a roamer steps onto water.
          this.roamers.forEach((r, i) => {
            if (before[i] !== r.x + ',' + r.y && this.isWaterTile(r.x, r.y)) this.waterRippleAt(r.x, r.y);
          });
        }
      }
    }

    if (this.moving) {
      this.moving.t += dt / MOVE_TIME;
      const k = Math.min(1, this.moving.t);
      this.player.px = this.moving.fromX + (this.moving.toX - this.moving.fromX) * k;
      this.player.py = this.moving.fromY + (this.moving.toY - this.moving.fromY) * k;
      this.placePlayerSprite();
      // Camera follows via followCamera(dt) at the top of update (eased, not snapped).
      this.updateMinimapPlayer();
      this.walkT += dt;
      const lead = this.game.runtime.party[0].refId;
      // 4-dir art: play the walk cycle matching the current facing (up/down get
      // their own vertical cycles now, not the side cycle).
      swapTexture(this.player.sprite, heroWalkUrl(lead, this.player.facing, Math.floor(this.walkT * 10)));
      if (k < 1) return; // still crossing the tile
      // Tile finished — settle. Instead of returning (which left a 1-frame gap
      // per tile = the "뚝뚝" stutter), fall through so a held direction chains
      // the next step seamlessly in this same frame.
      this.player.x = this.moving.toX; this.player.y = this.moving.toY;
      this.player.px = this.player.x; this.player.py = this.player.y;
      this.moving = null;
      this.revealMinimap(); // fog of war: light up the newly-reached tiles
      // Footfall feedback: a ripple on water, a small dust puff on dry ground.
      if (this.isWaterTile(this.player.x, this.player.y)) this.waterRippleAt(this.player.x, this.player.y);
      else this.dustPuffAt(this.player.x, this.player.y);
      // Retire the ambient control hint once the player has walked a bit.
      if (!this.game.tutHintDone) {
        this.game.tutHintMoves = (this.game.tutHintMoves || 0) + 1;
        if (this.game.tutHintMoves >= 8) { this.game.tutHintDone = true; this.hintLabel.visible = false; }
      }
      this.setPlayerDirSprite();   // settle on the static facing sprite
      this.placePlayerSprite();    // reset any bob offset
      this.arrive();
      // arrive() may have started a battle/dialog (busy) or warped via a portal.
      if (this.busy || this.moving || !this.map) return;
    }

    // Idle: show the interaction prompt for whatever the player faces.
    this.updatePrompt();
    if (input.pressed('confirm')) { this.interact(); return; }
    if (input.pressed('cancel')) { this.busy = true; this.game.openMenu(); return; }
    if (input.pressed('quest')) { this.busy = true; this.game.openMenu('quests'); return; } // Q → quest log

    const d = input.dir();
    if (d) {
      if (this.player.dir !== d.dir) {
        this.player.dir = d.dir;
        this.player.facing = d.dir; // 4-dir: sprite faces the actual input direction
        this.setPlayerDirSprite();
      }
      // Step on the initial press; only auto-repeat (continuous walk) once the
      // key has been held past REPEAT_DELAY. A quick tap moves exactly one tile.
      const action = { north: 'up', south: 'down', west: 'left', east: 'right' }[d.dir];
      const tapped = input.pressed(action);
      const walking = input.heldFor(action) >= REPEAT_DELAY;
      if (tapped || walking) {
        const res = tryMove(this.map, { x: this.player.x, y: this.player.y }, d.dx, d.dy, this.game.rng);
        if (res.moved) {
          this.pending = res;
          this.moving = { fromX: this.player.x, fromY: this.player.y, toX: res.x, toY: res.y, t: 0 };
          this.game.audio?.play('step');
        }
      }
    }
  }

  arrive() {
    this.persistPos();
    const res = this.pending; this.pending = null;
    // Boss tile?
    const obj = objectAt(this.map, this.player.x, this.player.y);
    if (obj && obj.kind === 'boss' && !this.game.runtime.flags[obj.flag || 'bossDefeated']) {
      this.busy = true;
      this.game.startBossEncounter(obj, this.map.tileset);
      return;
    }
    // Walked onto a field monster → battle.
    const rm = roamerAt(this.roamers, this.player.x, this.player.y);
    if (rm) { this.triggerRoamer(rm); return; }
    if (res && res.portal) {
      // Gated portals (e.g. frost gate behind the boss) refuse until unlocked.
      if (res.portal.requires && !this.game.runtime.flags[res.portal.requires]) {
        this.busy = true;
        this.game.openDialog(res.portal.lockedTalk || 'frost_gate');
        return;
      }
      this.loadMap(res.portal.to, res.portal.tx, res.portal.ty, this.player.dir);
      return;
    }
    // Step-on trigger (switch / warp / forced encounter). PURE resolveTrigger
    // computes the effect; applyTrigger does the Pixi/runtime side.
    if (obj && obj.kind === 'trigger') {
      const eff = resolveTrigger(this.map, obj, { rng: this.game.rng, fired: this.firedTriggers, flags: this.game.runtime.flags });
      if (eff) {
        if (obj.once && !eff.locked) this.firedTriggers.add(eff.fireKey);
        this.applyTrigger(eff);
        return;
      }
    }
    // Random step-encounters only on maps without symbol (roamer) encounters.
    // capEncounter: 랜덤 조우는 파티 수+1 마리까지 (초반 솔로/듀오 완화).
    if (res && res.encounter && !this.map.symbolEncounters) {
      this.busy = true;
      this.game.startBattle(capEncounter(res.encounter, this.activePartySize()), this.map.tileset);
    }
  }

  // 출전 인원 수 (조우 규모 캡 기준) — active 라인업, 없으면 파티 전체.
  activePartySize() {
    const rt = this.game.runtime;
    return (rt.active && rt.active.length) || (rt.party && rt.party.length) || 1;
  }

  // Apply a resolved trigger effect (the impure half of the trigger seam).
  //   openWall → open map.toggleWalls[id] cells (collision + structural), redraw
  //   warpTo   → cross-map loadMap, or in-map teleport (no re-trigger at dest)
  //   encounter→ forced battle
  applyTrigger(eff) {
    // Flag-gated and the player lacks the key → show the locked line, stay put.
    if (eff.locked) {
      if (eff.msg) { this.busy = true; this.game.showLines('', [eff.msg], () => this.game.resumeField()); }
      return;
    }
    if (eff.openWall) {
      const cells = (this.map.toggleWalls && this.map.toggleWalls[eff.openWall]) || [];
      for (const c of cells) {
        const k = c.y * this.map.w + c.x;
        this.map.collision[k] = 0;      // movement (canMove reads this)
        this.structCollision[k] = 0;    // rendering (buildWalls/minimap read this)
      }
      this.buildWalls();
      this.buildMinimap();
      this.game.audio?.play('buy');
      if (eff.msg) { this.busy = true; this.game.showLines('', [eff.msg], () => this.game.resumeField()); }
      return;
    }
    if (eff.warpTo) {
      this.game.audio?.play('step');
      if (eff.warpTo.to) {
        // Cross-map warp. loadMap resets pending/firedTriggers, so no re-fire.
        this.loadMap(eff.warpTo.to, eff.warpTo.x, eff.warpTo.y, this.player.dir);
      } else {
        // In-map teleport. Snap position WITHOUT re-running arrive() — the
        // destination tile's trigger (if any) does not chain-fire.
        this.player.x = eff.warpTo.x; this.player.y = eff.warpTo.y;
        this.player.px = this.player.x; this.player.py = this.player.y;
        this.placePlayerSprite();
        this.centerCamera();
        this.updateMinimapPlayer();
        this.persistPos();
      }
      return;
    }
    if (eff.encounter) {
      this.busy = true;
      this.game.startBattle(eff.encounter, this.map.tileset);
    }
  }

  interact() {
    // Tile the player faces.
    const delta = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[this.player.dir];
    const fx = this.player.x + delta[0], fy = this.player.y + delta[1];
    const obj = objectAt(this.map, fx, fy);
    if (!obj) return;
    if (obj.kind === 'chest') { this.openChest(obj); return; }
    // Quest giver NPC (offer / progress / turn-in) — drives its own dialog.
    if (obj.quest) { this.busy = true; this.game.talkQuest(obj.quest); return; }
    // Facing a not-yet-defeated boss and confirming ENGAGES it (intro → fight),
    // exactly like stepping onto its tile. Without this, interact only showed the
    // intro and closed, so a player who approached a boss from the side (e.g. the
    // swamp boss, with the empire exit now east of it) could face it and press Z
    // forever — the intro just looped and the fight never started. The intro is
    // still shown (startBossEncounter plays it before the battle). Defeated → noop.
    if (obj.kind === 'boss') {
      if (!this.game.runtime.flags[obj.flag || 'bossDefeated']) {
        this.busy = true;
        this.game.startBossEncounter(obj, this.map.tileset);
      }
      return;
    }
    if (obj.talk) {
      this.busy = true;
      this.game.openDialog(obj.talk, obj);
    }
  }

  chestId(o) { return `${this.map.id}:${o.x},${o.y}`; }

  openChest(o) {
    const id = this.chestId(o);
    this.busy = true;
    if (this.game.runtime.openedChests.includes(id)) {
      this.game.showLines('', ['텅 빈 상자다.'], () => this.game.resumeField());
      return;
    }
    this.game.runtime.openedChests.push(id);
    let msg = '보물상자!';
    // A `loot.flag` chest grants a persistent progression flag (e.g. a key that a
    // `requires:` door opens on). The flag MUST be whitelisted in save.js
    // (freshSave + validateSave) or it silently dies on reload.
    if (o.loot && o.loot.flag) this.game.runtime.flags[o.loot.flag] = true;
    if (o.loot && o.loot.gold) {
      this.game.runtime.gold += o.loot.gold;
      msg = `보물상자를 열었다 — ${o.loot.gold} 골드!`;
    } else if (o.loot && o.loot.item) {
      const it = getItem(o.loot.item);
      this.game.runtime.inventory[o.loot.item] = (this.game.runtime.inventory[o.loot.item] || 0) + 1;
      msg = `보물상자를 열었다 — ${it ? it.name : o.loot.item}!`;
    } else if (o.loot && o.loot.flag) {
      msg = o.loot.msg || '열쇠를 손에 넣었다!';
    }
    this.game.audio?.play('buy');
    this.game.saveNow();
    // collect cond 반영 후 퀘스트라인 tick — 전진 메시지는 상자 메시지에 잇는다.
    const qlMsgs = this.game.tickQuestlines?.({ collect: true }) || [];
    // resumeField (on dialog close) rebuilds objects → chest renders opened.
    this.game.showLines('', [msg, ...qlMsgs], () => this.game.resumeField());
  }

  resize() {
    const { w, h } = this.game.renderer.screen;
    this.weather?.resize(w, h);
    if (this.map) this.buildBackdrop(); // re-fit sky/mountains + world mask to the new screen
    this.buildEdgeFade(); // 엣지 포그도 새 화면 크기에 재구축
    this.centerCamera();
    if (this.map) this.buildMinimap();
    this.placeHint();
  }
}

function getMapBossSprite(refId) {
  // Use the monster's own `sprite` field — the SAME key the battle scene renders
  // via enemyUrl(unit.sprite) — so a field boss always matches its battle art
  // (e.g. werewolf_king → boss_werewolf_king, frost_queen → boss_ice_queen,
  // bridge_warden → rune_guardian). Falls back to the refId for any stray case.
  return getMonster(refId)?.sprite || refId;
}

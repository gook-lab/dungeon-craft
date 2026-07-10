// Renderer — the ONLY module that imports PixiJS. Owns the Application, a root
// container that scenes attach to, and a synchronous-ish PNG texture loader
// (Image → canvas → CanvasSource, nearest-neighbor) mirroring game's pngTexture
// pattern: the sprite is created immediately with a blank texture that fills in
// when the image finishes loading, so callers never await.

import * as PIXI from 'pixi.js';

const texCache = new Map(); // url -> PIXI.Texture (source rebinds on load)

export async function createRenderer(mount) {
  const app = new PIXI.Application();
  await app.init({
    background: '#1a1420',
    resizeTo: window,
    antialias: false,
    roundPixels: true,
  });
  mount.appendChild(app.canvas);

  const root = new PIXI.Container();
  app.stage.addChild(root);

  return {
    app,
    root,
    PIXI,
    get screen() { return { w: app.renderer.width, h: app.renderer.height }; },
    sprite: makeSprite,
    swapTexture,
  };
}

// Load (once) a correctly-sized canvas-backed texture. The canvas is sized to
// the image BEFORE the texture is created — the same pattern loadSheet() uses,
// which is the only reliable way to get pixel-art textures in Pixi v8 (resizing
// a 1×1 source in place does not work). Calls cb(tex|null) when ready.
function ensureTexture(url, cb) {
  const hit = texCache.get(url);
  if (hit) { cb(hit); return; }
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const tex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv, scaleMode: 'nearest' }) });
    texCache.set(url, tex);
    cb(tex);
  };
  img.onerror = () => cb(null);
  img.src = url;
}

// A Sprite whose texture fills in when the image loads (transparent until then).
// `onTex(tex, sp)` fires once the real texture is in — used to size props by their
// actual native pixel height (props ship at 48/64/96/192px and must not be assumed).
export function makeSprite(url, { anchorX = 0.5, anchorY = 0.5, onTex } = {}) {
  const sp = new PIXI.Sprite();
  sp.anchor.set(anchorX, anchorY);
  ensureTexture(url, (tex) => { if (tex && !sp.destroyed) { sp.texture = tex; if (onTex) onTex(tex, sp); } });
  return sp;
}

// A soft elliptical ground-shadow texture (radial fade), baked once into a
// nearest-canvas texture. Placed under field/battle entities so nothing floats
// off the floor. Mirrors the sibling game's drop-shadow blob. Callers set
// width/height + alpha per entity. 64×24 = a flat wide ellipse.
let _shadowTex = null;
export function shadowTexture() {
  if (_shadowTex) return _shadowTex;
  const W = 64, H = 24;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.42)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  _shadowTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv, scaleMode: 'nearest' }) });
  return _shadowTex;
}

// Swap a sprite's texture to a different url (facing change), deferred-safe.
export function swapTexture(sprite, url) {
  ensureTexture(url, (tex) => { if (tex && !sprite.destroyed) sprite.texture = tex; });
}

// Warm the cache so a later swapTexture is instant (e.g. preload attack frames).
export function preload(url) { ensureTexture(url, () => {}); }

const sheetCache = new Map(); // url -> Promise<Texture[]>

// Slice a tile sheet (cols×rows of tilePx) into individual nearest-neighbor
// textures, each backed by its own canvas so there are no frame/source timing
// issues. Returns a Promise resolving to a flat Texture[] in row-major order.
export function loadSheet(url, tilePx) {
  if (sheetCache.has(url)) return sheetCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cols = Math.floor(img.width / tilePx);
      const rows = Math.floor(img.height / tilePx);
      const tiles = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cv = document.createElement('canvas');
          cv.width = tilePx; cv.height = tilePx;
          const ctx = cv.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, c * tilePx, r * tilePx, tilePx, tilePx, 0, 0, tilePx, tilePx);
          tiles.push(new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv, scaleMode: 'nearest' }) }));
        }
      }
      resolve(tiles);
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
  sheetCache.set(url, p);
  return p;
}

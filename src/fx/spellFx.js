// Battle spell-effect engine — a PixiJS v8 port of the share2 `spellfx` prototype
// (low-res pixel-canvas particle/beam/flash engine). Code-drawn only; NO new art.
//
// Faithful 1:1 port strategy: the engine runs in the prototype's LOW-RES LOGICAL
// space (1 logical px = LO screen px). The owning scene puts the particle/beam
// layer inside a container scaled by LO, so every tuned constant from the
// prototype (sizes, velocities, gravity, beam widths) reproduces at the right
// on-screen scale without any retuning. The scene converts real unit positions to
// logical coords (÷ LO) when it calls play().
//
// Layering (set up by battleScene):
//   - fxLayer  (scale LO, inside fieldLayer, above sprites): particles + beams + floats
//   - tintG / flashG (unscaled, full-screen, above units & below the panel): persistent
//     colour wash + impact flash.
//
// The engine never draws unit sprites (the game already shows them) and never
// touches save/state — it is a pure cosmetic layer, skipped entirely in the
// headless balance harness (battleScene only constructs it when a renderer exists).

import * as PIXI from 'pixi.js';

export const LO = 4; // logical px → screen px (matches prototype)

const rnd = (a, b) => a + Math.random() * (b - a);

// Element palette — lifted verbatim from spellfx-defs.js so colours match.
export const PAL = {
  fireDeep: '#7a1f0a', fireR: '#e25563', fireY: '#f0c44c', fireW: '#fff0b8',
  ice: '#56a8e8', iceW: '#eaf6ff', iceP: '#bfe6ff',
  thunder: '#fff0b8', thunderP: '#b483f0', thunderB: '#9ad6ff',
  poison: '#9ad94f', poisonD: '#6fae2e',
  gold: '#ffd766', goldGlow: '#fff0b8', goldDeep: '#c98b2c',
  heal: '#62c46a', healW: '#eafbe8',
  red: '#e25563', shield: '#56a8e8', shieldW: '#cfe0ff',
  sleep: '#b59cff', sleepW: '#e6dcff',
  earth: '#c98b2c', earthD: '#7a5224', earthDk: '#5a3c18', dust: '#b9b48f',
  wind1: '#dff5e8', wind2: '#a8e6c8', leaf1: '#6fae2e', leaf2: '#c98b2c', leaf3: '#9ad94f',
  darkSmoke: '#241a3a', darkSmoke2: '#3a2c5a', wisp: '#b59cff', star: '#9ad6ff',
};

const MAX_PARTICLES = 520; // hard cap (perf backstop)

export class SpellFx {
  // opts: { fxLayer (scaled container), tintG, flashG, screen:{w,h}, shake(amt), audio(name) }
  constructor(opts) {
    this.fxLayer = opts.fxLayer;
    this.tintG = opts.tintG;
    this.flashG = opts.flashG;
    this.screen = opts.screen;
    this.shakeCb = opts.shake || (() => {});
    this.audioCb = opts.audio || (() => {});

    // Logical dimensions (prototype space).
    this.W = Math.round(this.screen.w / LO);
    this.H = Math.round(this.screen.h / LO);
    this.groundY = Math.round((this.screen.h * 0.58) / LO);

    this.particles = [];
    this.beams = [];
    this.floats = [];
    this.scheduled = [];
    this.flash = null;     // { color, a }
    this.bgTint = null;    // { color, a, life, max }
    this._shakeAccum = 0;

    // Two Graphics: normal + additive (blendMode 'add' ≈ canvas 'lighter').
    this.gNorm = new PIXI.Graphics();
    this.gAdd = new PIXI.Graphics();
    this.gAdd.blendMode = 'add';
    this.fxLayer.addChild(this.gNorm, this.gAdd);

    this.effect = null;
    this.caster = { x: 0, y: 0, hop: 0 };
    this.partner = null;  // 2nd origin for 인연공격 duo choreographies (null = solo cast)
    this.partners = [];   // all co-caster origins for trio/quad 필살기 ([] = solo/duo)
    this.enemies = [];
  }

  // --- prototype-compatible primitive helpers (logical coords) -------------
  p(o) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 1, max: 1,
      size: 1, color: '#fff', fade: true, shrink: false, flick: null,
      additive: false, streak: 0, head: false, headColor: null,
    }, o));
  }
  beam(o) {
    this.beams.push(Object.assign({
      x1: 0, y1: 0, x2: 0, y2: 0, life: 0.2, max: 0.2, color: '#fff',
      width: 1, jag: 0, seed: Math.random() * 99,
    }, o));
  }
  floatSpr(o) { this.floats.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, max: 1, _w: 0 }, o)); }
  doFlash(color, a) { this.flash = { color, a: a == null ? 0.8 : a }; }
  doShake(amt) { this._shakeAccum = Math.max(this._shakeAccum, amt); }
  tint(color, a, dur) { this.bgTint = { color, a, life: dur, max: dur }; }
  schedule(delay, fn) { this.scheduled.push({ t: delay, fn }); }

  targets() { return this.enemies; }
  primary() { return this.enemies[0]; }

  // Begin a spell. caster/enemies are { x, y } in LOGICAL coords. Resets pools so
  // a new cast cleanly supersedes any lingering effect (turns are sequential).
  play(spellId, { caster, enemies, partner, partners }) {
    this.particles.length = 0; this.beams.length = 0; this.floats.length = 0;
    this.scheduled.length = 0; this.flash = null; this.bgTint = null;
    this.caster = Object.assign({ hop: 0 }, caster);
    // partner / partners: optional co-caster origins (인연공격/필살기). Reset every cast
    // so a solo spell never reads a stale origin from a prior combo.
    this.partner = partner ? Object.assign({ hop: 0 }, partner) : null;
    this.partners = (partners || []).map((p) => Object.assign({ hop: 0 }, p));
    this.enemies = (enemies || []).map((e) => Object.assign({ flinch: 0, tint: 0 }, e));
    const factory = DEFS[spellId] || DEFS._default;
    this.effect = factory(this);
    this.effect._t = 0;
  }

  update(dt) {
    if (dt > 0.05) dt = 0.05;
    // scheduled (setTimeout replacement)
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const s = this.scheduled[i];
      s.t -= dt;
      if (s.t <= 0) { this.scheduled.splice(i, 1); try { s.fn(); } catch (e) { /* keep going */ } }
    }
    // current effect
    if (this.effect) {
      this.effect._t += dt;
      if (this.effect.update) this.effect.update(dt, this.effect._t);
      if (this.effect.done && this.effect.done(this.effect._t)) this.effect = null;
    }
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    // beams
    for (let i = this.beams.length - 1; i >= 0; i--) { const b = this.beams[i]; b.life -= dt; if (b.life <= 0) this.beams.splice(i, 1); }
    // floats
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const s = this.floats[i]; s.life -= dt;
      if (s.life <= 0) { this.floats.splice(i, 1); continue; }
      s.vy += (s.g || 0) * dt; s.x += s.vx * dt; s.y += s.vy * dt; s._w += dt;
    }
    // flash / shake / tint
    if (this.flash) { this.flash.a -= dt * 3.2; if (this.flash.a <= 0) this.flash = null; }
    if (this._shakeAccum > 0) {
      // Route to the scene shake once per accumulation: amt(logical) → px,ms.
      this.shakeCb(this._shakeAccum * LO * 0.7, 130);
      this._shakeAccum = 0;
    }
    if (this.bgTint) { this.bgTint.life -= dt; if (this.bgTint.life <= 0) this.bgTint = null; }

    this.redraw();
  }

  redraw() {
    const gN = this.gNorm, gA = this.gAdd;
    gN.clear(); gA.clear();

    // beams (additive)
    for (const b of this.beams) {
      const a = b.life / b.max;
      if (b.jag > 0) {
        const segs = 8;
        let px = b.x1, py = b.y1;
        gA.moveTo(px, py);
        for (let i = 1; i <= segs; i++) {
          const tt = i / segs;
          const jx = Math.sin(b.seed + i * 1.7) * b.jag * (1 - Math.abs(tt - 0.5) * 1.2);
          px = b.x1 + (b.x2 - b.x1) * tt + jx; py = b.y1 + (b.y2 - b.y1) * tt;
          gA.lineTo(px, py);
        }
      } else {
        gA.moveTo(b.x1, b.y1).lineTo(b.x2, b.y2);
      }
      gA.stroke({ color: b.color, width: b.width, alpha: a, cap: 'round' });
    }

    // particles
    for (const p of this.particles) {
      const a = p.fade ? Math.max(0, p.life / p.max) : 1;
      let col = p.color;
      if (p.flick) col = p.flick[Math.floor((1 - p.life / p.max) * p.flick.length * 0.999)] || col;
      const g = p.additive ? gA : gN;
      if (p.streak) {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const ux = p.vx / sp, uy = p.vy / sp;
        g.moveTo(p.x, p.y).lineTo(p.x - ux * p.streak, p.y - uy * p.streak)
          .stroke({ color: col, width: p.size || 1, alpha: a });
        if (p.head) { const s = (p.size || 1); g.rect(p.x - s, p.y - s, s * 2, s * 2).fill({ color: p.headColor || col, alpha: a }); }
        continue;
      }
      const sz = p.shrink ? Math.max(1, p.size * (p.life / p.max)) : p.size;
      g.rect(p.x - sz / 2, p.y - sz / 2, sz, sz).fill({ color: col, alpha: a });
    }

    // floats (custom pixel shapes)
    for (const s of this.floats) this.drawFloat(s);

    // full-screen overlays (unscaled)
    const { w, h } = this.screen;
    this.tintG.clear();
    if (this.bgTint) this.tintG.rect(0, 0, w, h).fill({ color: this.bgTint.color, alpha: this.bgTint.a * (this.bgTint.life / this.bgTint.max) });
    this.flashG.clear();
    if (this.flash) this.flashG.rect(0, 0, w, h).fill({ color: this.flash.color, alpha: Math.max(0, this.flash.a) });
  }

  // Typed float shapes (ports of the prototype's canvas draw callbacks).
  drawFloat(s) {
    const a = Math.max(0, s.life / s.max);
    const k = 1 - s.life / s.max;
    if (s.kind === 'cross') {
      this.gAdd.rect(s.x - 0.5, s.y - 2, 1, 4).rect(s.x - 2, s.y - 0.5, 4, 1).fill({ color: PAL.healW, alpha: a });
    } else if (s.kind === 'ring') {
      this.gAdd.circle(s.x, s.y, (s.r0 || 4) + k * (s.grow || 22)).stroke({ color: s.col || PAL.gold, width: 1, alpha: a });
    } else if (s.kind === 'hex') {
      const ap = Math.min(1, (s.max - s.life) * 4) * (s.life > 0.3 ? 1 : s.life / 0.3);
      const R = 13; const pts = [];
      for (let i = 0; i <= 6; i++) { const ang = -Math.PI / 2 + i * Math.PI / 3; pts.push(s.x + Math.cos(ang) * R * 0.7, s.y + Math.sin(ang) * R); }
      this.gAdd.poly(pts).fill({ color: PAL.shield, alpha: ap * 0.18 });
      this.gAdd.poly(pts).stroke({ color: PAL.shieldW, width: 1, alpha: ap * 0.85 });
    } else if (s.kind === 'note' || s.kind === 'zee') {
      const wob = Math.sin(s._w * 6) * 3;
      const x = s.x + wob, y = s.y, col = s.col;
      const aa = Math.min(1, a + 0.2);
      if (s.kind === 'note') this.gAdd.rect(x - 1, y - 3, 2, 5).rect(x + 1, y - 4, 2, 2).rect(x - 2, y + 2, 3, 2).fill({ color: col, alpha: aa });
      else this.gAdd.rect(x - 2, y - 2, 5, 1).rect(x + 1, y - 1, 1, 1).rect(x, y, 1, 1).rect(x - 2, y + 1, 5, 1).fill({ color: col, alpha: aa });
    } else if (s.kind === 'blade') {
      const x = s.x, y = s.y, al = Math.min(1, a + 0.4);
      this.gAdd.rect(x - 5, y - 40, 10, 44).fill({ color: PAL.fireW, alpha: al * 0.35 }); // glow
      this.gNorm.rect(x - 2, y - 38, 4, 38).fill({ color: '#fff0b8', alpha: al });   // blade
      this.gNorm.rect(x - 1, y - 36, 2, 34).fill({ color: '#ffffff', alpha: al });   // highlight
      this.gNorm.rect(x - 9, y - 30, 18, 3).fill({ color: '#ffd766', alpha: al });   // guard
      this.gNorm.rect(x - 1, y - 44, 2, 8).fill({ color: '#c98b2c', alpha: al });    // grip
      this.gNorm.rect(x - 3, y - 46, 6, 3).fill({ color: '#fff0b8', alpha: al });    // pommel
    } else if (s.kind === 'arrowUp') {
      this.gAdd.poly([s.x, s.y - 3, s.x - 2, s.y + 1, s.x + 2, s.y + 1]).fill({ color: s.col || PAL.gold, alpha: a });
    } else if (s.kind === 'arrowDown') {
      this.gAdd.poly([s.x, s.y + 3, s.x - 2, s.y - 1, s.x + 2, s.y - 1]).fill({ color: s.col || PAL.gold, alpha: a });
    } else if (s.kind === 'sneakMark') {
      this.gAdd.rect(s.x - 3, s.y - 1, 2, 2).fill({ color: '#b483f0', alpha: a });
      this.gAdd.rect(s.x + 1, s.y - 1, 2, 2).fill({ color: '#e6dcff', alpha: a });
      this.gAdd.rect(s.x - 1, s.y + 1, 2, 2).fill({ color: PAL.gold, alpha: a });
    } else if (s.kind === 'overMark') {
      const pts = []; for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2; pts.push(s.x + Math.cos(ang) * 4, s.y + Math.sin(ang) * 4); }
      this.gAdd.poly(pts).fill({ color: PAL.fireW, alpha: a });
    } else if (s.kind === 'eye') {
      this.gAdd.circle(s.x, s.y, 2).fill({ color: s.col || '#e6dcff', alpha: a });
      this.gAdd.circle(s.x - 1, s.y - 1, 1).fill({ color: '#0a0612', alpha: a });
    } else if (s.kind === 'reticle') {
      const r = s.r || 8;
      this.gAdd.circle(s.x, s.y, r).stroke({ color: s.col || PAL.gold, width: 1, alpha: a });
      this.gAdd.rect(s.x - 0.5, s.y - 2, 1, 4).fill({ color: s.col || PAL.gold, alpha: a });
      this.gAdd.rect(s.x - 2, s.y - 0.5, 4, 1).fill({ color: s.col || PAL.gold, alpha: a });
    } else if (s.kind === 'trap') {
      const pts = [s.x - 4, s.y - 2, s.x + 4, s.y - 2, s.x + 6, s.y, s.x + 4, s.y + 2, s.x - 4, s.y + 2, s.x - 6, s.y];
      this.gAdd.poly(pts).stroke({ color: '#9aa3c8', width: 1, alpha: a });
    } else if (s.kind === 'critMark') {
      this.gAdd.rect(s.x - 1.5, s.y - 3, 3, 6).fill({ color: PAL.red, alpha: a });
      this.gAdd.circle(s.x - 3, s.y - 1, 1).fill({ color: PAL.red, alpha: a });
    } else if (s.kind === 'magicCircle') {
      const r = (s.k || 0) * 16;
      this.gAdd.circle(s.x, s.y, r).stroke({ color: '#b483f0', width: 1, alpha: a * 0.7 });
      if (r > 4) {
        this.gAdd.circle(s.x, s.y, r * 0.6).stroke({ color: PAL.fireW, width: 1, alpha: a * 0.5 });
      }
    } else if (s.kind === 'shieldMark') {
      const pts = [s.x - 3, s.y - 4, s.x + 3, s.y - 4, s.x + 3, s.y + 4, s.x - 3, s.y + 4];
      this.gAdd.poly(pts).stroke({ color: PAL.shieldW, width: 1, alpha: a });
    } else if (s.kind === 'star4') {
      const pts = [s.x, s.y - 4, s.x + 3, s.y - 1, s.x + 4, s.y, s.x + 3, s.y + 1, s.x, s.y + 4, s.x - 3, s.y + 1, s.x - 4, s.y, s.x - 3, s.y - 1];
      this.gAdd.poly(pts).fill({ color: s.col || '#eafcf8', alpha: a });
    }
  }

  destroy() {
    if (this.gNorm && !this.gNorm.destroyed) this.gNorm.destroy();
    if (this.gAdd && !this.gAdd.destroyed) this.gAdd.destroy();
    this.particles.length = 0; this.beams.length = 0; this.floats.length = 0;
  }
}

// ===========================================================================
// Shared choreography helpers (ports of burst / projectile / aoe).
// ===========================================================================
function burst(S, x, y, cols, n, spd, opts) {
  opts = opts || {};
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(spd * 0.4, spd);
    S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), g: opts.g || 0, drag: 0.92,
      life: rnd(0.25, 0.6), max: 0.6, size: opts.size || 2, color: cols[i % cols.length],
      shrink: opts.shrink !== false, additive: opts.additive });
  }
}

// 쌍검사(duelist) helpers — 총구 화염 + 탄피 + 탄환 트레이서 + 출혈 핏방울.
const DL = { steel: '#dfe4f2', spark: '#fff0b8', blood: '#e25563', bloodD: '#7a1f0a', fire: '#f0c44c' };
// One bullet/shot: muzzle flash at `from`, a fast tracer streak, and an impact spray
// at the target. col defaults to a steel/gold round.
function gunshot(S, from, to, col) {
  col = col || DL.spark;
  S.p({ x: from.x, y: from.y, life: 0.08, max: 0.08, size: 3, color: DL.spark, additive: true }); // muzzle flash
  for (let i = 0; i < 3; i++) S.p({ x: from.x, y: from.y, vx: rnd(-30, 30), vy: rnd(10, 40), g: 120, life: 0.4, max: 0.4, size: 1, color: DL.fire, additive: true }); // 탄피
  const sp = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / sp, uy = (to.y - from.y) / sp;
  S.p({ x: from.x, y: from.y, vx: ux * 280, vy: uy * 280, life: 0.1, max: 0.1, size: 1, color: col, streak: 11, head: true, headColor: '#fff', fade: false }); // tracer
  S.schedule(0.06, () => burst(S, to.x, to.y - 9, [col, '#fff', DL.fire], 8, 100, { additive: true }));
}
// 출혈 핏방울 — 대상 위에서 붉은 방울이 튀어 흩어진다.
function bloodDrops(S, x, y) {
  for (let i = 0; i < 9; i++) S.p({ x, y: y - 9, vx: rnd(-50, 50), vy: rnd(-30, 10), g: 200, drag: 0.96, life: rnd(0.3, 0.6), max: 0.6, size: 2, color: i % 2 ? DL.blood : DL.bloodD });
  S.floatSpr({ kind: 'ring', x, y: y - 9, life: 0.4, max: 0.4, r0: 2, grow: 14, col: DL.blood });
}

function projectile(S, target, opts, onHit) {
  const from = { x: S.caster.x + 6, y: S.caster.y - 9 };
  const to = { x: target.x, y: target.y - 9 };
  let t = 0; const dur = opts.dur || 0.34; let hit = false;
  return {
    update(dt) {
      t += dt; const k = Math.min(1, t / dur);
      const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * (opts.arc || 0);
      S.p({ x, y, vx: rnd(-4, 4), vy: rnd(-4, 4), life: rnd(0.12, 0.28), max: 0.28, size: opts.size || 2, color: opts.trail[Math.floor(Math.random() * opts.trail.length)], shrink: true, additive: true });
      if (opts.core) S.p({ x, y, life: 0.08, max: 0.08, size: (opts.size || 2) + 1, color: opts.core, additive: true });
      if (k >= 1 && !hit) { hit = true; onHit(x, y); }
    },
  };
}

function arrow(S, from, to, dur, onHit) {
  let t = 0; let hit = false;
  return {
    update(dt) {
      t += dt; const k = Math.min(1, t / dur);
      const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k;
      const sp = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const ux = (to.x - from.x) / sp, uy = (to.y - from.y) / sp;
      S.p({ x, y, vx: ux * 200, vy: uy * 200, life: 0.12, max: 0.12, size: 1, color: PAL.gold, streak: 8, head: true, headColor: '#fff0b8', fade: false });
      if (k >= 1 && !hit) { hit = true; onHit(x, y); }
    },
  };
}

function rageBurst(S, x, y) {
  burst(S, x, y, [PAL.red, '#ff8a5a', '#7a1f0a'], 14, 120, { additive: true, up: 6 });
  for (let i = 0; i < 6; i++) S.p({ x: x + rnd(-4, 4), y: y + rnd(-4, 4), vy: rnd(20, 50), g: 60, life: 0.5, max: 0.5, size: 2, color: '#9a1020' });
  S.floatSpr({ kind: 'arrowUp', x, y: y - 16, vy: -12, life: 0.7, max: 0.7, col: PAL.red });
}

function sneakBurst(S, x, y) {
  burst(S, x, y, ['#e6dcff', '#b483f0', PAL.gold, '#fff'], 18, 160, { additive: true, size: 3 });
  S.floatSpr({ kind: 'sneakMark', x, y: y - 16, vy: -14, life: 0.7, max: 0.7 });
  S.floatSpr({ kind: 'ring', x, y, life: 0.7, max: 0.7, r0: 4, grow: 26, col: '#b483f0' });
}

function chargeBurst(S, x, y) {
  burst(S, x, y, [PAL.fireW, '#e6dcff', '#b483f0', '#fff'], 20, 160, { additive: true, size: 3, up: 6 });
  S.floatSpr({ kind: 'overMark', x, y: y - 16, vy: -14, life: 0.8, max: 0.8 });
  S.floatSpr({ kind: 'ring', x, y, life: 0.8, max: 0.8, r0: 4, grow: 28, col: PAL.fireW });
}

const castHop = (S) => { S.caster.hop = 4; };

// Field generators (full-screen weather-style particle bands).
function rainField(S, dt, o) {
  const n = Math.round((o.rate || 70) * dt);
  for (let i = 0; i < n; i++) S.p({ x: rnd(-6, S.W * 1.15), y: rnd(-8, S.H * 0.25), vx: o.vx || -14, vy: o.vy || 280, life: 0.6, max: 0.6, size: o.size || 1, color: o.color, streak: o.streak || 7, head: o.head, headColor: o.headColor, additive: o.additive, fade: false });
}
function snowField(S, dt, o) {
  const n = Math.round((o.rate || 46) * dt);
  for (let i = 0; i < n; i++) S.p({ x: rnd(-4, S.W), y: rnd(-6, 2), vx: rnd(-14, 14), vy: rnd(34, 74), life: 2.2, max: 2.2, size: (rnd(1, 3) | 0) || 1, color: Math.random() < 0.5 ? o.color : o.color2, fade: false });
}
function emberField(S, dt, o) {
  const n = Math.round((o.rate || 30) * dt);
  for (let i = 0; i < n; i++) S.p({ x: rnd(0, S.W), y: rnd(S.H * 0.7, S.H + 6), vx: rnd(-8, 8), vy: -rnd(26, 64), life: rnd(0.8, 1.6), max: 1.6, size: (rnd(1, 3) | 0) || 1, color: [o.c1, o.c2, o.c3][i % 3], additive: true, shrink: true });
}
function fogField(S, dt, o) {
  const n = Math.round((o.rate || 16) * dt);
  for (let i = 0; i < n; i++) S.p({ x: rnd(0, S.W), y: rnd(S.H * 0.4, S.H), vx: rnd(-10, 10), vy: -rnd(3, 12), life: rnd(0.7, 1.4), max: 1.4, size: (rnd(3, 6) | 0), color: Math.random() < 0.5 ? o.color : o.color2, additive: true, shrink: true });
  if (Math.random() < 0.5) S.p({ x: rnd(0, S.W), y: rnd(S.H * 0.6, S.H), vy: -rnd(10, 22), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: o.color, additive: true, shrink: true });
}
function sandField(S, dt, o) {
  const n = Math.round((o.rate || 60) * dt);
  for (let i = 0; i < n; i++) S.p({ x: rnd(-10, 0), y: rnd(S.H * 0.2, S.groundY + 4), vx: rnd(180, 320), vy: rnd(-12, 12), life: 0.7, max: 0.7, size: (rnd(1, 3) | 0) || 1, color: [o.c1, o.c2, o.c3][i % 3], streak: rnd(5, 11), fade: false });
}

// Shared AoE skeleton: ambient field + per-target staggered strikes.
function aoe(S, cfg) {
  castHop(S); if (cfg.tint) S.tint(cfg.tint.c, cfg.tint.a, cfg.dur);
  const targets = S.targets();
  let t = 0; const next = targets.map(() => rnd(0.1, 0.5));
  return {
    update(dt) {
      t += dt;
      if (cfg.field) cfg.field(S, dt, t);
      if (cfg.ambient) cfg.ambient(S, dt, t);
      targets.forEach((e, i) => {
        next[i] -= dt;
        if (next[i] <= 0 && t < cfg.dur - 0.25) { next[i] = rnd(cfg.gap[0], cfg.gap[1]); cfg.strike(S, e, t); }
      });
    },
    done: (tt) => tt > cfg.dur,
  };
}

// Bestiary-2 monster-skill palette (ported from share4 spellfx-monster2 `C`).
// Per-sprite recolour (석화 grey / 공허 purple / 용암 red) is done SCENE-SIDE in
// battleScene.playMonsterSkillFx via SKILL_TINT (the engine runs in logical coords
// and can't reach the real sprites); these particle/beam/ring colours match it.
const MC2 = {
  void: '#b483f0', voidD: '#6a4fb0', voidDk: '#241a3a', voidW: '#e6dcff',
  stone: '#9a957c', stoneL: '#c4bda0', stoneD: '#5a5444',
  web: '#dfe4f2', webD: '#9aa3c8', sonic: '#cfe0ff',
  tongue: '#e86a8a', tongueD: '#b04060',
  fireDeep: '#7a1f0a', fireR: '#e25563', fireY: '#f0c44c', fireW: '#fff0b8',
  rally: '#e25563', rallyG: '#ffd766', claw: '#fff0b8',
};

// ===========================================================================
// DEFS — 26 spell choreographies (base 13 + AoE 6 + extended 4 + class ults 3).
// Ported from spellfx-{defs,aoe,ext,class}.js. Keyed by the game spell id.
// ===========================================================================
export const DEFS = {
  // generic fallback — a small elemental burst on the primary target
  _default(S) {
    const tgt = S.primary() || S.caster; let done = false;
    return { update() { if (!done) { done = true; burst(S, tgt.x, tgt.y - 9, [PAL.fireW, PAL.fireY, PAL.fireR], 18, 110, { additive: true, g: 40 }); S.doFlash(PAL.fireY, 0.3); S.doShake(2); } }, done: (tt) => tt > 0.8 };
  },

  // --- Behaviour-archetype monster skills (kamikaze / warcry / barrier) -------
  /* 자폭 — the caster flares, then detonates: a caster-centred fireball + ring
     that blasts every foe (FX_ALL_TARGET). Big flash + shake sells the suicide. */
  kamikaze(S) {
    const u = S.caster; const targets = S.targets(); let t = 0, blown = false;
    return {
      update(dt) {
        t += dt;
        // wind-up: sputtering embers gather before the blast
        if (t < 0.32 && Math.random() < 0.7) S.p({ x: u.x + rnd(-8, 8), y: u.y - 9 + rnd(-6, 6), vy: -rnd(20, 50), life: rnd(0.2, 0.5), max: 0.5, size: 2, color: Math.random() < 0.5 ? PAL.fireY : PAL.fireR, additive: true, shrink: true });
        if (t >= 0.32 && !blown) { blown = true;
          S.doFlash(PAL.fireW, 0.7); S.doShake(8);
          burst(S, u.x, u.y - 9, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 40, 200, { additive: true, g: 30, size: 3 });
          S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 9, life: 0.5, max: 0.5, r0: 4, grow: 84, col: PAL.fireY });
          u.tint = 1; u.flinch = 6;
          targets.forEach((e) => { e.flinch = 5; e.tint = 0.8; burst(S, e.x, e.y - 9, [PAL.fireW, PAL.fireY, PAL.fireR], 14, 120, { additive: true, up: 14 }); });
        }
      },
      done: (tt) => tt > 1.0,
    };
  },
  /* 전열 고무 — a rally aura: gold/red motes rise off the caster with an
     expanding ring + an upward arrow (buff), no target damage. */
  warcry(S) {
    castHop(S); const u = S.caster; let t = 0, beat = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.05) { S.doFlash(PAL.gold, 0.3); S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 10, life: 0.6, max: 0.6, r0: 4, grow: 64, col: PAL.gold }); }
        if (t < 0.9 && Math.random() < 0.85) S.p({ x: u.x + rnd(-10, 10), y: u.y - rnd(0, 6), vy: -rnd(20, 50), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? PAL.gold : PAL.red, additive: true, shrink: true });
        if (t > 0.15 && t < 0.16) S.floatSpr({ kind: 'arrowUp', x: u.x, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.gold });
        if (!beat && t > 0.42) { beat = true; S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 10, life: 0.5, max: 0.5, r0: 4, grow: 50, col: PAL.red }); S.doShake(2); }
      },
      done: (tt) => tt > 1.0,
    };
  },
  /* 룬 보호막 — a holy ward: layered shield rings + a rune hex form around the
     caster with a soft flash + upward shield arrow. */
  barrier(S) {
    castHop(S); const u = S.caster; let t = 0, ring2 = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.05) { S.doFlash(PAL.shieldW, 0.3); S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 9, life: 0.6, max: 0.6, r0: 4, grow: 32, col: PAL.shieldW }); }
        if (t < 0.9 && Math.random() < 0.7) S.p({ x: u.x + rnd(-10, 10), y: u.y + rnd(-4, 4), vy: -rnd(16, 40), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? PAL.shield : PAL.shieldW, additive: true, shrink: true });
        if (t > 0.12 && t < 0.13) S.floatSpr({ kind: 'arrowUp', x: u.x, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.shieldW });
        if (!ring2 && t > 0.3) { ring2 = true; S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 9, life: 0.7, max: 0.7, r0: 6, grow: 26, col: PAL.shield }); S.floatSpr({ kind: 'hex', x: u.x, y: u.y - 10, life: 0.9, max: 0.9 }); }
      },
      done: (tt) => tt > 1.1,
    };
  },
  /* 사령 소환 — a necrotic ritual: violet motes spiral up off the caster, a
     ground ring pulses, then a flash + rune hex as the dead rise. Caster-centred
     (the minions' own sprites pop in via battleScene.spawnSummonViews). */
  summon(S) {
    const u = S.caster; let t = 0, popped = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.9 && Math.random() < 0.85) {
          const a = t * 7 + rnd(0, 6.28), r = rnd(8, 20);
          S.p({ x: u.x + Math.cos(a) * r, y: u.y - 9 + rnd(-6, 6), vx: -Math.cos(a) * 10, vy: -rnd(20, 50), life: rnd(0.4, 0.9), max: 0.9, size: 2, color: Math.random() < 0.5 ? '#b483f0' : '#6a3ca0', additive: true, shrink: true });
        }
        if (t < 0.05) { S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 6, life: 0.6, max: 0.6, r0: 6, grow: 40, col: '#b483f0' }); S.doFlash('#3a1060', 0.3); }
        if (!popped && t > 0.45) { popped = true; S.doFlash('#c9a0ff', 0.4); S.doShake(3); S.floatSpr({ kind: 'hex', x: u.x, y: u.y - 10, life: 0.9, max: 0.9 }); burst(S, u.x, u.y - 9, ['#b483f0', '#6a3ca0', '#e6dcff'], 16, 90, { additive: true, up: 10 }); }
      },
      done: (tt) => tt > 1.0,
    };
  },
  /* 거미 산란 — the brood queen's spawn: poison motes spill to the ground, a
     ring pulses, then a green burst as spiderlings skitter out. Caster-centred. */
  broodspawn(S) {
    const u = S.caster; let t = 0, popped = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.9 && Math.random() < 0.8) S.p({ x: u.x + rnd(-12, 12), y: u.y + rnd(-4, 6), vy: rnd(10, 40), g: 40, life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? PAL.poison : PAL.poisonD, shrink: true });
        if (t < 0.05) S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 6, life: 0.6, max: 0.6, r0: 6, grow: 44, col: PAL.poison });
        if (!popped && t > 0.4) { popped = true; S.doFlash(PAL.poisonD, 0.3); S.doShake(2); burst(S, u.x, u.y - 9, [PAL.poison, PAL.poisonD, PAL.healW], 18, 100, { additive: true, up: 8 }); }
      },
      done: (tt) => tt > 1.0,
    };
  },

  /* 1. 화염 화살 */
  firebolt(S) {
    castHop(S); const tgt = S.primary(); let proj = null, phase = 0;
    return {
      update(dt) {
        if (phase === 0) { proj = projectile(S, tgt, { trail: [PAL.fireY, PAL.fireR, PAL.fireW], core: PAL.fireW, size: 3, dur: 0.32 },
          (x, y) => { phase = 1; burst(S, x, y, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 26, 130, { g: 60, additive: true }); S.doFlash(PAL.fireY, 0.35); S.doShake(3); tgt.flinch = 4; tgt.tint = 0.8; }); phase = 0.5; }
        if (proj && phase < 1) proj.update(dt);
      },
      done: (tt) => tt > 1.0,
    };
  },

  /* 2. 화염 폭풍 */
  firestorm(S) {
    castHop(S); S.tint(PAL.fireDeep, 0.25, 1.4); let t = 0; const drops = []; const targets = S.targets();
    for (let i = 0; i < 14; i++) drops.push({ at: rnd(0.05, 1.0), x: rnd(S.W * 0.5, S.W * 0.98), done: false });
    return {
      update(dt) {
        t += dt;
        drops.forEach((d) => {
          if (!d.done && t >= d.at) { d.done = true;
            const gy = S.groundY - rnd(0, 18);
            for (let k = 0; k < 8; k++) S.p({ x: d.x + rnd(-2, 2), y: gy - 40 - k * 4, vy: 220, life: 0.22, max: 0.22, size: 3, color: [PAL.fireY, PAL.fireR, PAL.fireW][k % 3], shrink: true, additive: true });
            S.schedule(0.18, () => { burst(S, d.x, gy, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 14, 90, { g: 40, up: 30, additive: true }); S.doShake(2); });
          }
        });
        if (Math.random() < 0.4) S.doFlash(PAL.fireY, 0.12);
        targets.forEach((e) => { if (Math.random() < 0.06) { e.tint = 0.6; e.flinch = 2; } });
      },
      done: (tt) => tt > 1.7,
    };
  },

  /* 3. 얼음 창 */
  ice_lance(S) {
    castHop(S); const tgt = S.primary(); let proj = null, phase = 0;
    return {
      update(dt) {
        if (phase === 0) { proj = projectile(S, tgt, { trail: [PAL.ice, PAL.iceP, PAL.iceW], core: PAL.iceW, size: 3, dur: 0.28 },
          (x, y) => { phase = 1; S.doFlash(PAL.iceW, 0.3); S.doShake(2); tgt.flinch = 3; tgt.tint = 0.7;
            for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2); const s = rnd(40, 130); S.p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 180, drag: 0.96, life: rnd(0.3, 0.7), max: 0.7, size: (rnd(1, 3) | 0) || 2, color: [PAL.iceW, PAL.iceP, PAL.ice][i % 3] }); }
          }); phase = 0.5; }
        if (proj && phase < 1) proj.update(dt);
      },
      done: (tt) => tt > 1.0,
    };
  },

  /* 4. 뇌격 */
  thunderclap(S) {
    castHop(S); let t = 0; const targets = S.targets(); const struck = targets.map(() => false);
    return {
      update(dt) {
        t += dt;
        targets.forEach((e, i) => {
          const at = 0.15 + i * 0.18;
          if (!struck[i] && t >= at) { struck[i] = true;
            S.beam({ x1: e.x + rnd(-3, 3), y1: -2, x2: e.x, y2: e.y - 6, color: PAL.thunder, width: 2, jag: 6, life: 0.18, max: 0.18 });
            S.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: PAL.thunderP, width: 4, jag: 8, life: 0.14, max: 0.14 });
            S.doFlash('#dfe6ff', 0.55); S.doShake(4); e.flinch = 4; e.tint = 0.9;
            burst(S, e.x, e.y - 6, [PAL.thunder, PAL.thunderB, PAL.thunderP], 20, 120, { up: 20, additive: true });
          }
        });
      },
      done: (tt) => tt > (0.15 + targets.length * 0.18 + 0.7),
    };
  },

  /* 5. 독화살 */
  venom_shot(S) {
    castHop(S); const tgt = S.primary(); let proj = null, phase = 0, bubT = 0;
    return {
      update(dt) {
        if (phase === 0) { proj = projectile(S, tgt, { trail: [PAL.poison, PAL.poisonD], core: PAL.poison, size: 2, dur: 0.3, arc: 14 },
          (x, y) => { phase = 1; burst(S, x, y, [PAL.poison, PAL.poisonD, PAL.healW], 16, 80, { g: 30, additive: true }); S.doShake(2); tgt.flinch = 3; tgt.tint = 0.6; }); phase = 0.5; }
        if (proj && phase < 1) proj.update(dt);
        if (phase >= 1) { bubT += dt; if (bubT > 0.05) { bubT = 0; S.p({ x: tgt.x + rnd(-6, 6), y: tgt.y - rnd(2, 16), vy: -rnd(6, 16), life: rnd(0.5, 1), max: 1, size: 2, color: Math.random() < 0.5 ? PAL.poison : PAL.poisonD, shrink: true, additive: true }); } }
      },
      done: (tt) => tt > 1.5,
    };
  },

  /* 6. 심판의 빛 */
  smite(S) {
    castHop(S); const tgt = S.primary(); let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        if (t > 0.2 && t < 0.7) {
          S.beam({ x1: tgt.x, y1: -2, x2: tgt.x, y2: tgt.y - 6, color: PAL.goldGlow, width: rnd(5, 9), jag: 0, life: 0.1, max: 0.1 });
          S.beam({ x1: tgt.x, y1: -2, x2: tgt.x, y2: tgt.y - 6, color: PAL.gold, width: rnd(2, 4), jag: 0, life: 0.08, max: 0.08 });
          S.p({ x: tgt.x + rnd(-4, 4), y: rnd(0, tgt.y - 10), vy: 200, life: 0.3, max: 0.3, size: 2, color: PAL.goldGlow, additive: true, shrink: true });
        }
        if (t > 0.55 && !hit) { hit = true; S.doFlash(PAL.goldGlow, 0.6); S.doShake(3); tgt.flinch = 4; tgt.tint = 1;
          burst(S, tgt.x, tgt.y - 8, [PAL.goldGlow, PAL.gold, PAL.goldDeep], 24, 110, { up: 24, additive: true });
          for (let i = 0; i < 10; i++) S.p({ x: tgt.x + rnd(-6, 6), y: tgt.y, vy: -rnd(30, 80), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: PAL.gold, additive: true, shrink: true });
        }
      },
      done: (tt) => tt > 1.2,
    };
  },

  /* 7. 치유 */
  heal(S) {
    castHop(S); let t = 0, em = 0; const u = S.caster;
    return {
      update(dt) {
        t += dt; em += dt;
        if (em > 0.04 && t < 1.0) { em = 0; S.p({ x: u.x + rnd(-7, 7), y: u.y - rnd(0, 4), vy: -rnd(18, 40), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: Math.random() < 0.5 ? PAL.heal : PAL.healW, additive: true, shrink: true }); }
        if (t > 0.1 && t < 0.5 && Math.random() < 0.5) S.floatSpr({ kind: 'cross', x: u.x + rnd(-6, 6), y: u.y - rnd(6, 22), life: 0.3, max: 0.3 });
      },
      done: (tt) => tt > 1.3,
    };
  },

  /* 8. 성스러운 빛 */
  holy_nova(S) {
    castHop(S); let t = 0; const cx = S.caster.x, cy = S.caster.y - 8; let flashed = false;
    return {
      update(dt) {
        t += dt; const r = t * 90;
        if (t < 0.9) { const n = 26; for (let i = 0; i < n; i++) { if (Math.random() < 0.5) continue; const a = (i / n) * Math.PI * 2; S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6, life: 0.12, max: 0.12, size: 2, color: Math.random() < 0.5 ? PAL.gold : PAL.goldGlow, additive: true }); } }
        if (!flashed && t > 0.05) { flashed = true; S.doFlash(PAL.goldGlow, 0.4); }
        if (Math.random() < 0.6) S.p({ x: cx + rnd(-30, 30), y: cy + rnd(-6, 14), vy: -rnd(20, 50), life: rnd(0.5, 1), max: 1, size: 2, color: PAL.goldGlow, additive: true, shrink: true });
      },
      done: (tt) => tt > 1.3,
    };
  },

  /* 9. 전투의 함성 */
  warcry(S) {
    castHop(S); let t = 0, pulse = 0; const u = S.caster;
    return {
      update(dt) {
        t += dt; pulse += dt;
        if (Math.random() < 0.8) S.p({ x: u.x + rnd(-8, 8), y: u.y - rnd(0, 6), vy: -rnd(20, 55), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? PAL.red : PAL.gold, additive: true, shrink: true });
        if (pulse > 0.22 && t < 0.9) { pulse = 0; S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 10, life: 0.4, max: 0.4, r0: 4, grow: 22, col: PAL.gold }); S.doShake(1.5); }
      },
      done: (tt) => tt > 1.1,
    };
  },

  /* 10. 방벽 */
  shield_wall(S) {
    castHop(S); let t = 0, formed = false, hexDrawn = false; const u = S.caster;
    return {
      update(dt) {
        t += dt;
        if (!formed && t > 0.1) { formed = true; S.doFlash(PAL.shieldW, 0.3); }
        if (t < 1.0 && Math.random() < 0.7) S.p({ x: u.x + rnd(2, 16), y: u.y - rnd(2, 22), vx: rnd(-4, 4), vy: rnd(-8, 4), life: rnd(0.3, 0.7), max: 0.7, size: 2, color: Math.random() < 0.5 ? PAL.shield : PAL.shieldW, additive: true, shrink: true });
        if (!hexDrawn) { hexDrawn = true; S.floatSpr({ kind: 'hex', x: u.x + 11, y: u.y - 10, life: 1.2, max: 1.2 }); }
      },
      done: (tt) => tt > 1.3,
    };
  },

  /* 11. 자장가 */
  lullaby(S) {
    castHop(S); const tgt = S.primary(); let t = 0, em = 0;
    return {
      update(dt) {
        t += dt; em += dt;
        if (em > 0.16 && t < 1.1) { em = 0;
          const fromX = S.caster.x + 6, fromY = S.caster.y - 12; const isZ = Math.random() < 0.4;
          S.floatSpr({ kind: isZ ? 'zee' : 'note', x: fromX, y: fromY, vx: (tgt.x - fromX) * 0.5, vy: -rnd(8, 16), life: 1.0, max: 1.0, col: Math.random() < 0.5 ? PAL.sleep : PAL.sleepW });
        }
        if (t > 0.5 && Math.random() < 0.15) tgt.tint = 0.3;
      },
      done: (tt) => tt > 1.6,
    };
  },

  /* 12. 정화 */
  cleanse(S) {
    castHop(S); let t = 0, em = 0, flashed = false; const u = S.caster;
    return {
      update(dt) {
        t += dt; em += dt;
        if (em > 0.03 && t < 0.9) { em = 0; S.p({ x: u.x + rnd(-9, 9), y: u.y - 26, vy: rnd(50, 90), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: Math.random() < 0.4 ? PAL.gold : PAL.healW, additive: true, shrink: true }); }
        if (t > 0.15 && t < 0.6 && Math.random() < 0.3) S.beam({ x1: u.x + rnd(-8, 8), y1: u.y - 28, x2: u.x + rnd(-6, 6), y2: u.y - 2, color: PAL.healW, width: 1, jag: 0, life: 0.1, max: 0.1 });
        if (t > 0.1 && !flashed) { flashed = true; S.doFlash(PAL.healW, 0.3); }
        if (t > 0.4 && Math.random() < 0.4) S.p({ x: u.x + rnd(-10, 10), y: u.y - 1, vx: rnd(-20, 20), vy: -rnd(2, 10), life: 0.4, max: 0.4, size: 2, color: PAL.healW, additive: true, shrink: true });
      },
      done: (tt) => tt > 1.1,
    };
  },

  /* 13. 대지분쇄 */
  quake(S) {
    castHop(S); let t = 0; const targets = S.targets(); const struck = targets.map(() => false); let flashed = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.5) S.doShake(5); else if (t < 1.0) S.doShake(2.5);
        if (!flashed && t > 0.1) { flashed = true; S.doFlash(PAL.earth, 0.25); }
        targets.forEach((e, i) => {
          const at = 0.12 + i * 0.1;
          if (!struck[i] && t >= at) { struck[i] = true;
            for (let k = 0; k < 14; k++) { const a = -Math.PI / 2 + rnd(-0.8, 0.8); const s = rnd(60, 150); S.p({ x: e.x + rnd(-6, 6), y: S.groundY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 320, drag: 0.99, life: rnd(0.4, 0.9), max: 0.9, size: (rnd(1, 3) | 0) || 2, color: [PAL.earth, PAL.earthD, PAL.earthDk, PAL.dust][k % 4] }); }
            e.flinch = 4; e.tint = 0.5;
          }
        });
        if (t < 0.8 && Math.random() < 0.5) S.p({ x: rnd(S.W * 0.45, S.W), y: S.groundY - rnd(0, 4), vx: rnd(-10, 10), vy: -rnd(4, 14), life: rnd(0.5, 1), max: 1, size: 3, color: PAL.dust, shrink: true });
      },
      done: (tt) => tt > 1.4,
    };
  },

  /* --- AoE (weather-field) ------------------------------------------------ */
  arrowrain(S) {
    return aoe(S, {
      dur: 1.7, gap: [0.14, 0.32], tint: { c: '#0e1430', a: 0.18 },
      field: (s, dt) => rainField(s, dt, { rate: 60, vx: -40, vy: 300, size: 1, streak: 9, color: '#cfd8ec', head: true, headColor: '#fff0b8' }),
      strike: (s, e) => { burst(s, e.x + rnd(-5, 5), e.y - rnd(2, 14), ['#cfd8ec', '#b9b48f', '#fff0b8'], 7, 70, { g: 80 }); e.flinch = 3; e.tint = 0.4;
        s.p({ x: e.x + rnd(-6, 6), y: e.y - rnd(4, 16), vx: -30, vy: 220, life: 0.12, max: 0.12, size: 1, color: '#cfd8ec', streak: 8, head: true, headColor: '#fff0b8', fade: false }); },
    });
  },
  thunderstorm(S) {
    return aoe(S, {
      dur: 1.9, gap: [0.2, 0.45], tint: { c: '#0b1024', a: 0.3 },
      field: (s, dt) => rainField(s, dt, { rate: 55, vx: -22, vy: 300, size: 1, streak: 8, color: 'rgba(150,170,210,1)' }),
      ambient: (s) => { if (Math.random() < 0.06) s.doFlash('#aab6e0', 0.12); },
      strike: (s, e) => {
        s.beam({ x1: e.x + rnd(-3, 3), y1: -2, x2: e.x, y2: e.y - 6, color: PAL.thunder, width: 2, jag: 6, life: 0.16, max: 0.16 });
        s.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: PAL.thunderP, width: 4, jag: 8, life: 0.12, max: 0.12 });
        s.doFlash('#dfe6ff', 0.5); s.doShake(3.5); e.flinch = 4; e.tint = 0.85;
        burst(s, e.x, e.y - 6, [PAL.thunder, PAL.thunderB, PAL.thunderP], 16, 110, { up: 18, additive: true });
      },
    });
  },
  blizzard(S) {
    return aoe(S, {
      dur: 2.0, gap: [0.22, 0.46], tint: { c: '#bfe6ff', a: 0.12 },
      field: (s, dt) => { snowField(s, dt, { rate: 70, color: PAL.iceW, color2: PAL.iceP }); rainField(s, dt, { rate: 16, vx: -30, vy: 200, size: 1, streak: 6, color: PAL.ice, additive: true }); },
      strike: (s, e) => {
        for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2), sp = rnd(40, 120); s.p({ x: e.x, y: e.y - 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 160, drag: 0.96, life: rnd(0.3, 0.6), max: 0.6, size: (rnd(1, 3) | 0) || 2, color: [PAL.iceW, PAL.iceP, PAL.ice][i % 3] }); }
        s.doFlash(PAL.iceW, 0.28); s.doShake(2); e.flinch = 3; e.tint = 0.7;
      },
    });
  },
  inferno(S) {
    return aoe(S, {
      dur: 1.9, gap: [0.16, 0.34], tint: { c: PAL.fireDeep, a: 0.28 },
      field: (s, dt) => emberField(s, dt, { rate: 40, c1: PAL.fireY, c2: PAL.fireR, c3: PAL.fireW }),
      ambient: (s) => { if (Math.random() < 0.35) s.doFlash(PAL.fireY, 0.1); },
      strike: (s, e) => {
        for (let k = 0; k < 6; k++) s.p({ x: e.x + rnd(-3, 3), y: e.y - 50 - k * 5, vy: 260, life: 0.2, max: 0.2, size: 3, color: [PAL.fireY, PAL.fireR, PAL.fireW][k % 3], shrink: true, additive: true });
        s.schedule(0.17, () => { burst(s, e.x, e.y - 6, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 16, 100, { up: 26, g: 40, additive: true }); s.doShake(2.5); });
        e.tint = 0.7; e.flinch = 3;
      },
    });
  },
  venomcloud(S) {
    return aoe(S, {
      dur: 2.0, gap: [0.3, 0.55], tint: { c: '#163a18', a: 0.26 },
      field: (s, dt) => fogField(s, dt, { rate: 18, color: PAL.poison, color2: PAL.poisonD }),
      strike: (s, e) => {
        burst(s, e.x, e.y - 8, [PAL.poison, PAL.poisonD, PAL.healW], 12, 60, { up: 14, additive: true });
        for (let i = 0; i < 4; i++) s.p({ x: e.x + rnd(-6, 6), y: e.y - rnd(2, 14), vy: -rnd(8, 18), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: PAL.poison, additive: true, shrink: true });
        e.tint = 0.45;
      },
    });
  },
  sandstorm(S) {
    return aoe(S, {
      dur: 1.8, gap: [0.18, 0.4], tint: { c: '#3a2c14', a: 0.3 },
      field: (s, dt) => sandField(s, dt, { rate: 80, c1: PAL.earth, c2: PAL.dust, c3: PAL.earthD }),
      ambient: (s) => { if (Math.random() < 0.5) s.doShake(1.2); },
      strike: (s, e) => {
        for (let i = 0; i < 8; i++) s.p({ x: e.x - 8, y: e.y - rnd(2, 18), vx: rnd(120, 240), vy: rnd(-20, 20), life: rnd(0.25, 0.5), max: 0.5, size: (rnd(1, 3) | 0) || 1, color: [PAL.earth, PAL.dust, PAL.earthD][i % 3], streak: rnd(4, 8), fade: false });
        e.flinch = 2; e.tint = 0.35;
      },
    });
  },

  /* --- Extended (new elements + boss nuke) -------------------------------- */
  cyclone(S) {
    return aoe(S, {
      dur: 1.8, gap: [0.16, 0.36], tint: { c: '#16241c', a: 0.16 },
      field: (s, dt) => {
        const n = Math.round(72 * dt);
        for (let i = 0; i < n; i++) { const y = rnd(0, s.groundY); s.p({ x: rnd(-12, 0), y, vx: rnd(230, 380), vy: Math.sin(y * 0.4) * 26, life: 0.6, max: 0.6, size: 1, color: Math.random() < 0.5 ? PAL.wind1 : PAL.wind2, streak: rnd(8, 14), additive: true, fade: false }); }
        if (Math.random() < 0.7) s.p({ x: rnd(-6, 0), y: rnd(0, s.groundY), vx: rnd(170, 280), vy: rnd(-26, 26), g: 28, life: rnd(0.6, 1.1), max: 1.1, size: 2, color: [PAL.leaf1, PAL.leaf2, PAL.leaf3][(rnd(0, 3) | 0)] });
      },
      strike: (s, e) => { burst(s, e.x, e.y - 8, [PAL.wind1, PAL.wind2, PAL.leaf3], 10, 90, { up: 6, additive: true }); e.flinch = 3; e.tint = 0.35; },
    });
  },
  darkmist(S) {
    return aoe(S, {
      dur: 2.0, gap: [0.26, 0.5], tint: { c: '#0a0612', a: 0.46 },
      field: (s, dt) => {
        const n = Math.round(18 * dt);
        for (let i = 0; i < n; i++) s.p({ x: rnd(0, s.W), y: rnd(s.H * 0.35, s.H + 4), vx: rnd(-8, 8), vy: -rnd(4, 14), life: rnd(0.8, 1.5), max: 1.5, size: (rnd(4, 7) | 0), color: Math.random() < 0.6 ? PAL.darkSmoke : PAL.darkSmoke2, shrink: true });
        if (Math.random() < 0.45) s.p({ x: rnd(0, s.W), y: rnd(s.H * 0.3, s.H), vy: -rnd(8, 18), life: rnd(0.7, 1.2), max: 1.2, size: 2, color: PAL.wisp, additive: true, shrink: true });
      },
      strike: (s, e) => {
        s.floatSpr({ kind: 'ring', x: e.x, y: e.y - 9, life: 0.45, max: 0.45, r0: 3, grow: 14, col: PAL.wisp });
        burst(s, e.x, e.y - 8, [PAL.wisp, PAL.darkSmoke2, '#7a5fb0'], 10, 60, { additive: true }); e.tint = 0.55; e.flinch = 2;
      },
    });
  },
  divinewrath(S) {
    return aoe(S, {
      dur: 1.8, gap: [0.16, 0.36], tint: { c: '#2e2408', a: 0.16 },
      field: (s, dt) => { const n = Math.round(24 * dt); for (let i = 0; i < n; i++) s.p({ x: rnd(0, s.W), y: rnd(-6, s.H * 0.3), vx: rnd(-6, 6), vy: rnd(34, 72), life: 1.1, max: 1.1, size: 1, color: Math.random() < 0.5 ? PAL.gold : PAL.goldGlow, additive: true, fade: false }); },
      ambient: (s) => { if (Math.random() < 0.08) s.doFlash(PAL.goldGlow, 0.12); },
      strike: (s, e) => {
        s.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: PAL.goldGlow, width: rnd(5, 8), jag: 0, life: 0.12, max: 0.12 });
        s.beam({ x1: e.x, y1: -2, x2: e.x, y2: e.y - 6, color: PAL.gold, width: rnd(2, 4), jag: 0, life: 0.1, max: 0.1 });
        s.doFlash(PAL.goldGlow, 0.42); s.doShake(2.5); e.flinch = 4; e.tint = 1;
        burst(s, e.x, e.y - 8, [PAL.goldGlow, PAL.gold, PAL.goldDeep], 16, 100, { up: 20, additive: true });
      },
    });
  },
  meteor(S) {
    castHop(S); const tgt = S.primary(); let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.6) { S.tint('#1a0604', 0.55, 0.62); if (Math.random() < 0.7) S.p({ x: rnd(0, S.W), y: rnd(S.H * 0.7, S.H), vy: -rnd(24, 60), life: rnd(0.6, 1.2), max: 1.2, size: (rnd(1, 3) | 0) || 1, color: [PAL.fireY, PAL.fireR, PAL.fireDeep][(rnd(0, 3) | 0)], additive: true, shrink: true }); S.doShake(0.6 + t * 4); }
        if (t >= 0.5 && t < 0.92) {
          const k = (t - 0.5) / 0.42; const sx = S.W * 1.08, sy = -12, ex = tgt.x, ey = tgt.y - 8;
          const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k;
          for (let i = 0; i < 6; i++) S.p({ x: x + rnd(-4, 4), y: y + rnd(-4, 4), life: 0.22, max: 0.22, size: (rnd(3, 6) | 0), color: [PAL.fireY, PAL.fireR, PAL.fireW, PAL.fireDeep][i % 4], additive: true, shrink: true });
          for (let i = 0; i < 3; i++) S.p({ x: x + rnd(-2, 2), y: y - rnd(2, 10), vx: rnd(-20, 20), vy: -rnd(20, 50), life: 0.4, max: 0.4, size: 3, color: PAL.fireR, additive: true, shrink: true });
        }
        if (t >= 0.9 && !hit) { hit = true; S.doFlash('#fff0b8', 0.95); S.doShake(8); tgt.flinch = 6; tgt.tint = 1;
          burst(S, tgt.x, tgt.y - 8, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 40, 200, { up: 20, g: 60, additive: true, size: 3 });
          for (let i = 0; i < 16; i++) S.p({ x: tgt.x + rnd(-10, 10), y: tgt.y, vx: rnd(-60, 60), vy: -rnd(40, 110), g: 220, life: rnd(0.5, 1), max: 1, size: (rnd(1, 3) | 0) || 2, color: [PAL.fireR, PAL.fireDeep, PAL.dust][i % 3] }); }
      },
      done: (tt) => tt > 1.7,
    };
  },

  /* --- Class ultimates (single-target spectacle) -------------------------- */
  holyblade(S) {
    castHop(S); const tgt = S.primary(); let t = 0, sword = false, slam = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.45) { S.tint('#2e2408', 0.12, 0.45); if (Math.random() < 0.85) { const a = Math.random() * 6.28, r = rnd(6, 20); S.p({ x: S.caster.x + Math.cos(a) * r, y: S.caster.y - 10 + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3 - 10, life: rnd(0.3, 0.6), max: 0.6, size: 2, color: Math.random() < 0.5 ? PAL.gold : PAL.goldGlow, additive: true, shrink: true }); } }
        if (!sword && t >= 0.42) { sword = true; const tipY = tgt.y - 8; S.floatSpr({ kind: 'blade', x: tgt.x, y: -34, vy: (tipY + 34) / 0.3, life: 0.31, max: 0.31 }); }
        if (!slam && t >= 0.72) { slam = true;
          S.doFlash(PAL.goldGlow, 0.92); S.doShake(7); tgt.flinch = 6; tgt.tint = 1;
          S.beam({ x1: tgt.x, y1: tgt.y - 44, x2: tgt.x, y2: tgt.y + 12, color: PAL.goldGlow, width: 7, jag: 0, life: 0.22, max: 0.22 });
          S.beam({ x1: tgt.x - 34, y1: tgt.y - 14, x2: tgt.x + 34, y2: tgt.y - 14, color: PAL.goldGlow, width: 5, jag: 0, life: 0.22, max: 0.22 });
          burst(S, tgt.x, tgt.y - 10, [PAL.goldGlow, PAL.gold, PAL.goldDeep, '#fff'], 40, 180, { up: 16, g: 40, additive: true, size: 3 });
          for (let i = 0; i < 16; i++) S.p({ x: tgt.x + rnd(-8, 8), y: tgt.y, vy: -rnd(40, 110), life: rnd(0.5, 1), max: 1, size: 2, color: PAL.gold, additive: true, shrink: true });
        }
      },
      done: (tt) => tt > 1.5,
    };
  },
  berserk(S) {
    castHop(S); const tgt = S.primary(); let t = 0, last = 0, count = 0, fin = false;
    const ang = [[1, -1], [1, 1], [1, -0.4], [1, 0.4], [1, -1], [1, 1]];
    return {
      update(dt) {
        t += dt;
        if (t < 0.3) { S.caster.hop = 4; if (Math.random() < 0.7) S.p({ x: S.caster.x + rnd(-8, 8), y: S.caster.y - rnd(0, 16), vy: -rnd(20, 50), life: rnd(0.3, 0.5), max: 0.5, size: 2, color: Math.random() < 0.5 ? PAL.red : PAL.gold, additive: true, shrink: true }); }
        if (t >= 0.3 && t < 0.95) { last += dt; if (last > 0.085) { last = 0; const a = ang[count % ang.length]; const len = 28;
          S.beam({ x1: tgt.x - a[0] * len, y1: tgt.y - 9 - a[1] * len, x2: tgt.x + a[0] * len, y2: tgt.y - 9 + a[1] * len, color: Math.random() < 0.5 ? '#ffffff' : PAL.gold, width: 2, jag: 0, life: 0.14, max: 0.14 });
          burst(S, tgt.x + rnd(-5, 5), tgt.y - 9, ['#ffffff', PAL.gold, PAL.red], 7, 90, { additive: true });
          tgt.flinch = 3; tgt.tint = 0.6; S.doShake(2); count++;
        } }
        if (t >= 0.95 && !fin) { fin = true;
          S.beam({ x1: tgt.x - 32, y1: tgt.y - 34, x2: tgt.x + 32, y2: tgt.y + 10, color: PAL.goldGlow, width: 4, jag: 0, life: 0.26, max: 0.26 });
          S.beam({ x1: tgt.x + 32, y1: tgt.y - 34, x2: tgt.x - 32, y2: tgt.y + 10, color: PAL.goldGlow, width: 4, jag: 0, life: 0.26, max: 0.26 });
          S.doFlash('#ffe0d0', 0.72); S.doShake(7); tgt.flinch = 6; tgt.tint = 1;
          burst(S, tgt.x, tgt.y - 9, [PAL.goldGlow, PAL.gold, PAL.red, PAL.fireDeep], 36, 180, { up: 14, additive: true, size: 3 });
        }
      },
      done: (tt) => tt > 1.4,
    };
  },
  starfall(S) {
    castHop(S); const tgt = S.primary(); let t = 0, em = 0, fin = false;
    const star = PAL.star, glow = PAL.iceW;
    return {
      update(dt) {
        t += dt;
        if (t < 0.4) { if (Math.random() < 0.85) { const a = Math.random() * 6.28, r = rnd(8, 20); S.p({ x: S.caster.x + 6 + Math.cos(a) * r, y: S.caster.y - 10 + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 2.6, life: 0.3, max: 0.3, size: 2, color: Math.random() < 0.5 ? star : PAL.gold, additive: true, shrink: true }); } }
        if (t >= 0.4 && t < 0.95) { em += dt; if (em > 0.045) { em = 0;
          const sx = rnd(0, S.W), sy = -8; const dx = tgt.x - sx, dy = (tgt.y - 9) - sy, d = Math.hypot(dx, dy) || 1; const sp = 440;
          S.p({ x: sx, y: sy, vx: dx / d * sp, vy: dy / d * sp, life: d / sp, max: d / sp, size: 1, color: Math.random() < 0.5 ? star : glow, streak: 11, head: true, headColor: PAL.gold, fade: false });
          S.schedule((d / sp), () => { burst(S, tgt.x + rnd(-6, 6), tgt.y - rnd(2, 16), [star, glow, PAL.gold], 6, 60, { additive: true }); tgt.flinch = 2; tgt.tint = 0.4; });
        } }
        if (t >= 0.95 && !fin) { fin = true;
          S.beam({ x1: S.caster.x + 6, y1: S.caster.y - 10, x2: tgt.x, y2: tgt.y - 9, color: glow, width: 3, jag: 0, life: 0.16, max: 0.16 });
          S.doFlash(glow, 0.6); S.doShake(5); tgt.flinch = 6; tgt.tint = 1;
          burst(S, tgt.x, tgt.y - 9, [star, glow, PAL.gold, '#ffffff'], 34, 160, { additive: true, size: 3 });
          S.floatSpr({ kind: 'ring', x: tgt.x, y: tgt.y - 9, life: 0.5, max: 0.5, r0: 4, grow: 30, col: star });
        }
      },
      done: (tt) => tt > 1.5,
    };
  },

  /* --- Warrior ------------------------------------------------------------ */
  // 분쇄 강타 — a MELEE axe slam: a short overhead stroke (the weapon, not a sky
  // pillar) that lands into a ground shockwave + bilateral dust. Deliberately
  // distinct from smite's tall holy beam (the player flagged the old vertical-beam
  // version as looking identical to 심판의빛).
  crushblow(S) {
    castHop(S); const tgt = S.primary(); const rage = !!S._rage; let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        // wind-up sparks off the caster (steel/gold; red while raging)
        if (t < 0.32) { S.caster.hop = 4; if (Math.random() < 0.5) S.p({ x: S.caster.x + rnd(-6, 6), y: S.caster.y - rnd(2, 16), vy: -rnd(14, 34), life: 0.3, max: 0.3, size: 2, color: rage ? PAL.red : (Math.random() < 0.5 ? '#dfe4f2' : PAL.gold), additive: true, shrink: true }); }
        // overhead slam: a vertical steel beam driven straight down (rage adds a thick red beam)
        if (t >= 0.28 && t < 0.42) {
          S.beam({ x1: tgt.x, y1: tgt.y - 46, x2: tgt.x, y2: tgt.y - 2, color: '#dfe4f2', width: rnd(4, 7), jag: 0, life: 0.08, max: 0.08 });
          if (rage) S.beam({ x1: tgt.x, y1: tgt.y - 46, x2: tgt.x, y2: tgt.y - 2, color: PAL.red, width: rnd(7, 10), jag: 0, life: 0.07, max: 0.07 });
        }
        if (t >= 0.4 && !hit) { hit = true;
          S.doFlash(rage ? '#ffdcd0' : '#eef2ff', rage ? 0.7 : 0.55); S.doShake(rage ? 9 : 7); tgt.flinch = rage ? 6 : 5; tgt.tint = rage ? 1 : 0.7;
          // bilateral dust eruption kicked up by the slam (ground shockwave)
          for (let dir = -1; dir <= 1; dir += 2) for (let i = 0; i < (rage ? 13 : 9); i++) S.p({ x: tgt.x, y: S.groundY, vx: dir * rnd(60, rage ? 260 : 200), vy: -rnd(10, 60), g: 260, drag: 0.97, life: rnd(0.3, 0.7), max: 0.7, size: (rnd(1, 3) | 0) || 2, color: [PAL.dust, PAL.earth, '#9aa3c8'][i % 3] });
          burst(S, tgt.x, tgt.y - 8, rage ? ['#ff8a5a', PAL.red, '#fff'] : ['#dfe4f2', '#fff', PAL.gold], rage ? 26 : 18, rage ? 170 : 130, { up: 12, additive: true, size: 3 });
          if (rage) rageBurst(S, tgt.x, tgt.y - 8);
        }
      },
      done: (tt) => tt > 1.0,
    };
  },
  whirlwind(S) {
    const targets = S.targets(); const rage = !!S._rage; let t = 0, spin = 0; const swept = targets.map(() => false);
    const cx = S.caster.x, cy = S.caster.y - 9;
    return {
      update(dt) {
        t += dt; spin += dt * 26;
        const blades = rage ? 3 : 2;
        for (let k = 0; k < blades; k++) {
          const a = spin + k * Math.PI * 2 / blades, r = 16 + t * 12;
          S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6, life: 0.16, max: 0.16, size: 2, color: rage ? (Math.random() < 0.5 ? PAL.red : '#fff') : '#dfe4f2', additive: true });
        }
        if (Math.random() < 0.4) S.doShake(1.2);
        if (t >= 0.45) {
          const ringR = (t - 0.45) * 340;
          targets.forEach((e, i) => {
            if (!swept[i] && ringR >= Math.abs(e.x - cx)) {
              swept[i] = true;
              S.beam({ x1: e.x - 26, y1: e.y - 9, x2: e.x + 26, y2: e.y - 9, color: rage ? PAL.red : '#fff', width: rage ? 4 : 3, life: 0.14, max: 0.14 });
              burst(S, e.x, e.y - 9, rage ? ['#ff8a5a', PAL.red, '#fff'] : ['#dfe4f2', '#fff', PAL.gold], rage ? 18 : 12, 110, { additive: true });
              e.flinch = 4; e.tint = rage ? 0.85 : 0.6; S.doShake(2.5);
              if (rage) rageBurst(S, e.x, e.y - 9);
            }
          });
          // expanding ring particle wave tracing the sweep radius outward
          const n = 22;
          for (let i = 0; i < n; i++) { if (Math.random() < 0.6) continue; const a = (i / n) * 6.28; S.p({ x: cx + Math.cos(a) * ringR, y: cy + Math.sin(a) * ringR * 0.6, life: 0.1, max: 0.1, size: 2, color: rage ? PAL.red : '#dfe4f2', additive: true }); }
        }
      },
      done: (tt) => tt > 1.3,
    };
  },
  warroar(S) {
    castHop(S); S.tint('#2a0c0c', 0.18, 1.0);
    const targets = S.targets(); const cx = S.caster.x, cy = S.caster.y - 11; let t = 0;
    return {
      update(dt) {
        t += dt;
        if (Math.random() < 0.8) S.p({ x: cx + rnd(-8, 8), y: cy - rnd(4, 6), vy: -rnd(16, 44), life: rnd(0.3, 0.6), max: 0.6, size: 2, color: Math.random() < 0.5 ? PAL.red : '#ff9a6a', additive: true, shrink: true });
        if (t < 0.8 && Math.random() < 0.2) {
          S.floatSpr({ kind: 'ring', x: cx, y: cy, life: 0.5, max: 0.5, r0: 4, grow: 60, col: PAL.red });
          S.doShake(2.5); S.doFlash(PAL.red, 0.14);
        }
        targets.forEach((e, i) => {
          const strikeAt = 0.25 + i * 0.08;
          if (t >= strikeAt && t < strikeAt + 0.01) {
            e.flinch = 3; e.tint = 0.4;
            S.floatSpr({ kind: 'arrowDown', x: e.x, y: e.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.red });
          }
        });
      },
      done: (tt) => tt > 1.1,
    };
  },
  sunder(S) {
    castHop(S); const tgt = S.primary(); const rage = !!S._rage; let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        if (t > 0.26 && t < 0.4) {
          S.beam({ x1: tgt.x - 30, y1: tgt.y - 30, x2: tgt.x + 26, y2: tgt.y + 8, color: '#dfe4f2', width: rnd(3, 5), life: 0.08, max: 0.08 });
          if (rage) S.beam({ x1: tgt.x - 30, y1: tgt.y - 30, x2: tgt.x + 26, y2: tgt.y + 8, color: PAL.red, width: rnd(5, 8), life: 0.07, max: 0.07 });
        }
        if (t >= 0.38 && !hit) { hit = true;
          S.doFlash(rage ? '#ffdcd0' : '#e6ebff', rage ? 0.6 : 0.45); S.doShake(rage ? 7 : 5); tgt.flinch = rage ? 6 : 5; tgt.tint = rage ? 1 : 0.65;
          const icePal = PAL.iceP || '#bfe6ff';
          for (let i = 0; i < (rage ? 22 : 16); i++) {
            const a = -Math.PI / 2 + rnd(-1.3, 1.3), s = rnd(50, 150);
            S.p({ x: tgt.x, y: tgt.y - 9, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 280, drag: 0.97, life: rnd(0.4, 0.8), max: 0.8, size: (rnd(1, 3) | 0) || 2, color: ['#dfe4f2', '#9aa3c8', icePal][i % 3] });
          }
          S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: icePal });
          if (rage) rageBurst(S, tgt.x, tgt.y - 9);
        }
      },
      done: (tt) => tt > 1.0,
    };
  },
  taunt(S) {
    const u = S.caster; let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t > 0.1 && t < 0.11) S.doFlash(PAL.shieldW, 0.28);
        if (t < 0.5 && Math.random() < 0.6) S.p({ x: u.x + 10, y: u.y - 9 + rnd(-4, 4), vx: rnd(40, 90), vy: rnd(-6, 6), life: 0.4, max: 0.4, size: 2, color: PAL.gold, additive: true, shrink: true });
        if (t < 0.9 && Math.random() < 0.7) S.p({ x: u.x + rnd(-10, 10), y: u.y + rnd(-4, 4), vy: -rnd(18, 44), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? PAL.shield : PAL.shieldW, additive: true, shrink: true });
        if (t < 0.01) {
          S.floatSpr({ kind: 'ring', x: u.x, y: u.y - 9, life: 0.6, max: 0.6, r0: 4, grow: 24, col: PAL.shieldW });
          S.floatSpr({ kind: 'arrowUp', x: u.x, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.shieldW });
        }
      },
      done: (tt) => tt > 1.1,
    };
  },
  bloodlust(S) {
    const u = S.caster; let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t > 0.12 && t < 0.13) {
          S.doFlash('#5a0a0a', 0.4); S.doShake(4);
          burst(S, u.x, u.y - 9, [PAL.red, '#ff6a4a', '#7a1f0a'], 18, 110, { additive: true, up: 6 });
          S.tint('#2a0606', 0.3, 0.4);
        }
        if (t < 1.0 && Math.random() < 0.9) {
          const a = t * 8 + rnd(0, 6.28), r = rnd(6, 16);
          S.p({ x: u.x + Math.cos(a) * r, y: u.y - 9 + rnd(-4, 4), vx: Math.cos(a) * 8, vy: -rnd(26, 60), life: rnd(0.4, 0.9), max: 0.9, size: 2, color: Math.random() < 0.6 ? PAL.red : '#ff8a5a', additive: true, shrink: true });
        }
        if (t < 0.6 && Math.random() < 0.3) S.p({ x: u.x + rnd(-8, 8), y: u.y - 9 + rnd(-8, 8), vy: rnd(20, 50), g: 60, life: 0.5, max: 0.5, size: 2, color: '#9a1020' });
        if (t > 0.5 && t < 0.51) S.floatSpr({ kind: 'arrowUp', x: u.x, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.red });
      },
      done: (tt) => tt > 1.2,
    };
  },

  /* --- Hunter ------------------------------------------------------------ */
  stealth(S) {
    const u = S.caster; let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t < 0.4 && Math.random() < 0.8) {
          const a = rnd(0, 6.28), s = rnd(20, 70);
          S.p({ x: u.x, y: u.y - 9, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 8, drag: 0.9, life: rnd(0.5, 1), max: 1, size: (rnd(3, 6) | 0), color: Math.random() < 0.5 ? '#2a2438' : '#46506a', shrink: true });
        }
        if (t < 0.9 && Math.random() < 0.5) S.p({ x: u.x + rnd(-8, 8), y: u.y - rnd(0, 14), vy: -rnd(10, 26), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? '#b483f0' : '#e6dcff', additive: true, shrink: true });
        if (t < 0.01) S.floatSpr({ kind: 'eye', x: u.x, y: u.y - 24, vy: -8, life: 1.0, max: 1.0, col: '#e6dcff' });
      },
      done: (tt) => tt > 1.0,
    };
  },
  aimedshot(S) {
    const tgt = S.primary(); const sneak = !!S._stealth; let t = 0, proj = null, phase = 0;
    return {
      update(dt) {
        t += dt;
        if (t < 0.5) S.floatSpr({ kind: 'reticle', x: tgt.x, y: tgt.y - 9, life: 0.05, max: 0.05, r: 14 - (t / 0.5) * 8, col: sneak ? '#b483f0' : PAL.gold });
        if (phase === 0 && t >= 0.5) {
          phase = 1;
          proj = arrow(S, { x: S.caster.x + 7, y: S.caster.y - 12 }, { x: tgt.x, y: tgt.y - 9 }, 0.14, (x, y) => {
            S.doFlash('#fff6e0', sneak ? 0.7 : 0.5); S.doShake(sneak ? 7 : 5); tgt.flinch = sneak ? 6 : 5; tgt.tint = sneak ? 1 : 0.7;
            burst(S, x, y, [PAL.gold, PAL.fireW, '#fff', '#cfd8ec'], sneak ? 34 : 22, sneak ? 180 : 150, { additive: true, size: 3 });
            if (sneak) sneakBurst(S, x, y); else S.floatSpr({ kind: 'critMark', x, y: y - 6, vy: -16, life: 0.7, max: 0.7 });
          });
        }
        if (proj && phase < 2) { proj.update(dt); if (proj.done && proj.done(t - 0.5)) phase = 2; }
      },
      done: (tt) => tt > 1.0,
    };
  },
  multishot(S) {
    const tgt = S.primary(); const sneak = !!S._stealth; const shots = sneak ? 7 : 5; const gap = sneak ? 0.07 : 0.1; let t = 0; const arrows = [];
    return {
      update(dt) {
        t += dt;
        if (Math.floor(t / gap) < shots && Math.floor((t + dt) / gap) >= Math.floor(t / gap)) {
          const idx = Math.floor(t / gap);
          const scatter = sneak ? 8 : 3;
          const from = { x: S.caster.x + 7 + rnd(-scatter, scatter), y: S.caster.y - 12 + rnd(-scatter, scatter) };
          const to = { x: tgt.x + rnd(-scatter, scatter), y: tgt.y - 9 + rnd(-scatter, scatter) };
          const proj = arrow(S, from, to, 0.16, (x, y) => {
            burst(S, x, y, sneak ? ['#e6dcff', '#b483f0', PAL.gold] : ['#cfd8ec', PAL.fireW, PAL.gold], 8, 100, { additive: true });
            tgt.flinch = 3; tgt.tint = sneak ? 0.7 : 0.5; S.doShake(1.8);
            if (sneak && idx === shots - 1) sneakBurst(S, tgt.x, tgt.y - 9);
          });
          arrows.push({ p: proj, t: 0 });
        }
        arrows.forEach(a => { a.p.update(dt); });
      },
      done: (tt) => tt > 1.1,
    };
  },
  piercingshot(S) {
    const tgt = S.primary(); const sneak = !!S._stealth; const from = { x: S.caster.x + 7, y: S.caster.y - 9 }; let t = 0, fired = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.4 && Math.random() < 0.7) {
          S.p({ x: from.x + rnd(-4, 4), y: from.y + rnd(-4, 4), vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.25, max: 0.25, size: 2, color: sneak ? '#b483f0' : (Math.random() < 0.5 ? PAL.gold : PAL.fireW), additive: true, shrink: true });
        }
        if (t >= 0.4 && !fired) {
          fired = true;
          S.beam({ x1: from.x, y1: from.y, x2: S.W + 10, y2: tgt.y - 9, color: PAL.fireW, width: 2, life: 0.2, max: 0.2 });
          S.beam({ x1: from.x, y1: from.y, x2: S.W + 10, y2: tgt.y - 9, color: '#fff', width: 1, life: 0.16, max: 0.16 });
          if (sneak) S.beam({ x1: from.x, y1: from.y, x2: S.W + 10, y2: tgt.y - 9, color: '#b483f0', width: 4, life: 0.18, max: 0.18 });
          S.doFlash('#fff6e0', sneak ? 0.65 : 0.45); S.doShake(sneak ? 6 : 4); tgt.flinch = sneak ? 6 : 5; tgt.tint = sneak ? 1 : 0.7;
          burst(S, tgt.x, tgt.y - 9, [PAL.gold, PAL.fireW, '#cfd8ec', '#fff'], sneak ? 30 : 20, 140, { additive: true, size: 2 });
          S.p({ x: tgt.x, y: tgt.y - 9, vx: 320, vy: 0, life: 0.16, max: 0.16, size: 1, color: PAL.fireW, streak: 16, head: true, headColor: PAL.gold, fade: false });
          if (sneak) sneakBurst(S, tgt.x, tgt.y - 9);
        }
      },
      done: (tt) => tt > 1.0,
    };
  },
  assassinate(S) {
    const tgt = S.primary(); const sneak = !!S._stealth; const strikeAt = sneak ? 0.12 : 0.6; let t = 0, struck = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.45 && !sneak && Math.random() < 0.7) {
          S.p({ x: S.caster.x + rnd(-8, 8), y: S.caster.y - rnd(2, 16), vy: -rnd(8, 22), life: rnd(0.3, 0.6), max: 0.6, size: 3, color: Math.random() < 0.5 ? '#2a2438' : '#46506a', shrink: true });
        }
        if (!sneak && t > 0.4 && t < 0.41) S.tint('#0a0612', 0.4, 0.35);
        if (t >= strikeAt && !struck) {
          struck = true;
          const ex = tgt.x, ey = tgt.y - 9;
          S.beam({ x1: ex + 24, y1: ey - 22, x2: ex - 18, y2: ey + 10, color: '#fff', width: sneak ? 4 : 3, life: 0.16, max: 0.16 });
          S.beam({ x1: ex + 24, y1: ey + 10, x2: ex - 18, y2: ey - 22, color: sneak ? '#e6dcff' : PAL.gold, width: sneak ? 3 : 2, life: 0.18, max: 0.18 });
          if (sneak) S.beam({ x1: ex + 22, y1: ey - 8, x2: ex - 18, y2: ey - 8, color: '#b483f0', width: 2, life: 0.16, max: 0.16 });
          S.doFlash('#fff0e0', sneak ? 0.95 : 0.7); S.doShake(sneak ? 10 : 7); tgt.flinch = 6; tgt.tint = 1;
          burst(S, ex, ey, [PAL.gold, PAL.fireW, '#fff', '#9a1020'], sneak ? 44 : 30, sneak ? 210 : 170, { additive: true, size: 3 });
          for (let i = 0; i < (sneak ? 10 : 6); i++) S.p({ x: ex + rnd(-4, 4), y: ey + rnd(-4, 4), vx: rnd(-40, 40), vy: rnd(20, 60), g: 120, life: 0.5, max: 0.5, size: 2, color: '#9a1020' });
          if (sneak) sneakBurst(S, ex, ey); else S.floatSpr({ kind: 'critMark', x: ex, y: ey - 16, vy: -16, life: 0.7, max: 0.7 });
        }
      },
      done: (tt) => tt > 1.3,
    };
  },
  snaretrap(S) {
    const from = { x: S.caster.x + 6, y: S.caster.y - 10 }; const tgt = S.primary(); let t = 0, snapped = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.4) {
          const k = t / 0.4, x = from.x + (tgt.x - from.x) * k, y = from.y + (S.groundY - 1 - from.y) * k - Math.sin(k * Math.PI) * 24;
          S.p({ x, y, life: 0.12, max: 0.12, size: 3, color: '#9aa3c8' });
        }
        if (t >= 0.4 && t < 0.41) burst(S, tgt.x, S.groundY - 1, ['#9aa3c8', '#b9b48f'], 8, 50, { g: 40 });
        if (t > 0.4 && t < 0.95) S.floatSpr({ kind: 'trap', x: tgt.x, y: S.groundY - 1, life: 0.05, max: 0.05 });
        if (t >= 0.95 && !snapped) {
          snapped = true; S.doShake(4); tgt.flinch = 4; tgt.tint = 0.5;
          burst(S, tgt.x, S.groundY - 1, ['#cfd8ec', '#9aa3c8', '#b9b48f'], 12, 90, { up: 8 });
          const iceP = PAL.iceP || '#bfe6ff';
          S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: iceP });
        }
      },
      done: (tt) => tt > 1.4,
    };
  },
  smokebomb(S) {
    const cx = S.caster.x, cy = S.caster.y - 9; const targets = S.targets(); let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t > 0.12 && t < 0.13) {
          S.doShake(2);
          for (let i = 0; i < 18; i++) {
            const a = rnd(0, 6.28), s = rnd(30, 90);
            S.p({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 10, g: -10, drag: 0.9, life: rnd(0.6, 1.2), max: 1.2, size: (rnd(3, 6) | 0), color: Math.random() < 0.5 ? '#46506a' : '#2a2438', shrink: true });
          }
        }
        if (t < 0.9 && Math.random() < 0.7) S.p({ x: cx + rnd(-14, 14), y: cy + rnd(-8, 8), vy: -rnd(4, 14), life: rnd(0.5, 1), max: 1, size: (rnd(3, 6) | 0), color: '#3a4160', shrink: true });
        targets.forEach((e, i) => {
          if (t > 0.4 && t < 0.41) {
            const iceP = PAL.iceP || '#bfe6ff';
            S.floatSpr({ kind: 'arrowDown', x: e.x, y: e.y - 18, vy: -10, life: 0.8, max: 0.8, col: iceP });
            e.tint = 0.3;
          }
        });
      },
      done: (tt) => tt > 1.1,
    };
  },

  /* --- Mage -------------------------------------------------------------- */
  arcanebolt(S) {
    const tgt = S.primary(); const over = !!S._charge; const from = { x: S.caster.x + 6, y: S.caster.y - 13 }; let t = 0, proj = null, phase = 0;
    return {
      update(dt) {
        t += dt;
        if (t < 0.4) {
          const k = Math.min(1, t / 0.4), x = from.x + (tgt.x - from.x) * k, y = from.y + (tgt.y - 9 - from.y) * k - Math.sin(k * Math.PI) * 16;
          S.p({ x, y, size: over ? 6 : 4, color: over ? PAL.fireW : '#e6dcff', additive: true, life: 0.1, max: 0.1 });
          if (Math.random() < 0.5) S.p({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: rnd(-8, 8), vy: rnd(-8, 8), life: 0.08, max: 0.08, size: 1, color: over ? PAL.fireW : '#b483f0', additive: true });
        }
        if (t >= 0.4 && phase < 1) {
          phase = 1;
          S.doFlash(over ? PAL.fireW : '#e6dcff', over ? 0.7 : 0.4); S.doShake(over ? 6 : 3); tgt.flinch = over ? 6 : 4; tgt.tint = over ? 1 : 0.7;
          burst(S, tgt.x, tgt.y - 9, ['#e6dcff', '#b483f0', '#6a4fb0', '#fff'], over ? 34 : 22, over ? 170 : 130, { additive: true });
          if (over) chargeBurst(S, tgt.x, tgt.y - 9); else S.floatSpr({ kind: 'ring', x: tgt.x, y: tgt.y - 9, life: 0.3, max: 0.3, r0: 4, grow: 8, col: '#e6dcff' });
        }
      },
      done: (tt) => tt > 1.0,
    };
  },
  arcaneblast(S) {
    const tgt = S.primary(); const over = !!S._charge; let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.5 && Math.random() < 0.6) {
          const r = 30 - t * 40, a = rnd(0, 6.28);
          S.p({ x: tgt.x + Math.cos(a) * r, y: tgt.y - 9 + Math.sin(a) * r, vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 20, life: 0.25, max: 0.25, size: 2, color: Math.random() < 0.5 ? '#b483f0' : '#e6dcff', additive: true, shrink: true });
        }
        if (t >= 0.5 && !hit) {
          hit = true;
          S.doFlash(over ? '#fff' : '#e6dcff', over ? 1 : 0.85); S.doShake(over ? 10 : 7); tgt.flinch = 6; tgt.tint = 1;
          const cols = over ? [PAL.fireW, '#e6dcff', '#b483f0', '#fff'] : ['#e6dcff', '#b483f0', '#6a4fb0', PAL.ice, '#fff'];
          burst(S, tgt.x, tgt.y - 9, cols, over ? 64 : 44, over ? 240 : 200, { additive: true, size: 3, up: 6 });
          const ringCols = over ? [PAL.fireW, '#b483f0', '#e6dcff'] : [PAL.ice, '#b483f0', '#e6dcff'];
          for (let i = 0; i < (over ? 3 : 1); i++) {
            S.floatSpr({ kind: 'ring', x: tgt.x, y: tgt.y - 9, life: over ? 0.6 : 0.5, max: over ? 0.6 : 0.5, r0: 4, grow: over ? 58 : 46, col: ringCols[i % ringCols.length] });
          }
          if (over) chargeBurst(S, tgt.x, tgt.y - 9);
        }
      },
      done: (tt) => tt > 1.2,
    };
  },
  manashield(S) {
    const cx = S.caster.x, cy = S.caster.y - 9; let t = 0;
    return {
      update(dt) {
        t += dt;
        for (let k = 0; k < 2; k++) {
          const a = t * 7 + k * Math.PI;
          if (Math.random() < 0.5) S.p({ x: cx + Math.cos(a) * 14, y: cy + Math.sin(a) * 16, vx: -Math.cos(a) * 10, vy: -Math.sin(a) * 10, life: 0.18, max: 0.18, size: 2, color: Math.random() < 0.5 ? '#b483f0' : PAL.shield, additive: true, shrink: true });
        }
        if (t < 0.9 && Math.random() < 0.6) S.p({ x: cx + rnd(-12, 12), y: S.caster.y + rnd(-6, 6), vy: -rnd(16, 40), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? '#e6dcff' : PAL.shieldW, additive: true, shrink: true });
        if (t < 0.01) S.floatSpr({ kind: 'hex', x: cx, y: cy, life: 1.2, max: 1.2 });
      },
      done: (tt) => tt > 1.3,
    };
  },
  meditate(S) {
    const cx = S.caster.x, cy = S.caster.y - 9; let t = 0;
    return {
      update(dt) {
        t += dt;
        if (Math.random() < 0.6) {
          const a = rnd(0, 6.28), r = rnd(20, 34);
          S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * 16, vy: -Math.sin(a) * 16, life: 0.25, max: 0.25, size: 2, color: Math.random() < 0.5 ? PAL.shield : PAL.shieldW, additive: true, shrink: true });
        }
        if (t > 0.1 && t < 0.11) S.doFlash(PAL.shieldW, 0.22);
        if (t > 0.55 && t < 0.56) S.floatSpr({ kind: 'arrowUp', x: cx, y: S.caster.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.shieldW });
      },
      done: (tt) => tt > 1.1,
    };
  },
  haste(S) {
    const cx = S.caster.x, cy = S.caster.y - 9; let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t < 0.9 && Math.random() < 0.8) S.p({ x: cx - 10, y: cy + rnd(-8, 8), vx: rnd(120, 220), vy: 0, streak: rnd(8, 16), life: 0.35, max: 0.35, color: Math.random() < 0.5 ? '#fff' : PAL.shieldW, additive: true, fade: false });
        if (t < 0.9 && Math.random() < 0.5) S.p({ x: cx + rnd(-8, 8), y: S.caster.y + rnd(-6, 6), vy: -rnd(20, 46), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: PAL.shield, additive: true, shrink: true });
        if (t > 0.1 && t < 0.11) S.doFlash(PAL.shieldW, 0.26);
        if (t > 0.5 && t < 0.51) S.floatSpr({ kind: 'arrowUp', x: cx, y: S.caster.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.shieldW });
      },
      done: (tt) => tt > 1.0,
    };
  },
  masshaste(S) {
    let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t > 0.1 && t < 0.11) {
          S.doFlash(PAL.shieldW, 0.32);
          S.floatSpr({ kind: 'ring', x: S.caster.x, y: S.caster.y - 9, life: 0.6, max: 0.6, r0: 4, grow: 100, col: PAL.shield });
        }
        if (t < 1.0 && Math.random() < 0.7) S.p({ x: -10, y: S.groundY + rnd(-36, 36), vx: rnd(180, 320), vy: 0, streak: rnd(10, 18), life: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#fff' : PAL.shieldW, additive: true, fade: false });
        if (t < 0.95 && Math.random() < 0.7) S.p({ x: rnd(0, S.W), y: S.groundY - rnd(0, 24), vy: -rnd(20, 48), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: PAL.shield, additive: true, shrink: true });
        for (let i = 0; i < 4; i++) {
          const at = 0.18 + i * 0.14;
          if (t >= at && t < at + 0.01) S.floatSpr({ kind: 'arrowUp', x: S.W * (0.16 + i * 0.13), y: S.groundY - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.shieldW });
        }
      },
      done: (tt) => tt > 1.2,
    };
  },
  overcharge(S) {
    const cx = S.caster.x, cy = S.caster.y - 9; let t = 0;
    return {
      update(dt) {
        t += dt;
        S.tint('#140a22', 0.3, 0.45);
        if (Math.random() < 0.8) {
          const a = rnd(0, 6.28), r = rnd(18, 32);
          S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 2.6, life: 0.4, max: 0.4, size: 2, color: Math.random() < 0.5 ? PAL.fireW : '#b483f0', additive: true, shrink: true });
        }
        if (t < 0.95) {
          const sz = 3 + Math.round(Math.sin(t * 14) + 1);
          S.p({ x: cx, y: cy, life: 0.04, max: 0.04, size: sz, color: PAL.fireW, additive: true });
        }
        if (t > 0.1 && t < 0.11) S.doFlash(PAL.fireW, 0.3);
        if (t > 0.4 && t < 0.41) S.floatSpr({ kind: 'overMark', x: cx, y: cy - 24, vy: -10, life: 0.9, max: 0.9 });
      },
      done: (tt) => tt > 1.0,
    };
  },
  cataclysm(S) {
    const tgt = S.primary(); const ELC = [PAL.red, PAL.ice, '#b483f0', '#9ad94f', PAL.fireW]; const cx = tgt.x, cy = tgt.y - 9; let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.55) {
          S.tint('#140a22', 0.3, 0.55);
          S.floatSpr({ kind: 'magicCircle', x: cx, y: S.groundY - 2, life: 0.05, max: 0.05, k: Math.min(1, t / 0.5) });
          if (Math.random() < 0.6) {
            const a = rnd(0, 6.28), r = rnd(38, 4);
            S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30, life: 0.25, max: 0.25, size: 2, color: ELC[Math.floor(Math.random() * ELC.length)], additive: true, shrink: true });
          }
        }
        if (t >= 0.5 && t < 0.95) {
          if (Math.random() < 0.9) {
            S.beam({ x1: cx + rnd(-26, 26), y1: -2, x2: cx + rnd(-26, 26), y2: S.groundY, color: ELC[Math.floor(Math.random() * ELC.length)], width: rnd(2, 5), life: 0.1, max: 0.1 });
            S.p({ x: cx + rnd(-26, 26), y: -12, vy: 220, life: 0.15, max: 0.15, size: 2, color: ELC[Math.floor(Math.random() * ELC.length)], additive: true, shrink: true });
          }
          if (Math.random() < 0.5) S.doFlash(ELC[Math.floor(Math.random() * ELC.length)], 0.14);
          S.doShake(2.5);
        }
        if (t >= 0.92 && !hit) {
          hit = true;
          S.doFlash('#fff', 0.95); S.doShake(9); tgt.flinch = 6; tgt.tint = 1;
          for (let i = 0; i < ELC.length; i++) burst(S, cx, cy, [ELC[i], '#fff'], 12, 150 + i * 12, { additive: true, size: 3, up: 8 });
          for (let i = 0; i < 3; i++) S.floatSpr({ kind: 'ring', x: cx, y: cy, life: 0.6, max: 0.6, r0: 4, grow: 60, col: '#e6dcff' });
          for (let i = 0; i < 18; i++) S.p({ x: cx + rnd(-10, 10), y: cy, vy: -rnd(40, 120), life: rnd(0.5, 1), max: 1, size: 2, color: ELC[i % ELC.length], additive: true, shrink: true });
        }
      },
      done: (tt) => tt > 1.7,
    };
  },

  /* --- Knight ------------------------------------------------------------ */
  masheal(S) {
    let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t > 0.1 && t < 0.11) {
          S.doFlash(PAL.healW, 0.35);
          S.floatSpr({ kind: 'ring', x: S.caster.x, y: S.caster.y - 9, life: 0.6, max: 0.6, r0: 4, grow: 80, col: PAL.heal });
        }
        if (t < 1.0 && Math.random() < 0.7) S.p({ x: rnd(0, S.W), y: S.groundY - rnd(0, 30), vy: -rnd(24, 56), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: Math.random() < 0.5 ? PAL.heal : PAL.healW, additive: true, shrink: true });
        if (Math.random() < 0.35) S.p({ x: rnd(0, S.W), y: S.groundY - rnd(0, 30), vy: -rnd(24, 56), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: PAL.gold, additive: true, shrink: true });
        if (t < 0.7 && Math.random() < 0.25) S.beam({ x1: rnd(S.W * 0.1, S.W * 0.95), y1: -2, x2: rnd(S.W * 0.1, S.W * 0.95), y2: S.groundY, color: PAL.healW, width: rnd(2, 4), life: 0.12, max: 0.12 });
        if (t < 0.9 && Math.random() < 0.18) S.floatSpr({ kind: 'cross', x: rnd(S.W * 0.08, S.W * 0.95), y: S.groundY - rnd(6, 30), life: 0.4, max: 0.4 });
      },
      done: (tt) => tt > 1.3,
    };
  },
  masscleanse(S) {
    let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t > 0.1 && t < 0.11) {
          S.doFlash('#eafcf8', 0.4);
          S.floatSpr({ kind: 'ring', x: S.caster.x, y: S.caster.y - 9, life: 0.7, max: 0.7, r0: 4, grow: 120, col: '#7fded0' });
          S.floatSpr({ kind: 'ring', x: S.caster.x, y: S.caster.y - 9, life: 0.5, max: 0.5, r0: 4, grow: 90, col: '#fff' });
        }
        if (t < 0.9) {
          const dist = t * 360, a = rnd(0, 6.28);
          S.p({ x: S.caster.x + Math.cos(a) * dist, y: S.caster.y - 9 + Math.sin(a) * dist * 0.6, life: 0.12, max: 0.12, size: 2, color: Math.random() < 0.5 ? '#7fded0' : '#eafcf8', additive: true });
        }
        if (t < 1.0 && Math.random() < 0.6) S.p({ x: rnd(0, S.W), y: S.groundY - rnd(0, 26), vy: -rnd(20, 50), life: rnd(0.5, 1), max: 1, size: 2, color: Math.random() < 0.5 ? '#eafcf8' : '#fff', additive: true, shrink: true });
        if (t < 0.7 && Math.random() < 0.4) S.p({ x: rnd(S.W * 0.1, S.W * 0.95), y: S.groundY - rnd(4, 24), vx: rnd(-16, 16), vy: -rnd(24, 52), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: ['#9ad94f', '#b59cff', '#d98446'][Math.floor(Math.random() * 3)] });
        if (t < 0.9 && Math.random() < 0.2) S.floatSpr({ kind: 'star4', x: rnd(S.W * 0.08, S.W * 0.95), y: S.groundY - rnd(6, 30), life: 0.35, max: 0.35, col: '#eafcf8' });
      },
      done: (tt) => tt > 1.3,
    };
  },
  masbarrier(S) {
    const domes = [];
    for (let i = 0; i < 4; i++) domes.push({ x: S.W * (0.14 + i * 0.13), at: 0.12 + i * 0.1 });
    let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t > 0.1 && t < 0.11) {
          S.doFlash(PAL.shieldW, 0.34);
          S.floatSpr({ kind: 'ring', x: S.caster.x, y: S.caster.y - 9, life: 0.7, max: 0.7, r0: 4, grow: 120, col: PAL.shield });
          S.floatSpr({ kind: 'ring', x: S.caster.x, y: S.caster.y - 9, life: 0.5, max: 0.5, r0: 4, grow: 80, col: PAL.gold });
        }
        domes.forEach(d => {
          if (t >= d.at && t < d.at + 0.01) {
            S.floatSpr({ kind: 'hex', x: d.x, y: S.groundY - 6, life: 1.0, max: 1.0 });
            burst(S, d.x, S.groundY - 6, [PAL.shield, PAL.shieldW], 6, 40, { up: 20, additive: true });
          }
        });
        if (t < 0.95 && Math.random() < 0.6) S.p({ x: rnd(0, S.W), y: S.groundY - rnd(0, 24), vy: -rnd(14, 38), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? PAL.shieldW : PAL.gold, additive: true, shrink: true });
        if (t > 0.45 && t < 0.46) S.floatSpr({ kind: 'shieldMark', x: S.caster.x, y: S.caster.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.shieldW });
      },
      done: (tt) => tt > 1.3,
    };
  },

  // === 인연공격 (bond strikes) — DUO choreographies. Both S.caster AND S.partner
  // are origins (partner is null for every solo spell). The two heroes strike
  // together; the pair's class identity drives the look (성기사 holy / 협공 steel).
  // Cosmetic only — resolved by the bondStrike action in battle.js. ===

  // 맹세의 돌격 (기사×전사): twin holy charge lines converge into a gold smite.
  duo_oath_charge(S) {
    const tgt = S.primary() || S.caster; const co = S.caster; const po = S.partner || S.caster;
    castHop(S); S.caster.hop = 5; if (S.partner) S.partner.hop = 5;
    let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        // two converging streaks from both heroes toward the target
        for (const o of [co, po]) {
          const k = Math.min(1, t / 0.34);
          const x = o.x + (tgt.x - o.x) * k, y = (o.y - 9) + ((tgt.y - 9) - (o.y - 9)) * k;
          S.p({ x, y, vx: rnd(-6, 6), vy: rnd(-6, 6), life: 0.22, max: 0.22, size: 2, color: Math.random() < 0.5 ? PAL.gold : PAL.goldGlow, additive: true, shrink: true });
        }
        if (t >= 0.34 && !hit) {
          hit = true;
          burst(S, tgt.x, tgt.y - 9, [PAL.goldGlow, PAL.gold, PAL.fireW, '#fff'], 26, 150, { additive: true, up: 6 });
          S.floatSpr({ kind: 'star4', x: tgt.x, y: tgt.y - 9, life: 0.5, max: 0.5, col: PAL.goldGlow });
          S.floatSpr({ kind: 'ring', x: tgt.x, y: tgt.y - 9, life: 0.6, max: 0.6, r0: 4, grow: 30, col: PAL.gold });
          S.doFlash(PAL.goldGlow, 0.5); S.doShake(4);
        }
      },
      done: (tt) => tt > 0.95,
    };
  },

  // 축복받은 연사 (사냥꾼×기사): blessed arrows rain on every foe (FX_ALL_TARGET).
  duo_hallowed_volley(S) {
    const targets = S.targets(); const co = S.caster; const po = S.partner || S.caster;
    castHop(S); if (S.partner) S.partner.hop = 4; S.tint(PAL.goldGlow, 0.16, 1.1);
    let t = 0; const next = targets.map(() => rnd(0.05, 0.3));
    return {
      update(dt) {
        t += dt;
        targets.forEach((e, i) => {
          next[i] -= dt;
          if (next[i] <= 0 && t < 1.0) {
            next[i] = rnd(0.12, 0.26);
            const from = Math.random() < 0.5 ? co : po; // arrows fly from both heroes
            const fx = from.x + 6, fy = from.y - 10;
            const sp = Math.hypot(e.x - fx, (e.y - 9) - fy) || 1;
            const ux = (e.x - fx) / sp, uy = ((e.y - 9) - fy) / sp;
            S.p({ x: fx, y: fy, vx: ux * 220, vy: uy * 220, life: 0.16, max: 0.16, size: 1, color: PAL.goldGlow, streak: 9, head: true, headColor: '#fff', fade: false });
            S.schedule(0.14, () => { burst(S, e.x, e.y - 9, [PAL.goldGlow, PAL.gold, '#fff'], 8, 90, { additive: true }); });
          }
        });
        if (t > 0.05 && t < 0.09) S.doFlash(PAL.goldGlow, 0.22);
      },
      done: (tt) => tt > 1.15,
    };
  },

  // 협공 (사냥꾼×전사): warrior slam + hunter follow-up — a steel two-beat on one foe.
  duo_pincer(S) {
    const tgt = S.primary() || S.caster; const co = S.caster; const po = S.partner || S.caster;
    castHop(S); let t = 0, a = false, b = false;
    return {
      update(dt) {
        t += dt;
        if (t >= 0.12 && !a) { // warrior crashes in
          a = true;
          S.beam({ x1: co.x + 6, y1: co.y - 9, x2: tgt.x, y2: tgt.y - 9, life: 0.14, max: 0.14, color: PAL.fireW, width: 2 });
          burst(S, tgt.x, tgt.y - 9, [PAL.red, '#ff8a5a', PAL.fireW], 14, 120, { additive: true });
          S.doShake(3);
        }
        if (t >= 0.34 && !b) { // hunter strikes the opening
          b = true;
          S.beam({ x1: po.x + 6, y1: po.y - 10, x2: tgt.x, y2: tgt.y - 9, life: 0.14, max: 0.14, color: PAL.goldGlow, width: 1, jag: 3 });
          burst(S, tgt.x, tgt.y - 9, [PAL.gold, PAL.goldGlow, '#fff'], 18, 150, { additive: true, up: 4 });
          S.floatSpr({ kind: 'critMark', x: tgt.x, y: tgt.y - 12, vy: -12, life: 0.5, max: 0.5 });
          S.doFlash(PAL.gold, 0.32); S.doShake(4);
        }
      },
      done: (tt) => tt > 0.85,
    };
  },

  // 천공의 심판 (기사×법사): a radiant-arcane nova washes every foe (FX_ALL_TARGET).
  duo_radiant_nova(S) {
    const targets = S.targets(); const co = S.caster; const po = S.partner || S.caster;
    castHop(S); if (S.partner) S.partner.hop = 5; S.tint('#e6dcff', 0.2, 1.1);
    let t = 0, burst1 = false; const struck = targets.map(() => false);
    return {
      update(dt) {
        t += dt;
        // both heroes channel a shared rising glyph before the nova
        if (t < 0.34) for (const o of [co, po]) S.p({ x: o.x + rnd(-4, 4), y: o.y - 11 + rnd(-3, 3), vy: -rnd(20, 50), life: 0.4, max: 0.4, size: 2, color: Math.random() < 0.5 ? PAL.goldGlow : '#b483f0', additive: true, shrink: true });
        if (t >= 0.16 && t < 0.2 && !burst1) { burst1 = true; S.floatSpr({ kind: 'magicCircle', x: (co.x + po.x) / 2, y: (co.y + po.y) / 2 - 9, life: 0.6, max: 0.6, k: 1 }); }
        // staggered radiant detonations on each foe
        targets.forEach((e, i) => {
          if (!struck[i] && t >= 0.36 + i * 0.07) {
            struck[i] = true;
            burst(S, e.x, e.y - 9, ['#fff', PAL.goldGlow, '#b483f0', PAL.gold], 20, 140, { additive: true, up: 4 });
            S.floatSpr({ kind: 'star4', x: e.x, y: e.y - 9, life: 0.5, max: 0.5, col: '#fff' });
            S.floatSpr({ kind: 'ring', x: e.x, y: e.y - 9, life: 0.55, max: 0.55, r0: 3, grow: 26, col: PAL.goldGlow });
          }
        });
        if (t > 0.34 && t < 0.38) { S.doFlash('#fff', 0.5); S.doShake(4); }
      },
      done: (tt) => tt > 1.1,
    };
  },

  // 작열참 (전사×법사): mage ignites the warrior's blade — one blazing cleave.
  duo_blazing_cleave(S) {
    const tgt = S.primary() || S.caster; const co = S.caster; const po = S.partner || S.caster;
    castHop(S); let t = 0, lit = false, slam = false;
    return {
      update(dt) {
        t += dt;
        if (t >= 0.1 && !lit) { // the mage's flame wreathes the blade
          lit = true;
          burst(S, po.x + 6, po.y - 10, [PAL.fireR, PAL.fireY, PAL.fireW], 12, 90, { additive: true, up: 4 });
          S.p({ x: co.x + 6, y: co.y - 10, life: 0.3, max: 0.3, size: 3, color: PAL.fireW, additive: true });
        }
        if (t >= 0.32 && !slam) { // the warrior crashes it down
          slam = true;
          S.beam({ x1: co.x + 6, y1: co.y - 11, x2: tgt.x, y2: tgt.y - 9, life: 0.16, max: 0.16, color: PAL.fireW, width: 3 });
          burst(S, tgt.x, tgt.y - 9, [PAL.fireDeep, PAL.fireR, PAL.fireY, PAL.fireW], 28, 170, { additive: true, up: 6, g: 30 });
          for (let i = 0; i < 8; i++) S.p({ x: tgt.x + rnd(-6, 6), y: tgt.y - 6, vy: -rnd(20, 60), g: 80, life: 0.6, max: 0.6, size: 2, color: PAL.fireR });
          S.floatSpr({ kind: 'ring', x: tgt.x, y: tgt.y - 9, life: 0.6, max: 0.6, r0: 4, grow: 30, col: PAL.fireY });
          S.doFlash(PAL.fireY, 0.45); S.doShake(5);
        }
      },
      done: (tt) => tt > 0.9,
    };
  },

  // 마탄 연사 (사냥꾼×법사): arcane-charged arrows from both heroes, a 3-shot pierce.
  duo_arcane_volley(S) {
    const tgt = S.primary() || S.caster; const co = S.caster; const po = S.partner || S.caster;
    castHop(S); let t = 0, shot = 0; const times = [0.12, 0.3, 0.48];
    return {
      update(dt) {
        t += dt;
        while (shot < times.length && t >= times[shot]) {
          const from = shot % 2 === 0 ? co : po; // alternate the two heroes
          const fx = from.x + 6, fy = from.y - 10;
          const sp = Math.hypot(tgt.x - fx, (tgt.y - 9) - fy) || 1;
          const ux = (tgt.x - fx) / sp, uy = ((tgt.y - 9) - fy) / sp;
          S.p({ x: fx, y: fy, vx: ux * 240, vy: uy * 240, life: 0.16, max: 0.16, size: 1, color: '#b483f0', streak: 10, head: true, headColor: PAL.thunderB, fade: false });
          S.schedule(0.13, () => {
            burst(S, tgt.x, tgt.y - 9, ['#b483f0', PAL.thunderB, '#fff'], 12, 120, { additive: true });
            S.beam({ x1: tgt.x, y1: tgt.y - 16, x2: tgt.x, y2: tgt.y - 2, life: 0.1, max: 0.1, color: PAL.thunderB, width: 1, jag: 2 });
          });
          shot++;
        }
        if (t > 0.5 && t < 0.54) { S.doFlash('#b483f0', 0.3); S.doShake(3); }
      },
      done: (tt) => tt > 0.85,
    };
  },

  // === 인연 필살기 (trio/quad ults) — MULTI-origin: every participant (S.caster +
  // S.partners) channels into one climactic AoE. Generic by size; cosmetic only. ===

  // 삼중 합주 (트리오): three light streams converge, then a radiant wave on all foes.
  bond_ult_trio(S) {
    const origins = [S.caster, ...S.partners];
    const targets = S.targets(); for (const o of origins) o.hop = 5;
    const cx = origins.reduce((s, o) => s + o.x, 0) / origins.length;
    const cy = origins.reduce((s, o) => s + o.y, 0) / origins.length - 10;
    S.tint('#e6dcff', 0.22, 1.3);
    let t = 0, conv = false; const struck = targets.map(() => false);
    return {
      update(dt) {
        t += dt;
        // converge: streams from each hero into the shared focus
        if (t < 0.4) for (const o of origins) {
          const k = Math.min(1, t / 0.4);
          S.p({ x: o.x + (cx - o.x) * k, y: (o.y - 9) + (cy - (o.y - 9)) * k, vx: rnd(-5, 5), vy: rnd(-5, 5), life: 0.22, max: 0.22, size: 2, color: Math.random() < 0.5 ? PAL.goldGlow : '#b483f0', additive: true, shrink: true });
        }
        if (t >= 0.4 && !conv) {
          conv = true;
          burst(S, cx, cy, ['#fff', PAL.goldGlow, '#b483f0', PAL.gold], 26, 150, { additive: true });
          S.floatSpr({ kind: 'magicCircle', x: cx, y: cy, life: 0.5, max: 0.5, k: 1 });
          S.doFlash('#fff', 0.45);
        }
        // radiant wave hits each foe
        targets.forEach((e, i) => {
          if (!struck[i] && t >= 0.5 + i * 0.06) {
            struck[i] = true;
            burst(S, e.x, e.y - 9, ['#fff', PAL.goldGlow, '#b483f0'], 18, 150, { additive: true, up: 5 });
            S.floatSpr({ kind: 'ring', x: e.x, y: e.y - 9, life: 0.55, max: 0.55, r0: 3, grow: 28, col: PAL.goldGlow });
            S.doShake(2);
          }
        });
      },
      done: (tt) => tt > 1.25,
    };
  },

  // 운명의 대합주 (쿼드): four origins raise pillars, then a prismatic nova washes all.
  bond_ult_quad(S) {
    const origins = [S.caster, ...S.partners];
    const targets = S.targets(); for (const o of origins) o.hop = 6;
    const COLS = [PAL.goldGlow, '#b483f0', PAL.thunderB, PAL.fireY, '#fff'];
    S.tint('#1a1230', 0.4, 1.5);
    let t = 0, nova = false; const struck = targets.map(() => false);
    return {
      update(dt) {
        t += dt;
        // charge: rising pillars from every hero
        if (t < 0.5) for (const o of origins) S.p({ x: o.x + rnd(-5, 5), y: o.y - 9, vy: -rnd(40, 90), life: 0.5, max: 0.5, size: 2, color: COLS[(Math.random() * COLS.length) | 0], additive: true, shrink: true });
        if (t >= 0.2 && t < 0.24) for (const o of origins) S.floatSpr({ kind: 'magicCircle', x: o.x, y: o.y - 9, life: 0.6, max: 0.6, k: 1 });
        if (t >= 0.5 && !nova) {
          nova = true;
          S.doFlash('#fff', 0.7); S.doShake(7); S.tint('#fff', 0.5, 0.3);
        }
        // prismatic nova: a heavy staggered detonation on each foe + sky shards
        targets.forEach((e, i) => {
          if (!struck[i] && t >= 0.54 + i * 0.05) {
            struck[i] = true;
            burst(S, e.x, e.y - 9, COLS, 30, 190, { additive: true, up: 8, g: 20 });
            S.floatSpr({ kind: 'star4', x: e.x, y: e.y - 9, life: 0.6, max: 0.6, col: '#fff' });
            S.floatSpr({ kind: 'ring', x: e.x, y: e.y - 9, life: 0.7, max: 0.7, r0: 4, grow: 38, col: PAL.goldGlow });
            for (let k = 0; k < 6; k++) S.p({ x: e.x + rnd(-8, 8), y: e.y - 20, vy: rnd(40, 90), g: 60, life: 0.5, max: 0.5, size: 2, color: COLS[k % COLS.length], additive: true });
            S.doShake(4);
          }
        });
      },
      done: (tt) => tt > 1.45,
    };
  },

  // === 쌍검사(duelist) — gunslinger kit. 총구 화염 + 탄피 + 트레이서 + 폭발 + 출혈.
  // 기존 프리미티브만(gunshot/bloodDrops/burst). fragbomb/buckshot/fullburst/소이탄은
  // FX_ALL_TARGET. fullburst는 ult:true라 battleScene가 컷신으로 감싼다. ===
  quickdraw(S) {
    const tgt = S.primary() || S.caster; const from = { x: S.caster.x + 6, y: S.caster.y - 10 };
    castHop(S); let t = 0, n = 0; const times = [0.05, 0.18, 0.31, 0.44];
    return { update(dt) { t += dt; while (n < times.length && t >= times[n]) { gunshot(S, from, tgt); n++; } if (t > 0.05 && t < 0.08) S.doShake(2); }, done: (tt) => tt > 0.8 };
  },
  rend(S) {
    const tgt = S.primary() || S.caster; castHop(S); let t = 0, n = 0; const times = [0.08, 0.22, 0.36];
    return { update(dt) { t += dt; while (n < times.length && t >= times[n]) { const off = (n - 1) * 8; S.beam({ x1: tgt.x - 20, y1: tgt.y - 18 + off, x2: tgt.x + 20, y2: tgt.y + off, color: DL.steel, width: 2, life: 0.12, max: 0.12 }); burst(S, tgt.x, tgt.y - 9, [DL.steel, DL.blood, '#fff'], 8, 110, { additive: true }); n++; } if (Math.abs(t - 0.4) < dt) { bloodDrops(S, tgt.x, tgt.y); S.doShake(3); } }, done: (tt) => tt > 0.9 };
  },
  shurikenflurry(S) {
    const tgt = S.primary() || S.caster; const from = { x: S.caster.x + 6, y: S.caster.y - 10 }; castHop(S); let t = 0, n = 0; const times = [0.04, 0.14, 0.24, 0.34, 0.44];
    return { update(dt) { t += dt; while (n < times.length && t >= times[n]) { const sp = Math.hypot(tgt.x - from.x, (tgt.y - 9) - from.y) || 1; const ux = (tgt.x - from.x) / sp, uy = ((tgt.y - 9) - from.y) / sp; S.p({ x: from.x, y: from.y, vx: ux * 220, vy: uy * 220, life: 0.16, max: 0.16, size: 2, color: DL.steel, streak: 6, head: true, headColor: '#fff', fade: false }); S.schedule(0.13, () => burst(S, tgt.x, tgt.y - 9, [DL.steel, '#fff'], 6, 90, { additive: true })); n++; } }, done: (tt) => tt > 0.85 };
  },
  smokegrenade(S) {
    const cx = S.caster.x, cy = S.caster.y - 9; castHop(S); let t = 0;
    return { update(dt) { t += dt; if (t < 0.6 && Math.random() < 0.8) S.p({ x: cx + rnd(-12, 12), y: cy + rnd(-8, 8), vx: rnd(-10, 10), vy: -rnd(6, 18), life: rnd(0.5, 1.0), max: 1.0, size: (rnd(3, 6) | 0) || 3, color: Math.random() < 0.5 ? '#9aa3c8' : '#5a6478', additive: true, shrink: true }); if (Math.abs(t - 0.1) < dt) S.floatSpr({ kind: 'ring', x: cx, y: cy, life: 0.5, max: 0.5, r0: 3, grow: 24, col: '#cfd8ec' }); }, done: (tt) => tt > 1.0 };
  },
  fragbomb(S) {
    const targets = S.targets(); castHop(S); S.tint(PAL.fireDeep, 0.2, 1.0); let t = 0; const struck = targets.map(() => false);
    return { update(dt) { t += dt; targets.forEach((e, i) => { if (!struck[i] && t >= 0.2 + i * 0.08) { struck[i] = true; burst(S, e.x, e.y - 9, [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep], 22, 160, { additive: true, up: 6, g: 30 }); S.floatSpr({ kind: 'ring', x: e.x, y: e.y - 9, life: 0.5, max: 0.5, r0: 3, grow: 26, col: PAL.fireY }); S.doShake(3); } }); if (t > 0.2 && t < 0.24) S.doFlash(PAL.fireY, 0.4); }, done: (tt) => tt > 1.0 };
  },
  buckshot(S) {
    const targets = S.targets(); const from = { x: S.caster.x + 6, y: S.caster.y - 10 }; castHop(S); let t = 0, fired = false;
    return { update(dt) { t += dt; if (!fired && t >= 0.08) { fired = true; S.p({ x: from.x, y: from.y, life: 0.1, max: 0.1, size: 4, color: DL.spark, additive: true }); S.doShake(3); for (const e of targets) { for (let k = 0; k < 4; k++) { const sp = Math.hypot(e.x - from.x, (e.y - 9) - from.y) || 1; const ux = (e.x - from.x) / sp + rnd(-0.2, 0.2), uy = ((e.y - 9) - from.y) / sp; S.p({ x: from.x, y: from.y, vx: ux * 240, vy: uy * 240, life: 0.14, max: 0.14, size: 1, color: DL.steel, streak: 7, fade: false }); } S.schedule(0.12, () => { burst(S, e.x, e.y - 9, [DL.steel, DL.blood, '#fff'], 7, 100, { additive: true }); bloodDrops(S, e.x, e.y); }); } } }, done: (tt) => tt > 0.85 };
  },
  headshot(S) {
    const tgt = S.primary() || S.caster; const from = { x: S.caster.x + 6, y: S.caster.y - 11 }; castHop(S); let t = 0, hit = false;
    return { update(dt) { t += dt; if (t < 0.3 && Math.random() < 0.6) S.p({ x: from.x + rnd(-3, 3), y: from.y + rnd(-3, 3), life: 0.2, max: 0.2, size: 2, color: PAL.gold, additive: true }); if (!hit && t >= 0.3) { hit = true; gunshot(S, from, tgt, PAL.goldGlow); S.beam({ x1: from.x, y1: from.y, x2: tgt.x, y2: tgt.y - 9, color: PAL.goldGlow, width: 2, life: 0.16, max: 0.16 }); burst(S, tgt.x, tgt.y - 9, [PAL.goldGlow, PAL.gold, '#fff'], 22, 170, { additive: true }); S.floatSpr({ kind: 'critMark', x: tgt.x, y: tgt.y - 12, vy: -12, life: 0.6, max: 0.6 }); S.doFlash(PAL.goldGlow, 0.5); S.doShake(5); } }, done: (tt) => tt > 0.9 };
  },
  fullburst(S) {
    const targets = S.targets(); const from = { x: S.caster.x + 6, y: S.caster.y - 10 }; castHop(S); S.tint(PAL.fireDeep, 0.3, 1.3); let t = 0; const next = targets.map(() => rnd(0.05, 0.2));
    return { update(dt) { t += dt; targets.forEach((e, i) => { next[i] -= dt; if (next[i] <= 0 && t < 1.0) { next[i] = rnd(0.08, 0.18); gunshot(S, from, e, Math.random() < 0.5 ? DL.spark : PAL.fireY); } }); if (t > 0.5 && t < 0.54) { S.doFlash(PAL.fireW, 0.6); S.doShake(6); for (const e of targets) burst(S, e.x, e.y - 9, [PAL.fireW, PAL.fireY, PAL.fireR], 20, 170, { additive: true, up: 6, g: 20 }); } }, done: (tt) => tt > 1.25 };
  },

  // 쌍검사 인연기 (duelist duos) — multi-origin gunfire (S.caster + S.partner).
  duo_steelstorm(S) {
    const tgt = S.primary() || S.caster; const co = S.caster; const po = S.partner || S.caster; for (const o of [co, po]) o.hop = 5; let t = 0, n = 0; const times = [0.1, 0.24, 0.38, 0.52];
    return { update(dt) { t += dt; while (n < times.length && t >= times[n]) { const fr = n % 2 ? po : co; gunshot(S, { x: fr.x + 6, y: fr.y - 10 }, tgt, DL.steel); S.beam({ x1: tgt.x - 22, y1: tgt.y - 16, x2: tgt.x + 22, y2: tgt.y + 2, color: DL.steel, width: 2, life: 0.12, max: 0.12 }); n++; } if (Math.abs(t - 0.56) < dt) { S.doFlash('#fff', 0.4); S.doShake(4); } }, done: (tt) => tt > 0.9 };
  },
  duo_incendiary(S) {
    const targets = S.targets(); castHop(S); S.tint(PAL.fireDeep, 0.28, 1.2); let t = 0; const struck = targets.map(() => false);
    return { update(dt) { t += dt; targets.forEach((e, i) => { if (!struck[i] && t >= 0.18 + i * 0.07) { struck[i] = true; burst(S, e.x, e.y - 9, [PAL.fireW, PAL.fireY, PAL.fireR, '#b483f0'], 24, 170, { additive: true, up: 6, g: 25 }); for (let k = 0; k < 6; k++) S.p({ x: e.x + rnd(-8, 8), y: e.y - 6, vy: -rnd(20, 60), g: 70, life: 0.6, max: 0.6, size: 2, color: PAL.fireR }); S.doShake(3); } }); if (t > 0.18 && t < 0.22) S.doFlash(PAL.fireY, 0.45); }, done: (tt) => tt > 1.1 };
  },
  duo_crossfire(S) {
    const tgt = S.primary() || S.caster; const co = S.caster; const po = S.partner || S.caster; for (const o of [co, po]) o.hop = 4; let t = 0, n = 0; const times = [0.06, 0.16, 0.26, 0.36, 0.46, 0.56];
    return { update(dt) { t += dt; while (n < times.length && t >= times[n]) { const fr = n % 2 ? po : co; gunshot(S, { x: fr.x + 6, y: fr.y - 10 }, tgt, n % 2 ? PAL.gold : DL.spark); n++; } if (Math.abs(t - 0.6) < dt) { S.floatSpr({ kind: 'critMark', x: tgt.x, y: tgt.y - 12, vy: -12, life: 0.5, max: 0.5 }); S.doFlash(PAL.gold, 0.35); S.doShake(4); } }, done: (tt) => tt > 0.9 };
  },

  // 공생 연격 (동료 인연기) — a hero + the recruited monster ally cross-strike, 4-hit.
  duo_symbiosis(S) {
    const tgt = S.primary() || S.caster; const co = S.caster; const po = S.partner || S.caster; for (const o of [co, po]) o.hop = 4; let t = 0, n = 0; const times = [0.08, 0.2, 0.32, 0.44];
    return { update(dt) { t += dt; while (n < times.length && t >= times[n]) { const fr = n % 2 ? po : co; S.beam({ x1: fr.x + 6, y1: fr.y - 10, x2: tgt.x, y2: tgt.y - 9, color: n % 2 ? PAL.gold : PAL.iceW, width: 2, life: 0.12, max: 0.12 }); burst(S, tgt.x, tgt.y - 9, [PAL.gold, PAL.iceW, '#fff'], 8, 110, { additive: true }); n++; } if (Math.abs(t - 0.48) < dt) { S.doFlash('#fff', 0.35); S.doShake(4); } }, done: (tt) => tt > 0.85 };
  },

  // === Monster skills (enemy-side kit) — ported from share4/js/spellfx-monster.js.
  // caster = the monster, S.primary()/S.targets() = the hero target(s). Cosmetic
  // only; resolved by resolveMonsterSkill in battle.js. summon FX deferred. ===
  firebreath(S) {
    castHop(S); const targets = S.targets(); let t = 0; const fx = S.caster.x + 8, fy = S.caster.y - 12;
    return {
      update(dt) {
        t += dt;
        if (t < 0.7) {
          for (let i = 0; i < 5; i++) { const a = rnd(-0.4, 0.4), sp = rnd(120, 300);
            S.p({ x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 30, drag: 0.95, life: rnd(0.3, 0.7), max: 0.7, size: (rnd(2, 4) | 0), color: [PAL.fireW, PAL.fireY, PAL.fireR, PAL.fireDeep][(rnd(0, 4) | 0)], additive: true }); }
          if (Math.random() < 0.4) S.doFlash(PAL.fireY, 0.12); S.doShake(2);
        }
        if (Math.abs(t - 0.5) < dt) {
          S.doFlash(PAL.fireY, 0.4);
          for (const tgt of targets) { tgt.flinch = 4; tgt.tint = 0.7; burst(S, tgt.x, tgt.y - 9, [PAL.fireW, PAL.fireY, PAL.fireR], 14, 120, { additive: true, up: 10 }); }
        }
      },
      done: (tt) => tt > 1.1,
    };
  },
  venomspit(S) {
    castHop(S); const tgt = S.primary(); let t = 0, hit = false; const fx = S.caster.x + 7, fy = S.caster.y - 11;
    return {
      update(dt) {
        t += dt;
        if (t < 0.35 && tgt) { const k = t / 0.35, x = fx + (tgt.x - fx) * k, y = fy + (tgt.y - 9 - fy) * k - Math.sin(k * Math.PI) * 20;
          for (let i = 0; i < 2; i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), life: 0.25, max: 0.25, size: 3, color: Math.random() < 0.5 ? PAL.poison : PAL.poisonD, additive: true, shrink: true }); }
        if (!hit && t >= 0.35 && tgt) { hit = true; S.doShake(2); tgt.flinch = 3; tgt.tint = 0.5;
          burst(S, tgt.x, tgt.y - 9, [PAL.poison, PAL.poisonD, PAL.healW], 16, 90, { additive: true, up: 8 });
          for (let i = 0; i < 5; i++) S.p({ x: tgt.x + rnd(-8, 8), y: tgt.y - rnd(2, 16), vy: -rnd(8, 18), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: PAL.poison, additive: true, shrink: true });
          S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.poison }); }
      },
      done: (tt) => tt > 1.2,
    };
  },
  monslam(S) {
    castHop(S); const tgt = S.primary(); let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        if (t < 0.34) S.caster.hop = 5;
        if (!hit && t >= 0.34 && tgt) { hit = true; S.doFlash('#d8c0a0', 0.5); S.doShake(8); tgt.flinch = 5; tgt.tint = 0.6;
          for (let dir = -1; dir <= 1; dir += 2) for (let i = 0; i < 9; i++) S.p({ x: tgt.x, y: S.groundY, vx: dir * rnd(60, 200), vy: -rnd(10, 60), g: 280, drag: 0.97, life: rnd(0.3, 0.7), max: 0.7, size: (rnd(1, 3) | 0) || 2, color: [PAL.dust, PAL.earth, PAL.earthD][i % 3] });
          burst(S, tgt.x, tgt.y - 8, [PAL.dust, '#fff', PAL.earth], 14, 120, { up: 12, additive: true }); }
      },
      done: (tt) => tt > 1.0,
    };
  },
  lifedrain(S) {
    castHop(S); const tgt = S.primary(); let t = 0; const cx = S.caster.x, cy = S.caster.y - 10;
    return {
      update(dt) {
        t += dt;
        if (tgt && t > 0.15 && t < 0.85) {
          if (Math.random() < 0.9) { const k = Math.random(); S.p({ x: tgt.x + (cx - tgt.x) * k + rnd(-3, 3), y: (tgt.y - 9) + (cy - (tgt.y - 9)) * k + rnd(-3, 3), life: 0.2, max: 0.2, size: 2, color: Math.random() < 0.5 ? PAL.thunderP : '#6a4fb0', additive: true, shrink: true }); }
          tgt.tint = 0.5;
        }
        if (tgt && Math.abs(t - 0.2) < dt) S.beam({ x1: tgt.x, y1: tgt.y - 9, x2: cx, y2: cy, color: PAL.thunderP, width: 2, jag: 3, life: 0.4, max: 0.4 });
        if (t > 0.3 && Math.random() < 0.5) S.p({ x: cx + rnd(-6, 6), y: cy + rnd(-4, 4), vy: -rnd(16, 36), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: PAL.heal, additive: true, shrink: true });
        if (tgt && Math.abs(t - 0.5) < dt) { tgt.flinch = 3; S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.thunderP }); }
      },
      done: (tt) => tt > 1.1,
    };
  },
  monshock(S) {
    castHop(S); const tgt = S.primary(); let t = 0, hit = false;
    return {
      update(dt) {
        t += dt;
        if (!hit && t >= 0.25 && tgt) { hit = true;
          S.beam({ x1: S.caster.x + 6, y1: S.caster.y - 12, x2: tgt.x, y2: tgt.y - 9, color: PAL.thunder, width: 2, jag: 7, life: 0.18, max: 0.18 });
          S.beam({ x1: S.caster.x + 6, y1: S.caster.y - 12, x2: tgt.x, y2: tgt.y - 9, color: PAL.thunderB, width: 4, jag: 9, life: 0.12, max: 0.12 });
          S.doFlash('#fffbe0', 0.5); S.doShake(4); tgt.flinch = 4; tgt.tint = 0.8;
          burst(S, tgt.x, tgt.y - 9, [PAL.thunder, PAL.thunderB, '#fff'], 16, 110, { additive: true });
          S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.thunderB }); }
        if (hit && tgt && t < 0.9 && Math.random() < 0.4) S.p({ x: tgt.x + rnd(-8, 8), y: tgt.y - rnd(2, 16), life: 0.12, max: 0.12, size: 2, color: PAL.thunder, additive: true });
      },
      done: (tt) => tt > 1.0,
    };
  },
  frostbreath(S) {
    castHop(S); const tgt = S.primary(); let t = 0; const fx = S.caster.x + 8, fy = S.caster.y - 11;
    return {
      update(dt) {
        t += dt;
        if (t < 0.6) { for (let i = 0; i < 4; i++) { const a = rnd(-0.35, 0.35), sp = rnd(90, 230);
          S.p({ x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.94, life: rnd(0.4, 0.8), max: 0.8, size: (rnd(1, 3) | 0) || 2, color: [PAL.iceW, PAL.ice, PAL.iceP][(rnd(0, 3) | 0)], additive: true, shrink: true }); } }
        if (tgt && Math.abs(t - 0.45) < dt) { S.doFlash(PAL.iceW, 0.4); S.doShake(2); tgt.flinch = 3; tgt.tint = 0.8;
          for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2), sp = rnd(30, 90); S.p({ x: tgt.x, y: tgt.y - 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 120, life: rnd(0.4, 0.7), max: 0.7, size: 2, color: PAL.iceW }); }
          S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: PAL.ice }); }
      },
      done: (tt) => tt > 1.1,
    };
  },
  curse(S) {
    const targets = S.targets(); castHop(S); S.tint('#0a0612', 0.4, 1.0);
    let t = 0; const marked = targets.map(() => false); const cx = S.caster.x, cy = S.caster.y - 10;
    return {
      update(dt) {
        t += dt;
        if (t < 0.5 && Math.random() < 0.8) S.p({ x: cx + rnd(-8, 8), y: cy + rnd(-6, 6), vy: -rnd(10, 30), life: rnd(0.4, 0.7), max: 0.7, size: 2, color: Math.random() < 0.5 ? PAL.thunderP : '#6a4fb0', additive: true, shrink: true });
        if (Math.abs(t - 0.25) < dt) S.doFlash('#6a4fb0', 0.35);
        targets.forEach((e, i) => { if (!marked[i] && t > 0.3 + i * 0.1) { marked[i] = true; e.tint = 0.6; e.flinch = 2;
          S.floatSpr({ kind: 'ring', x: e.x, y: e.y - 9, life: 0.5, max: 0.5, r0: 3, grow: 16, col: PAL.thunderP });
          S.floatSpr({ kind: 'arrowDown', x: e.x, y: e.y - 18, vy: -8, life: 0.9, max: 0.9, col: PAL.thunderP }); } });
      },
      done: (tt) => tt > 1.2,
    };
  },
  frenzy(S) {
    castHop(S); let t = 0, burst0 = false; const u = S.caster, cx = u.x, cy = u.y - 9;
    return {
      update(dt) {
        t += dt;
        if (!burst0 && t > 0.12) { burst0 = true; S.doFlash('#5a0a0a', 0.45); S.doShake(5); burst(S, cx, cy, [PAL.red, '#ff6a4a', PAL.fireDeep], 20, 120, { additive: true, up: 6 }); }
        if (t < 0.4) S.tint('#2a0606', 0.32, 0.4);
        if (t < 1.0 && Math.random() < 0.9) { const a = t * 8 + Math.random() * 6.28, r = rnd(6, 18); S.p({ x: cx + Math.cos(a) * r, y: cy + rnd(-4, 8), vx: Math.cos(a) * 8, vy: -rnd(26, 64), life: rnd(0.4, 0.9), max: 0.9, size: 2, color: Math.random() < 0.6 ? PAL.red : '#ff8a5a', additive: true, shrink: true }); }
        if (Math.abs(t - 0.5) < dt) S.floatSpr({ kind: 'arrowUp', x: cx, y: u.y - 24, vy: -12, life: 0.9, max: 0.9, col: PAL.red });
      },
      done: (tt) => tt > 1.1,
    };
  },
  monregen(S) {
    castHop(S); let t = 0, em = 0; const u = S.caster, cx = u.x, cy = u.y - 9;
    return {
      update(dt) {
        t += dt; em += dt;
        if (em > 0.04 && t < 1.0) { em = 0; S.p({ x: cx + rnd(-8, 8), y: u.y - rnd(0, 4), vy: -rnd(16, 40), life: rnd(0.6, 1.1), max: 1.1, size: 2, color: Math.random() < 0.5 ? PAL.heal : PAL.healW, additive: true, shrink: true }); }
        if (t > 0.1 && !u._rgf) { u._rgf = true; S.doFlash(PAL.healW, 0.28); }
        if (t > 0.1 && t < 0.5 && Math.random() < 0.4) S.floatSpr({ kind: 'cross', x: cx + rnd(-8, 8), y: cy - rnd(4, 18), life: 0.3, max: 0.3, col: PAL.healW });
      },
      done: (tt) => { if (tt > 1.2) { S.caster._rgf = false; return true; } return false; },
    };
  },

  // --- Bestiary-2 확장 키트 (11종, ported from share4 spellfx-monster2) ---------
  // Raw-canvas `draw` callbacks from the prototype are translated to the live
  // engine's typed floatSpr kinds (ring/hex/star4/arrowUp/arrowDown) + particles/
  // beams. tintColor sprite recolour is omitted (deferred — see MC2 note).
  voidblast(S) {
    const targets = S.targets(); castHop(S); S.tint('#0a0612', 0.5, 1.2);
    let t = 0, blown = false; const cx = S.W * 0.62, cy = S.groundY - 22;
    return {
      update(dt) {
        t += dt;
        if (t < 0.5) for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = Math.max(4, 36 - t * 50);
          S.p({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * 26, vy: -Math.sin(a) * 26, life: 0.25, max: 0.25, size: 2, color: Math.random() < 0.5 ? MC2.void : MC2.voidDk, additive: true, shrink: true }); }
        if (!blown && t >= 0.5) { blown = true; S.doFlash('#1a0a2a', 0.8); S.doShake(7);
          burst(S, cx, cy, [MC2.voidW, MC2.void, MC2.voidD, MC2.voidDk], 40, 200, { additive: true, size: 3 });
          S.floatSpr({ kind: 'ring', x: cx, y: cy, life: 0.5, max: 0.5, r0: 4, grow: 70, col: MC2.void });
          targets.forEach((e) => { e.flinch = 4; e.tint = 0.8; }); }
      },
      done: (tt) => tt > 1.2,
    };
  },
  shadowbolt(S) {
    castHop(S); const tgt = S.primary(); let hit = false, t = 0; const fx = S.caster.x + 7, fy = S.caster.y - 12;
    return {
      update(dt) {
        t += dt; const k = Math.min(1, t / 0.34);
        if (!hit && tgt) { const x = fx + (tgt.x - fx) * k, y = fy + (tgt.y - 9 - fy) * k;
          S.p({ x, y, life: 0.12, max: 0.12, size: 4, color: MC2.voidDk });
          for (let i = 0; i < 2; i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), life: 0.3, max: 0.3, size: 2, color: Math.random() < 0.5 ? MC2.void : MC2.voidD, additive: true, shrink: true });
          if (k >= 1) { hit = true; S.doFlash('#1a0a2a', 0.4); S.doShake(3); tgt.flinch = 4; tgt.tint = 0.7;
            burst(S, x, y, [MC2.voidW, MC2.void, MC2.voidD, MC2.voidDk], 20, 130, { additive: true });
            S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 18, vy: -10, life: 0.8, max: 0.8, col: MC2.void }); } }
      },
      done: (tt) => tt > 1.0,
    };
  },
  petrify(S) {
    castHop(S); const tgt = S.primary(); let t = 0, beam = false;
    return {
      update(dt) {
        t += dt;
        if (!beam && t > 0.15 && tgt) { beam = true; S.beam({ x1: S.caster.x + 7, y1: S.caster.y - 13, x2: tgt.x, y2: tgt.y - 10, color: MC2.stoneL, width: 2, jag: 0, life: 0.3, max: 0.3 }); S.doFlash(MC2.stoneL, 0.3); }
        if (tgt && t > 0.2 && Math.random() < 0.4) S.p({ x: tgt.x + rnd(-8, 8), y: tgt.y - rnd(2, 18), vy: rnd(10, 30), g: 60, life: 0.5, max: 0.5, size: 2, color: Math.random() < 0.5 ? MC2.stone : MC2.stoneD });
        if (tgt && Math.abs(t - 0.6) < dt) { S.doShake(2); tgt.flinch = 3; tgt.tint = 0.6; S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 20, vy: -10, life: 0.9, max: 0.9, col: MC2.stoneL }); }
      },
      done: (tt) => tt > 1.3,
    };
  },
  webshot(S) {
    castHop(S); const tgt = S.primary(); let t = 0, hit = false; const fx = S.caster.x + 6, fy = S.caster.y - 9;
    return {
      update(dt) {
        t += dt; const k = Math.min(1, t / 0.3);
        if (!hit && tgt) { const x = fx + (tgt.x - fx) * k, y = fy + (tgt.y - 9 - fy) * k - Math.sin(k * Math.PI) * 12;
          for (let i = 0; i < 3; i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), life: 0.2, max: 0.2, size: 2, color: MC2.web, shrink: true });
          if (k >= 1) { hit = true; S.doShake(2); tgt.flinch = 2;
            for (let r = 0; r < 3; r++) S.floatSpr({ kind: 'ring', x: tgt.x, y: tgt.y - 10, life: 0.9 - r * 0.05, max: 0.9, r0: 5 + r * 4, grow: 4, col: MC2.web });
            S.floatSpr({ kind: 'arrowDown', x: tgt.x, y: tgt.y - 22, vy: -10, life: 0.8, max: 0.8, col: MC2.webD }); } }
      },
      done: (tt) => tt > 1.2,
    };
  },
  screech(S) {
    const targets = S.targets(); castHop(S); let t = 0, pulse = 0; const marked = targets.map(() => false);
    const cx = S.caster.x, cy = S.caster.y - 11;
    return {
      update(dt) {
        t += dt; pulse += dt;
        if (pulse > 0.16 && t < 0.85) { pulse = 0; S.floatSpr({ kind: 'ring', x: cx, y: cy, life: 0.45, max: 0.45, r0: 4, grow: 70, col: MC2.sonic }); S.doShake(1.2); }
        targets.forEach((e, i) => { if (!marked[i] && t > 0.25 + i * 0.08) { marked[i] = true; e.flinch = 2; e.tint = 0.3;
          S.floatSpr({ kind: 'arrowDown', x: e.x, y: e.y - 20, vy: -10, life: 0.8, max: 0.8, col: MC2.sonic }); } });
      },
      done: (tt) => tt > 1.0,
    };
  },
  tonguelash(S) {
    castHop(S); const tgt = S.primary(); let t = 0, hit = false; const fx = S.caster.x + 7, fy = S.caster.y - 9;
    return {
      update(dt) {
        t += dt;
        if (t < 0.4 && tgt) { const k = Math.min(1, t / 0.3); S.beam({ x1: fx, y1: fy, x2: fx + (tgt.x - fx) * k, y2: fy + (tgt.y - 9 - fy) * k, color: MC2.tongue, width: 3, jag: 0, life: 0.05, max: 0.05 }); }
        if (!hit && t >= 0.32 && tgt) { hit = true; S.doFlash('#ffd0dc', 0.4); S.doShake(5); tgt.flinch = 5; tgt.tint = 0.5;
          burst(S, tgt.x, tgt.y - 9, [MC2.tongue, MC2.tongueD, '#fff'], 14, 100, { additive: true });
          S.floatSpr({ kind: 'star4', x: tgt.x, y: tgt.y - 22, life: 0.9, max: 0.9, col: MC2.rallyG }); }
      },
      done: (tt) => tt > 1.2,
    };
  },
  wardrum(S) {
    castHop(S); let t = 0, beat = 0; const u = S.caster, cx = u.x, cy = u.y - 9;
    return {
      update(dt) {
        t += dt; beat += dt;
        if (beat > 0.28 && t < 0.95) { beat = 0; S.doShake(3); S.doFlash(MC2.rally, 0.16);
          S.floatSpr({ kind: 'ring', x: cx, y: cy, life: 0.5, max: 0.5, r0: 4, grow: 50, col: MC2.rallyG });
          burst(S, cx, cy, [MC2.rally, MC2.rallyG], 10, 80, { up: 4, additive: true }); }
        if (t < 1.0 && Math.random() < 0.7) S.p({ x: cx + rnd(-16, 16), y: u.y - rnd(0, 8), vy: -rnd(20, 50), life: rnd(0.4, 0.8), max: 0.8, size: 2, color: Math.random() < 0.5 ? MC2.rally : MC2.rallyG, additive: true, shrink: true });
        if (Math.abs(t - 0.5) < dt) { S.floatSpr({ kind: 'arrowUp', x: cx - 14, y: u.y - 22, vy: -12, life: 0.9, max: 0.9, col: MC2.rally }); S.floatSpr({ kind: 'arrowUp', x: cx + 14, y: u.y - 22, vy: -12, life: 0.9, max: 0.9, col: MC2.rallyG }); }
      },
      done: (tt) => tt > 1.1,
    };
  },
  stoneskin(S) {
    castHop(S); let t = 0, formed = false; const u = S.caster, cx = u.x, cy = u.y - 10;
    return {
      update(dt) {
        t += dt;
        if (!formed && t > 0.1) { formed = true; S.doFlash(MC2.stoneL, 0.28); S.doShake(2); }
        if (t < 0.9 && Math.random() < 0.7) S.p({ x: cx + rnd(-12, 12), y: u.y - rnd(0, 20), vy: -rnd(6, 18), life: rnd(0.4, 0.8), max: 0.8, size: (rnd(2, 4) | 0), color: Math.random() < 0.5 ? MC2.stone : MC2.stoneL });
        if (t < 0.02) S.floatSpr({ kind: 'hex', x: cx, y: cy, life: 1.2, max: 1.2 });
        if (Math.abs(t - 0.5) < dt) S.floatSpr({ kind: 'arrowUp', x: cx, y: u.y - 26, vy: -12, life: 0.9, max: 0.9, col: MC2.stoneL });
      },
      done: (tt) => tt > 1.2,
    };
  },
  flurry(S) {
    castHop(S); const tgt = S.primary(); let t = 0, count = 0; const ang = [[1, -1], [1, 1], [1, -0.3]];
    return {
      update(dt) {
        t += dt;
        if (t < 0.25) S.caster.hop = 4;
        if (tgt && t >= 0.25 && count < 3 && t >= 0.25 + count * 0.18) { const a = ang[count], len = 22;
          S.beam({ x1: tgt.x - a[0] * len, y1: tgt.y - 9 - a[1] * len, x2: tgt.x + a[0] * len, y2: tgt.y - 9 + a[1] * len, color: MC2.claw, width: 2, jag: 0, life: 0.14, max: 0.14 });
          S.beam({ x1: tgt.x - a[0] * len, y1: tgt.y - 6 - a[1] * len, x2: tgt.x + a[0] * len, y2: tgt.y - 6 + a[1] * len, color: '#fff', width: 1, jag: 0, life: 0.12, max: 0.12 });
          burst(S, tgt.x + rnd(-4, 4), tgt.y - 9, [MC2.claw, '#fff', MC2.rallyG], 7, 90, { additive: true });
          tgt.flinch = 3; tgt.tint = 0.6; S.doShake(2.2); count++; }
      },
      done: (tt) => tt > 1.0,
    };
  },
  divebomb(S) {
    castHop(S); const tgt = S.primary(); let t = 0, hit = false; const sx = (tgt ? tgt.x : 0) - 30, sy = -14;
    return {
      update(dt) {
        t += dt;
        if (tgt && t >= 0.18 && t < 0.4) { const k = (t - 0.18) / 0.22, x = sx + (tgt.x - sx) * k, y = sy + (tgt.y - 9 - sy) * k;
          for (let i = 0; i < 3; i++) S.p({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), life: 0.18, max: 0.18, size: 2, color: Math.random() < 0.5 ? MC2.sonic : '#fff', streak: 8, additive: true, fade: false, vx: tgt.x - sx, vy: tgt.y - 9 - sy }); }
        if (!hit && tgt && t >= 0.38) { hit = true; S.doFlash('#fff', 0.5); S.doShake(6); tgt.flinch = 5; tgt.tint = 0.7;
          burst(S, tgt.x, tgt.y - 9, [MC2.sonic, '#fff', MC2.webD], 20, 150, { additive: true, size: 2 }); }
      },
      done: (tt) => tt > 1.0,
    };
  },
  eruption(S) {
    const targets = S.targets(); castHop(S); S.tint(MC2.fireDeep, 0.28, 1.6);
    let t = 0; const next = targets.map(() => rnd(0.1, 0.5));
    return {
      update(dt) {
        t += dt;
        if (Math.random() < 0.5) S.p({ x: rnd(0, S.W), y: rnd(S.groundY - 6, S.groundY), vy: -rnd(20, 50), life: rnd(0.6, 1.2), max: 1.2, size: (rnd(1, 3) | 0) || 1, color: [MC2.fireY, MC2.fireR, MC2.fireW][(rnd(0, 3) | 0)], additive: true, shrink: true });
        targets.forEach((e, i) => { next[i] -= dt; if (next[i] <= 0 && t < 1.3) { next[i] = rnd(0.35, 0.6);
          for (let k = 0; k < 8; k++) S.p({ x: e.x + rnd(-5, 5), y: S.groundY, vy: -rnd(120, 240), g: 240, life: rnd(0.4, 0.7), max: 0.7, size: (rnd(2, 4) | 0), color: [MC2.fireW, MC2.fireY, MC2.fireR, MC2.fireDeep][k % 4], additive: true });
          S.doFlash(MC2.fireY, 0.2); S.doShake(3); e.flinch = 4; e.tint = 0.6; } });
      },
      done: (tt) => tt > 1.6,
    };
  },
};

// Spells whose visual reads as "AoE" (the engine doesn't need this, but the scene
// uses it to decide whether to pass all targets or just the primary).
export const FX_ALL_TARGET = new Set([
  'firestorm', 'thunderclap', 'quake', 'arrowrain', 'thunderstorm', 'blizzard',
  'inferno', 'venomcloud', 'sandstorm', 'cyclone', 'darkmist', 'divinewrath',
  'warroar', 'whirlwind', 'smokebomb', 'masshaste', 'masheal', 'masscleanse', 'masbarrier',
  // Monster AoE skills (firebreath sprays the party; curse marks all heroes;
  // kamikaze detonates across the front).
  'firebreath', 'curse', 'kamikaze',
  // Bestiary-2 AoE skills (void blast / sonic screech / lava eruption hit the party).
  'voidblast', 'screech', 'eruption',
  // 인연공격 AoE (축복받은 연사 rains on every foe; 천공의 심판 nova washes the line).
  'duo_hallowed_volley', 'duo_radiant_nova',
  // 쌍검사 AoE (작약탄/산탄/풀버스트 + 소이탄 연격이 전열을 덮는다).
  'fragbomb', 'buckshot', 'fullburst', 'duo_incendiary',
]);

export function hasSpellFx(id) { return !!DEFS[id]; }

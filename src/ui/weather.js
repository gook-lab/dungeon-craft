// Weather system — environmental rain/storm/snow/embers effects via PixiJS.
// Ported from share/js/weather.js (canvas-based) into particle pools + Graphics.
// Uses a reposition-pool strategy: fixed particles reused per kind, repositioned
// each frame. Cheap: ~120 rain / ~90 snow / ~70 embers at 60fps.

import * as PIXI from 'pixi.js';

export function createWeather({ width = 800, height = 600 } = {}) {
  // Public container the caller manages (z-order, clipping, etc.)
  const container = new PIXI.Container();

  let kind = 'clear';
  let w = width, h = height;
  let t = 0; // global animation time

  // --- Particle pool (reused across kind switches) ---
  const particles = [];
  let particleCount = 0;

  // --- Storm flash state ---
  let flash = 0, nextBolt = 2.5 + Math.random() * 3.5;
  let bolt = null;

  // --- Graphics for drawing (one per kind) ---
  const rainGraphics = new PIXI.Graphics();
  const stormOverlay = new PIXI.Graphics();
  const snowGraphics = new PIXI.Graphics();
  const embersGraphics = new PIXI.Graphics();
  const fogGraphics = new PIXI.Graphics();

  // Hide initially
  rainGraphics.visible = false;
  stormOverlay.visible = false;
  snowGraphics.visible = false;
  embersGraphics.visible = false;
  fogGraphics.visible = false;

  container.addChild(rainGraphics, stormOverlay, snowGraphics, embersGraphics, fogGraphics);

  // --- Initialization ---
  function seedParticles(newKind) {
    particles.length = 0;
    let count = 0;

    if (newKind === 'rain' || newKind === 'storm') {
      // ~120 rain streaks (W/7)
      count = Math.floor(w / 7);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          len: 10 + Math.random() * 12,
          sp: 480 + Math.random() * 260,
        });
      }
    } else if (newKind === 'snow') {
      // ~90 snow flakes (W/14)
      count = Math.floor(w / 14);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 2 + Math.floor(Math.random() * 2) * 1, // 2 or 3 px
          sp: 28 + Math.random() * 40,
          drift: Math.random() * 2 - 1,
          ph: Math.random() * 6, // phase offset for sway
        });
      }
    } else if (newKind === 'embers') {
      // ~70 embers (W/22)
      count = Math.floor(w / 22);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: h + Math.random() * h, // start off-bottom
          r: 2 + Math.floor(Math.random() * 2), // 2 or 3 px
          sp: 24 + Math.random() * 40,
          drift: Math.random() * 1.4 - 0.7,
          ph: Math.random() * 6,
          life: Math.random(), // 0..1, decays as it rises
        });
      }
    } else if (newKind === 'fog') {
      // 느리게 흐르는 반투명 안개 덩어리 (늪 등) — 큰 타원 소수.
      count = Math.ceil(w / 160) + 4;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: h * (0.15 + Math.random() * 0.75),
          rx: 90 + Math.random() * 120,
          ry: 22 + Math.random() * 30,
          sp: 6 + Math.random() * 14,
          drift: Math.random() < 0.5 ? -1 : 1,
          ph: Math.random() * 6,
          a: 0.05 + Math.random() * 0.05,
        });
      }
    }

    particleCount = count;

    // Storm flash reset
    if (newKind === 'storm') {
      flash = 0;
      nextBolt = 2.5 + Math.random() * 3.5;
      bolt = null;
    }
  }

  function drawStormBolt(g, startX, startY, boltW, boltH) {
    // Pixelated lightning: zigzag from top to 72% down
    g.strokeStyle = '#fff0b8';
    g.lineWidth = 3;
    g.beginPath();
    let x = startX, y = startY;
    g.moveTo(x, y);
    while (y < boltH * 0.72) {
      y += 18 + Math.random() * 16;
      x += (Math.random() * 40 - 20);
      g.lineTo(x, y);
    }
    g.stroke();
    // Glow effect
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 7;
    g.stroke();
  }

  function updateAndDraw(dt) {
    if (kind === 'clear') return;

    t += dt;

    if (kind === 'rain' || kind === 'storm') {
      rainGraphics.clear();
      rainGraphics.setStrokeStyle({
        color: 0x9fb4d8,
        width: 2,
        alpha: 0.55,
      });

      for (const p of particles) {
        p.y += p.sp * dt;
        p.x -= p.sp * 0.18 * dt;
        if (p.y > h) {
          p.y = -p.len;
          p.x = Math.random() * w;
        }
        // Draw rain streak: from (p.x, p.y) to (p.x - len*0.18, p.y + len)
        rainGraphics.moveTo(p.x, p.y);
        rainGraphics.lineTo(p.x - p.len * 0.18, p.y + p.len);
      }
      rainGraphics.stroke();

      // Storm mode: add flash + bolt
      if (kind === 'storm') {
        nextBolt -= dt;
        if (nextBolt <= 0 && flash <= 0) {
          flash = 1;
          bolt = { x: w * (0.2 + Math.random() * 0.6) };
          nextBolt = 2.5 + Math.random() * 4;
        }

        if (flash > 0) {
          // Flash overlay (full-screen white tint)
          stormOverlay.clear();
          stormOverlay.rect(0, 0, w, h).fill({
            color: 0xdce1ff,
            alpha: flash * 0.5,
          });

          // Draw bolt at 55% fade
          if (flash > 0.55 && bolt) {
            // Bolt drawn via a simple line approach (not perfect but fast)
            // For pixel-perfect, convert to PIXI.Graphics moveTo/lineTo
            stormOverlay.setStrokeStyle({
              color: 0xfff0b8,
              width: 3,
              alpha: 0.9,
            });
            let bx = bolt.x, by = 0;
            stormOverlay.moveTo(bx, by);
            while (by < h * 0.72) {
              by += 18 + Math.random() * 16;
              bx += (Math.random() * 40 - 20);
              stormOverlay.lineTo(bx, by);
            }
            stormOverlay.stroke();

            // Glow
            stormOverlay.setStrokeStyle({
              color: 0xffffff,
              width: 7,
              alpha: 0.5,
            });
            let bx2 = bolt.x, by2 = 0;
            stormOverlay.moveTo(bx2, by2);
            while (by2 < h * 0.72) {
              by2 += 18 + Math.random() * 16;
              bx2 += (Math.random() * 40 - 20);
              stormOverlay.lineTo(bx2, by2);
            }
            stormOverlay.stroke();
          }

          flash -= dt * 3.2;
        }
      }
    } else if (kind === 'snow') {
      snowGraphics.clear();

      for (const p of particles) {
        p.y += p.sp * dt;
        p.x += Math.sin(t * 1.5 + p.ph) * 14 * dt + p.drift * 18 * dt;

        // Wrap x
        if (p.x < -4) p.x += w + 8;
        else if (p.x > w + 4) p.x -= w + 8;

        // Wrap y
        if (p.y > h) {
          p.y = -4;
          p.x = Math.random() * w;
        }

        snowGraphics.rect(
          Math.round(p.x),
          Math.round(p.y),
          p.r,
          p.r
        ).fill({ color: 0xeef6ff, alpha: 0.9 });
      }
    } else if (kind === 'embers') {
      embersGraphics.clear();

      for (const p of particles) {
        p.y -= p.sp * dt;
        p.x += Math.sin(t * 2 + p.ph) * 10 * dt + p.drift * 12 * dt;
        p.life -= dt * 0.35;

        // Wrap x
        if (p.x < -4) p.x += w + 8;
        else if (p.x > w + 4) p.x -= w + 8;

        // Wrap y / respawn
        if (p.y < -4 || p.life <= 0) {
          p.y = h + 4;
          p.x = Math.random() * w;
          p.life = 1;
        }

        const a = Math.max(0, Math.min(1, p.life));
        const r = Math.floor(255);
        const g = Math.floor(120 + 90 * a);
        const b = 40;

        embersGraphics.rect(
          Math.round(p.x),
          Math.round(p.y),
          p.r,
          p.r
        ).fill({ color: (r << 16) | (g << 8) | b, alpha: a });
      }
    } else if (kind === 'fog') {
      fogGraphics.clear();
      for (const p of particles) {
        p.x += p.sp * p.drift * dt;
        const yy = p.y + Math.sin(t * 0.4 + p.ph) * 6;
        // Wrap x (타원 폭만큼 여유)
        if (p.x < -p.rx) p.x = w + p.rx;
        else if (p.x > w + p.rx) p.x = -p.rx;
        const breathe = 0.8 + 0.2 * Math.sin(t * 0.6 + p.ph);
        // 두 겹(넓고 옅게 + 좁고 살짝 진하게)으로 부드러운 뭉게 느낌.
        fogGraphics.ellipse(p.x, yy, p.rx, p.ry).fill({ color: 0xdfe8e0, alpha: p.a * breathe });
        fogGraphics.ellipse(p.x, yy, p.rx * 0.55, p.ry * 0.6).fill({ color: 0xeef4ee, alpha: p.a * 0.8 * breathe });
      }
    }
  }

  function setKind(newKind) {
    // Hide all graphics
    rainGraphics.visible = false;
    stormOverlay.visible = false;
    snowGraphics.visible = false;
    embersGraphics.visible = false;

    kind = newKind;
    seedParticles(newKind);

    // Show the appropriate graphics
    if (newKind === 'rain') {
      rainGraphics.visible = true;
    } else if (newKind === 'storm') {
      rainGraphics.visible = true;
      stormOverlay.visible = true;
    } else if (newKind === 'snow') {
      snowGraphics.visible = true;
    } else if (newKind === 'embers') {
      embersGraphics.visible = true;
    } else if (newKind === 'fog') {
      fogGraphics.visible = true;
    }
  }

  function update(dt) {
    updateAndDraw(dt);
  }

  function resize(newW, newH) {
    w = newW;
    h = newH;
    seedParticles(kind); // Reseed to fit new bounds
  }

  function destroy() {
    container.removeChildren();
    rainGraphics.destroy();
    stormOverlay.destroy();
    snowGraphics.destroy();
    embersGraphics.destroy();
    fogGraphics.destroy();
  }

  return {
    container,
    setKind,
    update,
    resize,
    destroy,
  };
}

// Ember buff-aura — a warm amber shimmer that pulses while a buff is active.
// Two layers: an edge vignette glow that breathes (sin-driven alpha) and a few
// rising ember motes. Used by battleScene to telegraph that a Fate buff
// (고무/불굴/애정 surge) is still in effect. Independent of biome weather so it
// stacks over rain/snow/embers without conflict. Drives itself off setActive():
// when turned off it fades out smoothly rather than snapping.
export function createEmberAura({ width = 800, height = 600 } = {}) {
  const container = new PIXI.Container();
  let w = width, h = height;
  let t = 0;
  let active = false;
  let strength = 0; // 0..1, eased toward active (1) / inactive (0)

  const glow = new PIXI.Graphics();   // edge vignette
  const motes = new PIXI.Graphics();  // rising embers
  container.addChild(glow, motes);

  // A pool of rising motes (denser so the buff reads at a glance).
  let pool = [];
  function seed() {
    pool = [];
    const count = Math.max(22, Math.floor(w / 26));
    for (let i = 0; i < count; i++) {
      pool.push({
        x: Math.random() * w,
        y: h + Math.random() * h,
        r: 3 + Math.floor(Math.random() * 2), // 3-4px
        sp: 26 + Math.random() * 44,
        drift: Math.random() * 1.4 - 0.7,
        ph: Math.random() * 6,
        life: Math.random(),
      });
    }
  }
  seed();

  function draw() {
    t += 0; // t advanced in update()
    glow.clear();
    motes.clear();
    if (strength <= 0.001) return;

    // Breathing pulse: base + sine, scaled by current strength. Tuned bright
    // enough to read clearly over the (often green/dark) battle backdrop.
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    const a = strength * (0.34 + 0.2 * pulse);

    // Edge vignette: warm amber bands hugging top + bottom.
    const band = h * 0.22;
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const k = 1 - i / bands;
      glow.rect(0, (band * i) / bands, w, band / bands + 1).fill({ color: 0xffa040, alpha: a * k });
      glow.rect(0, h - band + (band * i) / bands, w, band / bands + 1).fill({ color: 0xff7a2a, alpha: a * (i / bands) });
    }

    // Rising motes — brighter core + soft halo so they pop against dark scenes.
    for (const p of pool) {
      const ml = Math.max(0, Math.min(1, p.life));
      const g = Math.floor(160 + 80 * ml);
      const col = (255 << 16) | (g << 8) | 0x40;
      const x = Math.round(p.x), y = Math.round(p.y);
      motes.rect(x - 1, y - 1, p.r + 2, p.r + 2).fill({ color: col, alpha: ml * strength * 0.4 }); // halo
      motes.rect(x, y, p.r, p.r).fill({ color: 0xfff0c0, alpha: ml * strength });                   // core
    }
  }

  function update(dt) {
    t += dt;
    // Ease strength toward the target so on/off transitions shimmer in/out.
    const target = active ? 1 : 0;
    strength += (target - strength) * Math.min(1, dt * 4);
    if (Math.abs(strength - target) < 0.01) strength = target;
    if (strength > 0.001) {
      for (const p of pool) {
        p.y -= p.sp * dt;
        p.x += Math.sin(t * 2 + p.ph) * 9 * dt + p.drift * 10 * dt;
        p.life -= dt * 0.4;
        if (p.x < -4) p.x += w + 8; else if (p.x > w + 4) p.x -= w + 8;
        if (p.y < -4 || p.life <= 0) { p.y = h + 4; p.x = Math.random() * w; p.life = 1; }
      }
    }
    draw();
  }

  function setActive(on) { active = !!on; }
  function resize(newW, newH) { w = newW; h = newH; seed(); }
  function destroy() { container.removeChildren(); glow.destroy(); motes.destroy(); }

  return { container, setActive, update, resize, destroy, get active() { return active; } };
}

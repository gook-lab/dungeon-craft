/* ============================================================
   spellfx-engine.js — 저해상도 픽셀 캔버스 애니메이션 엔진
   내부 로직 해상도(LO)로 그린 뒤 픽셀 스케일업 → 진짜 픽셀 질감.
   파티클 · 빔(번개/광선) · 화면 플래시 · 흔들림 지원.
   ============================================================ */
(function () {
  const LO = 4; // 로직 픽셀 1칸 = 화면 LO px

  // 빠른 정수 사각형 (픽셀 단위 스냅)
  function rect(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  }

  class Stage {
    constructor(host, opts) {
      opts = opts || {};
      this.host = host;
      this.cv = document.createElement('canvas');
      this.cv.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated';
      host.appendChild(this.cv);
      this.g = this.cv.getContext('2d');
      this.g.imageSmoothingEnabled = false;
      this.sprites = {};         // name -> {img, w, h}
      this.particles = [];
      this.beams = [];
      this.sprFx = [];           // 떠다니는 픽셀 스프라이트 (음표/Z 등)
      this.flash = null;         // {a, color}
      this.shake = 0;
      this.bgTint = null;        // {a, color} 지속 틴트
      this.scene = null;
      this.running = false;
      this.effect = null;        // 현재 재생 중 이펙트
      this.onMsg = opts.onMsg || (() => {});
      this.resize();
      window.addEventListener('resize', () => this.resize());
      // 영구 렌더 루프 — 생성 즉시 시작, 한 프레임이 던져도 멈추지 않음
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this._loop);
    }
    resize() {
      const w = this.host.clientWidth, h = this.host.clientHeight;
      this.W = Math.max(40, Math.round(w / LO));
      this.H = Math.max(30, Math.round(h / LO));
      this.cv.width = this.W; this.cv.height = this.H;
      this.g.imageSmoothingEnabled = false;
      if (this.scene) this.layoutScene();
    }
    async loadSprite(name, url, h) {
      return new Promise((res) => {
        const img = new Image();
        img.onload = () => {
          const scale = h / img.height;
          this.sprites[name] = { img, w: Math.round(img.width * scale), h: Math.round(img.height * scale) };
          res();
        };
        img.onerror = () => { this.sprites[name] = null; res(); };
        img.src = url;
      });
    }
    // 씬 구성: caster(좌) + 적 N체(우)
    setScene(casterSpr, enemySprs) {
      this.scene = { casterSpr, enemySprs: enemySprs.slice(0, 3) };
      this.layoutScene();
      this.draw(); // 즉시 1프레임 — rAF 지연/일시정지에도 씬이 보이도록
    }
    layoutScene() {
      const W = this.W, H = this.H;
      const gy = Math.round(H * 0.74); // 지면선
      this.caster = { x: Math.round(W * 0.16), y: gy, spr: this.scene.casterSpr, hop: 0 };
      const n = this.scene.enemySprs.length;
      this.enemies = this.scene.enemySprs.map((spr, i) => {
        const ex = W * (0.62 + (n === 1 ? 0.06 : i * 0.13));
        const ey = gy - (n === 1 ? 0 : (i % 2) * H * 0.16);
        return { x: Math.round(ex), y: Math.round(ey), spr, flinch: 0, tint: 0 };
      });
      this.groundY = gy;
    }
    targets() { return this.enemies || []; }
    primary() { return this.enemies && this.enemies[0]; }

    // --- 헬퍼: 파티클 ---
    p(o) {
      this.particles.push(Object.assign({
        x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 1, max: 1,
        size: 1, color: '#fff', fade: true, shrink: false, flick: null, additive: false,
      }, o));
    }
    beam(o) {
      this.beams.push(Object.assign({
        x1: 0, y1: 0, x2: 0, y2: 0, life: .2, max: .2, color: '#fff', width: 1, jag: 0, seed: Math.random() * 99,
      }, o));
    }
    floatSpr(o) {
      this.sprFx.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, draw: null }, o));
    }
    doFlash(color, a) { this.flash = { color, a: a == null ? .8 : a }; }
    doShake(amt) { this.shake = Math.max(this.shake, amt); }
    tint(color, a, dur) { this.bgTint = { color, a, life: dur, max: dur }; }

    play(effectFactory) {
      // 이전 잔여 정리
      this.particles.length = 0; this.beams.length = 0; this.sprFx.length = 0;
      this.flash = null; this.shake = 0; this.bgTint = null;
      if (this.enemies) this.enemies.forEach(e => { e.flinch = 0; e.tint = 0; });
      if (this.caster) { this.caster.hop = 0; this.caster.alpha = 1; }
      this.effect = effectFactory(this);
      this.effect._t = 0;
      if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this._loop); }
    }
    stop() { this.running = false; }

    _loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      try { this.update(dt); this.draw(); } catch (e) { /* 한 프레임 실패해도 루프 유지 */ if (!this._warned) { console.warn('fx frame error', e); this._warned = true; } }
      requestAnimationFrame(this._loop);
    };

    update(dt) {
      // 이펙트 진행
      if (this.effect) {
        this.effect._t += dt;
        if (this.effect.update) this.effect.update(dt, this.effect._t);
        if (this.effect.done && this.effect.done(this.effect._t)) this.effect = null;
      }
      // 파티클
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        p.vy += p.g * dt; p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      // 빔
      for (let i = this.beams.length - 1; i >= 0; i--) {
        const b = this.beams[i]; b.life -= dt; if (b.life <= 0) this.beams.splice(i, 1);
      }
      // 스프라이트 fx
      for (let i = this.sprFx.length - 1; i >= 0; i--) {
        const s = this.sprFx[i]; s.life -= dt;
        if (s.life <= 0) { this.sprFx.splice(i, 1); continue; }
        s.vy += (s.g || 0) * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      }
      // 적 피격 반동 / 틴트 감쇠
      if (this.enemies) this.enemies.forEach(e => { e.flinch *= Math.pow(0.001, dt); if (e.flinch < 0.2) e.flinch = 0; e.tint = Math.max(0, e.tint - dt * 3); });
      if (this.caster) this.caster.hop = Math.max(0, this.caster.hop - dt * 4);
      // 플래시 / 흔들림 / 틴트
      if (this.flash) { this.flash.a -= dt * 3.2; if (this.flash.a <= 0) this.flash = null; }
      this.shake *= Math.pow(0.0008, dt);
      if (this.shake < 0.3) this.shake = 0;
      if (this.bgTint) { this.bgTint.life -= dt; if (this.bgTint.life <= 0) this.bgTint = null; }
    }

    drawSprite(spr, x, y, opts) {
      opts = opts || {};
      const s = this.sprites[spr]; if (!s) {
        // 폴백: 블록
        rect(this.g, x - 6, y - 16, 12, 16, opts.tintColor || '#46506a'); return;
      }
      const g = this.g;
      const dx = Math.round(x - s.w / 2), dy = Math.round(y - s.h);
      const baseA = opts.alpha == null ? 1 : opts.alpha;
      if (baseA <= 0) return;
      g.globalAlpha = baseA;
      g.drawImage(s.img, dx, dy, s.w, s.h);
      g.globalAlpha = 1;
      if (opts.tint > 0) {
        g.save(); g.globalAlpha = Math.min(1, opts.tint) * baseA; g.globalCompositeOperation = 'source-atop';
        g.fillStyle = opts.tintColor || '#fff'; g.fillRect(dx, dy, s.w, s.h); g.restore();
      }
    }

    draw() {
      const g = this.g, W = this.W, H = this.H;
      g.save();
      // 흔들림
      let ox = 0, oy = 0;
      if (this.shake > 0) { ox = (Math.random() * 2 - 1) * this.shake; oy = (Math.random() * 2 - 1) * this.shake; g.translate(Math.round(ox), Math.round(oy)); }
      // 배경
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#171c33'); grd.addColorStop(0.72, '#222a40');
      grd.addColorStop(0.72, '#2a2438'); grd.addColorStop(1, '#1c1830');
      g.fillStyle = grd; g.fillRect(-4, -4, W + 8, H + 8);
      // 지면 라인
      rect(g, -4, this.groundY, W + 8, 1, '#39406e');
      // 지속 틴트
      if (this.bgTint) { g.globalAlpha = this.bgTint.a * (this.bgTint.life / this.bgTint.max); g.fillStyle = this.bgTint.color; g.fillRect(-4, -4, W + 8, H + 8); g.globalAlpha = 1; }

      // 그림자
      const sh = (u) => { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(u.x, this.groundY + 1, 7, 2, 0, 0, 7); g.fill(); };
      if (this.caster) sh(this.caster);
      if (this.enemies) this.enemies.forEach(sh);

      // 스프라이트
      if (this.caster) this.drawSprite(this.caster.spr, this.caster.x + (this.caster.hop ? 3 : 0), this.caster.y - (this.caster.hop || 0), { alpha: this.caster.alpha == null ? 1 : this.caster.alpha });
      if (this.enemies) this.enemies.forEach(e => {
        const fx = e.flinch ? (Math.random() * 2 - 1) * e.flinch * 0.5 : 0;
        this.drawSprite(e.spr, e.x + fx, e.y, { tint: e.tint, tintColor: e.tintColor || '#fff' });
      });

      // 빔 (라인) — additive
      g.globalCompositeOperation = 'lighter';
      this.beams.forEach(b => {
        const a = b.life / b.max;
        g.globalAlpha = a;
        g.strokeStyle = b.color; g.lineWidth = b.width;
        g.beginPath();
        if (b.jag > 0) {
          const segs = 8; g.moveTo(b.x1, b.y1);
          for (let i = 1; i <= segs; i++) {
            const tt = i / segs;
            const jx = (Math.sin(b.seed + i * 1.7) ) * b.jag * (1 - Math.abs(tt - .5) * 1.2);
            g.lineTo(b.x1 + (b.x2 - b.x1) * tt + jx, b.y1 + (b.y2 - b.y1) * tt);
          }
        } else { g.moveTo(b.x1, b.y1); g.lineTo(b.x2, b.y2); }
        g.stroke();
      });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

      // 파티클
      this.particles.forEach(p => {
        const a = p.fade ? Math.max(0, p.life / p.max) : 1;
        let col = p.color;
        if (p.flick) col = p.flick[Math.floor((1 - p.life / p.max) * p.flick.length * 0.999)] || col;
        // 스트릭(빗줄기/화살): 속도 방향으로 늘여 그림
        if (p.streak) {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const ux = p.vx / sp, uy = p.vy / sp;
          if (p.additive) g.globalCompositeOperation = 'lighter';
          g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = p.size || 1;
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - ux * p.streak, p.y - uy * p.streak); g.stroke();
          if (p.head) { rect(g, p.x - (p.size || 1), p.y - (p.size || 1), (p.size || 1) * 2, (p.size || 1) * 2, p.headColor || col); }
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          return;
        }
        const sz = p.shrink ? Math.max(1, Math.round(p.size * (p.life / p.max))) : p.size;
        if (p.additive) g.globalCompositeOperation = 'lighter';
        g.globalAlpha = a;
        rect(g, p.x - sz / 2, p.y - sz / 2, sz, sz, col);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      });

      // 떠다니는 스프라이트 fx
      this.sprFx.forEach(s => { if (s.draw) s.draw(g, s); });

      g.restore();
      // 플래시 (흔들림 무관 전체)
      if (this.flash) { g.globalAlpha = Math.max(0, this.flash.a); g.fillStyle = this.flash.color; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    }
  }

  window.SpellFX = { Stage, LO };
})();

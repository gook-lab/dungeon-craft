/* ============================================================
   weather.js — 캔버스 픽셀 환경 이펙트
   비 · 천둥 번쩍임 · 눈 · 잿불. 새 에셋 없음.
   ============================================================ */
(function () {
  function makeCanvas(host) {
    const c = document.createElement('canvas');
    c.style.position = 'absolute'; c.style.inset = '0';
    c.style.width = '100%'; c.style.height = '100%';
    c.style.imageRendering = 'pixelated'; c.style.pointerEvents = 'none';
    host.appendChild(c);
    const fit = () => { c.width = host.clientWidth; c.height = host.clientHeight; };
    fit();
    return { c, fit };
  }

  function WeatherStage(host) {
    const { c, fit } = makeCanvas(host);
    const g = c.getContext('2d');
    let mode = 'rain';
    let parts = [];
    let flash = 0, nextBolt = 2 + Math.random() * 3, t = 0;
    let bolt = null, raf = null;

    function seed() {
      parts = [];
      const W = c.width, H = c.height;
      if (mode === 'rain' || mode === 'storm') {
        const n = Math.floor(W / 7);
        for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, len: 10 + Math.random() * 12, sp: 480 + Math.random() * 260 });
      } else if (mode === 'snow') {
        const n = Math.floor(W / 14);
        for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, r: 2 + Math.floor(Math.random() * 2) * 1, sp: 28 + Math.random() * 40, drift: Math.random() * 2 - 1, ph: Math.random() * 6 });
      } else if (mode === 'embers') {
        const n = Math.floor(W / 22);
        for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: H + Math.random() * H, r: 2 + Math.floor(Math.random() * 2), sp: 24 + Math.random() * 40, drift: Math.random() * 1.4 - 0.7, ph: Math.random() * 6, life: Math.random() });
      }
    }

    function drawBolt(W, H) {
      // 픽셀 지그재그 번개
      g.strokeStyle = '#fff0b8'; g.lineWidth = 3;
      g.beginPath();
      let x = bolt.x, y = 0;
      g.moveTo(x, y);
      while (y < H * 0.72) { y += 18 + Math.random() * 16; x += (Math.random() * 40 - 20); g.lineTo(x, y); }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 7; g.stroke();
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const W = c.width, H = c.height;
      g.clearRect(0, 0, W, H);

      if (mode === 'clear') { raf = requestAnimationFrame(frame); return; }

      if (mode === 'rain' || mode === 'storm') {
        g.strokeStyle = 'rgba(180,200,235,.55)'; g.lineWidth = 2;
        g.beginPath();
        for (const p of parts) {
          p.y += p.sp * dt; p.x -= p.sp * 0.18 * dt;
          if (p.y > H) { p.y = -p.len; p.x = Math.random() * W; }
          g.moveTo(p.x, p.y); g.lineTo(p.x - p.len * 0.18, p.y + p.len);
        }
        g.stroke();
        if (mode === 'storm') {
          nextBolt -= dt;
          if (nextBolt <= 0 && flash <= 0) { flash = 1; bolt = { x: W * (0.2 + Math.random() * 0.6) }; nextBolt = 2.5 + Math.random() * 4; }
          if (flash > 0) {
            g.fillStyle = `rgba(220,225,255,${flash * 0.5})`;
            g.fillRect(0, 0, W, H);
            if (flash > 0.55 && bolt) drawBolt(W, H);
            flash -= dt * 3.2;
          }
        }
      } else if (mode === 'snow') {
        for (const p of parts) {
          p.y += p.sp * dt; p.x += Math.sin(t * 1.5 + p.ph) * 14 * dt + p.drift * 18 * dt;
          if (p.y > H) { p.y = -4; p.x = Math.random() * W; }
          g.fillStyle = 'rgba(238,246,255,.9)';
          g.fillRect(Math.round(p.x), Math.round(p.y), p.r, p.r);
        }
      } else if (mode === 'embers') {
        for (const p of parts) {
          p.y -= p.sp * dt; p.x += Math.sin(t * 2 + p.ph) * 10 * dt + p.drift * 12 * dt;
          p.life -= dt * 0.35;
          if (p.y < -4 || p.life <= 0) { p.y = H + 4; p.x = Math.random() * W; p.life = 1; }
          const a = Math.max(0, Math.min(1, p.life));
          g.fillStyle = `rgba(255,${120 + Math.floor(90 * a)},${40},${a})`;
          g.fillRect(Math.round(p.x), Math.round(p.y), p.r, p.r);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function set(m) { mode = m; seed(); }
    function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    window.addEventListener('resize', () => { fit(); seed(); });
    seed(); start();
    return { set };
  }

  window.WeatherStage = WeatherStage;
})();

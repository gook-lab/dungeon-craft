// Galmuri webfont loader. PIXI.Text renders through the canvas 2D API, so the
// font must be present in `document.fonts` BEFORE the first text is drawn —
// otherwise Pixi bakes a monospace fallback texture that never refreshes.
// main.js awaits ensureFonts() before the first scene renders.
//
// The @font-face rules come from index.html's non-blocking `#galmuri-css` link
// (media="print" → "all" on load). document.fonts.load() resolves EMPTY for a
// family that isn't declared yet, so wait for that stylesheet first.

import { GALMURI_FACES } from './tokens.js';

let done = null;

function galmuriSheetReady() {
  const link = document.getElementById('galmuri-css');
  if (!link || link.media === 'all') return Promise.resolve();
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

// onProgress(doneCount, total) fires as each face/size settles — feeds the boot
// loader's real progress bar.
export function ensureFonts(onProgress) {
  if (done) return done;
  done = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return;
    try {
      await galmuriSheetReady();
      // Flush style so the just-enabled sheet's @font-face rules reach document.fonts.
      getComputedStyle(document.documentElement).getPropertyValue('font-family');
      // The stylesheet declares the faces; force-load the weights we actually
      // paint at so the first frame is already crisp.
      const loads = GALMURI_FACES.flatMap((f) => [
        document.fonts.load(`16px "${f}"`),
        document.fonts.load(`24px "${f}"`),
      ]);
      let settled = 0;
      for (const p of loads) p.finally(() => onProgress?.(++settled, loads.length)).catch(() => {});
      await Promise.all(loads);
      await document.fonts.ready;
    } catch {
      /* font CDN unreachable — fall back to monospace, game still runs */
    }
  })();
  return done;
}

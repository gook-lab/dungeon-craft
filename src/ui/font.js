// Pixel webfont loader. PIXI.Text renders through the canvas 2D API, so the
// font must be present in `document.fonts` BEFORE the first text is drawn —
// otherwise Pixi bakes a monospace fallback texture that never refreshes.
// main.js awaits ensureFonts() before the first scene renders.
//
// The @font-face rules are inline in index.html and the files are self-hosted
// subsets (public/fonts/, ~80 KB for all three) that index.html already
// preloads, so these loads usually just pick up a fetch that is in flight.

import { FONT_FACES } from './tokens.js';

let done = null;

// onProgress(doneCount, total) fires as each face/size settles — feeds the boot
// loader's real progress bar.
export function ensureFonts(onProgress) {
  if (done) return done;
  done = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return;
    try {
      // Force-load the sizes we actually paint at so the first frame is crisp.
      const loads = FONT_FACES.flatMap((f) => [
        document.fonts.load(`16px "${f}"`),
        document.fonts.load(`24px "${f}"`),
      ]);
      let settled = 0;
      for (const p of loads) p.finally(() => onProgress?.(++settled, loads.length)).catch(() => {});
      await Promise.all(loads);
      await document.fonts.ready;
    } catch {
      /* font files unreachable — fall back to monospace, game still runs */
    }
  })();
  return done;
}

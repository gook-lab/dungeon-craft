// Galmuri webfont loader. PIXI.Text renders through the canvas 2D API, so the
// font must be present in `document.fonts` BEFORE the first text is drawn —
// otherwise Pixi bakes a monospace fallback texture that never refreshes.
// main.js awaits ensureFonts() before the first scene renders.

import { GALMURI_FACES } from './tokens.js';

let done = null;

export function ensureFonts() {
  if (done) return done;
  done = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return;
    try {
      // The @import in style.css declares the faces; force-load the weights we
      // actually paint at so the first frame is already crisp.
      await Promise.all(
        GALMURI_FACES.flatMap((f) => [
          document.fonts.load(`16px "${f}"`),
          document.fonts.load(`24px "${f}"`),
        ]),
      );
      await document.fonts.ready;
    } catch {
      /* font CDN unreachable — fall back to monospace, game still runs */
    }
  })();
  return done;
}

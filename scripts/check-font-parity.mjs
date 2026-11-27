// check-font-parity — the subset faces must draw exactly like upstream Galmuri.
//
// Draws every character the game uses (font-chars.mjs) at 18/20/24/30px on a
// canvas in Chromium, once with the pinned upstream face (jsDelivr) and once with
// public/fonts/, and compares pixels and canvas metrics. Run after
// build-font-subset.mjs; prints the diff counts and exits 1 if any are non-zero.
//
//   PLAYWRIGHT_DIR=<folder with node_modules/playwright> node scripts/check-font-parity.mjs
//
// Playwright is not a dependency of this repo; point PLAYWRIGHT_DIR at any
// project that has it installed. Needs network access for the upstream fonts.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GALMURI_VERSION, SUBSET_FACES, collectCodePoints } from './font-chars.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(process.env.PLAYWRIGHT_DIR || process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/font-subset.json'), 'utf8'));

const faces = SUBSET_FACES.map((f) => ({
  ...f,
  upstream: `https://cdn.jsdelivr.net/npm/galmuri@${GALMURI_VERSION}/dist/${f.from}.woff2`,
  subset: readFileSync(join(ROOT, 'public/fonts', `${f.family}.woff2`)).toString('base64'),
  chars: collectCodePoints(ROOT)
    .map((c) => String.fromCodePoint(c))
    .filter((c) => c.trim() && !manifest.faces[f.family].notInSource.includes(c)),
}));

const browser = await chromium.launch();
const page = await browser.newPage();
const results = await page.evaluate(async (faces) => {
  const out = [];
  for (const f of faces) {
    const bytes = Uint8Array.from(atob(f.subset), (c) => c.charCodeAt(0)).buffer;
    const up = new FontFace(`U_${f.family}`, `url(${f.upstream})`);
    const sub = new FontFace(`S_${f.family}`, bytes);
    await Promise.all([up.load(), sub.load()]);
    document.fonts.add(up);
    document.fonts.add(sub);
    let px = 0, metrics = 0;
    for (const size of [18, 20, 24, 30]) {
      for (let i = 0; i < f.chars.length; i += 40) {
        const text = f.chars.slice(i, i + 40).join('');
        const draw = (fam) => {
          const cv = document.createElement('canvas');
          cv.width = size * 44; cv.height = size * 2;
          const ctx = cv.getContext('2d');
          ctx.font = `${size}px "${fam}"`;
          ctx.fillStyle = '#fff';
          ctx.fillText(text, 2, size * 1.4);
          const m = ctx.measureText(text), pm = ctx.measureText('|ÉqÅM'); // PixiJS metric string
          return {
            data: ctx.getImageData(0, 0, cv.width, cv.height).data,
            m: [m.width, pm.actualBoundingBoxAscent, pm.actualBoundingBoxDescent, pm.fontBoundingBoxAscent, pm.fontBoundingBoxDescent],
          };
        };
        const a = draw(`U_${f.family}`), b = draw(`S_${f.family}`);
        for (let k = 0; k < a.data.length; k++) if (a.data[k] !== b.data[k]) px++;
        if (a.m.some((v, j) => v !== b.m[j])) metrics++;
      }
    }
    out.push({ face: f.family, from: f.from, chars: f.chars.length, pixelDiff: px, metricDiff: metrics });
  }
  return out;
}, faces);
await browser.close();

for (const r of results) console.log(`${r.face} vs ${r.from}: ${r.chars} chars × 4 sizes — pixel diff ${r.pixelDiff}, metric diff ${r.metricDiff}`);
if (results.some((r) => r.pixelDiff || r.metricDiff)) process.exit(1);

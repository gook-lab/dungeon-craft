// Guards the self-hosted subset fonts: every character in src/ must be in
// public/fonts/*.woff2 (or be one the upstream Galmuri face never had, which
// renders through the fallback chain exactly as before). New dialogue, item or
// monster names with new characters fail here — rebuild with
// `node scripts/build-font-subset.mjs` (see the script header).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBSET_FACES, collectCodePoints, woff2CodePoints } from '../../scripts/font-chars.mjs';
import { FONT, FONT_FACES } from './tokens.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/font-subset.json'), 'utf8'));
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const wanted = collectCodePoints(ROOT);

describe('subset fonts', () => {
  for (const { family } of SUBSET_FACES) {
    it(`${family}.woff2 covers every character in src/`, () => {
      const have = woff2CodePoints(readFileSync(join(ROOT, 'public/fonts', `${family}.woff2`)));
      const known = new Set([...manifest.faces[family].notInSource].map((c) => c.codePointAt(0)));
      const missing = wanted.filter((c) => !have.has(c) && !known.has(c));
      expect(String.fromCodePoint(...missing), 'run node scripts/build-font-subset.mjs').toBe('');
    });

    it(`${family} is declared, preloaded and loaded before first paint`, () => {
      expect(html).toContain(`font-family: ${family};`);
      expect(html).toContain(`<link rel="preload" href="/fonts/${family}.woff2" as="font" type="font/woff2" crossorigin />`);
      expect(FONT_FACES).toContain(family);
    });
  }

  it('the game draws only with the subset faces (no reserved "Galmuri" family, no CDN)', () => {
    for (const stack of Object.values(FONT)) {
      const families = stack.split(',').map((s) => s.trim()).filter((s) => s !== 'monospace');
      for (const f of families) expect(FONT_FACES).toContain(f);
    }
    expect(html).not.toMatch(/cdn\.jsdelivr\.net|font-family:\s*["']?Galmuri/i);
  });

  it('the OFL license ships next to the font files', () => {
    expect(readFileSync(join(ROOT, 'public/fonts/OFL.md'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });
});

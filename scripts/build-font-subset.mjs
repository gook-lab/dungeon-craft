// build-font-subset — rebuild public/fonts/*.woff2 from the characters in src/.
//
//   FONT_PYTHON=<python with fonttools+brotli> node scripts/build-font-subset.mjs [--src <dir>]
//
// --src points at a folder holding the upstream Galmuri*.woff2 files; without it
// the pinned version is downloaded from jsDelivr. Run this whenever
// src/ui/fontSubset.test.js reports missing characters (new dialogue, item or
// monster names), then commit public/fonts/ and scripts/font-subset.json.
//
// fonttools is a build-time tool only — make a throwaway venv:
//   python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools brotli
//   FONT_PYTHON=/tmp/ft/bin/python node scripts/build-font-subset.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GALMURI_VERSION, SUBSET_FACES, collectCodePoints, woff2CodePoints } from './font-chars.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/fonts');
const MANIFEST = join(ROOT, 'scripts/font-subset.json');
const PY = process.env.FONT_PYTHON || 'python3';
const srcArg = process.argv.indexOf('--src');
const work = mkdtempSync(join(tmpdir(), 'font-subset-'));

async function sourceFont(name) {
  if (srcArg > -1) return join(process.argv[srcArg + 1], `${name}.woff2`);
  const url = `https://cdn.jsdelivr.net/npm/galmuri@${GALMURI_VERSION}/dist/${name}.woff2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const file = join(work, `${name}.woff2`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const cps = collectCodePoints(ROOT);
const unicodes = join(work, 'unicodes.txt');
writeFileSync(unicodes, cps.map((c) => c.toString(16)).join('\n'));
mkdirSync(OUT, { recursive: true });

const manifest = { source: `galmuri@${GALMURI_VERSION}`, codePoints: cps.length, faces: {} };
for (const face of SUBSET_FACES) {
  const src = await sourceFont(face.from);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  const out = join(OUT, `${face.family}.woff2`);
  const res = JSON.parse(
    execFileSync(PY, [join(ROOT, 'scripts/font_subset.py'), src, out, unicodes, 'Galmuri', 'CryptPixel'], {
      encoding: 'utf8',
    }),
  );
  // Characters the upstream face never had render through the CSS fallback
  // chain exactly as before; record them so the test can tell them apart.
  const covered = woff2CodePoints(readFileSync(out));
  const notInSource = cps.filter((c) => !covered.has(c));
  if (notInSource.length !== res.missing.length) throw new Error(`${face.family}: subset lost characters`);
  manifest.faces[face.family] = {
    from: face.from,
    bytes: readFileSync(out).length,
    notInSource: String.fromCodePoint(...notInSource),
  };
  console.log(`${face.family}.woff2  ${manifest.faces[face.family].bytes} B  ${covered.size} chars  (${notInSource.length} not in ${face.from})`);
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${cps.length} code points → ${OUT}`);

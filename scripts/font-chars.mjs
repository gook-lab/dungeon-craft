// font-chars — what the game can draw, and what a subset font covers.
//
// Shared by scripts/build-font-subset.mjs (makes public/fonts/*.woff2) and
// src/ui/fontSubset.test.js (fails when src/ uses a character the subset lacks).
//
// Every character in every non-test file under src/ counts — strings, dialogue,
// item and monster names, and comments too. Comments make the set a little
// bigger but no string can slip through a parsing mistake.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

// Upstream font package, pinned. Bump together with a re-run of the build script.
export const GALMURI_VERSION = '2.40.3';

// Subset faces. Galmuri's license reserves the name "Galmuri", so a subset
// (a Modified Version under OFL 1.1) ships under its own family name.
export const SUBSET_FACES = [
  { from: 'Galmuri11', family: 'CryptPixel11' },
  { from: 'Galmuri14', family: 'CryptPixel14' },
  { from: 'GalmuriMono11', family: 'CryptPixelMono11' },
];

// Always kept: printable ASCII and Latin-1. Numbers and toLocaleString output
// are built at runtime, and PixiJS measures every font with "|ÉqÅM".
export const BASE_RANGES = [
  [0x20, 0x7e],
  [0xa0, 0xff],
];

const SOURCE_EXT = /\.(js|mjs|json|css)$/;

function walk(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (SOURCE_EXT.test(e.name) && !e.name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

// Code points the subset must cover: BASE_RANGES + every char in src/.
export function collectCodePoints(root) {
  const cps = new Set();
  for (const [a, b] of BASE_RANGES) for (let c = a; c <= b; c++) cps.add(c);
  for (const file of walk(join(root, 'src'), [])) {
    for (const ch of readFileSync(file, 'utf8')) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x20 && cp !== 0x7f && cp !== 0xfeff) cps.add(cp);
    }
  }
  return [...cps].sort((x, y) => x - y);
}

// --- WOFF2 cmap reader (just enough to list mapped code points) ----------

function base128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos.i++];
    v = v * 128 + (b & 0x7f);
    if (!(b & 0x80)) return v;
  }
  throw new Error('bad UIntBase128');
}

// Known-tag index → tag (WOFF2 spec table). Only the ones we must recognise.
const CMAP = 0, GLYF = 10, LOCA = 11;

function cmapCodePoints(t) {
  const u16 = (o) => t.readUInt16BE(o);
  const u32 = (o) => t.readUInt32BE(o);
  const n = u16(2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const pid = u16(4 + i * 8), eid = u16(6 + i * 8), off = u32(8 + i * 8);
    const fmt = u16(off);
    const rank = fmt === 12 ? 2 : fmt === 4 && (pid === 3 || pid === 0) && eid !== 0 ? 1 : 0;
    if (rank && (!best || rank > best.rank)) best = { rank, off, fmt };
  }
  if (!best) throw new Error('no unicode cmap subtable');
  const cps = new Set();
  const o = best.off;
  if (best.fmt === 12) {
    const groups = u32(o + 12);
    for (let g = 0; g < groups; g++) {
      const s = u32(o + 16 + g * 12), e = u32(o + 20 + g * 12), gid = u32(o + 24 + g * 12);
      for (let c = s; c <= e; c++) if (gid + (c - s) !== 0) cps.add(c);
    }
  } else {
    const segX2 = u16(o + 6), seg = segX2 / 2;
    const ends = o + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let i = 0; i < seg; i++) {
      const end = u16(ends + i * 2), start = u16(starts + i * 2);
      const delta = u16(deltas + i * 2), ro = u16(ranges + i * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let gid;
        if (ro === 0) gid = (c + delta) & 0xffff;
        else {
          const g = u16(ranges + i * 2 + ro + (c - start) * 2);
          gid = g === 0 ? 0 : (g + delta) & 0xffff;
        }
        if (gid !== 0) cps.add(c);
      }
    }
  }
  return cps;
}

// Code points a .woff2 file maps to a real glyph.
export function woff2CodePoints(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a woff2 file');
  const numTables = buf.readUInt16BE(12);
  const compressed = buf.readUInt32BE(20);
  const pos = { i: 48 };
  let offset = 0, cmap = null;
  for (let t = 0; t < numTables; t++) {
    const flags = buf[pos.i++];
    const tagIdx = flags & 0x3f, xform = flags >> 6;
    if (tagIdx === 63) pos.i += 4;
    const orig = base128(buf, pos);
    const hasXform = tagIdx === GLYF || tagIdx === LOCA ? xform === 0 : xform !== 0;
    const len = hasXform ? base128(buf, pos) : orig;
    if (tagIdx === CMAP) cmap = { offset, len };
    offset += len;
  }
  if (!cmap) throw new Error('woff2 has no cmap');
  const data = brotliDecompressSync(buf.subarray(pos.i, pos.i + compressed));
  return cmapCodePoints(data.subarray(cmap.offset, cmap.offset + cmap.len));
}

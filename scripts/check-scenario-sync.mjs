// check-scenario-sync — guards that scripts/balance.js SCENARIOS encounter pools
// + group sizes (min/max) stay in sync with the live maps in
// src/content/maps/**/*.js. Drift here makes the harness silently test the wrong
// encounter, invalidating tuning. Text/regex based (no ESM import — balance.js
// runs main() on import, and empire maps go through a _builder).
//
//   node scripts/check-scenario-sync.mjs          report mismatches (exit 1 if any)
//   node scripts/check-scenario-sync.mjs --fix     print corrected SCENARIOS min/max
//
// Match is by POOL-SET equality (a scenario ↔ the map with the same monster pool),
// then min/max are compared. Maps with no matching scenario are INFO only — the
// harness intentionally stops at swamp (empire is past its L16 ceiling).

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MAPS = join(ROOT, 'src/content/maps');
const fix = process.argv.includes('--fix');

const poolKey = (arr) => arr.map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean).sort().join(',');
const ENC = /encounters:\s*\{[^}]*?pool:\s*\[([^\]]*)\][^}]*?min:\s*(\d+)[^}]*?max:\s*(\d+)/;

// Walk maps dir (one level of subdirs — empire/).
function mapFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...mapFiles(join(dir, e.name)));
    else if (e.name.endsWith('.js') && !e.name.endsWith('.test.js') && e.name !== '_builder.js' && e.name !== 'index.js') out.push(join(dir, e.name));
  }
  return out;
}

const maps = [];
for (const f of mapFiles(MAPS)) {
  const m = readFileSync(f, 'utf8').match(ENC);
  if (!m) continue; // encounters: null (towns/arenas)
  maps.push({ file: f.replace(ROOT + '/', ''), pool: poolKey(m[1].split(',')), min: +m[2], max: +m[3] });
}

// SCENARIOS entries are one per line. Match line-by-line (an `equip: {}` on the
// line breaks a `[^}]`-bounded regex, so don't use one). Boss lines have a `name:`
// but no `pool:` — they're skipped (no encounter to sync).
const balanceTxt = readFileSync(join(ROOT, 'scripts/balance.js'), 'utf8');
const NAME = /name:\s*'([^']+)'/;
const POOL = /pool:\s*\[([^\]]*)\],\s*min:\s*(\d+),\s*max:\s*(\d+)/;
const scenarios = [];
for (const line of balanceTxt.split('\n')) {
  const n = line.match(NAME); const p = line.match(POOL);
  if (n && p) scenarios.push({ name: n[1].trim(), pool: poolKey(p[1].split(',')), min: +p[2], max: +p[3] });
}

let problems = 0;
const fixes = [];
for (const sc of scenarios) {
  const map = maps.find((mp) => mp.pool === sc.pool);
  if (!map) { console.log(`✗ SCENARIO "${sc.name}" pool matches no map (renamed/removed mob?)`); problems++; continue; }
  if (map.min !== sc.min || map.max !== sc.max) {
    console.log(`✗ "${sc.name}" min/max ${sc.min}-${sc.max} ≠ ${map.file} ${map.min}-${map.max}`);
    fixes.push(`  "${sc.name}": min ${sc.min}→${map.min}, max ${sc.max}→${map.max}`);
    problems++;
  } else {
    console.log(`✓ "${sc.name}" in sync with ${map.file} (${map.min}-${map.max})`);
  }
}

const matchedMaps = new Set(scenarios.map((s) => s.pool));
for (const mp of maps) {
  if (!matchedMaps.has(mp.pool)) console.log(`· (info) ${mp.file} encounters have no harness scenario — ok if past the L16 ceiling (empire)`);
}

if (fix && fixes.length) { console.log(`\n--fix: update scripts/balance.js SCENARIOS:`); for (const f of fixes) console.log(f); }
console.log(`\n${problems === 0 ? '✓ SCENARIOS in sync with maps' : `✗ ${problems} mismatch — sync scripts/balance.js${fix ? '' : ' (run with --fix for the diff)'}`}`);
process.exit(problems === 0 ? 0 : 1);

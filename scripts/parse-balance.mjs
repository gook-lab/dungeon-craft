// balance-check parser — runs the headless balance harness, parses its 3 tables
// (BASELINE / MERCY / RUTHLESS), flags scenarios outside the healthy bands, and
// diffs against the previous run. Deterministic post-processor for `npm run
// balance` — the inner loop of tuning. No deps beyond Node stdlib.
//
//   node scripts/parse-balance.mjs [seedsPerScenario]   (default 200)
//
// Healthy bands (mirrors the harness's own footer):
//   - encounters (~name without BOSS): 95-100% win, low deaths
//   - bosses (name has BOSS):          70-95% win WITH real HP attrition
// Flags: encounter <95% (too hard) · boss >95% (no teeth) / <70% (too hard) /
//        boss HP%remain >60 + deaths <0.2 (no attrition).

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.balance-last.json');
const seeds = process.argv[2] || '200';

const ROW = /^(.+?)\s+(\d+)%\s+([\d.]+)\s+(\d+)%\s+([\d.]+)\s*$/;
// Section header has a letter ("── BASELINE ──"); the row divider is pure
// box-drawing dashes ("──────") and must NOT match.
const SECTION = /^──\s*([A-Za-z].*?)\s*──$/;

function run() {
  const out = execSync(`npm run balance ${seeds}`, { cwd: join(HERE, '..'), encoding: 'utf8' });
  const sections = {};
  let cur = null;
  for (const line of out.split('\n')) {
    const sm = line.match(SECTION);
    if (sm) { cur = sm[1].split(/\s|\(/)[0]; sections[cur] = {}; continue; }
    if (!cur) continue;
    const m = line.match(ROW);
    if (!m) continue;
    const name = m[1].trim();
    if (name.toLowerCase().startsWith('scenario')) continue; // header row
    sections[cur][name] = {
      win: +m[2], rounds: +m[3], hp: +m[4], deaths: +m[5],
    };
  }
  return sections;
}

// MERCY/RUTHLESS bosses are SUPPOSED to saturate win% (the bond payoff — CLAUDE.md
// gotcha #5: "read deaths/rounds, not win%"), so the boss win-ceiling + attrition
// bands only apply to BASELINE. All builds still flag a genuinely-too-hard boss
// (<70%) and an over-hard encounter (<95%).
function flagsFor(section, name, r) {
  // Post-game boss scenarios (EMPEROR/DRAKE/VOIDLORD) carry no "BOSS" suffix but
  // are bosses, not trash — classify them so the 70-95% band + attrition rules
  // apply (else a genuinely-hard superboss falsely flags as an over-hard encounter).
  const boss = /BOSS|EMPEROR|DRAKE|VOIDLORD|FSTAR/i.test(name); // FSTAR = 별무덤 리전 보스 (2026-07-14)
  const baseline = /BASELINE/i.test(section);
  const out = [];
  if (boss) {
    if (r.win < 70) out.push(`승률 ${r.win}% — 보스 과함(<70%)`);
    // win 천장은 deaths와 결합해서만 플래그: 4인+rally 클러치 하에선 win%가 포화해도
    // (하니스 지침: deaths/rounds를 읽어라) 파티원이 반 명꼴로 죽는 싸움이면 이빨이
    // 있는 것 — EMPEROR 99%/0.49가 그 케이스 (2026-07-14 판정 정교화).
    else if (baseline && r.win > 95 && r.deaths < 0.3) out.push(`승률 ${r.win}%·사망 ${r.deaths} — 보스 무름(무저항 천장)`);
    if (baseline && r.hp > 60 && r.deaths < 0.2) out.push(`HP잔량 ${r.hp}%·사망 ${r.deaths} — 소모 부족`);
  } else if (r.win < 95) {
    out.push(`승률 ${r.win}% — 일반전 과함(<95%)`);
  }
  return out;
}

function delta(cur, prev) {
  if (!prev) return '';
  const d = (a, b, suf = '') => { const v = a - b; return v === 0 ? '' : ` (${v > 0 ? '+' : ''}${suf === '%' ? v : v.toFixed(2)}${suf})`; };
  return `${d(cur.win, prev.win, '%')}${d(cur.deaths, prev.deaths)}`.trim();
}

const sections = run();
const prev = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : null;

let flaggedCount = 0;
for (const [sec, rows] of Object.entries(sections)) {
  console.log(`\n── ${sec} ──`);
  for (const [name, r] of Object.entries(rows)) {
    const flags = flagsFor(sec, name, r);
    const dl = prev?.[sec]?.[name] ? delta(r, prev[sec][name]) : '';
    const mark = flags.length ? '⚠ ' : '✓ ';
    console.log(`${mark}${name.padEnd(15)} win ${String(r.win).padStart(3)}%  rounds ${String(r.rounds).padStart(4)}  hp ${String(r.hp).padStart(3)}%  deaths ${r.deaths.toFixed(2)}${dl ? `   Δ${dl}` : ''}`);
    for (const f of flags) { console.log(`    ⚠ ${f}`); flaggedCount++; }
  }
}

writeFileSync(CACHE, JSON.stringify(sections, null, 2));
console.log(`\n${flaggedCount === 0 ? '✓ 모든 시나리오 건강 구간' : `⚠ ${flaggedCount}건 플래그 — 위 항목 조정 필요`}`);
console.log(`(직전 실행 대비 Δ 표시 · 캐시: scripts/.balance-last.json)`);
process.exit(flaggedCount === 0 ? 0 : 1);

---
name: balance-check
description: Run the dragon-crypt balance harness, parse the 3 tables (BASELINE/MERCY/RUTHLESS), flag scenarios outside the healthy bands, and diff against the previous run. Use when tuning monster stats, spell power, encounter sizes, or MAGIC_SCALE_K — i.e. any balance edit that needs `npm run balance` verification.
---

# balance-check

The inner loop of balance tuning. Wraps `npm run balance` with automatic
band-flagging and a run-over-run diff, so you stop eyeballing 21 rows by hand.

## When to Use

- After editing `src/content/monsters.js` (HP/atk/spd), `src/content/spells.js`
  (power), `src/content/maps/*.js` (encounter min/max/rate), or
  `MAGIC_SCALE_K` in `src/systems/battle.js`.
- Any time you'd otherwise run `npm run balance` and read the tables manually.

## How It Works

Run:

```bash
node scripts/parse-balance.mjs [seedsPerScenario]   # default 200
```

It runs the harness, parses all three passes, and prints each scenario with a
`✓`/`⚠` mark plus a `Δ` delta vs the previous run (cached in
`scripts/.balance-last.json`). Exit code is non-zero if anything is flagged.

**Healthy bands** (mirrors the harness footer + CLAUDE.md gotcha #5):
- Encounters (name without `BOSS`): 95–100% win. Flag `<95%` (too hard).
- BASELINE bosses: 70–95% win WITH attrition. Flag `>95%` (no teeth),
  `<70%` (too hard), or `HP%remain >60 + deaths <0.2` (no attrition).
- MERCY/RUTHLESS bosses: win% is SUPPOSED to saturate (bond payoff) — only a
  genuinely-too-hard boss (`<70%`) is flagged there. Read deaths/rounds instead.

## Interpreting Results

- A flagged BASELINE boss `>95%` → bump its `maxHp` (magic ignores def, so def
  won't curb casters) or lower `MAGIC_SCALE_K`.
- A flagged encounter `<95%` → trim group size/atk or encounter rate.
- **Trash HP%remain staying ~88–94% with 0 deaths is the FLOOR, not a failure** —
  the harness models optimal play (perfect AoE/heal/herbs). Judge trash by
  avgRounds + per-region attrition trend, not the optimal-AI HP%. Don't chase
  deaths there; that only comes from spike atk that punishes real players.

## Notes

- Cosmetic-only; never edits game files. It just runs the harness and reports.
- Re-run all three passes after any bond/FP change too (the harness models them
  as separate passes).
- Pair with `/sync-balance-scenarios` if you changed a map's encounter min/max —
  the harness SCENARIOS must mirror the maps or these numbers are misleading.

---
description: Validate that scripts/balance.js SCENARIOS encounter pools + group sizes (min/max) stay in sync with the live maps in src/content/maps/**. Run after editing any map's encounters or the harness SCENARIOS. Pass --fix to print the corrected min/max diff.
---

# /sync-balance-scenarios

Guards against silent balance-harness drift: if a map's `encounters` group size
changes but `scripts/balance.js` SCENARIOS isn't updated (or vice versa), the
harness tests the wrong encounter and every tuning number is misleading. This is
NOT covered by `content.test.js` (which only checks map connectivity).

## What it does

Runs the checker script:

```bash
node scripts/check-scenario-sync.mjs        # report (exit 1 on mismatch)
node scripts/check-scenario-sync.mjs --fix  # also print the corrected min/max
```

It matches each harness SCENARIO to the map with the same monster pool (by
pool-set equality), then compares `min`/`max`. Output:
- `✓ "<scenario>" in sync with <map> (min-max)` — matched and equal
- `✗ "<scenario>" min/max A-B ≠ <map> C-D` — drift; `--fix` prints the change
- `✗ SCENARIO "<name>" pool matches no map` — a mob was renamed/removed
- `· (info) <map> has no harness scenario` — fine for empire (past the L16 ceiling)

## When to run

- After editing any `src/content/maps/**/*.js` `encounters: { min, max, pool }`.
- After editing the SCENARIOS array in `scripts/balance.js`.
- Before trusting a `npm run balance` / `/balance-check` result following such edits.

## Steps

1. Run `node scripts/check-scenario-sync.mjs`.
2. If mismatches: re-run with `--fix`, then apply the printed min/max to
   `scripts/balance.js` SCENARIOS (the maps are the source of truth — the harness
   mirrors them).
3. Re-run to confirm `✓ SCENARIOS in sync with maps`.

## Notes

- The harness intentionally stops at swamp (L16), so empire maps showing "no
  harness scenario" is expected, not an error.
- Pool match is by the SET of monster ids, order-independent.

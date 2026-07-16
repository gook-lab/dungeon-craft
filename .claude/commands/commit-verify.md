---
description: Pre-commit gate — run the Vitest suite then the Vite build, sequentially. Both must pass (exit 0) before committing. Fails fast, reporting which step broke. Validates only; never stages or commits.
---

# /commit-verify

Runs the project's two verification gates back-to-back, the same pair used
throughout this repo before every commit:

```bash
npx vitest run && npm run build
```

- **`npx vitest run`** — the full unit suite (pure resolver, scenes, progression,
  content guards). Catches a broken battle resolver, save round-trip, affinity
  coverage, map connectivity, etc.
- **`npm run build`** — the Vite production bundle. Catches syntax errors, bad
  imports, and PixiJS incompatibilities that tests (headless, no renderer) miss.

Sequential (build waits for tests) so a failure is unambiguous. Stop at the first
non-zero exit and report which step failed with its output; do not proceed to
`git add`/`git commit`.

## When to use

Immediately after editing game logic/content/scenes, before `git commit`. This is
the standing pre-commit ritual in CLAUDE.md's Run Workflow — `/commit-verify`
just bundles it.

## Notes

- Validation only — never modifies, stages, or commits code.
- Balance/stat/skill/curve edits ALSO need `npm run balance` (3 passes; + `NG=1`/
  `NG=2` for cycle scaling) — that's a separate tuning gate, not part of this one.
- If a test or the build fails, fix the cause and re-run; don't `--no-verify`.

---
description: Add a persistent save field/flag to src/data/save.js in BOTH freshSave() and validateSave() (the flags whitelist) with the correct defensive-read pattern, plus a save.test.js assertion — so the field actually survives a save→reload. Usage: /whitelist-save-flag <flagName> [default]. Default is false (boolean); pass 0 for a numeric counter.
---

# /whitelist-save-flag

Guards against the project's #1 recurring save bug: `validateSave()` REBUILDS the `flags`
object from a hardcoded allow-list (it does not spread `d.flags`). A flag added to
`freshSave()` but forgotten in `validateSave()` (or vice-versa) is **silently dropped** on
every save→reload — progression resets, a warp won't unlock, a cleared boss re-fights, an
upgrade reverts, with no error. See memory `save-flag-whitelist-trap` and CLAUDE.md §8.

## Arguments

- `<flagName>` (required) — the flag key. camelCase boolean clears (`magmaDrakeDefeated`) or
  branch poles (`empireKnight_spared`). Numeric counters (`mercied`) use a `0` default.
- `[default]` (optional) — `false` (boolean, default) or `0` (numeric counter).

## Steps

1. **Read** `src/data/save.js`. Locate the `flags: { … }` block in `freshSave()` (~line 40)
   and the `flags: { … }` block in `validateSave()` (~line 120). Confirm the flag is not
   already in either.
2. **freshSave()** — add the default to its `flags` object. Group it with related flags
   (e.g. a region's clear flag next to the other region flags), matching the existing
   comment style:
   - boolean: `myNewFlag: false,`
   - numeric: `myCounter: 0,`
3. **validateSave()** — add the matching defensive read to ITS `flags` object:
   - boolean: `myNewFlag: d.flags ? d.flags.myNewFlag === true : false,`
   - numeric: `myCounter: d.flags && Number.isFinite(d.flags.myCounter) ? d.flags.myCounter : 0,`
4. **save.test.js** — add a field-level assertion (this project uses field-level asserts, NOT
   toEqual blocks). Add to the relevant `describe` block:
   - `expect(freshSave().flags.myNewFlag).toBe(false);`
   - persistence: `expect(validateSave({ flags: { myNewFlag: true } }).flags.myNewFlag).toBe(true);`
   - default on old save: `expect(validateSave({}).flags.myNewFlag).toBe(false);`
5. **Verify**: `npx vitest run src/data/save.test.js` — must pass.

## Notes

- This is for `flags.*`. A new TOP-LEVEL save field (like `quests`, `equip.plus`) follows the
  same freshSave + validateSave + test pattern but lives in the root return object, not the
  flags block — apply the same three-edit discipline.
- Numeric counters validate with `Number.isFinite`; booleans coerce strictly via `=== true`
  so any junk value falls back to the default (old-save forward-compat).
- A region add touches this together with `/sync-balance-scenarios` and the content.test
  reachable guards — see memory `content-test-reachable-invariants`.

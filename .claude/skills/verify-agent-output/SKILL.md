---
name: verify-agent-output
description: Audit a background agent's claimed feature work against the real code before trusting or merging it — execute the gating predicates, verify wiring, check flag whitelisting and reachability. Use whenever an agent (or a worktree branch) reports a feature "complete", especially mercy/recruit gates, new maps/submaps, NPC shops/actions, or new persistent flags. Green tests are NOT sufficient evidence.
---

# verify-agent-output

An agent's completion report is a **claim, not evidence**. This repo has burned twice:
agents reported "COMPLETE ✅ / ready to merge / all tests pass" while shipping a mercy
route whose trigger was impossible, a submap with no entrance, a shop that never opened,
and unwhitelisted flags that died on reload — with **372 tests green the whole time**.

Tests here validate DATA INTEGRITY (schemas, portal graph, BFS). They do NOT validate the
PLAYER PATH. That gap is where agent work breaks.

## When to run

- A background/worktree agent reports a feature done.
- Before merging any agent branch.
- After a large multi-step content addition (new region, boss fate, recruit, shop).

## The audit (run every applicable check; report PASS/FAIL per item)

### 1. Execute the gating predicate — don't read about it, RUN it
The single highest-value check. For any feature gated by a pure predicate, build the real
object and call the real function headlessly:

```bash
node -e "
import('file://$PWD/src/systems/battle.js').then(b=>{
  const u = b.buildEnemyUnit('bog_witch');
  u.hp = Math.floor(u.maxHp*0.25);          // into the mercy window
  console.log('boss:',u.boss,'spareable:',u.spareable,'recruitable:',u.recruitable);
  console.log('canMercy:', b.canMercy(u), 'canRecruit:', b.canRecruit(u));
});
"
```
This is exactly how the "mercy route is untriggerable" bug was caught (`bog_witch` was
`boss:true`; `canMercy` requires `!boss || spareable`).

Other predicates worth executing: `canStep` (movement/elevation), `canRecruit`,
`isQuestComplete`, `condMet`, `affinityKind`/`affinityMult`, `toneFromFlags`.

### 2. Reachability — can the player actually GET there?
`content.test`'s critical-path BFS **exempts dead-end maps**, so a new submap with **no
entrance portal** still passes every test. Verify explicitly:

```bash
# Does any map actually have a portal INTO the new map?
grep -rn "'<new_map_id>'" src/content/maps/ | grep -v "id: '<new_map_id>'"
```
No hit → the map is unreachable dead content, regardless of green tests.

### 3. Wiring — is the claimed hook actually called?
Grep the call chain end-to-end. Repo-specific traps:
- **NPC actions** (`shop`/`inn`/`heal`/`warp`) are read from the **dialog.js ENTRY**, not
  the map object (`dialogScene.js` ~156-159). A map object's `action:'shop'` is INERT.
- A new spell/skill id must be referenced by a learnset / `joinSkill` / `ALLY_COMBOS`, or
  it is dead data.
- An emitted event must have a fold site in `main.js` (the resolver never persists).

### 4. Save persistence — new flags/fields
Any new `flags.*` needs `freshSave()` + `validateSave()` (whitelist), else it silently
dies on reload. A new TOP-LEVEL field needs all four save.js sites + a round-trip test
(Gotcha #11). See the `/whitelist-save-flag` command.

### 5. Orphans + "deferred" tells
- Removed/renamed content: grep the old id — dangling refs (spellFx `FX_ALL_TARGET`,
  monster `joinSkill`, chest loot) break silently.
- If the agent's report says "optional / deferred / scaffolded / can be added later" —
  **that means unimplemented**. Treat it as a gap, not a footnote.

### 6. Only then: the suites
```bash
npx vitest run && npm run build
npm run balance          # if anything touched stats/spells/monsters (3 passes)
```
Green here means "no schema/syntax break" — it is the floor, not the verdict.

## Report format

Emit a PASS/FAIL line per check with the evidence (the command + its output), then a
verdict: merge / fix-first / send back. Never conclude "works" from the agent's summary
or from a green suite alone.

## Related

- `/commit-verify` — tests+build gate (orthogonal: syntax/schema, not game logic)
- `/whitelist-save-flag` — the save-flag whitelist procedure
- `/run-qa-snapshot` — drive the real game to a state and screenshot it (the player-path
  check when a predicate isn't enough)
- Memory: `agent-reports-are-claims`

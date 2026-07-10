---
description: Scaffold a new enemy skill across all the files it touches — monsterSkills.js (data), monsters.js (skills:[] mapping), fx/spellFx.js (choreography), and battle.js only if the kind is new — using the project's atk-scaled (dmgMult, NOT flat power) conventions, plus the display-layer + balance reminders. Usage: /scaffold-monster-skill <skillId> [damage|drain|ailment|selfbuff|selfheal|allybuff|guard].
---

# /scaffold-monster-skill

Adding an enemy skill is a multi-file edit and the steps are easy to half-do (forget the FX
stub; copy a spec's flat `power` literally; skip the display layer for a new status). This
walks the full path. See memories `monster-skills-balance-cliff`, `spellfx-kinds-and-live-qa`,
`new-status-needs-display-layer` and CLAUDE.md "Monster skill" + "Status ailments" sections.

## Arguments

- `<skillId>` (required) — lowercase id, matches 1:1 across all files (`venomstrike`).
- `[kind]` (optional) — `damage` (default) | `drain` | `ailment` | `selfbuff` | `selfheal`
  | `allybuff` | `guard`. These all ALREADY have resolver branches — only a genuinely new
  behaviour needs battle.js changes.

## Steps

1. **`src/content/monsterSkills.js`** — add to `MONSTER_SKILLS`. **Damage is atk-scaled via
   `dmgMult`, NEVER flat `power`** (a spec's `power:N` must be translated to a weight so it
   stays on the tuned ladder). `target` is caster-relative: `one`/`all` = the OPPOSING side,
   `self`/`allies` = the caster's side.
   - damage single: `dmgMult: 0.9–1.0`; AoE: `dmgMult: 0.55–0.6`; multi-hit: `dmgMult: 0.45, hits: 3`
   - `element` drives affinity + FX colour; `inflict`/`inflictChance`/`inflictTurns` for an on-hit status
   - extra fields: `pierce` (0..1 def ignored), `highCrit: true` (HIGHCRIT_CHANCE roll), `chance` on an `ailment` (partial-land), `defMult`/`atkMult`/`spdBonus` (selfbuff/allybuff), `healPct` (drain/selfheal), `shieldPct` (guard)
   ```js
   <id>: { id: '<id>', name: '[KR 이름]', kind: '<kind>', target: 'one', dmgMult: 0.9, element: 'physical' },
   ```
2. **`src/content/monsters.js`** — add `{ id: '<id>', chance: 0.35, cd: 2, max? }` to one or
   more monsters' `skills: [ … ]` arrays (chance = per-turn roll, cd = round cooldown, max =
   per-battle cap). For a boss, also consider `phase2.skills`. **If a concurrent agent is
   editing monsters.js, do these mappings with a one-shot idempotent Node script** (Edit-tool
   calls fail with "file modified" against a moving file).
3. **`src/fx/spellFx.js`** — add a `DEFS['<id>'](S) { … }` choreography (else it falls back to
   `_default`). Use the live engine's typed `floatSpr` `kind:`s (ring/hex/star4/arrowUp/
   arrowDown/…), NOT raw `draw` callbacks. AoE-looking skills → also add the id to
   `FX_ALL_TARGET`. For a per-target sprite recolour, add `SKILL_TINT['<id>'] = 0x…` in
   battleScene (the FX engine only gets logical coords — it can't tint sprites itself).
4. **battle.js — ONLY if the kind is new.** The 8 kinds above are already handled in
   `resolveMonsterSkill`. A new kind needs a branch there + likely a `makeUnit` field.
5. **If the skill inflicts a NEW status** (not in `STATUS_TYPES`): this is a SEPARATE feature —
   follow `new-status-needs-display-layer`: STATUS_TYPES + tickStatus + combat hook (battle.js)
   AND pixelIcons.js (ST_PAL + a 10×10 `STATUS` grid) + battleScene.js (STATUS_KR/STATUS_TAG +
   a message branch). Tests pass without the display half, so don't skip it.
6. **Balance**: `npm run balance` (3 passes). Read deaths/avgRounds, not win% (optimal AI
   saturates win%). **Watch the cliff both ways**: a selfbuff `atkMult` stacks multiplicatively
   with `phase2.atkMult` (small change → big superboss swing); and a sub-1.0 `dmgMult` AoE on a
   boss P2 can make it EASIER (AI casts it instead of a full basic). Then `npx vitest run`.

## Notes

- The balance harness auto-models skills (`scripts/balance.js` reuses the real
  `enemyChooseAction` + `resolveAction`) — do NOT write separate harness AI for a skill.
- `summon` is DEFERRED (breaks spoils/mercy/recruit + needs renderer spawn) — see TODOS.md.
- For a hero spell (not enemy), use `content/spells.js` + `physical:true` for atk-scaled skills
  — different file, see CLAUDE.md "Spell" checklist.

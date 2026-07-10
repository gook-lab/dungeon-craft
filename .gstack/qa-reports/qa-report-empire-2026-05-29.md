# QA Report — 무너진 제국 슬라이스 (양 분기 완주)

Date: 2026-05-29 · Target: http://localhost:9153/ · Mode: diff-aware (seeded-save)
Framework: PixiJS v8 / Vite (canvas) · Tier: Standard · Driver: gstack browse (launched)

## Scope
Fallen Empire vertical slice — both moral branches (knight spare→정문 / slay→뒷문)
and both ending tones (merciful / ruthless). Drove deterministically by seeding
`dragon_crypt_save_v1` (party L30, intro:true, region flags), confirm key **Z**,
title cursor defaults to 이어하기 (do NOT press ArrowUp — it wraps to 새 게임).

## Health Score: 98/100 — ship-ready
No bugs found. No JS console errors (only harmless headless "No available adapters"
audio warnings). −2 cosmetic: full city-maze walk not exercised (random encounters
at 0.16/step make step-nav flaky; gate logic verified by seeded position + BFS test).

## Verified (evidence: .gstack/qa-reports/screenshots/)
| # | Check | Result | Screenshot |
|---|---|---|---|
| 1 | empire_gate renders (stone tileset, combMaze, minimap, sign, chest) | ✓ | empire_gate_live (prior) |
| 2 | empire_gate_sign dialog | ✓ "무너진 비문…" | empire_sign (prior) |
| 3 | Empire encounter fires; new monsters spawn | ✓ 석상 가고일/녹슨 병사/유령 위병 names+sprites | t1-frontgate-throne |
| 4 | 자비 greyed vs un-weakened enemies (canMercy gate) | ✓ | t1-frontgate-throne |
| 5 | 옥좌의 방 renders (braziers, chest, minimap boss/portal) | ✓ | t3-emperor-intro |
| 6 | 황제 boss-intro dialog | ✓ "…손님인가. 짐의 폐허에…" | t3-emperor-intro |
| 7 | 황제 boss (boss_skeleton_king sprite), 자비 greyed (boss) | ✓ | t3-emperor-battle |
| 8 | Emperor defeated → `empireBossDefeated` persists | ✓ flag=true | t3-emperor-defeated |
| 9 | **Merciful ending** (mercied30/slain1) | ✓ 「자비의 결말」 teal, motes | t3-emperor-defeated |
| 10 | **Ruthless ending** (mercied1/slain40) | ✓ 「정복의 결말」 red | t4-ruthless-ending |
| 11 | **뒷문 locked** when spared (slain-only gate) | ✓ "무너진 뒷문…" dialog, no warp | t5-backgate-locked |
| 12 | **정문 opens** when spared → warps to 옥좌의 방 | ✓ landed throne west entrance | t6-frontgate-open |

## Key confirmations
- **Final-boss migration works**: the EMPEROR (not bog_witch) triggers the ending.
  endBattle's config-driven `isFinal=!!bossObj.final` routes correctly.
- **Tone branching end-to-end**: same emperor fight, different mercy flags →
  different ending title + color (자비/teal vs 정복/red). toneFromFlags drives it.
- **Branch-portal wiring live**: spared opens 정문 / blocks 뒷문 with the right
  lockedTalk. Same `requires` mechanism as the proven frost gate.

## Not exercised (low risk)
- Full city maze traversal on foot (encounter-flaky); completability is locked by
  content.test.js BFS guard + gate logic verified by seeded position.
- Actual in-combat knight spare→recruit join (combat RNG); branchOutcome covered by
  4 unit tests; mercy command presence + boss-exclusion confirmed live.

## Fixes applied
None — no bugs found. (Repo is not a git repo; commit step N/A.)

PR summary: QA drove both empire branches to completion — merciful + ruthless
endings, both throne gates, emperor final-boss migration. 0 bugs, health 98/100.

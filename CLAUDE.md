# dragon-game (던전크래프트) — Project Guide

Dragon Quest-style turn-based RPG. Plain ESM JavaScript (Node ≥18), PixiJS v8,
Vite, Vitest. Shares heroes/assets/world with the sibling **Crypt Survivors**
(`../game`, a Vampire-Survivors auto-battler — different architecture; its
CLAUDE.md does NOT apply here). The battle resolver never imports PixiJS, so the
core is headless-testable.

> Sibling distinction: this is **던전크래프트 / port 9153**. `../game` is Crypt
> Survivors / port 7153. The session often opens in `../game`; verify cwd.

See also: [DESIGN.md](DESIGN.md) (UI vocabulary) · [TODOS.md](TODOS.md) (deferred scope).

## Quick Reference

| Command | Purpose |
|---|---|
| `npm install` | First-time install |
| `npm run dev` | Dev server (http://localhost:9153/) |
| `npm test` | Vitest unit tests (402 as of 2026-08-22; must pass before committing) — `npx vitest run` |
| `npm run balance` | Headless battle harness — 3 passes: BASELINE (kill build, no bonds), MERCY (positive bonds: tanky + clutch FP), RUTHLESS (negative bonds: glass cannon + less FP). Read avgRounds/deaths; win% saturates under optimal AI. |
| `npm run build` | Production bundle → `dist/` |

Git: 로컬 저장소 (2026-07-10 init, 원격 없음 — 로컬 커밋만). PixelLab MCP available for pixel art (`mcp__pixellab__*`).

## Project Structure

```
src/
  engine/    sceneManager (LIFO scene stack), renderer (only PixiJS consumer), input
  systems/   battle (PURE resolver — no Pixi), progression (xp/level/unit builders),
             field (grid move + encounters), roamers (overworld enemy patrol)
  content/   spells, monsters, items, party, dialog (+ tone-branch variants), quests,
             maps/ (town/wild/dungeon/frost/swamp + empire/ 4-map slice + lava/ + void/
             post-game superbosses, via _builder + index)
  scenes/    title, field, battle (opaque), dialog (overlay), menu, shop, equip, warp
  fx/        spellFx.js — code-drawn pixel spell-FX engine (~76 choreographies)
  ui/        uikit.js — windowBox / menuList / label (the only UI primitives)
  util/      rng (seeded), audio (ZzFX + asset SFX/BGM layer — see §11), assets (hero/enemy/structure URL bridges)
  data/      save.js (localStorage, defensive `??` validation)
main.js      bootstrap — wires engine + scenes + runtime; owns save fold,
             prologue gating, recruit persistence, mercy-counter fold, ending tone
scripts/balance.js   headless battle harness
```

## Key Architectural Patterns

### 1. Scene stack (engine/sceneManager.js)
LIFO stack; only the TOP scene gets `update(dt)`, all render. Scenes set
`opaque` (Battle/Title — hide below) or are overlays (Dialog/Menu/Shop over the
field). Scenes never import each other — they call `game.toX()` / `game.scenes.push`.
`game.scenes.top` is the current scene.

### 2. Pure battle resolver (systems/battle.js)
`createBattle(heroUnits, enemyUnits)` → `state`. `resolveAction(state, action, rng)`
mutates state, returns `{ events }`; the scene reads events to animate. **Never
imports Pixi; never writes save.** Round-based turn order is **INTERLEAVED by spd**
(all living units in one track sorted spd desc — NOT side-phased; ties break
heroes-before-enemies then stable index), so a fast enemy can act before a slow hero
(`effectiveSpd` lets 동상/freeze slow a unit's slot). See §9 Encounter tuning for the
regional spd curves that make fast mobs threaten. Action types: `attack | spell | item |
defend | flee | mercy`. Spell `kind`s: `damage | heal | mana | buff | ailment | cure |
state`. Damage spells split two ways: **magic** (default — `magicDamage`, maxMp-scaled,
ignores def) vs **physical** (`physical:true` → `skillDamage`, atk-scaled, respects def;
the warrior/huntress kits). Physical-skill extras: `melee` (rage bonus), `hits` (multi-
strike, with `atkScale` to weight each hit down), `pierce` (ignore def), `critBonus`.

**Combat states (the 4-class rework, 2026-05-29)** — pure unit fields resolved entirely
in battle.js: `stealth` (은신, hunter — next damaging skill = guaranteed crit ×1.8 +
dodge until acting; consumed), `rage` (분노, warrior — N turns of melee +30% dmg +30%
lifesteal; entered via bloodlust's `hpCost`), `charge` (충전, mage — next MAGIC spell
×1.5; consumed). Plus `shield` (방어막 absorb pool, soaked first in `dealDamage`),
`evaTurns` (연막탄 dodge), `aggro` (도발 — `enemyChooseAction` targets the taunter).
Class identities: **knight** holy SUPPORT (party heal/cleanse/barrier), **warrior**
MELEE/rage, **huntress** physical RANGED/암살 (no more elemental magic), **mage** arcane +
ELEMENTAL caster (the elemental book moved here; optional recruit, not in STARTING_PARTY).

Shared unit shape via `makeUnit(over)`: `{ id, refId, side, name, maxHp, hp, maxMp, mp,
atk, def, spd, spells:[], status:{}, alive, defending, atkBuff, stealth, rage, charge,
shield, evaTurns, aggro, ... }`.
`buildEnemyUnit` (battle.js), `buildHeroUnit`/`buildAllyUnit` (progression.js) all
go through `makeUnit`. progression.js imports `makeUnit` from battle.js — a clean
one-way edge (battle.js does NOT import progression). Don't reverse it.

### 3. Mercy mechanic (fight / spare / recruit)
A weakened enemy (`hp ≤ maxHp · mercyThreshold`, default 0.3, bosses excluded
**by default**) can be **spared** or **recruited**. Pure predicates `canMercy(t)` /
`canRecruit(t)` gate the UI.

**Boss mercy opt-in (`spareable`, 2026-07-16)** — a STORY boss can opt INTO mercy while
staying `boss:true` (keeping enrage / boss music / region gating): set `spareable: true`
in monsters.js. The gate reads `(!target.boss || target.spareable)`, so only flagged
bosses become spare/recruitable. `recruitable` honors an EXPLICIT override
(`m.recruitable != null ? m.recruitable : !m.boss`), so a spareable boss can also join.
Reference: `bog_witch` (늪의 마녀 자비/처단 갈림 — the C-slice consequence gate).
**Gotcha**: setting only `branchFlag` on the map object does NOT make a boss spareable —
without `spareable`, canMercy still returns false and the 자비 menu never appears.

`resolveAction({type:'mercy', mode:'spare'|'recruit'})`:
- spare → enemy leaves (`alive=false`, `resolved='spared'`), `state.mercied++`
- recruit → roll `1 - hp/maxHp`; success → `resolved='recruited'` + emit
  `{type:'recruit', refId}`; fail → `recruitFail`, turn consumed.
Spared/recruited enemies STAY in `state.units` (alive=false), so `spoils()` (counts
all enemy units) grants **full xp** — sparing never underlevels (no code needed).
`killUnit()` tallies `state.slain` on enemy death.

**Persistence is main.js's job** (battle.js stays pure): on victory `endBattle`
folds `resolved==='recruited'` units into `save.allies[]`, and `state.mercied/slain`
into `flags.mercied/slain`. Recruited monster → `buildAllyUnit(refId, level)` joins
as a 4th hero unit when `runtime.activeAlly` is set (menuScene 동료 deploys/benches).

### 4. Tone-branched dialogue (content/dialog.js)
`toneFromFlags(flags)` → `merciful` (mercy ≥70%) / `ruthless` (≤30%) / `mixed`
(<4 resolved = mixed). `tonedDialogId(id, flags)` swaps to a `${id}_${tone}`
variant if it exists. main.js uses it for reactive NPC lines + boss-win endings
(`boss_win_merciful` etc.). **Mercy ratio is never shown as a meter** — implicit,
Undertale-style. New story beat: define base + `_merciful`/`_ruthless` variants.

**Dialog choices + moral-choice rooms (C단계 2026-05-30)**: a dialog entry (or
DialogScene args) may carry terminal `choices: [labels]`; after the last line
DialogScene shows a ▶ selector (↑↓ + confirm), then pops and calls `onChoice(index)`.
A map NPC with `moral:'<id>'` (+ a one-time `flag`) routes `main.openDialog` to push
that choice dialog with `onChoice → game.resolveMoral(obj, pick)`. `resolveMoral`
applies the outcome AND feeds the mercy ratio (`flags.mercied++`/`slain++`) so a
non-combat choice shifts `toneFromFlags` → NPC tone + ending, same as battle mercy.
Reference: empire_camp `포로` (탈영병) → `moral_deserter` (살려보낸다/처형한다). The
choice mechanic is generic — reuse for yes/no prompts, branch picks, etc.

**Grim variants (bond-polarity layer, 2026-07-14)**: dialogue can ALSO branch on the
party's bond colour, independent of the mercy tone. `bondPolarity(bonds)` (systems/
bonds.js, PURE) → `'dark'|'light'|'none'` by negative/positive pole majority. When
dark, `main.openDialog` swaps to `${id}_grim` **with priority over the tone variant**;
`endBattle` applies the same rule to boss `win` dialogs (opt-in per authored id).
Authored: enoch_act1/act2/act3_grim (에녹 reads the party's dark undercurrent — quest
directions unchanged) + 4 boss wins (boss_win_grim 해골왕 / frost_ 늑대왕 / empire_
황제 / void_ 공허). The emperor grim keeps **D7**: the 5-line death monologue is
IDENTICAL — only the reaction + tagline lines differ. Grim is a dialogue layer only —
ending-scene tone/titles are untouched. New grim beat = just add a `${id}_grim` entry.

### 4.5 다단계 퀘스트라인 (content/questlines.js, 2026-07-10 — 서사 고도화 1막)
Unity 스토리 바이블 역이식(자비 렌즈)의 스파인. `QUESTLINES` = 스테이지 배열
(`{cond, desc}`), 상태는 `save.questlines = {id:{stage,status}}` (엔트리 없음 =
stage 0 자동-활성). cond 판정은 quests.js의 공유 **`condMet(cond, runtime)`**
(isQuestComplete가 위임 — cond 타입은 거기 한 곳에만 추가): 기존 boss/mercy/slay/
collect + 신규 `reach{map}`(`visitedMaps`) / `talk{npcId}`(`talkedNpcs`, npcId =
맵 오브젝트의 **배치별 고유 id** — 같은 인물도 막마다 enoch_act1/act2/...).
`advanceQuestlines(runtime)`는 충족 스테이지를 **루프로 연쇄 전진**(선-충족 소급 —
시퀀스 게이트가 아니라 체크리스트) 후 이벤트 기술자 반환; 토스트/보상/저장은
`main.game.tickQuestlines()`가 담당하며 **4지점에서만 명시 호출**: endBattle 승리
(메시지 합류) · fieldScene.loadMap(`recordVisit` 후) · openDialog 종료(`recordTalk`
후) · openChest. saveNow 내부 호출 금지. **toRuntime/runtimeToSave는 save.js로
이동** — Gotcha #11 네 지점이 한 파일에 모였고 save.test의 라운드트립 어서션이
필드 누락을 잡는다(main.js는 호출만; 새 영속 필드는 save.js 4곳 + 테스트만).
퀘스트 로그(menuScene 'quests')가 스테이지 체크리스트(▣/▶/▢)를 렌더.
**3막 전체 출하 (2026-07-10)** — `after` 필드로 막 순차 게이팅(`questlineUnlocked`
공유 판정: advance 전진 + menuScene 노출 둘 다; 완료 이벤트의 `unlocked`가 다음 막
챕터 카드를 띄움). 막 구성: **1막** 에녹(마을, Pasqualina VS-style 아트) → 어둠숲
(wild 남쪽 사이드, empire_bridge 패턴) → dark_warden → skeleton_king. **2막** 에녹
(frost) → 늑대인간왕 → 마녀 → ruins_below(empire_city 남단 의식장 — 비석이 황제
동기의 사전 씨앗) → seal_guardian → 황제(win 독백 = "잘못된 자비" 고백, **톤 무관
동일 대사 + 리액션 라인만 분기** — D7 원칙). **3막** 에녹(lava_gate) →
별무덤(starfall/starfall_crater 2맵 신규 리전, L21 밴드 — 황제 L18↔드레이크 L25 갭;
lava_gate 남쪽 잿길 + 워프 등록) → fallen_star(스페어=해방) → 드레이크 → 공허의 군주
(trueEnding 유지). 스토리 존/신규 몹은 전부 팔레트 스왑 + 기존 타일셋; balance
SCENARIOS에 dkfrst/dkWARDEN/ruins/sealGRD/starfl/FSTAR 동기 등록.

**에필로그 + 회차+(NG+, 2026-07-10)**: `content/epilogues.js`(PURE) — 리더 클래스별
결말 문단을 EndingScene이 요약 아래 표시. 엔딩 Z → `game.offerNgPlus()` 선택
다이얼로그 → 수락 시 `_ngCarry`(회차+도감 seen)를 들고 CharacterSelect부터 재시작
(beginGame이 fresh 후 머지). `save.ngPlus`(0=1회차, save.js 4곳+라운드트립 테스트) —
적 스케일은 battleScene.enter에서 **회차 증분 diminishing 누적**(`f=1/(1+(i-1)·0.8)`,
회차당 +0.25·f HP / +0.15·f atk → NG+1 +25%/+15% 그대로, NG+2 +39%/+23%; **씬 레이어
폴드 — 리졸버·밸런스 해니스 비접촉**, bonds 패턴), 골드 +15%/회차는 endBattle(캡 없음).
챕터 카드에 회차 배지. **유효 회차는 NG+2 상한 고정**(`NG_SCALE_CAP=2`) — 체감곡선도
무한 상승형이라 캡이 없으면 NG+3부터 늪마녀(17라운드 소모전 스펀지)가 다시 1%로 무너져
클리어 불가. NG+3+는 NG+2 난이도(늪 7%·황제 78%)로 유지, 배지 숫자만 계속 오름.
**선형 스케일 금지** — 영웅 성장 상한이 회차마다 고정이라 선형이면
NG+2부터 스토리 보스가 최적플레이로도 클리어 불가(늪 1%)가 된다(2026-07-16 수정).
`scripts/balance.js`는 `NG=n` env로 회차 스케일 미리보기(battleScene와 동일 공식) —
NG 미설정은 1회차 그대로. 회차 곡선/영웅 성장/보스 스탯 변경 후 `NG=1`·`NG=2`로 재확인.
**`BASIC_ONLY=1 npm run balance`** — 영웅이 공격 스킬/상태기를 무시하고 통상공격만(+생존
힐/허브). "스킬 없이 이기는가" 실측 진단: 트래시는 100% 승(스킬=선택)이지만 보스는 8~31%
(스킬 사용 시 77~91%)로 붕괴 → 보스가 스킬 게이트임을 정량 확인. 보스 튜닝 후 이 토글로
회귀 검증(5% 아래면 평균 플레이어에게 과튜닝 신호). **XP 곡선**: `progression.js stepCost`가
L≤4는 `8+6·(L-1)`(그대로), L≥5는 `26+15·(L-4)`로 기울기 상향(레벨업 ~2배; 준2차는 후반
grind 폭증이라 선형 채택). 레벨→스탯 매핑 불변이라 해니스(고정 레벨) 비접촉 — 순수 페이싱.

### 5. Save schema (data/save.js)
Defensive `??` validation; old saves never crash. Mercy fields: `allies:[]`,
`activeAlly:null` (validated against roster — prevents phantom 5th unit),
`flags.mercied/slain`. Adding a persistent field: add to `freshSave()` + a
validated read in `validateSave()` + a test. Tests use **field-level asserts**
(not toEqual blocks like ../game) — so the sibling `/sync-save-schema` does NOT
apply here.

### 6. Fabula Points + Bonds (자비 = 파워, Fabula Ultima port)
The mercy theme's mechanical payoff, split in two:
- **Fabula Points** (`save.fabula`, cap 6) — scarce clutch currency. **Earned**:
  +1/battle on any spare/recruit (NOT per-enemy — that made rally spammable),
  +1 per hero's first Crisis (≤50% HP) per battle, +1 per hero flaw trigger
  (Trait→FP). **Spent** via the 운명 battle command: 고무(party atk +30%, 1),
  불굴(survive next lethal hit at 1 HP, 1), 재기(revive a fallen hero @15% HP, 2).
  **운명 is a FREE ACTION (2026-05-30)** — it does NOT consume the actor's turn:
  `resolveNow` re-opens the same hero's command menu (instead of advanceTurn) for
  `inspire/lastStand/rally`. Capped at **once per turn** (`this.fateUsedThisTurn`,
  reset in `act()` at each hero turn-start, set in `confirmFate`, gates the 운명
  menu option) — WITHOUT this cap a held/repeated confirm chain-drains all FP in
  one turn (the bug this guard fixes). FP cost (1/1/2) is still spent normally.
  **FP currency lives in runtime/scene — the resolver stays FP-free.** The
  resolver only exposes pure effect actions `inspire`/`lastStand`/`rally`
  (+ `dealDamage` helper that honors the one-shot `lastStand` clamp).
- **Bonds** (`save.bonds = { "a|b": [emotions] }`, `systems/bonds.js`, PURE) —
  permanent. **3 axes, each with a positive and negative pole** (≤3 per pair;
  the poles are mutually exclusive — `addEmotion` flips the opposite in place via
  the `OPPOSITE` map, so a flipping playstyle re-colours a bond instead of
  hoarding both). The pole each battle grows is set by whether you showed mercy:
  - TRUST (co-survival, bloodied): mercy→**충성**(loyalty,+def) / slaughter→**불신**(mistrust,+atk%)
  - CARE (revive vs abandon): revived→**애정**(affection,Crisis surge) / abandoned→**증오**(hatred,death-rage surge)
  - RESPECT (shared Crisis): mercy→**존경**(admiration,+atk) / ruthless→**멸시**(contempt,+atk bigger)

  **Effects** (battleScene.enter, save-progression buff invisible to fresh harness
  runs): `bondStrength` counts **positive poles only** → +3%/pt maxHP (cap +15%);
  loyalty→+2 def, admiration→+2 atk, contempt→+3 atk, mistrust→+6%/pt atkBuff.
  affection surges +0.2 atkBuff when a bonded ally hits Crisis (`checkCrisisFP`);
  hatred surges +0.35 atkBuff when a bonded ally **dies** (`checkDeathRage`).
  Positive bonds = tanky+clutch; **negative bonds = glass cannon — offense only,
  NO HP cushion** (the ruthless power fantasy; mirror of mercy=power). The balance
  harness models both via the MERCY and RUTHLESS passes.
- Bonds view: field menu (X) → 유대 (negative poles marked `†`, dual 자비/잔혹
  legend). Per-hero flaws (knight 맹세/warrior 분노/huntress 통찰) live in
  `battleScene.checkFlawFP`, not party.js.
- **Bond strikes (인연공격, content/bondSkills.js)** — FP-cost duo skills, once per
  battle (`state.bondStrikeUsed`). Hero pairs need an emotion on the pair's bond;
  **recruited allies need none** (recruiting IS the bond) — deployed ally + FP suffices.
  `availableBondStrikes()` looks up `ALLY_COMBOS[ally.refId]` first (species-specific
  duo — 5 story-setpiece allies: dark_warden 숲의 사냥 3연격+출혈 / bridge_warden
  파수꾼의 낙추 강타+방어약화 / seal_guardian 서약의 뇌창 관통 뇌전+감전 / fallen_star
  별빛 낙하 전체 성속 2연 / ember_hound 잿불 질주 2연 화상), falling back to the
  generic `ALLY_COMBO` (공생 연격) for ordinary recruits. Pure data + spellFx DEFS —
  the resolver's existing `base.inflict/pierce/hits` paths do the work (resolver/scene
  untouched). New species combo = one `ALLY_COMBOS` entry + a `DEFS[id]` choreography.

### 7. Field movement (fieldScene)
- **Tile-chaining**: a finished tile FALLS THROUGH (no `return`) so a held key
  starts the next step the same frame — fixes per-tile 1-frame stutter. `MOVE_TIME
  0.12`, `REPEAT_DELAY 0.16` (config.js).
- **4-dir sprite (2026-05-30)**: all 5 heroes ship full north/south/east/west stills
  (`heroes/{base}_{dir}.png`) + 8-frame walk cycles (`heroes/anim/{base}_{dir}_{0..7}.png`,
  imported from the PixelLab 4-dir bundles). `player.facing` IS the 4-dir sprite
  direction (= `player.dir` on input); `heroUrl`/`heroWalkUrl` resolve by `DIRS`. Up/down
  movement plays its own vertical walk cycle. (Attack frames stay east/west only — the
  battle is side-view.) `loadMap` syncs `facing = dir` so the spawn sprite faces entry.
- **Roamer density + respawn (2026-07-15)**: `roamerCount(map)` (systems/roamers.js,
  PURE) sizes the symbol-encounter population per map: `map.encounters.roamers` override,
  else `max(5, min(18, round(w*h/55)))`. The divisor assumes maze walls eat ~half the
  raw area, so **perceived density ≈ 2× the tiles-per-roamer number** (large fields
  884-1008 tiles → 16-18, mid ~572 → 10, small boss rooms 252 → 5, deliberately sparse
  for pre-boss tension). **Respawn contract**: roamers are runtime-only — `spawnRoamers`
  runs on every `loadMap`, so map re-entry always respawns them (bosses are flag-gated
  map objects, never roamers — naturally excluded). Roamers are avoidable symbols, so
  raising density adds optional encounters, not forced grind.
- **Random-encounter grace (ENC_GRACE, 2026-07-16)**: step-encounter maps (no
  `symbolEncounters`: wild_cave/dungeon/darkforest/ruins_below/starfall/waterway) felt
  "too fast" because `rollEncounter` is a pure per-step probability with NO cooldown, so
  fights clustered on consecutive steps. `fieldScene._stepsSinceEnc` counts steps and
  gates the encounter in `arrive()` on `>= ENC_GRACE` (config.js `ENC_GRACE=5`), resetting
  to 0 on `loadMap` AND on battle start — the first ~5 tiles after entry/battle are
  encounter-free. Per-step `rate` is UNCHANGED (overall frequency same; only clustering
  removed). Player-side softening — balance harness never walks, so no re-run needed.
- **Minimap POI glyphs + fog-independent markers (2026-07-16)**: the corner/big (M) minimap
  draws points-of-interest as legible glyphs (not plain color dots): **`!`** gold = quest
  giver (bright if offer/turn-in ready, dim while active, GONE when `quests[id]==='done'`),
  **`?`** gold = unopened visible chest, **`?`** cyan/dim = open/gated portal; boss = red
  dot, recruit/plain NPC = green dot (hidden once its join `flag` is set = 영입 완료),
  runegate = gold square. `mmGlyph(g,tx,ty,cell,type,color,alpha)` renders into `mmStatic`
  so glyphs scale in the enlarged view. **POI markers render REGARDLESS of fog** (the
  terrain tiles stay fog-gated — exploration still fills the map) so a just-entered dark
  dungeon shows chests/portals/boss to navigate toward (objective markers); only
  `o.hidden` chests stay secret. Quest NPCs' static `!` label prefix (`"! 위병대장"`) is
  also stripped when the quest is done (field label + minimap unified).
- **Ground shadows (2026-05-30)**: a soft elliptical drop-shadow under characters +
  enemies so nothing floats. `renderer.shadowTexture()` (a baked radial-ellipse canvas
  texture, reused) is the shared primitive. FIELD: `fieldScene.makeFieldShadow(mult)`
  adds one to `props` at `zIndex −0.5` under the player / NPCs / bosses / roamers
  (positioned at the tile-foot in `placePlayerSprite`/`placeRoamerSprite`/buildObjects;
  props/signs/chests get none). BATTLE: `battleScene.makeUnitView` adds one at each
  unit's feet (behind sprite + the hero foot-ring). Ported from `../game`'s drop-shadow.

### 8. Ending flow
Boss objects flagged `final: true` (now **empire_throne fallen_emperor** — moved off
swamp bog_witch when the Fallen Empire slice appended the region after swamp) route
endBattle → `game.toEnding(tone)` → `EndingScene` (opaque, tone-titled, drifting motes)
→ `game.toTitle()` (pops all, pushes Title). Cleared save kept → 이어하기 = post-game
free roam. **Branch bosses** carry `branchFlag` on the map object: endBattle records
`branchOutcome(state, ref)` (battle.js, PURE — reads that enemy's own `resolved`, not
the battle-wide mercy tally) as `flags.${branchFlag}_spared|_slain`, which map portals
gate on via `requires`. The empire's fallen_knight (NOT `boss:true`, so it stays
spareable) uses this to open 정문(spared)/뒷문(slain) to the throne. New persistent
flags MUST be added to `freshSave()` + `validateSave()` (flags is whitelisted, not
freeform — see save gotcha).

**Post-game superboss regions** (lava `불의 분화구`, void `공허의 균열`): optional,
NOT `final:true` (the emperor stays the STORY ending). They're **warp-only** — never in
content.test's BFS reachable list (no portal-graph path from town), but still pass the
portal-graph validity + per-map traversability guards. Each gates the next: lava opens
on `empireBossDefeated`, void on `magmaDrakeDefeated` (`flags.voidLordDefeated` is the
completion tail). Cleared-save players warp in to fight magma_drake / void_lord for
post-game gear. New superboss region: append maps, register a warp point (NOT a town
portal), whitelist its boss flag.

**Two ending tiers**: a boss object's `final:true` (emperor) → `toEnding(tone)` with the
mercy-toned title (자비/정복/여정). The deepest superboss void_lord carries `trueEnding:true`
instead → `toEnding('true')`, the **TRUE ending** (`EndingScene` `TONE.true` — gold title +
returning-starlight, independent of mercy tone). endBattle routes: trueEnding → final →
resumeField. A new ultimate-conclusion boss uses `trueEnding`; the story finale uses `final`.

### 9. Map connectivity tests (content.test.js)
Two regression guards lock completability: (a) every portal targets an existing
map + a walkable landing; (b) BFS from spawn over **baked collision** (structural
walls + props/signs/chests baked solid, exactly as fieldScene.loadMap) reaches
every portal/boss/chest. A wall or prop that seals a region passes the portal-graph
check but fails BFS. Maze maps use `combMaze` (`_builder.js`) — a guaranteed-
connected serpentine; left/right open zones hold entrance/boss/exit.

**Sprite-ref integrity guard (2026-07-16)** — a third guard (`map sprite-ref integrity`)
mirrors fieldScene.buildObjects' URL rules and asserts every NPC/boss object's art ref
resolves to a REAL file: `art:'enemy'`→`/enemies/<ref>_east.png`, `art:'hero'`→
`/heroes/<ref>_<dir>.png`, plain npc→`/npcs/<ref>_<dir>.png`, boss→
`/enemies/<getMonster(ref).sprite>_east.png`. Catches the invisible-NPC class of bug
(a stray ref renders nothing, with NO error) — the reason it exists.

**HD-2D elevation (2026-05-30)** — maps may carry an optional `elev[]` (row-major,
like collision) + `stairs:[{x,y}]` bridges + `drops:[{x,y}]` one-way ledges (`_builder.js
raiseRect(elev,collision,W,x0,y0,x1,y1,level)` raises only walkable cells). It's BOTH
visual (`fieldScene.buildElevation` draws cliff faces/rim light/drop shadow; tiles +
sprites offset by `elev*ELEV_STEP`) AND a real walk rule: the **shared pure predicate
`canStep(map,fx,fy,tx,ty)`** (field.js) gates a step — same level OK, different level
needs a stair (bidirectional) or a down-step off a drop ledge (one-way). tryMove,
roamers, AND the content.test BFS all call `canStep`, so a cliff blocks identically
in-game and in the guard. The BFS above now floods via `canStep` (flat maps: no
`elev` → `canStep≡canMove`, unchanged); maps with `drops` get an extra **stranding
guard** (reverse-flood from portals — every reachable tile must reach an exit, so a
one-way drop can't trap you). `elev`/`stairs`/`drops` are STATIC map data (no save
change). Forget a stair → the boss/chest goes unreachable → content.test RED. Maps
with elevation: dungeon/frost/swamp/empire_throne/lava_core (boss on a raised dais +
stair), town (north terrace), wild (SE bluff + drops).

**Signature room generators (던전 다양성 B단계, 2026-05-30)** — `combMaze` is no
longer the only shape. `_builder.js` adds three CONNECTIVITY-SAFE-BY-CONSTRUCTION
generators (each placing only isolated obstacle clusters with ≥2-tile aisles, so the
open floor stays one region; `_builder.test.js` flood-verifies, incl. 20 cavern seeds):
`pillarHall(col,w,h,x0,y0,x1,y1,{spacing,size})` (기둥홀 — regular columns, open
hall), `cavern(col,w,h,x0,y0,x1,y1,rng,{cell,density})` (동굴 — jittered rock
clusters, needs a seeded `rng`/`.next` for determinism), `bridgeChasm(col,w,h,axis,
at,bridges,{thickness})` (협곡다리 — a wall band crossable only at listed bridge
gaps; ≥1 bridge required or the halves isolate). `floodReachable(col,w,h,sx,sy)` is
the shared BFS helper. Shapes are now varied PER REGION (no more universal comb):
the three core story mazes — **dungeon=cavern** (sparse crypt cave), **frost=pillarHall**
(ice colonnade), **swamp=cavern dense** (mangrove tangle, cell 3) — plus empire
(gate=pillarHall, city=combMaze, throne=columns, camp=rect) + the bridge (bridgeChasm).
Each map's generator is bounded to the comb's old middle cols (4-20) so the left
trigger/queen corridor (cols 1-3) + the boss region (cols 21+) stay open; `cavern`
takes a fixed seed (`createRng(N).next`) so layouts are deterministic for content.test.

**Region tileset (시각 다양성 B단계)**: the 4 empire maps used to all reuse
`dungeon` flagstone. Now `tileset:'empire'` (`empire_marble.png`, PixelLab Wang 32px,
semantic ground id **8**) — dark cracked obsidian + dried-blood veins for the fallen
empire. NOTE the Wang index: `{8: 6}` picks the full-LOWER (obsidian) tile, NOT 12
(the all-marble upper tile, which read too lava-like). New region tileset: add to
`TILESETS`+`TILESET_META`(index 6=lower/12=upper)+`TILE_COLOR` fallback+`BIOME_WEATHER`.

**Within-map ground variety via ACCENT SHEETS (2026-05-30)**: a map renders ONE
tileset sheet by default, but `TILESET_META[x].accents = { groundId: {url, idx} }`
lets specific ground ids draw from OTHER sheets — `buildGround` loads the main + all
accent sheets (Promise.all) and picks per cell. Used for swamp mud + `swamp_bog`
algae-water pools (id 3, walkable, cosmetic). Wild uses the simpler within-sheet
route (grass+dirt from its one meadow sheet + id-3 water solid fallback). Caveat:
accent sheets MUST match `tilePx` (the unused `swamp_moss/planks` are 192px, not 32 —
slicing them at 32 misaligns; generate a 32px Wang sheet instead).

### 10. Spell FX engine (fx/spellFx.js) — ported from share2/spellfx
A code-drawn pixel particle/beam/flash engine (NO new art), a faithful PixiJS port
of the share2 `spellfx` prototype. Runs in the prototype's **low-res logical space**
(1 logical px = `LO`(4) screen px): battleScene puts the particle/beam layer inside
`fieldLayer` scaled ×LO, plus full-screen tint+flash `Graphics` just below the panel.
The scene converts unit mid-body positions to logical coords (÷LO) when calling
`spellFx.play(spellId, {caster, enemies})`. Because the engine runs in logical space,
every tuned prototype constant (sizes/velocities/beam widths) reproduces 1:1 with no
retuning. `DEFS` holds ~76 choreographies keyed by game spell id (base 13 + AoE 6 +
extended 4 + class ults 3 + the class-rework kits: warrior/hunter/mage/knight skills);
`FX_ALL_TARGET` marks the AoE-looking ones. **State-branch FX**: before `play()`,
`playSpellFx` sets `spellFx._rage/_stealth/_charge` (from the actor's rage + the
`stateEnd` events) and the warrior/hunter/mage choreographies read those flags to
escalate visuals (분노 red, 은신 기습 purple, 충전 과부하 gold). battleScene
drives it from the `castStart` event in `resolveNow`→`playSpellFx`; on impact,
`flashFromEvents` SKIPS its legacy single `fxTexture` sprite + shake when the engine
owns the spell (`hasSpellFx(spellId)`) to avoid doubling — the red flash + damage
number stay. **Cosmetic only**: never imports battle.js state, never writes save;
constructed only when a renderer exists (headless balance harness never builds it).
Two Graphics per engine: `gNorm` + `gAdd` (blendMode 'add' ≈ canvas 'lighter').
`floatSpr` canvas callbacks → typed shapes in `drawFloat` (cross/ring/hex/note/zee/
blade). Particle cap 520. `setTimeout` → `schedule(delay, fn)` (dt-driven, resize-safe).

**battleScene.panelMenu scrolls** — a long spellbook (13+ spells at high level)
would overflow the fixed bottom panel and overlap/clip. `panelMenu` caps visible
rows (`maxVisible` by panel height) and SCROLLS the window with the cursor (▲/▼
markers when more is above/below); reusable row slots re-text on each `setIndex`.
`texts` is kept full-length (objects) so navMenu/navTarget cursor-wrap (% length)
still spans every option. Two-line status cards in `menuScene` similarly clip if
text wraps — the equipment line is ONE line auto-shrunk via `eq.scale.x`, and the
whole status column scales to fit screen height (`statusLayer.scale`).

### 11. Audio asset layer (util/audio.js, 2026-07-14)
SFX/BGM transcoded from the Unity sibling's packs (MagicArsenal + 25 RPG Game Tracks +
Resources/Bgm) via **afconvert** (macOS builtin, no ffmpeg) → m4a in `public/audio/`
(32 files, ~16MB). The layer sits on the shared zzfx `AudioContext`; **every path falls
back to ZzFX** (file missing / not-yet-decoded / disabled → identical to pre-port
behavior), so headless/test runs are unaffected. Maps: `ASSET_BGM` (mode → basename;
field modes are `field_<region>` keyed by `map.mood || map.tileset`, same lookup as
`REGION_MOOD`; fieldScene.loadMap sets `game.fieldMusic` so battle-return resumes the
region track), `JINGLES` (victory — handleEnd stops BGM then `playJingle`), and 10
element cast/impact SFX pairs (`playElement('cast'|'impact', element)` driven from
battleScene's castStart/impact events; heal/cure map to the 'heal' pair). **AAC encoder
delay (~45ms lead silence)** is trimmed at decode time — scan decoded PCM for first/last
non-silent samples (`trimRange`) → `loopStart/loopEnd` + start offset — keeping SFX
punchy and BGM loops gapless without lossless files. **Memory**: decoded PCM ≈ 40MB/
track, so `preload()` decodes only battle/boss + jingles + SFX; region BGMs lazy-decode
on entry and `startAssetBgm` **evicts** non-current `bgm_` buffers (revisit = HTTP-cache
re-decode). New track: afconvert the wav (SFX 64k / region BGM 96k / battle 128k AAC) →
drop in `public/audio/` → add the basename to the right map. License caveat: Unity
asset-store packs used outside Unity — accepted for this local toy (see TODOS.md).

## Content Extension Checklists

**Recruitable monster**: in `content/monsters.js` set `recruitable` (default true
unless boss) and optional `mercyThreshold`. Per-monster join skill/dialogue is
deferred (see TODOS.md).

**Caged-monster rescue (자비 셋피스, C단계 2026-05-30)** — a free-it-in-the-overworld
beat embodying 자비=파워. Pure DATA on the trigger kit: a `kind:'npc'` with
`art:'enemy'` (renders the monster's BATTLE sprite via `enemyUrl(o.ref)` — the ref is
used **DIRECTLY as the sprite key**, unlike a `kind:'boss'` object which resolves
`getMonster(ref).sprite` via `getMapBossSprite`. **Gotcha**: an `art:'enemy'` ref with no
`/enemies/<ref>_east.png` file renders INVISIBLE with no error — e.g. the witch NPC's old
`bog_witch_npc` (the sprite is `boss_bog_witch`). content.test's sprite-ref integrity guard
now catches this) + `recruitAlly:'<refId>'` + a persistent `flag`, placed behind a
switch-gated cage (`toggleWalls` cell opened by a `switch` trigger). On dialog close
`main.openDialog` fires `game.recruitAlly(refId, flag)` (mirrors `recruitHero` but
pushes to `runtime.allies` — the same bench battle-recruit feeds; idempotent via the
flag, joins at lead level, deploy via field menu → 동료). The freed-flag is PERSISTENT
→ MUST be in `freshSave()`+`validateSave()` whitelist (see Gotcha #9); the cage SWITCH
is runtime-only (reseals on re-entry). Reference: empire_city `갇힌 사냥개` (ember_hound)
in the switch-gated bottom-right pocket. Dialog `caged_hound` (the captive's plight);
the join line is the monster's own `recruitLine`. The empire is the mercy-showcase
region — it also carries the moral-choice branch (fallen_knight spare/slay → 정문/뒷문).

**Optional side-area map (C단계 붕괴다리)**: `empire_bridge` (심연의 다리) — a dead-end
map off the camp (one always-open portal in + return), so it does NOT join the
content.test hardcoded critical-path reachable list (town→…→throne); it only needs the
all-maps portal-validity + spawn→portals/bosses/chests traversability guards. Built with
`bridgeChasm` (chasm crossable only at one bridge column) + an `encounter` trigger on the
span (collapse-ambush) + the spareable+recruitable `bridge_warden` miniboss.
`bridge_warden` is a palette-swap of rune_guardian (bronze tint + upscale). FIELD boss
sprites come from `fieldScene.getMapBossSprite(refId)` which returns `getMonster(refId).sprite`
— the SAME key the battle scene renders via `enemyUrl(unit.sprite)`, so a field boss always
matches its battle art (fixed 2026-05-30: the old hardcoded refId→sprite map only covered
skeleton_king + bridge_warden, leaving 9 bosses — werewolf_king→boss_werewolf_king,
frost_queen→boss_ice_queen, blood_count→boss_vampire, void_lord→boss_demon, … — rendering
as shadow-only/invisible on the field). A new field boss just needs its monster `sprite`
file at `/enemies/<sprite>_east.png`.

**Monster skill (적 전용기, 2026-05-30)**: enemies cast family-keyed skills, not just
basic attacks. Define in `content/monsterSkills.js` (`{id,name,kind,target,...}`;
`kind: damage|drain|ailment|selfbuff|selfheal|selfdestruct|allybuff|guard`; `target:
one|all|self|allies` is **caster-relative** = the OPPOSING side / the caster / the
caster's own line). Damage is **atk-scaled** (`monsterSkillDamage`, weighted by `dmgMult`,
`pierce` ignores def fraction) — NEVER maxMp magic, so trash/bosses stay on the tuned
ladder (the spec's flat `power` is **translated to `dmgMult` weights** when porting);
`element` only drives ailment + affinity. **Bestiary-2 resolver fields (2026-05-30)**:
`hits` (multi-strike, e.g. flurry ×3), `highCrit` (a `HIGHCRIT_CHANCE` roll for
`CRIT_MULT`, e.g. divebomb), `defMult` (selfbuff def, e.g. stoneskin), and an optional
`chance` on `ailment` (partial-land — petrify 0.7; omit = always, like curse/monshock;
a missed roll emits `inflictResist`). `allybuff` surges the caster's whole side
(atkMult/spdBonus — wardrum/warcry); `enemyChooseAction` **skips allybuff when the
caster fights alone** (`living(side) < 2`). Give a monster a kit via `skills: [{id,chance,cd,max?}]` in monsters.js
(chance=per-turn roll, cd=round cooldown, max=per-battle cap). `enemyChooseAction` rolls
ready skills before the basic-attack default; `_cd`/`_used`/`skills` are `makeUnit`
fields, `_cd` ticks once per round in `startRound`. Bosses swap kits on enrage via
`phase2.skills` (`enrageBosses` resets `_cd`). FX: port the choreography into
`fx/spellFx.js DEFS[id]` (caster=monster, `S.primary()/targets()`=heroes); AoE ones go in
`FX_ALL_TARGET`; battleScene drives it via `playMonsterSkillFx` on the `monsterSkill`
event. **No separate balance simulator** — `scripts/balance.js` reuses the real
`enemyChooseAction`+`resolveAction`, so it models skills automatically; re-run
`npm run balance` (3 passes) after touching kits. **Watch the frenzy×enrage cliff**:
a selfbuff `atkMult` multiplies on top of `phase2.atkMult`, so small changes near the
one-shot HP threshold swing superboss win% hugely (1.4→1.3 moved DRAKE 35%→82%).
Adding an AoE skill to a `phase2.skills` set is the same lever: magma_drake P2 +eruption
dropped DRAKE baseline 70%→64%; trimming its chance 0.4→0.25 (cd 3→4) recovered it to
~68/87/100 (BASELINE/MERCY/RUTHLESS). Conversely, giving a boss a sub-1.0 `dmgMult` AoE
it casts *instead of* a full basic attack can LOWER its single-target pressure (void_lord
+voidblast nudged it slightly easier, not harder) — read the table, don't assume.
`summon` (mid-battle unit spawn) is DEFERRED — breaks spoils()/mercy/recruit invariants
+ needs renderer spawn (see TODOS.md).

**Spell**: `content/spells.js` (`{id,name,mpCost,power,kind,target}`); add to a
hero's `spells`/`learn` in `party.js`. For a custom animation, add a choreography
to `fx/spellFx.js` `DEFS[id]` (else it falls back to `_default`); AoE-looking spells
go in `FX_ALL_TARGET`. **Physical skill?** set `physical:true` (atk-scaled
`skillDamage`, NOT maxMp-scaled magic) — warrior/huntress kits; `spell.power` is then
*bonus atk*, not the whole number. A `kind:'state'` skill (stealth/rage/charge) carries
`state` (+ `hpCost`/`turns`); the balance harness models warrior 분노 + huntress 은신 in
`chooseStateAction`, so re-run `npm run balance` after touching the state kits.
**Balance note (magic)**: magic damage/heal SCALE with the caster's
`maxMp` via `magicScale(caster) = 1 + maxMp/MAGIC_SCALE_K` (K=15, battle.js), so
`spell.power` is the *base* — a reachable single-target spell now out-damages a free
basic attack at the same level (the design intent: skills = the strong, MP-gated
payoff). Because maxMp grows per class (huntress fastest, warrior slowest), the same
`power` hits hardest on the strongest caster — per-class identity for free. So
`power` is NOT the final number: a `power 16` spell at L16 huntress (maxMp ~29) lands
~46. The harness AI picks the *earliest-learned* AoE and *highest-power* single-target
(≤L16), so reachable single-target spells (firebolt/smite/ice_lance) are now ON the
tuned boss ladder. Ults/메테오 (power ≥24) stay **post-game learns (L17+)** — scaled,
they'd be overwhelming on the tuned bosses. New AoEs are still inert in the harness
(firestorm/quake stay the pick). Re-run `npm run balance` (3 passes) after touching
spell power/learnsets OR `MAGIC_SCALE_K` — boss `maxHp` is tuned against this scale
(skeleton_king 320, bog_witch 660, fallen_emperor 760 bumped for it 2026-05-29).

**Status ailments (양방향: heroes ↔ enemies, same code)**: 12 types in
`STATUS_TYPES` (battle.js) — poison (DoT 8%), burn (DoT 6%, 화염), sleep (skip +
45% self-wake), shock (30%/turn paralysis skip, 뇌전), weaken (atk −30%, 일반 디버프),
freeze (동상, 냉기 — `effectiveSpd` ×0.5 in turn order + atk −20%, NOT spd-mutating),
plus the class-rework physical-debuff trio: atkdown (위협, atk ×0.8 — warroar/연막탄),
defdown (방어약화, target def ×0.6 via `effectiveDef` — sunder), slow (둔화,
`effectiveSpd` ×0.5 like freeze but NO atk penalty — snaretrap), plus the **Bestiary-2
CC trio (2026-05-30)**: petrify (석화 — full deterministic turn skip, no self-wake,
cleanse-gated; medusa), stun (기절 — 1-turn skip; tonguelash inflict), blind (실명 — a
blinded attacker's damaging action misses `BLIND_MISS`=50%, no skip; screech). All CC
turn-skips are bounded by `MAX_CC_SKIPS`=2 (**anti-stunlock** in `tickStatus`: on the
3rd consecutive skip the unit shakes off sleep/petrify/stun and acts — emits `shakeOff`;
the `_ccSkips` counter is a `makeUnit` field). `applyStatus`/`tickStatus`/`cureStatus`
handle all; `tickStatus` emits `poisonTick`/`burnTick`/`asleep`/`paralyzed`/`wake`/
`petrified`/`stunned`/`shakeOff`. A damage spell carries one via
`inflict`/`inflictChance`/`inflictTurns` (resolver line ~275) — element→ailment:
화염→burn, 냉기→freeze, 뇌전→shock (single-target higher chance, AoE lower). Enemies
inflict the SAME way via `monster.inflict {status,chance,turns}`. Adding a NEW status:
extend `STATUS_TYPES` + a `tickStatus` branch + the damage hook if it modifies combat
(see `weaken` in physicalDamage) + an icon in `pixelIcons.STATUS`/`ST_PAL` +
`STATUS_KR`/`STATUS_TAG` in battleScene + a message branch. cleanse spell auto-cures
all of `STATUS_TYPES`; consumables cure one named status (antidote→poison etc.).

**Elemental affinity (`elementMultiplier`, battle.js)**: a damage spell's `element`
(spells.js: fire/ice/thunder/holy/poison/wind/dark/earth/physical) vs the target's
`family` tag (monsters.js: elemental `undead`/`icy`/`fiery`/`fire`/`void` +
physical-activation `rocky`(석·구조물)/`metal`(기갑)/`aerial`(공중)/`beast`(야수);
heroes + untagged enemies neutral). DELIBERATELY MILD — STRONG ×1.25, RESIST ×0.8,
else ×1 (not classic ×2/×0.5, so it nudges spell choice without trivializing or
hard-walling). Rules: 신성(holy)→undead/void; 암흑(dark)→void; 화염(fire)↔냉기(ice)
cross ×1.25 same-element ×0.8; **뇌전(thunder)→metal/aerial (▼rocky), 대지(earth)→rocky
(▼aerial), 바람(wind)→beast (▼rocky)** — the physical-element layer so 원소 무기가 실제
약점을 노린다(2026-07-16). rocky는 earth▲·wind▼·thunder▼의 축; metal은 rusty_soldier/
imperial_guard/fallen_knight(제국권 뇌전 특효 — 나머지 제국군은 undead 유지로 신성 축
공존). 어느 한 원소도 단독 정답이 아니게 지역마다 undead/metal/rocky/beast/aerial 혼재. Applied wherever a damage fn carries an `element`: `magicDamage`
(spells), `skillDamage` (physical hero skills), `monsterSkillDamage` (enemy skills),
AND **basic attacks (`physicalDamage`) now inherit the attacker's `weaponElement`**
(2026-07-16 — 물리 클래스가 원소 무기로 통상공격까지 상성). `family` carries through
`buildEnemyUnit`. Story bosses (bog_witch/dark_warden) stay UNTAGGED so no weapon
trivializes them. Balance-invisible (harness uses ice/non-elemental weapons vs
untagged/non-interacting bosses) — a player-facing optimization layer, not a ladder
lever. Re-run balance only if you change the multipliers or tag a boss the harness's
equipped weapon element matches.

**Affinity module (`src/systems/affinity.js`, PURE, 2026-05-30 refactor)**: the table +
multipliers were extracted out of battle.js into a shared module so the resolver and the
battle UI preview agree. Exports: `affinityMult(element, family)` → multiplier (battle.js
wraps it as `elementMultiplier`), `affinityKind(element, family)` → `'strong'|'resist'|
'neutral'` (drives the UI 상성 badge), constants `AFFINITY_STRONG`(1.25)/`AFFINITY_RESIST`
(0.8), and the `AFFINITY` table (element → `{strong:[…families], resist:[…families]}`).
`AFFINITY` is the single source of truth — edit it there (don't duplicate the rules), and
the previewed number stays equal to the dealt number.

**Encounter tuning (군집 전투, 2026-05-29)**: trash is balanced for GROUP combat, not
1v3 speed bumps. Maps spawn 2-5 mobs (`encounters.min/max` per map; wild gentler at
2-3), with trimmed `rate` so bigger fights don't grind. Trash HP/atk were bumped ~1.4x
so a group survives round 1 and lands real counter-hits, and so the 자비/recruit window
(hp ≤ 30%) is reachable on regular mobs + AoE spells have multiple targets.

**Trash attrition pass (2026-07-16)** — player power kept accreting (아티팩트 / 유대 /
무기속성 상성 / 4인 편성 / 강화) while trash stayed static, so trash had drifted to a
NON-EVENT: `BASIC_ONLY=1` (skills forbidden) still cleared **every** region L2→L26 at
100% win / 0.00 deaths / ~90% HP. The 44 true trash mobs (encounter-pool only — the 17
map-boss/miniboss refs are EXCLUDED, they're separately tuned as harness scenarios) were
bumped **atk ×1.78, maxHp ×1.47** cumulative, via a deterministic script (never hand-edit
44 rows). **Key lesson: atk alone did almost nothing** (+32% atk moved HP-remaining only
90%→86%) because trash died in ~2 rounds and never got to act — **HP is what buys them
turns, atk is what makes those turns hurt; you need both.** Result: mid-game trash
71-82% HP-remaining at 2.4-3.3 rounds (attrition, NOT grind) with deaths appearing even
under optimal AI; early game (L2-6) deliberately left gentle. Boss scenarios are
unaffected (they don't draw from the trash pool) — verify that in the table after any
trash change. Turn order is
INTERLEAVED by spd (not side-phased) — fast skirmishers (spider/imp 13, frost_crow 20,
swamp_runner 26, spirit_guard 24) are tuned to OUTSPEED the bruiser heroes (knight/warrior,
~level+6 spd) so they strike BEFORE being culled; huntress stays fastest. Bump a fast mob's
spd above the region's warrior spd or interleaving is a no-op there (hero spd scales, mob
spd is flat). The harness models
OPTIMAL play (perfect AoE/heal/herb), so trash showing ~90-96% HP-remaining + 0 deaths
there is the FLOOR — real (suboptimal) players take more; read avgRounds (now ~2.5-3 vs
old ~1.5) and the rising per-region attrition, not the optimal-AI HP%. Don't "fix" trash
back to 1-round kills. balance.js SCENARIOS mirror the per-map min/max — keep them in sync.

**Early-game party-size cap (capEncounter, 2026-07-15)**: random encounters (step rolls
AND roamer groups) are trimmed to **partySize+1** enemies via the PURE
`capEncounter(enc, partySize)` (field.js), applied in fieldScene at battle start with
`activePartySize()` — a solo-leader start faces ≤2 mobs, a full party the map's normal
max. Scripted trigger formations (`group:[refIds]`) bypass the cap (authored ambushes
stay as designed). The balance harness models the 3-hero ladder WITHOUT this cap
(full-size encounters), so the cap is a pure player-side softening — no re-run needed
when touching it.

**Quest** (`content/quests.js`, PURE — no Pixi/save write): a quest is
`{id,name,giver,desc,cond,reward,offer/active/done dialogue}`. PURE `isQuestComplete(quest,
runtime)` checks `cond.type` — `boss{flag}` / `mercy{count}` (flags.mercied) / `slay{count}`
(flags.slain) / `collect{item,count}` (inventory). State lives in `save.quests[id]` =
`'active'|'done'` (validated in save.js — string-keyed, whitelisted to those two values).
NPC interact (`obj.quest`) → `game.talkQuest(giver, qId)` offers / turns in (reward grant
+ collect-consume is main.js's job, not the resolver). Quest log opens from field via **Q
key** (input action `quest`) or menu → 퀘스트. New quest: add to `QUESTS`, link a giver
NPC's `quest`, add `_merciful`/`_ruthless` dialogue variants if tone-reactive, add a test.

**Merchant shop** (`scenes/shopScene.js` `SHOPS` registry): keys
`general`/`smith`(대장장이)/`jeweler`(보석상)/`alchemist`(연금술사). Each = `{title, stock:[ids],
upgradeSlots?:[], tabs?:[{key,label}]}`. NPC dialog `action:'shop'` (+ `shop:key`) → `game.openShop(key)`. Modes
cycle on a toggle row: buy → sell (50%) → **upgrade** (only if `upgradeSlots` set). Buy/sell
respect the finite equip pool (Gotcha #7). New shop: add a `SHOPS` entry + a merchant NPC
whose dialog warps to it.
- **Category tabs + scroll (2026-05-30)**: a shop with `tabs:[{key:'weapon',label:'무기'},…]`
  splits its BUY list into ◀▶-switchable category tabs (`key` matched against `getItem(id).kind`)
  — the smith uses 무기/방어구. The list also **scrolls**: `render()` windows the options to
  `maxVisible` rows (derived from screen height) around the cursor with ▲/▼ markers, so a long
  mixed stock never overflows. up/down/◀▶ re-render to slide the window / switch tab. (Sell &
  upgrade modes ignore tabs.)

**Equipment upgrade (강화, max +5)**: per-slot level in `save.party[i].equip.plus.{weapon/
armor/accessory}` (clamped 0–5 in save.js; resets to 0 when that slot's item is swapped in
equipScene). `items.equipBonus(equip)` folds the bonus: each stat ×`(1 + 0.2·plus)`
(`UPGRADE_STEP`). Smith upgrades weapon/armor, jeweler accessories — via the shop's upgrade
mode; `upgradeCost(item, plus) = max(60, round(price·0.4)) · (plus+1)` (scales per level).
equipScene shows `+N` (gold) on equipped names; battleScene's `equipBonus` uses the same
canonical helper. The resolver never sees `plus` — it's folded into the unit's atk/def/etc.
at build time.

**Equipment passive effects (장신구 특수효과, 2026-05-30)**: gear may carry a `passive`
object (combat effects NOT folded into stats). `items.equipPassives(equip)` merges +
clamps them (shares the `forEachEquipped` slot-iterator with `equipBonus`); battleScene
passes the result as `buildHeroUnit({passives})` → `makeUnit` field `unit.passives`
(enemies/allies default `{}` → every hook no-ops). PURE resolver reads it at hook points:
- `regenHp`/`regenMp` (≤0.2) → `startRound` heals a fraction of max (clamped, no overheal);
  events stashed on `state.roundEvents` (HP bar ticks up — no blocking message in v1).
- `resist:{status:0..0.9}`/`resistAll` → inflict roll ×`(1-resist)` at the on-hit
  infliction sites; a roll the charm blocks emits `inflictResist` (reuses existing message).
- `dmgReduce` (≤0.4) → `dealDamage` after shield absorb (DoT ticks through here too — the
  clamp keeps DoT meaningful; min 1 so a hit never tickles to nothing).
- `counter` (≤0.75) → in the `attack` branch after `dealDamage`, **basic attacks only (v1)**,
  recursion-guarded (counter calls `dealDamage` directly — no re-counter), living opposite-side
  target only. Physical-skill/spell/DoT counter is deferred.
- `crit` (≤0.75) → `rollCrit(actor, base, rng)` single helper folds it into BOTH the
  basic-attack crit (base 0) and spell crit (base `spell.critBonus`) so they can't diverge.
  rollCrit short-circuits (no rng) when stealth or chance 0 → balance rng stays bit-identical
  for unequipped units (harness kill-build unaffected). `plus`(강화) does NOT scale passives.
Reference accessories in items.js: antitoxin_charm/regen_ring/thorn_band/lucky_charm/
aegis_pendant (보석상 stock). New passive: add `passive` to an item + a hook branch if it's a
new effect kind + a battle.test case; FX is deferred (events emitted, animation TODO).
**신규 passive 키(2026-07-20)**: `lifesteal`(가한 피해 % 회복)·`execute`(대상 HP≤30% 피해
배수)·`thorns`(근접 피격 % 반사)·`bleedChance`(적중 시 % 출혈) — `equipPassives`가 병합+
클램프. `execute`/`hpBelow50`/`weaknessDmg`는 **`condMult(attacker,target,weak)`** 곱연산
(physicalDamage/skillDamage, **상성 뒤·크리 앞**); `spellDmg`는 magicDamage. `lifesteal`/
`thorns`/`bleedChance`는 **`applyOnHit(state,att,tgt,dmg,melee,events,rng)`** — 리졸버 attack
브랜치 dealDamage 직후 호출(**v1 기본공격만**, counter 선례; 물리 스킬 확장은 TODO). 언데드
bleed 면역은 applyStatus가 처리. 모든 passive 읽기는 이 4지점(physical/skill/magicDamage +
applyOnHit)에 집중 — 새 passive는 여기만 건드리면 되고, 훅 누락 시 조용히 무효화된다.

**Artifact (유물, 수집형 유물 — 2026-07-20)**: 캐릭터별 판매불가 슬롯 유물. PURE 데이터
`src/content/artifacts.js`(14종). **gear passive와 동일 shape로 병합**해 리졸버가 `unit.passives`
한 곳만 읽는다 — battleScene `buildHeroWithArtifacts(p)`가 `mergePassives(gearPassives(equip),
artifactPassives(equipped, refId).passive)` + `mods`(스탯)를 접고 `survive1hp`→**기존 lastStand
재사용**. 스키마: `{id,name,rarity,cat:'지속|공격|생존|자원|카르마',affinity:classId|null,source,
mods?,passive?,trigger?}`. **슬롯** `artifactSlotCount(level)` 1/8/16→1/2/3. **세트** `computeSetBonus`
같은 cat 2→×1.2·3→×1.4(그 cat의 passive만, `CAT_PASSIVE`). **클래스 친화** `affinity===refId`면
그 유물 효과 ×1.25(`ART_AFFINITY_MUL`). **유한 풀**: 한 유물=영웅 1명만(gear Gotcha #7 미러).
- **trigger(scene-side)**: `hpRegenEnd/mpRegenEnd/goldBonus`→endBattle 정산, `fpGain`→
  `game.gainFP`(Gotcha #14), `recruitBonus`→buildHeroWithArtifacts가 `actor.passives`로 접합해
  리졸버 채용 롤이 읽음(캡 0.95).
- **획득**: chest `loot:{artifact:'id'}`→`save.artifacts.owned`(fieldScene openChest). **장착 UI**:
  `scenes/artifactScene.js`(유물 씬, 메뉴 X→유물). **save.artifacts{owned,equipped}**는 Gotcha #11
  4지점. **카르마 유물은 배타 루트 맵에 배치** — mercy_relic→witchs_hut(swampBoss_spared),
  brand→wraith_bog(swampBoss_slain): 포탈이 이미 requires 상호배타라 회차당 택1(수집 배타성),
  content.test 도달성은 그대로 통과. **커버리지 가드**(artifacts.test): 14종 전부 상자 배치·중복
  없음·passive/trigger 키 화이트리스트(REAL_PASSIVE/REAL_TRIGGER — eva류 미구현 키 조용한 무효화
  방지). 밸런스 해니스는 아티팩트 미모델(bonds·4번째 유닛처럼 base 래더 위 opt-in — TODO: 정확
  수치는 해니스 로드아웃 추가). 새 유물: ARTIFACTS + 배치(배타 루트면 게이트 맵) + 새 passive면
  battle.js 4지점 훅 + 커버리지 가드 갱신.

**Warp/fast-travel** (`scenes/warpScene.js` `WARP_POINTS`): each `{map, requires}` — `requires`
is a boss flag (or `null` = always, e.g. town). The scene shows only points whose flag is
set, so destinations **clear-gate**: dungeon→bossDefeated, frost→frostBossDefeated,
swamp→swampBossDefeated, empire_gate→empireBossDefeated, lava_gate→empireBossDefeated,
void_gate→magmaDrakeDefeated. Town's 차원석 + the `return_scroll` consumable (battle-excluded
via `!effect.warp`) open it. New warp dest: add a `WARP_POINTS` entry gated on the region's
clear flag.

**Map trigger (밟으면 발동, 던전 다양성 키트 2026-05-30)**: a `kind:'trigger'` object
the player STEPS ON (walkable, never baked solid, hidden from the minimap). PURE
`resolveTrigger(map, obj, {rng, fired, flags})` (field.js, mirrors the battle.js
resolver seam) returns an effect descriptor; `fieldScene.arrive()`→`applyTrigger()`
does the Pixi/runtime side. Effects: `switch` (opens `map.toggleWalls[wallId]` cells —
flips collision + redraws walls; runtime-only so it resets on map re-entry since loadMap
re-slices collision), `warp` (`to`+tx/ty cross-map via loadMap, or same-map teleport
that does NOT re-fire a trigger at the destination), `encounter` (forced battle from
`pool` or the map pool). Optional `once:true` (consumed via `firedTriggers` Set, reset
per map) and `requires:'<flag>'` (a flag-gated locked door — reports `locked` + `lockedMsg`
until the player holds the flag; the in-dungeon equivalent of a portal `requires`).
**열쇠 (key)**: a `chest` with `loot.flag` grants a persistent flag (e.g. `crypt_key`)
— MUST be whitelisted in save.js `freshSave()`+`validateSave()` (see Gotcha #9) or it
dies on reload. **content.test completability guard**: the in-map flood-fill pre-opens
ALL `toggleWalls` cells + adds same-map warp pads as graph edges (assumes every
switch/key is reachable, like a portal `requires`) — so a boss/chest behind a
switch-wall or across a warp isn't a false soft-lock. New trigger map: place triggers
in open regions / dead-end pockets so the serpentine critical path stays intact;
re-run `npx vitest run` (the guard catches sealed-off rewards). `src/content/maps/dungeon.js`
is the reference (switch+key-door vault, warp pair, encounter trap). The kit is now
**spread across regions for variety** (each gets a DISTINCT primitive so the comb-maze
template stops feeling repetitive): frost = encounter trap (얼음 균열 매복), swamp =
switch+key vault (`bog_key`, drained 금고), lava_gate / void_gate = same-map warp pad
pairs (마그마 / 차원 균열 — teleporters fit the post-game rift fiction, unlike the
grounded crypt). empire_gate instead uses a `pillarHall` colonnade layout (structural
variety, no trigger). New keys (`bog_key`) follow the same whitelist rule.

**Scene**: new class with `enter/update`; push via `game.scenes.push(scene, args)`
as opaque or overlay.

**Character select + active lineup (출전 편성, 2026-05-30)** — the party model:
a new game opens `CharacterSelectScene` (opaque) to pick ONE **leader** from all 5
heroes (`game.startGame(true)` → push select → `game.beginGame(leaderId)` sets
`party=[leader]`, `active=[leader]`, presets that leader's `joinedX` flag so its
recruit NPC stays hidden — `LEADER_FLAG` maps knight/warrior/huntress/mage/duelist →
joinedKnight/…/joinedDuelist). The other heroes join via recruit NPCs — town has
ALL of 기사/전사/사냥꾼/쌍검사 (the duelist is a bounty-hunter at (11,5) near the inn);
empire 야영지 has 마법사. So every non-leader hero is recruitable (`joinedX` flags). `save.active` is the
**deployed lineup** (≤`MAX_ACTIVE`=4, `data/save.js`): refIds resolving to a party
hero OR a recruited monster ally — ONE unified roster, superseding the old
single-slot `activeAlly` (kept only for old-save migration; `validateSave` derives
`active` from party+activeAlly when absent). `battleScene.enter` builds the hero side
from `active` (hero→buildHeroUnit, ally→buildAllyUnit); benched members don't fight or
earn XP (endBattle's `heroUnits.find(id===refId)` skips them — bonds form only among
active heroes). Field menu (X)→**편성** toggles 출전/벤치 (≥1, ≤4); `recruitHero`/
`recruitAlly`/in-battle recruit auto-deploy via `game.deployIfRoom` when there's room.
`active` is a TOP-LEVEL save field → Gotcha #11's FOUR sites (freshSave+validateSave
+toRuntime+saveNow). Balance harness still models the tuned **3-hero** ladder; a 4th
deployed unit is a player advantage, not a difficulty re-tune (note in `balance.js`).

**Player-facing surfaces (UI/progression, 2026-05-30)** — added together; mostly
cosmetic/save, no resolver changes:
- **Compendium 도감** (`scenes/compendiumScene.js`): ONE tabbed overlay (몬스터/장비/
  상태이상, ◀▶ switch). Monsters are **seen-gated** by `save.seen[]` (refIds folded in
  `endBattle`). Opened from field menu (X)→도감; close = `scenes.pop()` ONLY (it's an
  overlay over the menu — do NOT `resumeField`). Status copy lives in
  `content/statusInfo.js` (STATUS_KR/STATUS_DESC/STATUS_ORDER), shared with battleScene.
- **Save slots** (`data/save.js`): `SAVE_SLOTS=3`; `slotKey(slot)` (slot 1 = the legacy
  `dragon_crypt_save_v1` key for back-compat). loadSave/writeSave/clearSave/hasSave all
  take a trailing `slot`; `slotSummary()` feeds the titleScene picker (이어하기/새로 시작/
  삭제). main.js owns `game.slot`, `slotSummaries()`, `deleteSlot()`, `startGame(isNew,slot)`.
- **Battle target preview** (`battleScene`): on cursor over a target — a damage band on
  the HP bar (`dmgPreviewG`) + `±` range label (`predictDamage`/`setPreviewLabel`), a green
  band for heals, and a **kill skull** icon when lethal. The active hero gets a glow
  **foot ring**. Enemy **stat badges** (`drawStatBadge`/`statTexture`): 낫 scythe (hard
  hitter, threat = `physicalDamage` vs median hero maxHp ≥0.18), 검 sword (milder), 방패
  shield. Cosmetic — never reads/writes battle state beyond the previewed numbers.
- **Item/equipment tooltips** (always-on, Esc-menu style): `renderItemInfo` (battle item
  menu + field menu) mirrors `renderSkillInfo`; equip tooltips + a **지능(주문력)** row
  showing `magicScale` and a `STAT_FOCUS` 추천-특성 hint per class; shop buy/sell/upgrade a
  **purchase-confirm** prompt (`askConfirm`). `items.itemSummary()`/`itemKindKR()` back the text.
- **Formation ambushes**: `field.js buildGroup` supports an exact `group:[refIds]` mode
  (a trigger/encounter spawns a SPECIFIC lineup), alongside the existing min/max pool roll.
- **Stealth-gated skill**: `assassinate`(그림자 일격) carries `requiresStealth:true` —
  gated in FOUR layers (spell flag → resolver fizzle backstop → battle-UI grey-out →
  balance harness picker exclusion). A new conditional skill must touch all four or it
  desyncs (UI offers what the resolver refuses, or the harness mis-models it).

## Known Gotchas
1. **battle.js must stay Pure** — no Pixi import, no save write. Recruit persists
   via emitted event folded in main.js.
2. **spoils() counts ALL enemy units** (not just dead) — spared/recruited get full
   xp by design; don't "fix" it.
3. **Field-level save tests** — not toEqual blocks; sibling save-schema tooling N/A.
4. **Browser QA**: keyboard-driving the canvas is flaky. `window.__game` is NOT
   exposed — drive deterministically by seeding `localStorage` (key
   `dragon_crypt_save_v1`) with a partial save (validateSave fills defaults), then
   reload + `$B press`. NOTE: a seeded save without `flags.intro:true` replays the
   prologue+tutorial on load (set `intro:true` to skip). Filter HMR / 404 noise.
5. **balance harness models the bond builds separately** — bonds/FP are scene-side
   buffs, invisible to fresh harness runs. `npm run balance` runs 3 passes: BASELINE
   (no bonds), MERCY (positive bonds: tanky + clutch FP), RUTHLESS (negative bonds:
   glass cannon — +atk/atkBuff, no HP, less FP). per-enemy FP once made rally
   spammable → bosses immortal; FP is capped +1/battle. Re-check all three after
   touching bonds/FP. Read deaths/rounds, not win% (optimal AI saturates win%).
6. **FP resolver purity**: 운명 effects are pure actions (`inspire`/`lastStand`/
   `rally`); the FP count itself is owned by runtime/battleScene, never the resolver.
7. **Equipment is a shared finite pool** — `equip[slot]` stores an item id by
   reference; inventory count is NOT decremented on equip. `equipScene` derives
   `freeCopies(id) = inv[id] − heroes-already-wearing-it`; a hero can only equip an
   item with a free copy (else greyed "타 영웅"), so one bought sword arms ONE hero,
   not all three. Don't "fix" by decrementing inv (unequip re-credit + old saves break).
8. **운명(FP) is a party-shared pool, shown as a persistent pip gauge** in battle
   (`buildPanel`/`updateFabulaBadge`: `✦ 운명 N/FABULA_CAP` + diamond pips, always
   visible even at 0 — its own resource, distinct from per-unit HP/MP bars). One
   `runtime.fabula` value (cap `FABULA_CAP`=6), NOT per-hero.
9. **Death penalty & KO XP are gentle (2026-05-30)** — on a party wipe `endBattle`
   takes **10% gold** (was 50%) + revives to town; and on victory **KO'd heroes gain
   FULL XP** (the old `!u.alive` skip in the XP loop was removed — fallen heroes don't
   fall behind; a level-up even revives them). Both are deliberate "mercy/forgiving"
   levers — don't re-harshen without the user. Tuning note: these don't touch the
   balance harness (which never wipes), so no re-run needed for these two.
10. **Hero growth was cut ~20% (2026-05-30)** — `party.js` maxHp/atk/def growth ×0.8
    (spd/MP kept — turn-order + magicScale tuning). A 25% cut had CASCADED into the
    post-game (DRAKE 68%→16%, VOIDLORD 81%→2%) because enemy stats are hand-tuned to
    the old curve; 15-20% + a targeted superboss re-trim (magma_drake/void_lord atk/HP/
    enrage atkMult) is the safe range. The DRAKE phase2 `atkMult` is a one-shot cliff —
    re-run `npm run balance` (3 passes) after ANY hero-growth / spell-power / boss-stat
    change. (See [[monster-skills-balance-cliff]] memory.)
11. **A new TOP-LEVEL save field needs FOUR edits — now all in `save.js` (2026-07-10)** —
    `freshSave()` + `validateSave()` (allow-list) + `toRuntime()` (save→runtime) +
    `runtimeToSave()` (runtime→save). The mapping pair MOVED out of main.js into
    data/save.js (main.js only calls them; `saveNow = writeSave(runtimeToSave(runtime))`),
    so the old failure mode — a field present in save.js but absent from main.js's
    hand-built mapping **loading once then silently dropping on the next write** (how
    `save.seen` showed 0/53) — is now caught by save.test.js's
    `validateSave(runtimeToSave(toRuntime(seeded))) === seeded` round-trip assertion.
    Add the new field to all four save.js sites + that round-trip test's seed.
    `flags.*` are still the whitelist-only case (no mapping edit — they spread whole).
12. **NPC actions come from the DIALOG ENTRY, not the map object (2026-07-16)** —
    `action:'shop'|'inn'|'heal'|'warp'` (+ `shop:'<key>'`) must live on the **dialog.js
    entry**, NOT on the map object. `DialogScene.enter` reads `d.action`/`d.shop` from
    `getDialog(dialogId)` and dispatches on close (`dialogScene.js` ~156-159 →
    `game.openShop/tryInn/healSpring/openFastTravel`); `openDialog` only passes
    `{dialogId, afterClose}`, so a map object's `action` field is **INERT**. The failure
    is silent: you talk to the merchant, the lines play, and no shop opens (exactly how
    the witch's hut shop shipped broken). Reference: `shop_smith`/`witchs_hut_greeting`
    carry `action:'shop'` in dialog.js. Any object with `obj.talk` is interactable, so a
    **prop** can carry `talk:'<id>'` to become an interaction point (the hut's 약솥 →
    `witch_spring` → `action:'heal'` → free full heal).
13. **`save.artifacts` is a Gotcha #11 TOP-LEVEL field (2026-07-20)** — `{owned:[ids],
    equipped:{refId:[id|null,...]}}`. Add to all FOUR save.js sites (freshSave `{owned:[],
    equipped:{}}` + validateSave whitelist owned/equipped + toRuntime + runtimeToSave) +
    the round-trip test seed. Artifacts are **non-sellable** — never add to shop stock; they
    live only in `owned` (via chest `loot.artifact`) and are equipped in the 유물 씬.
14. **`game.gainFP(n)` is the SINGLE gateway for all FP gains (2026-07-20)** — routes the
    운명석(fatestone) `fpGain` multiplier via a fractional carry (`runtime._fpCarry`, runtime-
    only) so +25% on +1 grants accrues deterministically(문턱마다 보너스 FP). ALL four FP-earn
    sites go through it: `checkCrisisFP`/`checkFlawFP` (battleScene), item 운명의 모래시계
    (battleScene), mercy +1 (main.js endBattle). A NEW FP source must call `game.gainFP`, NOT
    mutate `runtime.fabula` directly — else it bypasses the fpGain multiplier AND the UI gauge
    resync. FP is runtime-only (never persisted mid-battle); the resolver never reads it.

## Run Workflow
`npx vitest run && npm run build && $B goto http://localhost:9153/ && $B screenshot`

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## 문서 규약

사람이 읽는 문서(`README*.md`, `docs/**/*.md`)는 guk-lab 공통 규약을 따른다.
정본은 `~/sonix/toy/guk-lab-docs` — 복사하지 않고 가리킨다.

- 톤: `guk-lab-docs/STYLE.md` — 본문 습니다체, 헤드 요약·표 셀은 명사형,
  헤딩은 기술 명사구, 수치에는 측정 시점 병기.
- 다이어그램: `guk-lab-docs/harness/skills/doc-diagrams/SKILL.md` —
  `docs/diagrams/<name>.mmd` 가 정본, 색은 의미(core/view/store/external/tool),
  점선은 런타임 밖 경로에만.
- 브랜치·PR: `guk-lab-docs/playbooks/branching.md` — main 직접 커밋 금지,
  develop 에 쌓고 PR 로 합친다.
- `README.md` 를 고치면 `README.en.md` 도 같은 커밋에서 고친다.

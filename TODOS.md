# dragon-game TODOs

See also: [CLAUDE.md](CLAUDE.md) (shipped architecture) · [DESIGN.md](DESIGN.md) (UI vocabulary) · [docs/map-roadmap.md](docs/map-roadmap.md) (HD-2D 맵 작업 핸드오프 — 다음 세션 이어받기).

## 전투 사운드 asset 이식 1차 — ✅ DONE (2026-07-14) / 리전 BGM 2차 — ⬜
- **1차 출하**: 유니티 형제 프로젝트의 팩을 afconvert(AAC m4a)로 변환해
  `public/audio/` (총 3.2MB, 23파일). ① MagicArsenal 원소별 시전/임팩트 SFX 10쌍
  (fire/ice/thunder/holy/dark/earth/arcane/wind→storm/poison→water/heal→life) —
  playSpellFx·playMonsterSkillFx의 castStart에서 시전음, flashFromEvents에서
  임팩트음. ② 전투 BGM(25RPG Action 1 Loop) + 보스 BGM(Resources/Bgm boss) —
  setMusic asset 레이어. ③ 승리 징글(Victory) — handleEnd에서 BGM off 후 재생.
- **설계**: util/audio.js asset 레이어 — 공유 zzfx AudioContext 위 WebAudio 버퍼,
  **모든 경로가 ZzFX 폴백**(파일 없음/미디코드/비활성 → 기존과 동일). AAC 인코더
  딜레이 ~45ms는 디코드 시 무음 트림(trimRange → loopStart/End + start offset)으로
  해결 — 임팩트 펀치 유지 + BGM 루프 무단절. unlock()에서 전 버퍼 프리로드.
- **2차 리전 BGM — ✅ DONE (2026-07-14)**: 9곡 변환(bgm_town/wild/dungeon/graveyard/
  frost/forest/castle/ruins/ascent, 총 public/audio 16MB). `field_<mood||tileset>`
  모드(REGION_MOOD와 같은 조회 키) — fieldScene.loadMap이 `game.fieldMusic` 기록 +
  setMusic, enterField/endBattle이 복원. 매핑: darkforest→graveyard(묘지기 로어) /
  swamp→forest / empire→castle / ritual→ruins / starfall·lava→ascent / void→dungeon
  재사용. **메모리 설계**: 리전 BGM은 방문 시 lazy 디코드(디코드 PCM ~40MB/트랙) +
  startAssetBgm이 현재 트랙·전투/보스 외 bgm 버퍼 evict(재방문 = HTTP캐시 재디코드).
  미디코드 구간·미매핑 리전은 필드 칩튠 폴백.
- **유의**: 에셋스토어 팩 → 유니티 외 사용은 라이선스 회색지대 (로컬 토이라 수용).


## Monster skill: 사령 소환(summon) — ✅ 이미 출하됨 (기록 정리 2026-07-14)

리졸버 `kind:'summon'` 분기(battle.js:836 — noSpoils/스페어·영입 불가/slain 비오염/
fieldCap) + battle.test 커버 + battleScene 미드배틀 스프라이트 스폰(:1604) + spellFx
안무 + necromancer 킷(chance 0.35, max 1) 전부 라이브. 아래 원안의 우려 3건은 구현에
모두 반영돼 있음. joinSkill과 같은 "출하 후 정리 누락" 케이스 — 닫음.

### (원안) 사령 소환 — DEFERRED v2 (2026-05-30)

The monster-skill system (9 skills) shipped 2026-05-30; `summon` was deferred because
it mutates `state.units` mid-battle, touching three invariants the other 9 skills don't.
To ship it:
- **spoils()** counts every enemy unit → summoned skeletons would grant farmable
  xp/gold. Tag spawns `noSpoils` (or `xp:0,gold:0`) and skip them in `spoils()`.
- **mercy/recruit + isOver**: spawns must count for victory but not pollute the
  mercy/slain tally or be recruitable (`recruitable:false`; decide `resolved` handling).
- **renderer**: `battleScene` builds enemy sprites at `enter()`; a mid-battle spawn needs
  a sprite-creation path + `startRound` re-sort + a screen-slot cap (skip if full).
- def + FX (`skull` choreography) exist in `monsterSkills.js` / `share4` but aren't
  ported live. `necromancer` carries only `lifedrain` until then.
- Re-run `npm run balance` after — the per-battle `max` cap is mandatory (무한 소환 → 난이도 폭주).


## Polish fixes (2026-05-29, post-spellfx)

### 원소 상성 + quake/arrowrain 약화 — ✅ DONE
- All damage spells now carry an `element` (spells.js). Added affinity
  `elementMultiplier` (battle.js): 신성→언데드 ×1.25, 화염↔냉기 cross ×1.25 / same ×0.8
  (mild — user wanted 1.25 not 1.5; nudge, not hard counter). Monsters tagged
  `family: undead|icy|fiery` (walker/skeleton_king/void_walker/spirit_guard/
  rusty_soldier/fallen_emperor=undead; frost_wisp/ice_golem/frost_crow=icy;
  imp/wisp=fiery). Applied in magicDamage only. quake/arrowrain got `weaken` inflict
  (were the only elemental-ish damage spells missing a status). +4 affinity tests
  (129 pass); balance 3-pass unchanged (harness AI doesn't pick affinity spells —
  it's a player optimization layer, boss ladder untouched). Holy/physical ults stay
  status-free by design (pure nukes).

### 냉기 = 동상(freeze) 전용 상태 + 확률 상향 — ✅ DONE
- User noticed 눈보라's 동상 felt unreliable. It was `weaken` @50% chance AND a dead
  target can't carry a status (전체기 즉사). Split 냉기 into its own **freeze(동상)**
  ailment: `effectiveSpd(unit) = spd×0.5` (frozen units act later in the spd-sorted
  turn order — NOT mutating stored spd) + atk −20% (physicalDamage). Bumped chance:
  ice_lance 0.5→0.7, blizzard 0.5→0.6; ice_golem enemy weaken→freeze 0.45. Icon
  (snowflake), STATUS_KR '동상', +1 battle.test (effectiveSpd/atk/tick). 125 tests
  pass; balance unchanged (harness AI casts firestorm/quake, not blizzard, so freeze
  is mostly invisible to it — felt in real play via ice_lance/blizzard). NOTE: the
  즉사-no-status rule is intentional (dead target can't be debuffed).

### Elemental spells now inflict status (+ 2 new ailments) — ✅ DONE
- Bug: elemental damage spells (화염폭풍 etc.) showed FX but never applied a status —
  because most `spells.js` damage entries had NO `inflict` field (resolver handled it
  fine; the data was just missing it). Only venom/blizzard/etc. had one.
- Added 2 ailments to `STATUS_TYPES` (battle.js): **burn** (화상, 화염 DoT 6%/turn) +
  **shock** (감전, 뇌전 30%/turn paralysis). Wired tickStatus (burnTick/paralyzed),
  cureStatus (cleanse covers all), pixelIcons (burn/shock grids+palette), battleScene
  (STATUS_KR/TAG + messages).
- `inflict` added to elemental spells: 화염(firebolt/firestorm/inferno/meteor)→burn,
  냉기(ice_lance)→weaken, 뇌전(thunderclap/thunderstorm)→shock, 바람(cyclone)→weaken
  (single-target higher chance, AoE lower). **Bidirectional**: enemies inflict the
  same — imp→burn, ice_golem→weaken added to monsters.js.
- +3 battle.test (burn tick, shock paralysis, spell-inflict via boss); 124 tests pass.
  Balance 3-pass healthy (bosses still 94-100% w/ real attrition; trash rounds +~0.8
  from two-way ailments). NOTE: live, a strong caster one-shots trash before burn shows
  — verified via unit test (skeleton_king target) + the inflict code path live.

### Start as knight alone; 전사·사냥꾼 join via town NPCs — ✅ DONE
- `freshSave()` party = knight only (was the full trio). save.test asserts `['knight']`.
- town.js: two recruit NPCs at (6,5)/(9,5) using hero field art (`art:'hero'`),
  `recruit:'warrior'|'huntress'` + `flag:'joinedWarrior'|'joinedHuntress'`.
- `fieldScene.loadMap`/`buildObjects`/minimap skip a recruit NPC whose join flag is
  set (sprite hidden + tile walkable + marker gone).
- `main.openDialog` folds `obj.recruit` into the party on dialog close via the new
  `game.recruitHero(refId, flag)` (joins at lead level, sets flag, saves, shows a
  join line). `dialog.js`: `recruit_warrior`/`recruit_huntress` lines.
- **Critical fix:** `validateSave` flags are a WHITELIST — added `joinedWarrior`/
  `joinedHuntress` (+ freshSave defaults) so they survive a reload (else the NPC
  respawns + is re-recruitable). +1 save.test for persistence. 121 tests pass.
- Live-verified: knight-only start, warrior recruit (party→2, NPC vanishes), reload
  keeps `[knight,warrior] jW=true` (flag survives validateSave), huntress recruit
  (party→3). NOTE: QA was noisy — a stale localhost:9153 tab/instance kept autosaving
  an old `knight×3 swamp` save over the test save between steps (env issue, not a bug).

### Equipment double-equip blocked — ✅ DONE
- Bug: `equip[slot]` stored an item id by reference and inventory count was never
  consumed on equip → one bought weapon/armor could be worn by all 3 heroes at once.
- Fix (`equipScene.js`): treat inventory as a shared finite pool. `freeCopies(id) =
  inv[id] − heroes-already-wearing-it`; equipping requires a free copy, else the row
  greys out tagged "타 영웅". Verified live via localStorage state: knight's only
  silver_sword blocked on warrior; free iron_sword equips; both blocked on huntress
  once allocated. 109 tests pass.

### FP shown as its own gauge (separate from HP) — ✅ DONE
- `battleScene` 운명 badge was text-only and HIDDEN at 0 FP. Replaced with a
  persistent pip gauge (`✦ 운명 N/FABULA_CAP` + 6 diamond pips, filled=banked),
  always visible so FP reads as its own party resource distinct from HP/MP bars.
  Tests/build clean, no runtime errors; visual eyeball blocked this round by a flaky
  session image-display issue (PNGs generate fine) — worth a quick look on screen.

## Deferred from spellfx port session (2026-05-29)

### Spell-FX live verification — partial (2026-05-29, headless $B QA)
- **Confirmed on screen** (L23 party, wild roamer): 화염폭풍(firestorm) falling
  drops + ember bursts + red tint; 무쌍난무(berserk) gold X-slash beam + burst;
  눈보라(blizzard) full-screen snow field + cold tint + per-enemy ice-shard strike,
  hit both enemies. Projectile trail/burst, weather field, tint/flash all render at
  correct scale/position. No console errors.
- **Also found + FIXED:** long spellbook (13 spells at high level) overflowed the
  battle 주문 menu (rows overlapped/clipped). `battleScene.panelMenu` now scrolls
  (capped visible rows + ▲/▼ markers). Verified scroll up/down on huntress's 13-spell
  list. 109 tests pass.
- **NOT yet eyeballed** (share verified code paths, low regression risk):
  holy_nova/shield_wall (allAllies/self caster-positioned — same path as heal/berserk),
  메테오 blackout (persistent `tint` — same as firestorm), 성검 강타/별빛 연사,
  divinewrath. weaken/poison infliction from new AoEs not seen land (enemies die
  first at L23) but reuse venom_shot's resolver `inflict` path (unit-tested).
- **Follow-up:** a quick boss-fight pass would let the new AoE 상태이상 (눈보라/독무
  약화·독) actually land + show the status chip; and confirm the 4 unseen FX.

### Class ultimates: MP-cost (decided) vs 운명(FP)-cost
- **Decision (2026-05-29):** all 3 class ultimates (성검 강타/무쌍난무/별빛 연사)
  ship as **MP spells**, late-game learns (party.js L17+). The share2 prototype was
  itself inconsistent (성검 강타 MP12 + 별빛 연사 MP10 = MP; only 무쌍난무 = "운명 2").
- **Why MP, not FP:** the 운명/FP system exposes only *utility* pure actions
  (inspire/lastStand/rally) — folding damage ultimates into FP would (a) conflate two
  currencies, (b) need a new 운명-submenu damage path + targeting, (c) risk battle.js
  purity. MP-gated late learns reuse the existing spellbook pattern with zero new wiring.
- **Possible revisit:** if playtest wants ults to feel "earned/clutch," move 무쌍난무
  alone to an 운명 entry (resolver already has the pure-effect pattern to extend).

## Deferred from C-mechanic eng review (2026-05-29)

### Monster-specific recruit skills + species dialog — ✅ 이미 출하됨 (기록 정리 2026-07-10)
- `joinSkill` + `recruitLine`은 전 몬스터에 배포 완료 (progression.js:102 buildAllyUnit이
  joinSkill을 spells[]로 폴드). 이 항목은 출하 후 정리 누락 — 닫음.

### (원안) Monster-specific recruit skills + species dialog
- **What:** Recruited allies speak species-specific lines on join and carry
  species-unique skills (not just a generic attack).
- **Why:** Deepens the recruit payoff — a recruited goblin should feel different
  from a recruited wisp. Reinforces the "these enemies are people" shared-universe
  hook (the thing the whole C mechanic exists to prove).
- **Pros:** Each recruit feels distinct; collection/roster has real flavor.
- **Cons:** Scope balloon — needs per-monster skill data + per-species dialog
  table + UI to surface ally skills in the spell menu.
- **Context:** C mechanic ships with allies using a generic attack only
  (buildAllyUnit + generic allyGrowth, no spells). Add this AFTER the
  fight/spare/recruit hook is validated with playtesters. Start point:
  `content/monsters.js` (add optional `allySkill` + `joinLine`), then
  `progression.buildAllyUnit` to fold the skill into `spells[]`.
- **Depends on:** Full C mechanic shipped + playtest signal that recruit lands.

## Deferred from Fabula/Bonds + equip session (2026-05-29)

### Live-verify unshipped-on-screen pieces — ✅ DONE (2026-05-29, headless $B QA)
- All confirmed on screen via seeded-save QA (knight seeded to 5 HP = Crisis):
  - **운명 badge** (`✦ 운명 N`) renders top-right; **운명 menu** appears when FP>0;
    submenu shows 고무(+30% 1)/불굴(치명타 1HP 1)/재기(부활 2, disabled w/o fallen ally).
  - **고무(inspire)** fired: FP 6→5, msg "기사의 공격력이 올랐다!".
  - **Emotion bond accrual**: win folded co-survival → `huntress|warrior:[loyalty]`
    (new pair, confirmed in localStorage save).
  - **Crisis FP bank**: knight in Crisis at battle start → ✦운명 0→1.
  - **flaw→FP (knight 맹세)**: knight attacked while in Crisis → ✦운명 1→2.
  - **Crisis-partner-atk (애정 surge)**: msg "사냥꾼는 기사를 지키려 분기한다! 공격력 상승!"
    when knight fell into Crisis (huntress is affection-bonded; warrior surges too,
    queued behind). 재기(revive) + huntress 통찰/warrior 분노 flaws not individually
    triggered on screen but share the same verified code path + unit tests.
- QA method note: `window.__game` not exposed; drive via seeding `dragon_crypt_save_v1`
  in localStorage (knight hp:5, fabula:0, bonds w/ affection ties) then reload + walk
  into a wild roamer. Candidate for the deferred QA-snapshot skill below.

### Mercy-build balance ceiling — ✅ DONE (2026-05-29, M-D nerf)
- Harness isolation (200 seeds) found the ceiling's driver was **bonds, not rally**:
  bonds-only took frostBOSS 79%→99% win / 1.58→0.63 deaths; FP-only only 79%→92%.
- Applied **M-D**: bond maxHp fold +5%/cap+25% → **+3%/cap+15%** (battleScene.enter
  + balance.js harness model), rally revive 30% → **15%** HP (battle.js). A gentle
  rally nerf (fragile second chance, not @1HP) + the feel-invisible bond trim.
- Result: MERCY frostBOSS 99%/**0.56** deaths, swampBOSS 97%/**0.39**, dungBOSS
  100%/0.20 (was 0.06–0.22). Still tankier/clutch vs baseline but real attrition —
  "clutch, not a free pass." 106 tests pass; battle.test.js rally assertion → 15%.

### Negative bond emotions (ruthless path) — ✅ DONE (2026-05-29)
- Added 멸시/불신/증오 (contempt/mistrust/hatred) as the negative poles of the 3
  bond axes. Design = "glass cannon blood pact" (chosen over dark-mirror / curse):
  ruthless bonds give pure offense, NO HP cushion — a real alternative to mercy's
  tanky+clutch. Each axis grows positive or negative by whether you showed mercy:
  - TRUST (co-survival): 충성+def / 불신+atk%
  - CARE (revive vs abandon): 애정 Crisis-surge / 증오 death-rage surge
  - RESPECT (shared Crisis): 존경+atk / 멸시+atk(bigger)
- `bonds.js`: POSITIVE/NEGATIVE_EMOTIONS + OPPOSITE map (poles flip in place, not
  stack); `bondStrength` now counts positive poles only (HP fold). `main.js`
  endBattle earn split by `showedMercy`. `battleScene.enter` negative fold +
  `checkDeathRage()` (hatred surge, mirror of affection's checkCrisisFP). `menuScene`
  유대 view marks negatives with † + dual 자비/잔혹 legend. `balance.js` 3rd
  RUTHLESS pass (glass cannon: faster kills ~5.4 rounds, more deaths 0.70 vs mercy
  0.56 — distinct risk profile). +3 bonds.test.js tests; 109 pass.
- Possible follow-up: ruthless-tone NPC reactions already exist via
  `toneFromFlags`; could add bond-specific dialogue, and a hatred-surge live QA
  (needs a hero death mid-battle — only unit/harness-verified so far).

### Equipment delta preview — ✅ DONE (2026-05-29)
- The live equip screen is `EquipScene` (NOT `menuScene.pickLines` — that path is
  dead code, superseded; root 장비 pushes EquipScene). Added `renderDeltaInline()`
  in `equipScene.js`: each inventory row shows, below its absolute stats, the swap
  delta vs the slot's currently-equipped item — green ▲ gains / red ▼ losses, with
  the 해제 row showing the loss of unequipping. Compact vocab (공/방/속/체/마) +
  arrow + colour distinguishes it from the absolute line (힘/수비/민첩). Verified
  live ($B): upgrade/downgrade/mixed (oak_staff 공-1▼ 마+6▲)/해제 all read correctly;
  matches the left status column's ▸ preview for the focused row.
- Follow-up — ✅ DONE (2026-05-29): the dead equip drill-down in `menuScene.js`
  (`pickLines`/`slotLines`/`ownedForSlot` + equipHero/equipSlot/equipPick modes +
  `statStr` + the `'gear'` ternary + dead `applyTo` equip branches) was removed.
  EquipScene is the sole equip path. 109 tests pass.

### dragon-game QA-snapshot skill — ✅ DONE (2026-05-29)
- Added `.claude/commands/run-qa-snapshot.md`: seed `dragon_crypt_save_v1` into
  localStorage (validateSave fills defaults) → reload → `$B press` → screenshot.
  Documents the no-`window.__game` reality + recipes (운명/FP, Crisis surge+flaw,
  equip delta, dialogue tone) and the low-hp-Crisis / bonds / fabula seed tricks.

### 4-direction hero sprites — ✅ 이미 출하됨 (기록 정리 2026-07-14)
- 5영웅 전원 north/south/east/west 스틸 + 8프레임 워크 사이클 라이브 (2026-05-30,
  PixelLab 4-dir 번들 — CLAUDE.md §7 참조). 이 항목은 출하 후 정리 누락 — 닫음.


## 인연공격(bondStrike) 후속 (2026-05-30, /plan-eng-review에서 분리)

설계 승인 + eng-review 완료: `~/.gstack/projects/dragon-game/kyb-ontact-unknown-design-20260530-182734.md`.
v1 = 시작 3쌍(기사|전사·기사|사냥꾼·전사|사냥꾼) 듀오 합동기. 아래는 v1 출시 후 후속.

### 법사 쌍 합동기 — ✅ DONE (2026-05-30)
- 법사×시작 3쌍 추가: 천공의 심판(기사×법사, holy AoE) / 작열참(전사×법사, fire 단일 강타)
  / 마탄 연사(사냥꾼×법사, thunder 단일 3연사 관통). bondSkills.js 데이터 + spellFx DEFS 3종
  (천공의 심판은 FX_ALL_TARGET 등록). resolver/UI 불변(데이터-only 확장).
  법사는 선택 영입이라 영입+배치+유대 형성 시에만 운명 메뉴 노출. → 듀오 총 6쌍.

### 3인/4인 인연 필살기 — ✅ DONE (2026-05-30)
- bondStrike를 N명 참가로 일반화(partnerIds[]). 인원수별 범용 얼티 2종(BOND_ULTS):
  삼중 합주(트리오, 5 FP, holy AoE) / 운명의 대합주(쿼드, 6 FP, prismatic AoE). 게이트 =
  개시자가 ≥size-1 living 영웅과 유대 + FP. 폴-변조는 bondModForCombo(개시자↔각 파트너
  머지, dmgMult는 MAX로 runaway 방지). **전투당 1회 게이트 공유**(듀오/트리오/쿼드 중 택1,
  state.bondStrikeUsed). 운명 메뉴 ✦듀오 / ★얼티 아이콘. spellFx play() partners[] 멀티
  오리진 + DEFS 2종. 251 테스트 통과. 라이브 QA: ★삼중 합주 3인 76/63/72 전멸, FP 6→1.

### 스킬 컷신 (필살기/인연기 시네마틱) — ✅ DONE (2026-05-30)
- `fx/cutscene.js` 신규: share4 spellfx-cutscene.js(DOM/WAAPI)를 PixiJS t-구동으로 포팅.
  레터박스 IN → 대각 슬래시 → 포트레이트 순차 슬라이드인(public/heroes/<class>_south.png) →
  태그(필살기/인연공격/트리플·쿼드 인연기) + 스킬명 슬램 → 임팩트@52%(플래시+onImpact) →
  퇴장. 1~4 포트레이트, 길이 1.3s(1~2인)/1.5s(3~4인), Z 스킵.
- battleScene 통합: enter()에서 Cutscene 생성(최상단 레이어)+포트레이트 preload, update()에
  tick+입력잠금, resolveNow의 bondStrike를 resolveBondCutscene로 분기(onImpact에서
  resolveAction+spellFx+데미지, onDone에서 메시지+enrage+턴진행). commit에 name 전달.
  252 테스트 통과. 라이브 QA: ★삼중 합주 — 레터박스/슬래시/3포트레이트/✦✦✦/"트리플 인연기"
  "삼중 합주" 슬램/임팩트 105 데미지 동기화/방사 FX/퇴장 전 과정 확인.
- **클래스 1인 필살기 컷신 — ✅ DONE (2026-05-30):** spells.js의 클래스 ult 5종
  (holyblade/berserk/starfall/cataclysm/meteor)에 `ult:true` 플래그 + resolveNow에 spell ult
  분기. resolveBondCutscene을 공유 `resolveWithCutscene(action, cs, fxFn)`로 일반화(인연=
  playBondFx / 주문=playSpellFx). 1인 포트레이트 + "필살기" 태그(✦ 마크 없음). 라이브 QA:
  사냥꾼 별빛 연사 — 단일 포트레이트/필살기 태그/임팩트 67 데미지 확인. 252 테스트 통과.

### 장비 패시브 발동 시각 신호 — ✅ DONE (2026-05-30)
- **패시브 메커니즘은 이미 완성돼 있었음**(items.js passive 15개 + battle.js 훅 5종 +
  passiveParts ✦UI). 빠진 건 발동 시 시각 신호뿐 → battleScene 프리미티브로만 추가
  (spellFx 엔진 미접촉 — 공격 FX와 공존).
- battle.js: dealDamage에 `dmgReduce` 이벤트 emit(유일한 리졸버 변경, cosmetic — 메커니즘
  불변, 밸런스 동일). battleScene: `spawnLabel`(팝업 레이어 재사용)/`tintPulse` 헬퍼 +
  `equipFx(events)`(counter 반격!+반격데미지숫자 / inflictResist 저항! / dmgReduce 경감
  throttle 1.4s) + `drainRoundEvents`(regen — 기존엔 state.roundEvents가 무드레인=무음이었음,
  nextTurn 라운드플립에서 재생 라벨+초록 tint) + crit 골드 글린트(flashFromEvents).
  resolveNow/resolveBondCutscene에 배선. 252 테스트(+dmgReduce 이벤트 검증). 밸런스 불변.
  라이브 QA: 독거미→기사 3피해(dmgReduce 감소 작동 확인). 라벨은 _popups 부유 시스템
  verbatim 재사용(데미지숫자와 동일 경로).

### 수집 동료 쌍 합동기 — ✅ DONE (2026-07-14, 종별 전용기 5종)
- `bondSkills.ALLY_COMBOS` (refId 키): 스토리 영입 셋피스 5종이 generic 공생 연격
  대신 전용기를 낸다 — **숲의 사냥**(dark_warden, 3연격+출혈) / **파수꾼의 낙추**
  (bridge_warden, 대강타+방어약화) / **서약의 뇌창**(seal_guardian, 관통 뇌전+감전) /
  **별빛 낙하**(fallen_star, 전체 성속 2연 — FX_ALL_TARGET) / **잿불 질주**
  (ember_hound, 2연 돌진+화상). availableBondStrikes가 배치 동료 refId로 조회, 없으면
  ALLY_COMBO 폴백. 순수 데이터+FX 확장(리졸버의 기존 base.inflict/pierce/hits 경로
  재사용 — resolver/scene 비접촉). spellFx DEFS 5종 + bondSkills.test 3케이스(전용기
  대체/불변식/폴백). 그 외 일반 영입 몹은 공생 연격 유지.

### bondStrike 밸런스 하니스 모델링 — ✅ DONE (2026-07-10)
- balance.js: 보스전 뱅킹 FP(mercy 4/ruthless 3) → knight×warrior 듀오 '맹세의 돌격'
  전투당 1회 발동(bondUsed 게이트, commitBondStrike 계약 그대로 base+mod 라이더).
- 3-pass 재실측: MERCY 보스 deaths 0.03~0.79 / RUTHLESS 0.03~0.89 — "clutch, not
  a free pass" 밴드 유지. DRAKE MERCY 90→99%는 모델이 더 현실적이 된 것(게임 무변경).

### (원안) bondStrike 밸런스 하니스 모델링 — DEFERRED v2
- **What**: `scripts/balance.js` `chooseStateAction`에 bondStrike를 넣어 MERCY/RUTHLESS
  패스가 합동기 데미지를 자동 측정.
- **Why**: 현재 scene-side라 하니스 미측정(affinity와 동일) → 수동 손계산이 유일 방어선.
  자동 측정하면 power 오타·보스 트리비얼화를 회귀로 잡음.
- **Context**: monsterSkills가 enemyChooseAction 재사용으로 자동 모델링되는 선례 있음.
  유대/FP/파트너 선택 AI를 하니스에 넣는 작업이라 비용 있음.
- **Depends on**: T1-T3 완료 + 실제 power 확정. v1은 "scene-side 수용"이 명시 결정.

### HD-2D 편도 낙하(one-way drop) + 방향성 BFS — ✅ DONE (2026-05-30)
구현 완료. `field.js isDrop` + canStep 하향 규칙(`e>t && isDrop(from)` → OK, 역방향 차단).
canStep이 방향성(from→to)이라 content.test BFS가 자동으로 방향 존중. `map.drops=[{x,y}]`
(던전 보스 단상 앞 row9 = 전투 후 뛰어내리기, 오를 땐 계단만). 갇힘(stranding) 가드:
drops 보유 맵은 포탈에서 역-플러드해 "모든 도달 타일이 출구에 도달 가능"한지 검증(reach-TO
+ reach-BACK 둘 다). field.test 방향성 케이스 + content.test 합성 fixture(하향 도달/상향 차단)
추가. 275 tests green.

## 쌍검사(duelist) 직업 풀세트 — ✅ DONE (2026-05-30)
- placeholder였던 duelist를 풀 키트로: party.js 스탯/learn(전용 7스킬+풀버스트), spells.js
  7종(quickdraw/rend/shurikenflurry/smokegrenade/fragbomb/buckshot/headshot, physical+atk-scale,
  hits엔 atkScale, rend·buckshot→bleed, fragbomb→burn) + fullburst(ult:true→컷신 자동).
- **신규 상태 bleed(출혈)**: 물리 DoT 6%/턴. battle.js STATUS_TYPES+tickStatus(bleedTick)+
  applyStatus 언데드 면역. 표시 레이어 전부(pixelIcons 핏방울+팔레트, STATUS_KR/TAG,
  statusInfo desc/order, items ITEM_CURE_KR, battleScene bleedTick 메시지). cleanse(정화)가
  STATUS_TYPES 전체 치유라 출혈 자동 커버. +3 battle.test(틱/언데드면역/cure).
- bondSkills 쌍검사 듀오 3쌍: 강철 폭풍(×전사)/소이탄 연격(×법사, burn)/십자포화(×사냥꾼).
  bondStrike resolver에 base.inflict 처리 보강(소이탄→화상). +1 test.
- spellFx 11종(직업기 7+fullburst+듀오 3) — gunshot/bloodDrops 헬퍼. fragbomb/buckshot/
  fullburst/소이탄 FX_ALL_TARGET.
- **쌍검사 전용무기 3종**: 쌍아 권총(crit)/결투의 건블레이드(counter)/할로우포인트 리볼버(crit)
  — items.js + DROP_GEAR(mid/high) + 대장간 stock. (슬롯 기반이라 하드 클래스락 아님.)
- 256 테스트 통과. 밸런스 불변(duelist는 튜닝 3인 sim 밖, bleed는 적이 안 검 → 하니스 무관).
- ~~여전히 STARTING_PARTY 아님 + 영입 NPC 없음~~ → **해소됨 (기록 정리 2026-07-14)**:
  캐릭터 선택에서 리더로 선택 가능 + 마을 (11,5) 현상금 사냥꾼 영입 NPC(recruit_duelist,
  joinedDuelist 플래그) 존재. STARTING_PARTY만 여전히 3인(의도 — 튜닝 사다리 유지).

## ~~⚠️ BUILD BROKEN~~ — ✅ 해소됨 (기록 정리 2026-07-14)
- 당시 없던 `scenes/characterSelectScene.js`는 출전 편성/캐릭터 선택 시스템과 함께
  출하됐고(CLAUDE.md "Character select + active lineup" 참조) 빌드는 그린. 스테일 닫음.

## QA 디버그 훅 (window.__game / __dbg) — ✅ DONE (2026-05-30)
- main.js 끝에 `import.meta.env.DEV` 게이트로 dev 전용 노출(프로덕션 빌드엔 제거).
  - `__dbg.battle(['goblin','skeleton_king'])` — 필드/RNG/키보드 없이 전투 즉시 진입.
  - `__dbg.seed({party,fabula,bonds,flags,gold})` — 런타임 상태 패치.
  - `__dbg.cast(spellId, targetIdx)` — 영웅 주문 직접 시전(메뉴 조작 스킵 → FX/데미지 QA).
  - `__dbg.bond(comboId, targetIdx)` — 인연기/필살기 직접 발동(commitBondStrike 재현).
  - `__dbg.state()` — 현재 씬 + 전투 스냅샷(유닛 hp/status, bondStrikeUsed).
- 세션 내내 겪던 키보드 QA 플래키(전투→타이틀 탈출, RNG 대기) 해소. **주의**: 전투 종료 후
  필드 왕복 시 stale-tab autosave가 runtime.party를 knight-only로 덮음 → 측정은 localStorage에
  풀파티+bonds 박고 reload하면 우회됨.

## 인연기/필살기 power 튜닝 (실측 기반) — ✅ DONE (2026-05-30)
- 훅 `__dbg.cast/bond`로 bog_witch(660,L16) 대비 실측 → 단일 히트 power가 atk/(atk+def)
  soft-cap에 막혀 ult이 기본기보다 약한 **역전** 발견.
- 수정(전부 다단 탄막 hits로): **fullburst** 단일40→hits3 power18(10%→20%), **트리오** 단일26→
  hits3 power16(~10%→22%), **쿼드** 단일34→hits4 power16(~10%→**31%**, 클러치 25~35% 밴드).
- **클래스 ult(berserk/meteor/starfall) 8-11%는 유지** — harness AI가 픽하는 튜닝된 사다리라
  건드리면 보스 밸런스 깨짐(bond는 scene-side/하니스 미측정이라 자유롭게 조정 가능).
- 단일 히트 듀오(맹세의 돌격/작열참/소이탄/천공의 심판)는 3-FP 저티어라 유지. 275 테스트, 밸런스 불변.

## 동료 인연기 (공생 연격) + 컷신 URL 일반화 — ✅ DONE (2026-05-30)
- 범용 동료 인연기 `공생 연격`(physical 4연타) — **영입=유대**라 감정 게이트 없이 "배치된
  동료(u.ally) + FP"면 발동(bondSkills.ALLY_COMBO + availableBondStrikes 동료 브랜치). 복잡한
  bond-성장/id-refId 머신을 우회. 전투당 1회 게이트·FP 공유.
- **기존 버그 수정**: 영입 동료가 side:'hero'+몬스터 스프라이트라 makeUnitView의 heroUrl로
  **빈칸 렌더**되던 것 → `u.ally ? enemyUrl : ...`로 수정(전투에서 동료 스프라이트 정상 표시).
- 컷신 포트레이트를 **class-key→URL**로 일반화(cutscene.js) + scene이 hero=heroUrl/ally=enemyUrl
  조립(portraitUrl). 동료(몬스터)도 컷신에 제대로 등장. spellFx duo_symbiosis. +2 test.
- 라이브 QA(훅): 사냥꾼+고블린 공생 연격 — 동료 전투 렌더 + 컷신 2포트레이트(hero+monster art) 확인.

## bleed/DoT 중첩 규칙 — ✅ LOCKED (2026-05-30)
- 규칙 확정: 재부여 시 **더 긴 지속으로 갱신(Math.max), 누적 안 함**. poison/burn/bleed는
  재부여로 유지되지만 스택 폭주(출혈 3중첩=3배 틱) 불가. 틱 데미지는 항상 maxHp 고정%.
  battle.js applyStatus 주석으로 의도 명시 + 회귀 테스트 추가(refresh-not-accumulate).

## FP 호딩 경제 — ✅ ASSESSED, 변경 불요 (2026-05-30)
- 점검 결과: FP는 **반복 싱크(고무1/불굴1/재기2 — 자유행동, 전투당 여러 번)** + **전투당 1회
  대형 싱크(인연기 3-6)**가 공존 → 운명 메뉴를 쓰면 활발히 소비됨. "호딩"은 시스템을 안 쓸 때만
  생기고 그땐 무의미. 캡 6은 클러치 쿼드(cost 6) 뱅킹용으로 의도적. **튜닝된 경제라 변경은 리스크**.
- 더 타이트한 느낌 원하면 레버: 캡 6→5, 또는 인연기 cost 미세조정. 현 상태로 균형 잡힘.

## 쌍검사(duelist) 포스트게임 학습 공백 — ✅ DONE (2026-07-14)

- **팬파이어**(L19 — 전체 3연 강철 탄막 + 출혈 0.5) + **처형탄**(L23 — 단일 관통
  pierce + critBonus 0.6, headshot 상위 처형기) 출하. spells.js 2종 + party.js learn
  19/23 + spellFx DEFS 2종(fanfire는 FX_ALL_TARGET) + battle.test 2케이스(fanfire
  전체 히트+bleed 경로, executioner pierce가 중장갑에서만 이기는 니치 검증 — pierce
  0.7 고정이라 def비율 <0.7일 때만 이득). 하니스 비접촉(duelist 비-sim) — balance 불변.

## 서사 고도화 2·3막 증축 — ✅ DONE (2026-07-10, 볼륨 확장 세션)
### 완료 기록 (2026-07-10 볼륨 확장):
- **2막 「잿더미의 진실」**: ql_act2 6스테이지(에녹 frost 배치 → 늑대인간왕 → 마녀 →
  지하 의식장 reach → 봉인의 파수병 → 황제) + `ruins_below` 존(empire_city 남단,
  pillarHall 의식장, 비석 2 = 황제 동기의 사전 씨앗) + `seal_guardian` 미니보스
  (spirit_guard 금빛 스왑, 3.2라운드/84%) + **황제 최종 독백 재서술**(잘못된 자비 고백 —
  톤 무관 동일 대사, 리액션 라인만 분기).
- **3막 「최후의 등반」 + 신규 리전 「별무덤」**: ql_act3 5스테이지 + `starfall`/
  `starfall_crater` 2맵 리전(L21 밴드 — 황제 L18↔드레이크 L25 갭 메꿈, lava_gate
  남쪽 잿길 + 워프 등록) + 신규 몹 star_husk/star_moth + 리전 보스 `fallen_star`
  (frost_wisp 금빛 스왑, 5.7라운드/56%/0.68 deaths — 완벽한 중간 계단, 스페어=해방).
- **퀘스트라인 `after` 게이팅**: 막 순차 해금 + 완료 시 다음 막 챕터 카드 (unlocked 이벤트).
- **에필로그 5종** (`content/epilogues.js`): 리더 클래스별 결말 문단, EndingScene 표시.
- **회차+ (NG+)**: save.ngPlus (save.js 4곳+테스트) — 엔딩에서 제안, 도감 승계,
  적 HP+25%/atk+15%/골드+15% per 회차 (battleScene/endBattle 씬 레이어 — 리졸버 비접촉).
- 312 테스트 + balance 3-pass(ruins/sealGRD/starfl/FSTAR 시나리오 동기) + 라이브 QA 전 구간.

1막 수직 슬라이스(아래 questline 항목 + 에녹 + 어둠숲 존) 출하 후의 진입점.
승인 설계: `~/.gstack/projects/dragon-game/kyb-ontact-unknown-design-20260710-104017.md`
(리뷰 반영 완료 — 세이브 형태 `{id:{stage,status}}`, condMet 추출, tick 4지점,
보스 사망대사 data-only, 에녹=Pasqualina VS-style 등 전부 문서에 확정 기재).
- **2막**: 폐허 지하 스토리 존 + 황제 "잘못된 자비" 재해석 독백(같은 대사, 톤별
  리액션만 분기) + empire moral-choice/caged-hound 셋피스와 에녹 2차 계시 동선 확정
  (맵 분리로 물리 겹침 없음 — 대사 포어섀도잉만 연결).
- **3막**: 빙하 동굴 존 + 에녹 3차 계시 + void_lord 후일담 내레이션 (trueEnding 유지).
- **후속(별도)**: ~~클래스 에필로그 5종 + NG+ 훅, 로어 사이드퀘 6종~~ → ✅ 전부 출하
  (에필로그/NG+ 2026-07-10 볼륨 확장, 사이드퀘 6종 q_warden_rest/q_frozen_kin/
  q_broken_oath/q_bloods_madness/q_star_mercy/q_scale_forge — 기버 6명 배치).

## 톤↔유대 커플링 (서사가 bonds를 조회) — ✅ DONE v1 (2026-07-10) + 증보 (2026-07-14)
- `bonds.bondPolarity(bonds)` PURE ('dark'|'light'|'none' — 부정/긍정 극 다수결) +
  main.openDialog가 `${id}_grim` 변형을 톤 변형보다 우선 스왑. 저술: enoch_act3_grim
  (어두운 유대 파티 전용 3차 계시). 새 grim 대사는 dialog.js 엔트리만 추가하면 됨.
- **증보 (2026-07-14)**: enoch_act1_grim / enoch_act2_grim (막마다 에녹이 "일행
  사이의 공기"를 읽는다 — 퀘스트 동선 지목은 동일 유지) + **보스 win grim 라우팅**:
  endBattle이 bondPolarity dark면 `${win}_grim`을 톤 변형보다 우선(openDialog와 같은
  규칙, 저술된 보스만 opt-in). 저술 4종: boss_win_grim(해골왕) / frost_boss_win_grim
  (늑대왕) / empire_boss_win_grim(황제 — D7 준수: 독백 5행 동일, 리액션+표어만 분기) /
  void_boss_win_grim(공허). 엔딩 씬 톤은 불변(grim은 대사 레이어만).

## (원안) 톤↔유대 커플링 리팩터 노트 (2026-07-10)

- **What:** 현재 대사 톤은 `toneFromFlags`(mercied/slain)만 읽고 bonds는 의도적으로
  분리(설계 문서 "톤↔유대 비대칭" 항목). 향후 서사가 유대 상태에 반응하려면(예: 증오
  유대 보유 시 에녹 대사 변주) `tonedDialogId`에 bonds 파라미터를 추가하는 형태가 유력.
- **Why:** "자비=힘" 테마가 2·3막에서 bonds와 얽히면 서사 밀도 상승 (eng-review 외부
  관점 #10). 지금은 1막 프리미티브 검증이 우선이라 결합 보류.
- **Depends on:** 2막 구현 시점 이후 + 유대 조회 시맨틱 설계(긍/부정 극 어느 쪽을 보나).

## questline 'reach'/'talk' cond 타입 + 트래커 — ✅ DONE (2026-07-10, 1막 수직 슬라이스)

아래 원안대로 + 승인 설계(design-20260710-104017) 리뷰 반영으로 출하:
- `content/questlines.js` (PURE): QUESTLINES + `{id:{stage,status}}` 상태 +
  `advanceQuestlines`(루프 연쇄 전진, 이벤트 기술자 반환) + `recordVisit/recordTalk`.
  cond 판정은 quests.js에서 추출한 공유 `condMet`(reach/talk 추가) — isQuestComplete 위임.
- 세이브: `questlines`/`visitedMaps`/`talkedNpcs` 3필드. **toRuntime/runtimeToSave가
  main.js에서 save.js로 이동** — Gotcha #11 네 지점이 한 파일에 모였고 라운드트립
  유닛테스트(save.test)가 누락을 잡는다. main.js는 호출만.
- tick 4지점: endBattle 승리(메시지 합류) / fieldScene.loadMap(reach) /
  main.openDialog 종료(talk, `obj.npcId` = 배치별 고유 id) / openChest(collect).
  saveNow 내부 호출 금지(확정 유지). 다중 충족은 루프 전진 + 토스트 1개.
- 1막 콘텐츠: 에녹(마을 (11,8), npcId enoch_act1, Pasqualina VS-style 재사용) +
  ql_act1 4스테이지 + 어둠숲 존(darkforest, wild 남쪽 사이드 dead-end) +
  dark_warden 미니보스(grave_hound 팔레트 스왑, 스페어/영입 가능) + 계시 대사
  톤 3벌 + win 사망대사 톤 3벌 + 퀘스트 로그 스테이지 체크리스트(menuScene).
- 304 테스트 + balance 3-pass(dkfrst/dkWARDEN 시나리오 동기) + $B 라이브 QA
  (대화→토스트→체크리스트→reach→리로드 생존→전투 렌더) 전부 그린.
- 후속: 2·3막 (위 "서사 고도화 2·3막 증축" 항목 참조).

## (원안) questline 'reach'/'talk' cond 타입 + 트래커 — (2026-05-31, plan-eng-review)
- **What:** questlines.js의 스테이지 cond에 `reach`(맵 X 진입) / `talk`(NPC Y 대화) 타입 추가
  + 이를 판정할 영속 트래커 — `save.visitedMaps`(Set) / `save.talkedNpcs`(Set).
- **Why:** 옥토패스식 "그 장소로 가라" / "그와 말하라" 스테이지 목표. 현 cond(boss/collect/
  mercy/slay)로는 못 만드는 서사형 진행. 자동전진(cond 충족 시) 모델과 바로 맞물림.
- **현 상태:** Milestone 1 쇼케이스 퀘스트라인은 **기존 cond만**으로 저술(트래커 미구현).
  quests.js:13이 이미 "reach/visited deferred — needs a visited-map tracker"로 명시.
- **Cons / 주의:** visitedMaps·talkedNpcs 각각 TOP-LEVEL 영속 필드 → **Gotcha #11 4군데**
  (freshSave+validateSave+main.js toRuntime+saveNow) ×2. fieldScene.loadMap에서 visited 기록,
  openDialog/interact에서 talked 기록하는 훅 추가.
- **Depends on:** Milestone 1(questlines.js + condMet 공유) 선행. condMet에 두 케이스만 추가하면 됨.

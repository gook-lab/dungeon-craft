# 맵 작업 로드맵 (HD-2D)

> 다음 세션 핸드오프. 옥토패스풍 HD-2D 맵 룩 작업의 현재 상태 + 남은 작업.
> 관련: [CLAUDE.md §9](../CLAUDE.md) (elevation 키트) · [TODOS.md](../TODOS.md) · 설계문서(레포 밖, 로컬 gstack 산출물 — 공개 레포에는 없음).
> 작성: 2026-05-30. 테스트 기준선: 작성 당시 **279 passing**. 2026-08-22 기준 **402 passing** (`npx vitest run`)입니다.

---

## 1. 지금까지 완료 (shipped)

다음 기능들이 출하됩니다:

**렌더 시스템** (`src/scenes/fieldScene.js` + `src/config.js`)은:
- **분위기** `buildAtmosphere()` — 리전별 ambient tint + 깊이 fog + radial vignette (`REGION_MOOD` in config.js). screen-space, world↔hud 사이.
- **틸트시프트 far-blur** `ensureFarBlur()`/`updateFarBlur()` — 상단 띠를 RenderTexture로 블러 복제 + feather mask. **WebGL/WebGPU에서만**(`r.gl||r.gpu` 게이트); Canvas2D 폴백은 fog로 대체. `FAR_BLUR` config.
- **포인트 라이트** `buildLights()` — add-blend radial glow (`glowTexture`). 맵 `kind:'light'` obj 또는 brazier/shrine/torch prop auto-glow. `update()`에서 sine 깜빡임.
- **elevation 렌더** `buildElevation()` — 리전 바위면 절벽(`CLIFF` 팔레트) + 풀/눈/이끼 처마 + 수직 줄무늬 + N/W/E 측벽 + S 키큰 면 + 2톤 외곽선. **계단 = 골드 램프**(낮은 이웃→높은 칸 스팬, 발밑부터 보임).
- **바닥 데코** `buildDecor()` — 리전별 데칼(`DECOR` 팔레트: grass/flower/pebble/crack/glint/reed/ember/mote/rubble) 시드 산포.

**elevation 메커닉** (`src/systems/field.js`, PURE):
- `elevAt`/`isStair`/`isDrop` + **`canStep(map,fx,fy,tx,ty)`** — 단일 엣지 규칙. tryMove·roamers·content.test BFS 공유.
- 규칙: 같은 레벨 OK / 계단 양방향 / **한 단 내려가기 어디서든** / 2단+ 낙하는 `drop`만 / 올라가기는 계단만.
- `_builder.js raiseRect(elev,collision,W,x0,y0,x1,y1,level)` — 걷는 셀만 올림.
- content.test: elevation-aware BFS + **갇힘 가드**(모든 elev 맵, 포탈 역-플러드).

**14개 맵 전부 elevation을 지원합니다** (멀티 티어 + 리전별 스킴):
| 맵 | 크기 | elevation |
|---|---|---|
| town | 16×13 | 북쪽 stone 테라스 |
| wild | 36×28 | NW 숲언덕 + SE 절벽 L1→L2 봉우리 |
| dungeon | 34×26 | 2단 옥좌(접근단+왕좌) |
| frost | 34×26 | 2단 빙붕(테라스+셸프) |
| swamp | 36×28 | 2단 마녀단(뿌리+가마솥) |
| empire_gate | 26×22 | 동쪽 성벽 단 |
| empire_city | 26×22 | 분기성문 rampart(정문/뒷문 위) |
| empire_camp | 16×13 | 북쪽 폐허 테라스 |
| empire_bridge | 22×16 | 협곡 건너 warden 제단 |
| empire_throne | 18×14 | 2단 대옥좌(3폭 의식계단) |
| lava_gate | 26×22 | 동쪽 obsidian 단 |
| lava_core | 18×14 | 2단 마그마 단 |
| void_gate | 26×22 | 동쪽 void석 단 |
| void_core | 18×14 | 2단 공허 옥좌 |

**아트**: PixelLab 환경 프롭 5종(`prop_wild_bush/mossy_boulder/crypt_rubble/ice_cluster/swamp_reeds`, `public/structures/`, `walkable:true` 장식). wild/dungeon/frost/swamp에 산포합니다. **PixelLab 잔여 ~53 generations** (Tier2 구독).

---

## 2. 아키텍처 빠른참조 (다음 세션이 바로 손댈 노브)

- **무드 색 조정**: `config.js REGION_MOOD[region]` = `{tint, fog, vignette, bloom}`. + DESIGN.md "환경 무드" 테이블.
- **절벽 색**: `fieldScene.js CLIFF[region]` = `{face, overhang}`.
- **데코 종류/밀도**: `fieldScene.js DECOR[region]` = `{density, kinds, pal}`.
- **단차 높이**: `config.ELEV_STEP` (현재 26). **줌**: `config.WORLD_SCALE` (현재 2.4). **블러**: `config.FAR_BLUR`.
- **계단 색(골드)**: `buildElevation()` 내 `const GOLD`.
- **새 맵 elevation**: `raiseRect` + `stairs:[{x,y}]`(높은 칸) (+ `drops:[{x,y}]`) → `npx vitest run`이 도달성/갇힘 검증.
- **새 prop**: `public/structures/<key>.png` + 맵 obj `{kind:'prop',ref:'<key>',tiles,walkable?}`. structureUrl 자동 매핑(assets.js 불필요).
- **라이브 QA**: dev `import.meta.env.DEV`에서 `window.__game`(scenes.top=field, .player, .map) + `window.__dbg`를 씁니다. 헤드리스는 Canvas2D 폴백 + 필드 절반-렌더 퀵이 있습니다 → 실 브라우저로 시각 확인합니다.

---

## 3. 남은 작업 (우선순위)

### A. 환경 밀도 — 나머지 맵에 프롭 산포 (S, 크레딧 0~소량)
empire/lava/void 맵은 elevation은 있지만 **환경 프롭 산포가 없음**(wild/dungeon/frost/swamp만 함).
- empire 3맵(gate/city/camp): `prop_crypt_rubble` walkable 산포.
- lava: 라바 바위 프롭 필요 → PixelLab `create_map_object`("cooled magma rock chunk") 1~2개 + 산포.
- void: 부서진 오벨리스크 조각 프롭 → PixelLab 1~2개 + 산포.
- 패턴: 기존 맵의 `walkable:true` prop 산포 블록 복붙 + 좌표만.

### B. 원경 parallax 배경 레이어 — ✅ v1 SHIPPED (2026-05-31)
하늘·먼 산·안개 레이어를 playfield 뒤에 깔아 디오라마 깊이를 줍니다. **정탑다운 해법 = 맵을 화면 하단
(1-band)으로 마스킹하고 상단 band(22%)에 패럭랙스 배경을 노출**(사용자 "맵 70% + 배경" 직관).
**실내(dungeon/ice)는 `regions.<x>.off:true`로 배경을 끕니다** → 풀스크린 맵(기존 틸트시프트 룩).
- 구현됨: `config.BACKDROP`(enabled/band/리전별 sky·hills) + `fieldScene.buildBackdrop()`(코드
  그라데이션 하늘 + 굴곡 산 2겹 + 시접 haze) + `ensureWorldMask()`(world를 [band,h]로 클립) +
  `camTarget()` 밴드 클램프(world.y ≤ band → 북단에서도 플레이어 안 가려집니다) + update 패럭랙스
  (산 x = world.x×factor) + far-blur 게이트를 끕니다.
- **트레이드오프**: 북쪽 전방 시야 ~28%↓(의도). 라이브 튜닝 노브: `config.BACKDROP.band`, 리전 sky/hills 색.
- **남은 작업**: band % 실플레이 감, 산 굴곡/색 눈맞춤, 던전류(실내) 배경 끄기 여부, (선택)산 드리프트 애니.
- 아트: PixelLab 풀 배경을 회피하고 코드 실루엣으로 감 — 충분히 읽힙니다(스크린샷 검증).

### B′. 촉각 생동감 (정탑다운 ROI 최상위) — ✅ SHIPPED (2026-05-31)
카메라 lerp(무게감) + 물 파문(발걸음·로머) + 풀 흔들림/갈라짐(지나가면 비켜남) + 발걸음 먼지를 구현했습니다.
정탑다운에선 원경보다 촉각이 시간당 생동감이 크습니다(2차 의견 검증). `fieldScene` 렌더 전용이고, 279 프레임입니다.

### C. 환경 애니메이션 (M, 생동감)
흔들리는 풀/갈대, 물 반짝임, 떠다니는 입자를 애니메이션 합니다. `update(dt)`에서 데코/물 타일에 sine 흔들림을 씁니다. 코드 중심입니다.

### D. 계단 정렬 너그럽게 (S, 선택) — 유저 피드백 후속
계단이 1칸이라 정렬이 빡빡습니다. 필요시 stairs를 **3칸 폭**으로 넓혀 등반 지점을 늘립니다. (현재 시각은 골드 램프 스팬으로 해결되므로 — 실플레이 후 판단합니다.)

### E. elevation 형태 다양화 (M)
현재 전부 사각 plateau입니다. 가라앉은 웅덩이(주변을 올려 표현), 굽이치는 고가 통로, 비대칭 단 등을 추가할 수 있습니다. `raiseRect` 여러 번 조합 or 신규 헬퍼를 씁니다.

### F. 맵 크기 일관성 (M, 선택)
핵심 경로 4맵만 확대되었습니다. empire/lava/void 맵(26×22, 18×14)도 "거리감"을 위해 확대할지를 결정해야 합니다 — 좌표 상대값 리팩터가 필요합니다(dungeon.js 패턴 참고: `bossX=W-3`).

### G. 무드/색 라이브 튜닝 (S)
`REGION_MOOD`/`CLIFF`/`GOLD`/`ELEV_STEP`/`WORLD_SCALE`을 실 브라우저로 눈 맞춥니다. 특히 골드 계단 톤, 다크 밴드 농도를 봅니다.

---

## 4. 열린 질문 / 결정 대기
- **정탑다운 vs 오블리크 틸트**: 진짜 옥토패스 3D 디오라마 각은 정탑다운이므로 구조적으로 불가능합니다(렌더러 재작성 필요). 현재 가짜 elevation으로 대체하고 있습니다. 틸트 도입은 대공사 — 별도 결정이 필요합니다.
- **"위로 누르기" vs "ledge 방향으로 누르기"**: top-down elevation은 화면-위 ≠ 고도-위입니다. 골드 램프가 방향을 가리키지만, 신규 유저 혼란 가능 → 튜토리얼 힌트를 고려합니다.
- **PixelLab 크레딧 배분**(~53): 배경 vs 프롭 vs 절벽-strip 타일을 어디에 쓸지 결정합니다. A/B에 우선합니다.

---

## 5. 시작점 (다음 세션 첫 액션 추천)
1. **A (프롭 산포)** 부터 하는 것이 좋습니다 — 싸고 즉각 밀도가 올라가며, 전 맵 일관성을 확보합니다. empire에 crypt_rubble부터 시작합니다.
2. 그다음 **B (원경 배경)** — 옥토패스 격차를 가장 크게 줄입니다.
3. 매 변경 후 `npx vitest run` (elevation/도달성 가드) + `run-qa-snapshot` 또는 실 브라우저로 확인합니다.

# dungeon-craft

**한국어** | [English](README.en.md)

순수 JavaScript와 PixiJS로 만든 드래곤 퀘스트풍 턴제 JRPG입니다.

전투에서 약해진 적을 쓰러뜨리거나 살려 보내고, 일부는 동료로 영입할 수 있습니다. 선택의 누적 결과는 별도 점수 대신 NPC 대사·파티 관계·보스 경로와 엔딩의 변화로 나타납니다.

## 프로젝트 특징

- **선택이 이어지는 전투**: 적을 처치하거나 살려 보낸 결과가 이후 대사와 진행 경로에 반영됩니다.
- **렌더링과 전투 계산 분리**: 전투 계산은 PixiJS에 의존하지 않아 Node 환경에서도 반복 검증할 수 있습니다.
- **헤드리스 밸런스 검증**: 여러 전투 조건을 자동 실행해 평균 라운드와 사망 수의 변화를 비교합니다.
- **맵 연결성 검사**: 포탈과 충돌 데이터를 그래프로 검사해 이동할 수 없는 구간을 테스트에서 찾습니다.

> 형제 프로젝트: `../game` (Crypt Survivors — 뱀파이어 서바이버즈풍 오토배틀러).
> 히어로/에셋/월드를 공유하지만 아키텍처는 완전히 다릅니다.

## 스크린샷

<img src="docs/screenshots/01-title.png" width="600">

## 실행

```bash
npm install
npm run dev      # 개발 서버 http://localhost:9153/
npm test         # Vitest 유닛 테스트 402개 (커밋 전 필수)
npm run build    # 프로덕션 번들 → dist/
npm run balance  # 헤드리스 밸런스 하네스 (아래 참조)
```

### 밸런스 하네스

`npm run balance`는 렌더러 없이 전투만 시뮬레이션해 3패스를 돌립니다.

| 패스 | 조건 | 보는 값 |
|---|---|---|
| BASELINE | 킬 빌드, 유대 없음 | avgRounds / deaths |
| MERCY | 긍정 유대 (탱키 + 클러치 FP) | 생존력 상승폭 |
| RUTHLESS | 부정 유대 (글래스캐논, HP 쿠션 없음) | 화력 상승폭 |

승률은 최적 AI에서 포화하기 때문에 **평균 라운드 수와 사망 수**를 읽습니다.

## 프로젝트 구조

```
src/
  engine/    sceneManager (LIFO 씬 스택) · renderer (유일한 PixiJS 소비자) · input
  systems/   battle (순수 리졸버 — Pixi 미참조) · progression (xp/레벨/유닛 빌더)
             field (그리드 이동 + 인카운터) · roamers (오버월드 순찰) · bonds (순수)
  content/   spells · monsters · items · party · dialog (톤 분기 변형 포함)
             quests · questlines · bondSkills · maps/ (마을/야생/던전/설원/늪 +
             제국 4맵 + 용암·공허 포스트게임 초보스, _builder + index 경유)
  scenes/    title · field · battle(opaque) · dialog(overlay) · menu · shop · equip · warp
  fx/        spellFx.js — 코드로 그리는 픽셀 주문 이펙트 엔진 (~76종 안무)
  ui/        uikit.js — windowBox / menuList / label (유일한 UI 프리미티브)
  util/      rng (시드) · audio (ZzFX + 에셋 SFX/BGM) · assets (스프라이트 URL 브리지)
  data/      save.js (localStorage, 방어적 `??` 검증) · settings.js
main.js      부트스트랩 — 엔진 + 씬 + 런타임 배선, 세이브 폴드, 프롤로그 게이팅,
             동료 영속화, 자비 카운터 폴드, 엔딩 톤 결정
scripts/balance.js   헤드리스 전투 하네스
```

## 핵심 설계

자세한 내용은 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** 참조. 요약하면:

1. **순수 전투 리졸버** — `systems/battle.js`는 PixiJS를 import하지 않고 세이브도 안 씁니다.
   `resolveAction(state, action, rng)`이 상태를 변형하고 `{ events }`를 돌려주면, 씬은 그 이벤트를 읽어 애니메이션만 합니다.
2. **LIFO 씬 스택** — 최상단 씬만 `update(dt)`를 받고 전부 렌더합니다. 씬끼리 서로 import하지 않습니다.
3. **자비 메커니즘** — `hp ≤ maxHp × 0.3`인 적은 살려보내기/영입 가능합니다. 순수 술어 `canMercy` / `canRecruit`가 UI를 게이트합니다.
4. **톤 분기 대사** — 자비 비율이 `merciful / ruthless / mixed` 톤을 만들고, `${id}_${tone}` 변형이 있으면 자동으로 갈아끼웁니다. **비율은 절대 UI에 노출하지 않습니다** (언더테일식).
5. **Fabula Points + 유대** — Fabula Ultima에서 가져온 "자비 = 힘" 장치. 긍정 유대는 탱키+클러치, 부정 유대는 화력만 있고 HP 쿠션이 없는 글래스캐논입니다.
6. **맵 연결성 테스트** — 포탈 그래프 + 베이크된 충돌 위 BFS로 "벽 하나 때문에 클리어 불가"를 회귀 테스트로 잠깁니다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 아키텍처 상세 |
| [CLAUDE.md](CLAUDE.md) | 작업 규칙 + 콘텐츠 확장 체크리스트 + 알려진 함정 (883줄, 사실상 개발자 매뉴얼) |
| [DESIGN.md](DESIGN.md) | UI 어휘 |
| [TODOS.md](TODOS.md) | 보류된 스코프 |
| [docs/map-roadmap.md](docs/map-roadmap.md) | 맵 로드맵 |

## 라이선스

**Source-available — 오픈소스가 아닙니다.** 코드를 읽을 수 있게 공개했을 뿐,
사용 권한을 준 것은 아닙니다. 다른 프로젝트에 가져다 쓰거나 재배포·상업적 이용을
하려면 사전 서면 허락이 필요합니다. 전문은 [LICENSE](LICENSE), 한국어 안내는 [LICENSE.ko.md](LICENSE.ko.md) 참조.

효과음은 [ZzFX](https://github.com/KilledByAPixel/ZzFX)(MIT), 픽셀 아트 일부는 PixelLab으로
생성했습니다. 서드파티 구성요소는 각자의 라이선스를 따릅니다.

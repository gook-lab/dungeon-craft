# 글꼴 서브셋 확인 — 첫 로딩 측정 · 글자 촬영 (2026-11-27)

jsDelivr 에서 받던 Galmuri 4종(약 1.9MB)을 게임 글자만 남긴 자체 서빙 서브셋 3종(86KB)으로
바꾼 뒤의 기록입니다. 서브셋 규칙과 라이선스는 [public/fonts/README.md](../../../public/fonts/README.md)
에 있습니다.

## 첫 로딩 — 전후 비교

`vite preview` 빌드, 빈 캐시 Chromium, DevTools 망 제한, 조건마다 3회 중앙값입니다.
측정 도구는 `scripts/measure-first-load.mjs` 이고, 「타이틀」은 main.js 의 `dc-title` 표시 시각입니다.

| 조건 | 타이틀 전 | 타이틀 후 | 전송량 전 → 후 | 요청 수 전 → 후 |
|---|---|---|---|---|
| 제한 없음 | 490 ms | 215 ms | 2,496 KB → 637 KB | 12 → 10 |
| 1.6 Mbps / 150 ms | 13,558 ms | 3,756 ms | 2,496 KB → 637 KB | 12 → 10 |
| 4 Mbps / 40 ms | 5,423 ms | 1,816 ms | 2,496 KB → 637 KB | 12 → 10 |

- 전: 글꼴은 JS 가 돈 뒤(약 3.3초, 1.6 Mbps)에야 받기 시작했고 13.0초 무렵 끝났습니다.
- 후: HTML 의 preload 로 0.17초에 받기 시작해 1.2초 안에 끝납니다. 이제 타이틀을 늦추는 것은
  JS 묶음(약 530KB 압축)입니다.
- 타이틀용 두 종만 먼저 받고 숫자용 Mono 를 타이틀 뒤로 미루는 안도 재 봤습니다. 1.6 Mbps 에서
  3,698 ms 로 차이가 잡음 범위(−31 ms)여서 넣지 않았습니다.

## 글자 촬영 — 두부 · 폴백 확인

1280×720 dev 서버 촬영입니다. 모든 장면에서 `document.fonts` 의 세 글꼴이 `loaded` 였고,
같은 저장 데이터로 찍은 main 과 화소 비교 시 타이틀 · 메뉴 · 장비 · 도감은 화면 전체가 차이 0 이었고,
나머지 장면도 차이는 비 · 대사 타자 진행 · 적 대기 동작 같은 움직임에만 있었습니다.

| 파일 | 장면 |
|---|---|
| `01-title.png` · `02-title-slot.png` | 타이틀 · 슬롯 선택 |
| `03-field.png` | 필드 HUD |
| `04-dialog.png` | 대화 |
| `05-shop.png` | 상점 |
| `06-menu.png` · `07-equip.png` · `08-quests.png` | 메뉴 · 장비 · 퀘스트 |
| `09-compendium.png` | 도감 |
| `10-battle.png` · `11-battle-target.png` | 전투 |
| `12-ending.png` · `13-ending-epilogue.png` | 엔딩 · 후일담 대사 |

✦ ⏱ ♛ 같은 기호는 원래 Galmuri 에도 없어 예전과 똑같이 시스템 글꼴로 그려집니다(`scripts/font-subset.json`
의 `notInSource`).

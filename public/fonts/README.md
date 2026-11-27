# 게임 글꼴 — Galmuri 서브셋

이 폴더의 `CryptPixel*.woff2` 는 이민서(quiple) 님의 [Galmuri](https://github.com/quiple/galmuri)
2.40.3 을 고친 판(Modified Version)입니다. 라이선스는 같은 폴더의 [OFL.md](OFL.md)
(SIL Open Font License 1.1)이고, 이 레포 본체의 라이선스와 별개입니다.

## 원본과의 차이 — 글자 줄이기 · 이름 바꾸기

| 파일 | 원본 | 바꾼 것 |
|---|---|---|
| `CryptPixel11.woff2` | `Galmuri11.woff2` | 글자 줄임 · 이름 바꿈 |
| `CryptPixel14.woff2` | `Galmuri14.woff2` | 글자 줄임 · 이름 바꿈 |
| `CryptPixelMono11.woff2` | `GalmuriMono11.woff2` | 글자 줄임 · 이름 바꿈 |

- 글자: 게임 소스(`src/`)에 나오는 글자와 ASCII · Latin-1 만 남겼습니다. 남긴 글자는 원본과
  화소 단위로 같게 그려집니다(`scripts/check-font-parity.mjs`, 2026-11-27 18 · 20 · 24 · 30px 전수 비교 차이 0).
- 이름: 원본 배포 CSS(`galmuri.css`)가 「Reserved Font Name "Galmuri"」를 밝히고 있어,
  OFL 1.1 제3조에 따라 고친 판의 파일 이름 · 글꼴 이름(name 테이블)에서 "Galmuri" 를 뺐습니다.
  저작권 · 라이선스 · 상표 · 디자이너 표기는 원본 그대로 둡니다.

## 다시 만들기 — scripts/build-font-subset.mjs

대사나 아이템 이름에 새 글자가 들어가면 `src/ui/fontSubset.test.js` 가 실패합니다. 그때 아래처럼
다시 만들고 `public/fonts/` 와 `scripts/font-subset.json` 을 함께 커밋합니다.

```sh
python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools brotli
FONT_PYTHON=/tmp/ft/bin/python node scripts/build-font-subset.mjs
PLAYWRIGHT_DIR=<playwright 가 설치된 폴더> node scripts/check-font-parity.mjs
```

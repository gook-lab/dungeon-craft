# dragon-game — Design System

See also: [CLAUDE.md](CLAUDE.md) (architecture + patterns) · [TODOS.md](TODOS.md) (deferred scope).


DQ-style turn-based RPG, PixiJS v8, pixel-art. This captures the de-facto UI
vocabulary so new screens stay consistent. (Written during the C-mechanic
design review, 2026-05-29.)

## Core vocabulary (src/ui/uikit.js)

- `windowBox(w, h)` — the dark command/status window. The ONE container primitive.
  Status panels, dialog boxes, and submenus all use it. Don't invent new frames.
- `menuList(options, { width, itemH, pad, size })` — vertical selectable list with
  a cursor. The ONE list primitive (spell menu, item menu, mercy submenu, roster).
- `label(str, size, fill)` — text. Default 18px white (`#ffffff`).

## Tokens

- Text: body 18px, command bar 22px, message 20px, status name 17px / stat 15px.
- Colors: white `#ffffff` (default), highlight gold `#ffe066`, info cyan `#cfe`,
  muted `#aab`, disabled grey `#6a6a72`.
- Battle phase banner: hero `#bcd8ff` on `0x1b3a6b`, enemy `#ffc0c0` on `0x6b1b1b`.
- Bottom panel: `0x0a0a2a` @ 0.96, 4px white top border, edge-to-edge.

## Interaction conventions

- Keyboard-driven: arrows move, confirm selects, cancel backs out. No hover state
  (it's a canvas game) — never rely on hover for discoverability.
- Command bar is horizontal across the bottom panel; submenus are vertical
  `menuList`. Selected item: gold fill + 1.12× scale + a gold cursor triangle.
- **Disabled menu items**: grey `#6a6a72`, no scale, and confirming on one shows a
  one-line reason rather than silently failing (see 자비 gating in battleScene).

## C-mechanic UI rules (this feature)

- **자비 (mercy)** lives in the command bar above 방어, always visible, greyed/
  disabled until an enemy is weakened to its mercy threshold. It is the game's
  signature mechanic — never bury it or hide it entirely.
- Mercy submenu: 살려주기 (spare) always; 영입하기 (recruit) only when a weakened
  enemy is recruitable.
- **Recruit success**: target glows gold and slides toward the party side, fading
  (`tickAnims` kind `'recruit'`) + join message + `levelup` SFX. This is the
  emotional payoff — it must read differently from a kill.
- **Spare**: soft white drift-up fade (kind `'spare'`), NOT the generic death
  dissolve.
- **Mercy ratio is never shown as a meter.** The town elder + boss-win dialogue
  react to playstyle via `_merciful` / `_ruthless` dialog variants
  (`tonedDialogId` in content/dialog.js). Keep it implicit (Undertale-style).
- a11y: never signal mercy-eligibility by colour alone — pair grey with the label.

## Adding a new screen

Reuse `windowBox` + `menuList` + `label`. Match the tokens above. If you reach for
a new frame style or a new font size, stop — there's probably an existing token.

## 환경 무드 (HD-2D 맵 룩, 2026-05-30)

맵 분위기 토큰. `config.js REGION_MOOD`이 정본; 아래는 시작값(QA 미세조정). 규율:
far-band만 블러(스프라이트 또렷). 설계: `~/.gstack/projects/dragon-game/*-design-20260530-202911.md`.

| REGION | AMBIENT TINT | FOG (color/α) | VIGNETTE α | BLOOM thresh |
|--------|--------------|---------------|-----------|--------------|
| town | #fff4e0 ·0.06 | #e8dcc0 / 0.10 | 0.18 | 0.82 |
| wild | #eaf2e0 ·0.05 | #cfe0c8 / 0.08 | 0.16 | 0.85 |
| dungeon | #b8c6e0 ·0.14 | #2a3550 / 0.22 | 0.34 | 0.78 |
| frost | #dce8ff ·0.12 | #cfe0ff / 0.18 | 0.26 | 0.80 |
| swamp | #c8e0b0 ·0.12 | #3a4a2c / 0.24 | 0.32 | 0.76 |
| empire | #e0b0a0 ·0.14 | #3a2024 / 0.26 | 0.38 | 0.74 |
| lava | #ffb060 ·0.18 | #401808 / 0.20 | 0.30 | 0.68 |
| void | #c090ff ·0.20 | #1a0a2e / 0.30 | 0.42 | 0.66 |

**elevation 단차 가독성 (3요소):** rim light(높은 타일 윗모서리 2px, 앰비언트 밝은 α0.5 — 핵심
"윗면 끝" 신호) + cliff face(#000 α0.55→0.15 그라데이션) + drop shadow(낮은 타일 top, #000 α0.30).
대비 규율: rim ↔ cliff 명도차 ≥ 50%.

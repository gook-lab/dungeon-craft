---
description: Drive 던전크래프트 into a live state (dev server → seed localStorage save → reload → $B press → screenshot) and capture it, without manually clicking through prologue/menus. Use to eyeball a render/UX change in real play.
---

# /run-qa-snapshot [what-to-show]

Fast-track the repetitive "get into a specific game state and screenshot it" loop.
Unlike the sibling `../game` (which exposes `window.__dbg`), 던전크래프트 does **not**
expose `window.__game` — so we drive deterministically by **seeding a partial save
into localStorage**, reloading, then pressing keys. `validateSave()` fills any
missing fields, so a tiny partial save is enough.

Use this whenever you need to verify a battle/menu/field change on screen (FP/운명
commands, bond effects, equip delta preview, dialogue tone, backdrop, etc.).

## Key facts (why this works)

- Save key: `dragon_crypt_save_v1`. Origin is per-port, so each dev-server port has
  its own localStorage — seed the port you'll screenshot.
- `flags.intro: true` **skips the prologue + tutorial**. Omit it and reload replays
  the intro every time.
- Carried hero `hp` enters battle as-is (`buildHeroUnit` uses `opts.hp`). Seed a low
  `hp` (e.g. `5`) to force a hero into **Crisis (≤50%)** at battle start — the way to
  test Crisis FP bank, flaw→FP, and the 애정(affection) Crisis-partner surge.
- Seed `fabula` (0–6) and `bonds` to test the 운명 menu / badge and bond effects.
  Bond pair key = the two refIds **sorted**, joined with `|` (e.g. `knight|warrior`,
  `huntress|knight`). Emotions: `admiration` / `loyalty` / `affection`.
- Wild/field maps use **roamer (symbol) encounters** — walk into a dark roamer to
  start a battle. Town has none (safe for menu/equip shots).

## Steps

1. **Ensure a dev server is up** (Vite auto-bumps from 9153 if busy):
   ```bash
   for p in 9153 9154 9155; do
     code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$p/ 2>/dev/null)
     [ "$code" = "200" ] && { echo "PORT=$p"; break; }
   done
   ```
   If none are up, start one and read the chosen port:
   ```bash
   npm run dev > /tmp/dg-dev.log 2>&1 &
   sleep 4 && grep -iE "Local:" /tmp/dg-dev.log
   ```
   NOTE: a Vite server on ANY port serves your latest code via HMR (it watches the
   FS), so an already-running server from a prior session is fine to reuse.

2. **Resolve the browse binary** (`$B`) and seed a save, then reload:
   ```bash
   B="$HOME/.claude/skills/gstack/browse/dist/browse"
   PORT=9153   # from step 1
   # Minimal save: L9 party in town, prologue skipped. Add fields per what you test.
   SAVE='{"version":1,"party":[{"id":"knight","level":9,"hp":null,"mp":null,"equip":{"weapon":null,"armor":null,"accessory":null}},{"id":"warrior","level":9,"hp":null,"mp":null,"equip":{"weapon":null,"armor":null,"accessory":null}},{"id":"huntress","level":9,"hp":null,"mp":null,"equip":{"weapon":null,"armor":null,"accessory":null}}],"gold":300,"inventory":{"herb":5},"mapId":"town","pos":{"x":7,"y":9},"openedChests":[],"allies":[],"activeAlly":null,"fabula":0,"bonds":{},"flags":{"intro":true,"mercied":0,"slain":0}}'
   $B goto "http://localhost:$PORT/" >/dev/null 2>&1; sleep 1
   $B js "localStorage.setItem('dragon_crypt_save_v1', JSON.stringify($SAVE)); 'ok'"
   $B goto "http://localhost:$PORT/" >/dev/null 2>&1; sleep 1.5
   $B js "var c=document.querySelector('canvas'); c?('canvas '+c.width+'x'+c.height):'NO CANVAS'"  # sanity
   ```
   `NO CANVAS` / `chrome-error://` → the port is dead; pick another and re-seed.

3. **Drive to the target state** with key presses (controls: ↑↓←→, `z` confirm,
   `x` menu/cancel):
   ```bash
   $B press z; sleep 0.8          # title 이어하기 → field
   # --- field menu (equip / bonds / item / ally) ---
   $B press x; sleep 0.4          # open menu (root: 아이템/장비/동료/유대/닫기)
   # ↓ to the row you want, then z. e.g. 유대 = 3 downs; 장비 = 1 down (opens EquipScene)
   # --- start a battle (wild/field map only) ---
   # walk into a roamer; they also chase you:
   for i in $(seq 1 8); do $B press ArrowDown; sleep 0.18; done
   for i in $(seq 1 8); do $B press ArrowRight; sleep 0.18; done
   ```
   The battle command order: 공격 / 주문 / 아이템 / 자비(weakened enemy only) / 운명(FP>0) /
   방어 / 도망. Disabled rows (greyed 자비) are skipped by the cursor.

4. **Screenshot** and read it back:
   ```bash
   $B screenshot /tmp/dg-qa.png
   $B console 2>&1 | grep -iE "error|uncaught|typeerror" | grep -v innerSerialize | tail
   ```
   Use the Read tool on the PNG to view. The field scene can briefly render small
   right after a reload; if so, take a second shot after ~1s (it settles to 1280x720).

5. **Clean up** the QA save so the next load is a fresh game:
   ```bash
   $B js "localStorage.removeItem('dragon_crypt_save_v1'); 'cleared'"
   ```

## Recipes

- **운명/FP commands**: seed `"fabula":6` → battle → cursor to 운명 → Z shows
  고무/불굴/재기. 재기 is disabled unless a hero has fallen.
- **Crisis surge + flaw→FP**: seed knight `"hp":5` + `"bonds":{"knight|warrior":["affection"],"huntress|knight":["affection"]}` → battle. Crisis bank ticks ✦운명, surge msg "X는 Y를 지키려 분기한다!", knight attack → 맹세 flaw +1.
- **Equip delta preview**: seed an equipped weapon + spare weapons in `inventory`,
  map `town` → menu → 장비 → → (slots→inv). Rows show 공+N▲ / 공-N▼ vs equipped.
- **Dialogue tone**: seed `flags.mercied`/`flags.slain` to push `toneFromFlags`
  (merciful ≥70% / ruthless ≤30%) and talk to an NPC.
- **Force an enemy skill cast (monster skills FX)**: enemy skills fire on a per-turn
  `chance` roll once off cooldown, so a SLOW single mob dies before it ever acts. To
  catch a cast: (1) seed a region with **dense skill-mobs** (swamp `mapId:"swamp"` spawns
  2-5 inc. mud_crawler→venomspit, bog_brute→monslam) so several enemies get turns; (2)
  in battle make **all heroes 방어 (defend)** — no kills, so every enemy acts each round
  and rolls its skill; (3) burst-screenshot (~3 shots, 0.4s apart) during the enemy phase
  to land on the ~1s cast animation. AoE casters (imp/fire_bat→firebreath, bog_witch→curse)
  read clearest. **CAVEAT**: don't edit any source file mid-run — a Vite HMR full-reload
  drops the battle back to Title (you'll see 새 게임 highlighted); finish the shot first.

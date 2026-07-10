---
description: Scaffold a new equipment item across the files it touches — items.js (def), shopScene.js SHOPS (buyable stock), items.js DROP_GEAR (drop tier), with the passive schema + ✦display + balance reminders. Usage: /scaffold-item <itemId> <weapon|armor|accessory> [stats] [passives].
---

# /scaffold-item

Adding equipment is a multi-file edit that's easy to half-do (forget shop stock, miss a
drop tier, add a `passive` key with no resolver hook). This walks the full path. See
CLAUDE.md "Equipment passive effects" + "Equipment upgrade" sections and the finite-pool
Gotcha #7.

## Arguments

- `<itemId>` (required) — lowercase id, matches 1:1 (`marksman_longbow`).
- `<kind>` (required) — `weapon` | `armor` | `accessory`.
- `[stats]` — any of `atk`/`def`/`spd`/`maxHp`/`maxMp` (EQUIP_STATS). Stay on the ladder:
  weapon atk ~3→20, armor def ~1→15, accessory is utility (one main stat).
- `[passives]` — optional `passive:{…}` keys (all combat-read, NOT stats):
  `counter`(≤0.75) / `crit`(≤0.75) / `dmgReduce`(≤0.4) / `regenHp`(≤0.2) / `regenMp`(≤0.2) /
  `resist:{<status>:0..0.9}` / `resistAll`. These ALL already have resolver hooks — adding a
  passive item needs ZERO battle.js change (equipPassives/forEachEquipped read every slot).

## Steps

1. **`src/content/items.js` — define in `ITEMS`.** `price: 0` = reward-only (not in any shop);
   else set a tier-appropriate price. `sprite`: weapons/accessories `pickup_rune`, armor
   `pickup_scroll`. Add `passive:{…}` if it carries one (clamps are applied by `equipPassives`,
   but keep raw values sane). Class-FLAVOR, not class-lock (any hero can equip — finite pool).
   ```js
   <id>: { id: '<id>', name: '[KR 이름]', kind: '<kind>', atk: 8, spd: 2, price: 180, sprite: 'pickup_rune', passive: { crit: 0.15 } },
   ```
2. **`src/scenes/shopScene.js` — `SHOPS` stock.** Add the id to the right merchant's `stock[]`:
   weapons+armor → `smith`, accessories → `jeweler` (both towns: 시작 마을 + empire_camp share
   the registry). Skip for `price:0` reward items. **If a concurrent agent is editing this file,
   use a one-shot idempotent Node script** (Edit-tool fails against a moving file).
3. **`src/content/items.js` — `DROP_GEAR` tier.** Add to `low`/`mid`/`high` (battle-drop pool by
   region tier). Reward-only items can also be placed as a map `chest` `loot.item` instead.
4. **✦Display is AUTOMATIC** — `itemSummary` calls `passiveParts(item.passive)`, so equip screen +
   shop tooltips show `✦반격 30%` etc. A genuinely NEW passive KEY (beyond the 7 above) needs a
   branch in `passiveParts` (items.js) AND a resolver hook in battle.js — that's a bigger feature,
   not a plain item.
5. **Verify**: `npx vitest run src/content/content.test.js` (item integrity: valid kind + finite
   price). Optional node check: `itemSummary(ITEMS['<id>'])` prints the expected ✦ line.
6. **Balance**: a stat-only item needs NO `npm run balance` (harness kill-build doesn't equip
   gear → passives + gear are invisible to the tuned ladder). Only re-run if you change the
   passive CLAMPS or a base-party assumption. To measure a full passive BUILD vs bosses, that's
   the deferred harness "equipped pass" (see followups) — not part of adding one item.

## Notes

- Equipment is a **shared finite pool** (Gotcha #7) — buying one sword arms ONE hero; do NOT
  decrement inventory on equip. New items inherit this for free.
- `plus` (강화 +N) scales STATS only (×`UPGRADE_STEP`), NOT passives (v1).
- For a consumable (potion/scroll), this command doesn't apply — add `kind:'consumable'` with an
  `effect:{…}` directly + the menuScene applyTo handler.

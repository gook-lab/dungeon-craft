import { describe, it, expect } from 'vitest';
import { ITEMS } from './items.js';
import { AFFINITY } from '../systems/affinity.js';

// Real passive keys understood by equipPassives (items.js). `eva` is NOT one —
// a weapon shipped with an invented passive silently no-ops, so guard the set.
const REAL_PASSIVES = new Set(['resist', 'resistAll', 'regenHp', 'regenMp', 'counter', 'crit', 'dmgReduce']);

// Elements a physical class can reach via a WEAPON. Derived from the affinity
// table so a future spell-element addition (added to AFFINITY) auto-requires a
// weapon. Two deliberate exclusions:
//   - 'physical' : the neutral default (no element = ×1), never a weapon element.
//   - 'poison'   : has no `strong` targets and is RESISTED by undead/void, so a
//                  poison weapon is strictly bad in the undead-heavy regions.
const WEAPON_ELEMENTS = Object.keys(AFFINITY).filter((e) => e !== 'physical' && e !== 'poison');

const weapons = Object.values(ITEMS).filter((it) => it.kind === 'weapon');

describe('Elemental weapon coverage — every affinity element is physically reachable', () => {
  it.each(WEAPON_ELEMENTS)('has at least one weapon with element "%s"', (element) => {
    const match = weapons.filter((w) => w.element === element);
    expect(match.length, `no weapon carries element '${element}' — a physical class can't exploit that affinity`).toBeGreaterThan(0);
  });

  it('every weapon element is a known affinity key', () => {
    for (const w of weapons) {
      if (w.element) expect(AFFINITY[w.element], `weapon ${w.id} has unknown element '${w.element}'`).toBeDefined();
    }
  });

  it('every weapon passive uses only real (equipPassives-supported) keys', () => {
    for (const w of weapons) {
      if (!w.passive) continue;
      for (const key of Object.keys(w.passive)) {
        expect(REAL_PASSIVES.has(key), `weapon ${w.id} has invented passive '${key}' — equipPassives would silently drop it`).toBe(true);
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  BOND_SKILLS, BOND_ULTS, POLE_RIDER, BOND_STRIKE_COST,
  bondMod, bondModForCombo, canBondStrike, availableBondStrikes,
} from './bondSkills.js';
import { bondKey, addEmotion, EMOTIONS } from '../systems/bonds.js';
import { makeUnit, createBattle } from '../systems/battle.js';

// A minimal hero/enemy unit for the gate checks.
const hero = (refId, alive = true) => makeUnit({ id: refId, refId, side: 'hero', name: refId, maxHp: 100, hp: alive ? 100 : 0, atk: 40, def: 10, spd: 10, alive });
const enemy = () => makeUnit({ id: 'e1', refId: 'walker', side: 'enemy', name: 'walker', maxHp: 200, hp: 200, atk: 20, def: 20, spd: 8 });

describe('bondSkills — data integrity', () => {
  it('every combo is keyed by the sorted bondKey of its pair', () => {
    for (const [key, combo] of Object.entries(BOND_SKILLS)) {
      expect(bondKey(combo.pair[0], combo.pair[1])).toBe(key);
      expect(combo.pair).toHaveLength(2);
      expect(combo.id).toBeTruthy();
      expect(combo.fx).toBeTruthy();
      expect(combo.base.physical).toBe(true); // atk-scaled, stays on the tuned ladder
      expect(['one', 'all']).toContain(combo.base.target);
    }
  });

  it('ships the three starting-party pairs', () => {
    expect(BOND_SKILLS[bondKey('knight', 'warrior')]).toBeTruthy();
    expect(BOND_SKILLS[bondKey('huntress', 'knight')]).toBeTruthy();
    expect(BOND_SKILLS[bondKey('huntress', 'warrior')]).toBeTruthy();
  });

  it('ships the three mage pairs (optional-recruit combos)', () => {
    expect(BOND_SKILLS[bondKey('knight', 'mage')]).toBeTruthy();
    expect(BOND_SKILLS[bondKey('mage', 'warrior')]).toBeTruthy();
    expect(BOND_SKILLS[bondKey('huntress', 'mage')]).toBeTruthy();
  });

  it('ships the three duelist pairs', () => {
    expect(BOND_SKILLS[bondKey('duelist', 'warrior')]).toBeTruthy();
    expect(BOND_SKILLS[bondKey('duelist', 'mage')]).toBeTruthy();
    expect(BOND_SKILLS[bondKey('duelist', 'huntress')]).toBeTruthy();
  });

  it('every POLE_RIDER key is a known emotion', () => {
    for (const emo of Object.keys(POLE_RIDER)) expect(EMOTIONS).toContain(emo);
  });
});

describe('bondMod — pole → rider', () => {
  const mk = (...emos) => { const b = {}; for (const e of emos) addEmotion(b, 'knight', 'warrior', e); return b; };

  it('each pole maps to its rider', () => {
    expect(bondMod(mk('admiration'), 'knight', 'warrior')).toEqual({ dmgMult: 1.25 });
    expect(bondMod(mk('contempt'), 'knight', 'warrior')).toEqual({ dmgMult: 1.40 });
    expect(bondMod(mk('loyalty'), 'knight', 'warrior')).toEqual({ shieldCasters: 0.20 });
    expect(bondMod(mk('mistrust'), 'knight', 'warrior')).toEqual({ applyDefdown: true });
    expect(bondMod(mk('affection'), 'knight', 'warrior')).toEqual({ healCasters: 0.15 });
    expect(bondMod(mk('hatred'), 'knight', 'warrior')).toEqual({ lifesteal: 0.40 });
  });

  it('empty bond → empty mod', () => {
    expect(bondMod({}, 'knight', 'warrior')).toEqual({});
    expect(bondMod(undefined, 'knight', 'warrior')).toEqual({});
  });

  it('stacks one rider per axis (max 3)', () => {
    const mod = bondMod(mk('loyalty', 'affection', 'admiration'), 'knight', 'warrior');
    expect(mod).toEqual({ shieldCasters: 0.20, healCasters: 0.15, dmgMult: 1.25 });
  });

  it('XOR invariant: dmgMult has exactly one source (admiration flips to contempt)', () => {
    // addEmotion flips the opposite pole in place, so a pair can never hold both.
    const mod = bondMod(mk('admiration', 'contempt'), 'knight', 'warrior');
    expect(mod.dmgMult).toBe(1.40); // contempt won the RESPECT axis; no double-apply
  });

  it('is order-independent on the pair', () => {
    const b = mk('hatred');
    expect(bondMod(b, 'warrior', 'knight')).toEqual({ lifesteal: 0.40 });
  });
});

describe('canBondStrike / availableBondStrikes — gate', () => {
  const bondedState = () => {
    const st = createBattle([hero('knight'), hero('warrior'), hero('huntress')], [enemy()]);
    return st;
  };
  const bonds = () => { const b = {}; addEmotion(b, 'knight', 'warrior', 'loyalty'); return b; };

  it('passes when fp ok, bond exists, both alive, not yet used', () => {
    expect(canBondStrike(bondedState(), bonds(), 3, 'knight', 'warrior')).toBe(true);
  });

  it('fails below FP cost', () => {
    expect(canBondStrike(bondedState(), bonds(), BOND_STRIKE_COST - 1, 'knight', 'warrior')).toBe(false);
  });

  it('fails with no bond emotion', () => {
    expect(canBondStrike(bondedState(), {}, 6, 'knight', 'warrior')).toBe(false);
  });

  it('fails once used this battle', () => {
    const st = bondedState(); st.bondStrikeUsed = true;
    expect(canBondStrike(st, bonds(), 6, 'knight', 'warrior')).toBe(false);
  });

  it('fails when the partner is down', () => {
    const st = createBattle([hero('knight'), hero('warrior', false), hero('huntress')], [enemy()]);
    expect(canBondStrike(st, bonds(), 6, 'knight', 'warrior')).toBe(false);
  });

  it('availableBondStrikes lists the actor duos (+ ult when enough partners)', () => {
    const b = {};
    addEmotion(b, 'knight', 'warrior', 'loyalty');
    addEmotion(b, 'huntress', 'warrior', 'hatred');
    const fromWarrior = availableBondStrikes(bondedState(), b, 6, 'warrior');
    expect(fromWarrior.filter((e) => e.size === 2).map((e) => e.id).sort()).toEqual(['duo_oath_charge', 'duo_pincer']);
    expect(fromWarrior.some((e) => e.id === 'bond_ult_trio')).toBe(true); // bonded to 2 living heroes
    const fromKnight = availableBondStrikes(bondedState(), b, 6, 'knight');
    const knightDuos = fromKnight.filter((e) => e.size === 2);
    expect(knightDuos.map((e) => e.id)).toEqual(['duo_oath_charge']); // only knight|warrior bonded
    expect(knightDuos[0].partnerRefs).toEqual(['warrior']);
    expect(fromKnight.some((e) => e.size >= 3)).toBe(false); // bonded to only 1 → no ult
  });
});

describe('인연 필살기 (trio/quad ults)', () => {
  const hero4 = (down) => [hero('knight'), hero('warrior'), hero('huntress'), hero('mage', !down)];
  const bondAll = (...partners) => { const b = {}; for (const p of partners) addEmotion(b, 'knight', p, 'loyalty'); return b; };

  it('data integrity: each ult is AoE physical with a size + cost', () => {
    for (const u of Object.values(BOND_ULTS)) {
      expect(u.base.physical).toBe(true);
      expect(u.base.target).toBe('all');
      expect([3, 4]).toContain(u.size);
      expect(u.cost).toBeGreaterThan(BOND_STRIKE_COST);
    }
  });

  it('bondModForCombo: duo = the pair mod', () => {
    const b = {}; addEmotion(b, 'knight', 'warrior', 'hatred');
    expect(bondModForCombo(b, 'knight', ['warrior'])).toEqual({ lifesteal: 0.40 });
  });

  it('bondModForCombo: multi merges dmgMult by MAX (no runaway multiply)', () => {
    const b = {};
    addEmotion(b, 'knight', 'warrior', 'admiration'); // 1.25
    addEmotion(b, 'knight', 'huntress', 'contempt');  // 1.40
    expect(bondModForCombo(b, 'knight', ['warrior', 'huntress']).dmgMult).toBe(1.40);
  });

  it('bondModForCombo: ORs applyDefdown, takes max fraction', () => {
    const b = {};
    addEmotion(b, 'knight', 'warrior', 'mistrust');   // applyDefdown
    addEmotion(b, 'knight', 'huntress', 'affection');  // healCasters 0.15
    const mod = bondModForCombo(b, 'knight', ['warrior', 'huntress']);
    expect(mod.applyDefdown).toBe(true);
    expect(mod.healCasters).toBe(0.15);
  });

  it('trio unlocks at 2 bonded living partners + 5 FP', () => {
    const st = createBattle([hero('knight'), hero('warrior'), hero('huntress')], [enemy()]);
    const trio = availableBondStrikes(st, bondAll('warrior', 'huntress'), 5, 'knight').find((e) => e.id === 'bond_ult_trio');
    expect(trio).toBeTruthy();
    expect(trio.size).toBe(3);
    expect(trio.partnerRefs.slice().sort()).toEqual(['huntress', 'warrior']);
  });

  it('trio hidden below its FP cost', () => {
    const st = createBattle([hero('knight'), hero('warrior'), hero('huntress')], [enemy()]);
    expect(availableBondStrikes(st, bondAll('warrior', 'huntress'), 4, 'knight').some((e) => e.id === 'bond_ult_trio')).toBe(false);
  });

  it('quad needs 3 bonded living partners; a downed member drops it to trio', () => {
    const full = createBattle(hero4(false), [enemy()]);
    expect(availableBondStrikes(full, bondAll('warrior', 'huntress', 'mage'), 6, 'knight').some((e) => e.id === 'bond_ult_quad')).toBe(true);
    const downed = createBattle(hero4(true), [enemy()]); // mage down → only 2 partners
    const avail = availableBondStrikes(downed, bondAll('warrior', 'huntress', 'mage'), 6, 'knight');
    expect(avail.some((e) => e.id === 'bond_ult_quad')).toBe(false);
    expect(avail.some((e) => e.id === 'bond_ult_trio')).toBe(true);
  });

  it('all ults vanish once a bond strike was used this battle', () => {
    const st = createBattle([hero('knight'), hero('warrior'), hero('huntress')], [enemy()]);
    st.bondStrikeUsed = true;
    expect(availableBondStrikes(st, bondAll('warrior', 'huntress'), 6, 'knight')).toEqual([]);
  });
});

describe('동료 인연기 (ally combo — 공생 연격)', () => {
  const ally = (refId) => makeUnit({ id: `ally_${refId}`, refId, side: 'hero', name: refId, maxHp: 80, hp: 80, atk: 30, def: 4, spd: 9, alive: true, ally: true });

  it('offered to a real hero when an ally is deployed (no bond emotion needed)', () => {
    const st = createBattle([hero('knight'), ally('goblin')], [enemy()]);
    const avail = availableBondStrikes(st, {}, 3, 'knight'); // empty bonds — recruiting IS the bond
    const sym = avail.find((e) => e.id === 'duo_symbiosis');
    expect(sym).toBeTruthy();
    expect(sym.partnerRefs).toEqual(['goblin']);
    expect(sym.size).toBe(2);
  });

  it('NOT offered to the ally itself, and gated by FP + once-per-battle', () => {
    const st = createBattle([hero('knight'), ally('goblin')], [enemy()]);
    expect(availableBondStrikes(st, {}, 3, 'goblin').some((e) => e.id === 'duo_symbiosis')).toBe(false); // ally's own turn
    expect(availableBondStrikes(st, {}, 2, 'knight').some((e) => e.id === 'duo_symbiosis')).toBe(false); // below cost
    st.bondStrikeUsed = true;
    expect(availableBondStrikes(st, {}, 6, 'knight')).toEqual([]); // shares the per-battle gate
  });
});

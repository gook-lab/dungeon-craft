// Bond Strikes (인연공격) — duo combos that turn the 유대(Bonds) you build into an
// active 운명(Fabula) command. PURE (no Pixi, no save write) so it's unit-testable;
// battleScene reads BOND_SKILLS + bondMod() and hands the resolver a ready payload,
// keeping battle.js free of any bonds/save import (mirrors affinity.js).
//
// Hybrid design (office-hours 2026-05-30): the CLASS PAIR picks the base attack +
// animation + element; the BOND'S DOMINANT POLE per axis modulates the effect.
// Because bonds.js's OPPOSITE map lets a pair hold at most ONE pole per axis, the
// riders below compose as "0..1 per axis, max 3 total" — and dmgMult can only ever
// come from ONE source (admiration XOR contempt), so double-application is
// structurally impossible (locked by an XOR invariant test in bondSkills.test.js).
//
//   RESPECT axis: 존경 admiration → dmgMult 1.25 | 멸시 contempt → dmgMult 1.40
//   TRUST   axis: 충성 loyalty    → shieldCasters | 불신 mistrust → applyDefdown
//   CARE    axis: 애정 affection  → healCasters   | 증오 hatred   → lifesteal
//
// The positive poles (자비 build) add protect/restore riders → bonds = a tanky,
// clutch payoff. The negative poles (잔혹 build) add lethal riders (흡혈/처형/관통
// 약화) → bonds = a glass-cannon payoff. Same mercy=power / ruthless=power mirror
// the passive bond buffs already use.

import { bondKey } from '../systems/bonds.js';

// 운명(FP) cost to unleash a bond strike. Scarce by design — cap is 6, so a full
// pool affords ~1 combo (2 at most), and the per-battle gate (state.bondStrikeUsed)
// caps it at one regardless. The "clutch one-shot" lever, not sustained DPS.
export const BOND_STRIKE_COST = 3;

// Pole → rider, organized by axis. FROZEN INTERFACE: each key maps 1:1 to an apply
// branch in battle.js's `bondStrike` action. Adding a NEW rider key is NOT a
// data-only change — it needs a matching resolver branch + a display string.
//   dmgMult       — multiply the combo's damage (applied post-skillDamage).
//   shieldCasters — grant both casters a 방어막 = this fraction of their maxHp.
//   applyDefdown  — inflict 방어약화 on the target(s) BEFORE damage (softens def).
//   healCasters   — heal both casters this fraction of their maxHp.
//   lifesteal     — heal both casters this fraction of total damage dealt.
export const POLE_RIDER = {
  // RESPECT — admiration empowers; contempt fuels a bigger, rider-less strike.
  admiration: { dmgMult: 1.25 },
  contempt: { dmgMult: 1.40 },
  // TRUST — loyalty shields the pair; mistrust exposes the foe (self-reliant edge).
  loyalty: { shieldCasters: 0.20 },
  mistrust: { applyDefdown: true },
  // CARE — affection mends the pair; hatred drinks the wound.
  affection: { healCasters: 0.15 },
  hatred: { lifesteal: 0.40 },
};

// The v1 combos — the three STARTING-PARTY pairs (mage is an optional recruit, so
// its pairs + recruited-ally pairs are deferred; see TODOS.md). Keyed by the sorted
// bondKey so the scene/lookup never mismatches on pair order. `base` is a synthetic
// physical spell fed to battle.js `skillDamage` (atk-scaled — stays on the tuned
// ladder, unlike maxMp magic). `power`/`hits` are STARTING tuning values: aim for a
// "Crisis-이후 역전 한 방" landing ~25-35% of a boss's maxHp (skeleton_king 320 /
// bog_witch 660 / fallen_emperor 760) — the harness NOW MODELS the duo strike
// (2026-07-10: balance.js 보스전 뱅킹 FP → knight×warrior 듀오 1회; power 오타·보스
// 트리비얼화가 회귀로 잡힌다). `fx` keys a DEFS choreography.
export const BOND_SKILLS = {
  // 기사 × 전사 — 성기사가 전사의 돌격을 축복: 단일 대상 성속성 강타(분노 시 가중).
  [bondKey('knight', 'warrior')]: {
    id: 'duo_oath_charge', name: '맹세의 돌격', pair: ['knight', 'warrior'],
    base: { physical: true, target: 'one', power: 34, melee: true, element: 'holy' },
    fx: 'duo_oath_charge',
  },
  // 사냥꾼 × 기사 — 기사의 축복을 받은 화살 연사: 전체 성속성 관통 3연사(대당 가볍게).
  [bondKey('huntress', 'knight')]: {
    id: 'duo_hallowed_volley', name: '축복받은 연사', pair: ['huntress', 'knight'],
    base: { physical: true, target: 'all', power: 16, hits: 3, atkScale: 0.5, element: 'holy', pierce: true },
    fx: 'duo_hallowed_volley',
  },
  // 사냥꾼 × 전사 — 전사가 시선을 끌고 사냥꾼이 빈틈을 찌르는 협공: 단일 2연타.
  [bondKey('huntress', 'warrior')]: {
    id: 'duo_pincer', name: '협공', pair: ['huntress', 'warrior'],
    base: { physical: true, target: 'one', power: 24, hits: 2, atkScale: 0.62, element: 'physical' },
    fx: 'duo_pincer',
  },

  // --- 법사 쌍 (mage is an OPTIONAL recruit — these only appear once the mage is
  // deployed + bonded; availableBondStrikes gates on a living mage hero unit). The
  // arcane caster lends each combo an element, but base stays physical (atk-scaled)
  // so it rides the same tuned ladder as the starter combos. ---

  // 기사 × 법사 — 기사의 축성 위에 법사의 비전을 터뜨리는 천공의 심판: 전체 성속성 폭발.
  [bondKey('knight', 'mage')]: {
    id: 'duo_radiant_nova', name: '천공의 심판', pair: ['knight', 'mage'],
    base: { physical: true, target: 'all', power: 18, element: 'holy' },
    fx: 'duo_radiant_nova',
  },
  // 전사 × 법사 — 전사의 칼날에 법사의 화염을 두른 작열참: 단일 화염 대강타.
  [bondKey('mage', 'warrior')]: {
    id: 'duo_blazing_cleave', name: '작열참', pair: ['mage', 'warrior'],
    base: { physical: true, target: 'one', power: 36, melee: true, element: 'fire' },
    fx: 'duo_blazing_cleave',
  },
  // 사냥꾼 × 법사 — 사냥꾼의 화살에 법사가 비전을 실어 쏘는 마탄 연사: 단일 뇌전 3연사(관통).
  [bondKey('huntress', 'mage')]: {
    id: 'duo_arcane_volley', name: '마탄 연사', pair: ['huntress', 'mage'],
    base: { physical: true, target: 'one', power: 15, hits: 3, atkScale: 0.5, element: 'thunder', pierce: true },
    fx: 'duo_arcane_volley',
  },

  // --- 쌍검사 쌍 (glass-cannon gunslinger duos) ---
  // 쌍검사 × 전사 — 강철 폭풍: 전사의 돌진 + 쌍검사의 난사, 단일 4연타.
  [bondKey('duelist', 'warrior')]: {
    id: 'duo_steelstorm', name: '강철 폭풍', pair: ['duelist', 'warrior'],
    base: { physical: true, target: 'one', power: 26, hits: 4, atkScale: 0.5, element: 'physical' },
    fx: 'duo_steelstorm',
  },
  // 쌍검사 × 법사 — 소이탄 연격: 법사의 불씨를 입힌 폭탄 연사, 전체 화염 + 화상.
  [bondKey('duelist', 'mage')]: {
    id: 'duo_incendiary', name: '소이탄 연격', pair: ['duelist', 'mage'],
    base: { physical: true, target: 'all', power: 18, element: 'fire', inflict: 'burn', inflictChance: 0.6, inflictTurns: 3 },
    fx: 'duo_incendiary',
  },
  // 쌍검사 × 사냥꾼 — 십자포화: 두 사수의 교차 사격, 단일 6연타.
  [bondKey('duelist', 'huntress')]: {
    id: 'duo_crossfire', name: '십자포화', pair: ['duelist', 'huntress'],
    base: { physical: true, target: 'one', power: 20, hits: 6, atkScale: 0.35, element: 'physical' },
    fx: 'duo_crossfire',
  },
};

// 인연 필살기 (multi-hero ults) — GENERIC by party size, not member-set: one trio
// ult + one quad ult, launchable by ANY actor bonded to enough living partners (so
// they survive a mage/ally swap). 필살기 = big AoE; cost scales with size and SHARES
// the one-per-battle bond gate (state.bondStrikeUsed) with the duos — a battle gets
// exactly one 인연기 (duo OR trio OR quad). base stays physical (atk-scaled ladder).
// 클러치 필살기 티어 — 단일 히트 power는 atk/(atk+def) soft-cap에 막혀 보스에서 undershoot
// (fullburst로 측정 확인: 단일 67 → 다단 129). 그래서 트리오/쿼드는 다단 탄막(hits)으로 두어
// "Crisis 이후 역전 한 방"(보스 maxHp 25~35%)이 실제로 나오게 한다.
export const BOND_ULTS = {
  // 트리오: 세 영웅의 합주 — 전체 성속성 3연 대폭발.
  trio: { id: 'bond_ult_trio', name: '삼중 합주', size: 3, cost: 5, base: { physical: true, target: 'all', power: 16, hits: 3, atkScale: 0.9, element: 'holy' }, fx: 'bond_ult_trio' },
  // 쿼드: 네 영웅 전원 — 운명의 대합주, 4연 최강 일격.
  quad: { id: 'bond_ult_quad', name: '운명의 대합주', size: 4, cost: 6, base: { physical: true, target: 'all', power: 16, hits: 4, atkScale: 0.9, element: 'holy' }, fx: 'bond_ult_quad' },
};

// 동료 인연기 (recruited-ally combo) — a generic strike a real hero teams up on with
// the deployed monster ally. NO emotion gate: recruiting the ally (by sparing it) IS
// the bond, so it's available whenever an ally is deployed + FP affords it. Sidesteps
// the hero-only bond-growth/id-refId machinery (allies don't grow bond emotions).
export const ALLY_COMBO = {
  id: 'duo_symbiosis', name: '공생 연격', cost: BOND_STRIKE_COST,
  base: { physical: true, target: 'one', power: 20, hits: 4, atkScale: 0.5, element: 'physical' },
  fx: 'duo_symbiosis',
};

// 종별 동료 전용 합동기 — 스토리 영입 셋피스 5종은 generic 공생 연격 대신 제 결의
// 전용기를 가진다 (자비=파워 보상 밀도: 살려 준 그 존재가 제 방식으로 갚는다).
// availableBondStrikes가 배치 동료의 refId로 조회, 없으면 ALLY_COMBO 폴백 — 순수
// 데이터 확장이라 resolver/scene 비접촉. 튜닝은 공생 연격(20×4@0.5)과 등가 밴드
// (scene-side, 하네스 미측정 — 인연기 power 튜닝 노트의 다단 탄막 원칙 준수).
export const ALLY_COMBOS = {
  // 어둠숲의 감시자 — 숲의 후각으로 몰이하는 협격: 단일 3연격 + 출혈.
  dark_warden: {
    id: 'ally_wildhunt', name: '숲의 사냥', cost: BOND_STRIKE_COST,
    base: { physical: true, target: 'one', power: 24, hits: 3, atkScale: 0.55, element: 'physical', inflict: 'bleed', inflictChance: 0.7, inflictTurns: 3 },
    fx: 'ally_wildhunt',
  },
  // 다리 파수꾼 — 사슬 끊긴 거상의 낙추: 단일 대강타 + 방어약화.
  bridge_warden: {
    id: 'ally_wardenslam', name: '파수꾼의 낙추', cost: BOND_STRIKE_COST,
    base: { physical: true, target: 'one', power: 42, element: 'earth', inflict: 'defdown', inflictChance: 0.8, inflictTurns: 2 },
    fx: 'ally_wardenslam',
  },
  // 봉인의 파수병 — 서약의 뇌창: 단일 관통 뇌전 + 감전.
  seal_guardian: {
    id: 'ally_sealspear', name: '서약의 뇌창', cost: BOND_STRIKE_COST,
    base: { physical: true, target: 'one', power: 30, element: 'thunder', pierce: true, inflict: 'shock', inflictChance: 0.5, inflictTurns: 2 },
    fx: 'ally_sealspear',
  },
  // 떨어진 별 — 해방된 별빛의 낙하: 전체 성속성 2연 폭발.
  fallen_star: {
    id: 'ally_starburst', name: '별빛 낙하', cost: BOND_STRIKE_COST,
    base: { physical: true, target: 'all', power: 16, hits: 2, atkScale: 0.7, element: 'holy' },
    fx: 'ally_starburst',
  },
  // 잿불 사냥개 — 우리에서 풀려난 질주: 단일 2연 돌진 + 화상.
  ember_hound: {
    id: 'ally_emberdash', name: '잿불 질주', cost: BOND_STRIKE_COST,
    base: { physical: true, target: 'one', power: 24, hits: 2, atkScale: 0.65, element: 'fire', inflict: 'burn', inflictChance: 0.7, inflictTurns: 3 },
    fx: 'ally_emberdash',
  },
  // 자비로 살려낸 마녀 — 어둠의 저주를 퍼붓는 주술: 전체 암흑 폭발 + 약화.
  bog_witch: {
    id: 'ally_hexstorm', name: '저주의 폭풍', cost: BOND_STRIKE_COST,
    base: { physical: true, target: 'all', power: 20, element: 'dark', inflict: 'weaken', inflictChance: 0.6, inflictTurns: 2 },
    fx: 'ally_hexstorm',
  },
};

// Compose the rider `mod` from a pair's bond emotions. PURE — battleScene calls this
// and rides the result in on the action payload, so battle.js never reads bonds.
// Axis-exclusive poles mean Object.assign can't collide (dmgMult has one source).
export function bondMod(bonds, refA, refB) {
  const mod = {};
  const list = (bonds && bonds[bondKey(refA, refB)]) || [];
  for (const emo of list) {
    const rider = POLE_RIDER[emo];
    if (rider) Object.assign(mod, rider);
  }
  return mod;
}

// Mod for a combo with N partners. Duo (1 partner) = the pair's mod. Ults merge the
// actor↔each-partner mods, taking the MAX of each numeric rider (NOT product — bounds
// an ult's power so stacked bonds can't runaway-multiply) and OR-ing applyDefdown.
export function bondModForCombo(bonds, actorRef, partnerRefs) {
  if (partnerRefs.length === 1) return bondMod(bonds, actorRef, partnerRefs[0]);
  const out = {};
  for (const pr of partnerRefs) {
    const m = bondMod(bonds, actorRef, pr);
    if (m.dmgMult) out.dmgMult = Math.max(out.dmgMult || 1, m.dmgMult);
    if (m.shieldCasters) out.shieldCasters = Math.max(out.shieldCasters || 0, m.shieldCasters);
    if (m.healCasters) out.healCasters = Math.max(out.healCasters || 0, m.healCasters);
    if (m.lifesteal) out.lifesteal = Math.max(out.lifesteal || 0, m.lifesteal);
    if (m.applyDefdown) out.applyDefdown = true;
  }
  return out;
}

// Living hero refIds (≠ actor) that share a bond with the actor — the pool an ult
// draws its co-casters from (the actor is the nexus of the formation).
function bondedLivingPartners(state, bonds, actorRef) {
  return state.units
    .filter((u) => u.side === 'hero' && u.alive && u.refId !== actorRef
      && ((bonds && bonds[bondKey(actorRef, u.refId)]) || []).length > 0)
    .map((u) => u.refId);
}

// Can `actorRef` open a bond strike with `partnerRef` right now? Pure gate the 운명
// menu uses (so it's unit-testable instead of buried in Pixi): not already used this
// battle, enough FP, the pair has ≥1 bond emotion, and both are living hero units.
export function canBondStrike(state, bonds, fp, actorRef, partnerRef) {
  if (!state || state.bondStrikeUsed) return false;
  if ((fp || 0) < BOND_STRIKE_COST) return false;
  const list = (bonds && bonds[bondKey(actorRef, partnerRef)]) || [];
  if (!list.length) return false;
  const live = (ref) => state.units.some((u) => u.side === 'hero' && u.refId === ref && u.alive);
  return live(actorRef) && live(partnerRef);
}

// Every bond strike/ult the CURRENT actor can launch right now. Unified entry shape
// for the 운명 menu (duos AND ults):
//   { id, name, cost, base, fx, partnerRefs:[...], size }
// Only affordable + gated combos are returned (the menu lists them directly). size is
// the participant count (2 duo / 3 trio / 4 quad).
export function availableBondStrikes(state, bonds, fp, actorRef) {
  if (!state || state.bondStrikeUsed) return [];
  const out = [];
  // Duos — specific class pairs that include the actor.
  for (const key of Object.keys(BOND_SKILLS)) {
    const combo = BOND_SKILLS[key];
    if (!combo.pair.includes(actorRef)) continue;
    const partnerRef = combo.pair[0] === actorRef ? combo.pair[1] : combo.pair[0];
    if (canBondStrike(state, bonds, fp, actorRef, partnerRef)) {
      out.push({ id: combo.id, name: combo.name, cost: BOND_STRIKE_COST, base: combo.base, fx: combo.fx, partnerRefs: [partnerRef], size: 2 });
    }
  }
  // Ults — generic by size; actor must be bonded to ≥ size-1 living heroes + afford it.
  const partners = bondedLivingPartners(state, bonds, actorRef);
  for (const u of [BOND_ULTS.trio, BOND_ULTS.quad]) {
    if ((fp || 0) < u.cost || partners.length < u.size - 1) continue;
    out.push({ id: u.id, name: u.name, cost: u.cost, base: u.base, fx: u.fx, partnerRefs: partners.slice(0, u.size - 1), size: u.size });
  }
  // Ally combo — a real hero (not the ally itself) + the deployed monster ally.
  // 스토리 영입 5종은 종별 전용기(ALLY_COMBOS)를, 그 외는 generic 공생 연격을 낸다.
  const actorU = state.units.find((u) => u.refId === actorRef && u.alive && u.side === 'hero');
  const allyU = state.units.find((u) => u.side === 'hero' && u.alive && u.ally);
  if (allyU && actorU && !actorU.ally) {
    const combo = ALLY_COMBOS[allyU.refId] || ALLY_COMBO;
    if ((fp || 0) >= combo.cost) {
      out.push({ id: combo.id, name: combo.name, cost: combo.cost, base: combo.base, fx: combo.fx, partnerRefs: [allyU.refId], size: 2 });
    }
  }
  return out;
}

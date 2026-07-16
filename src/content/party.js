// Party member definitions — DQ-style stats + per-class identity (reworked
// 2026-05-29 to the share3 4-class system). `sprite` is the base hero key; the
// renderer resolves direction + walk/attack frames. `learn` maps level → spellId
// gained on reaching that level. growth: per-level stat gains (progression.js).
//
// Class identities (the rework):
//   knight   — holy tank / SUPPORT: single + party heal, cleanse, barriers.
//   warrior  — MELEE / 분노(rage): physical strikes, debuff shouts, HP→rage.
//   huntress — physical RANGED / 암살: aimed/multi/pierce shots, 은신(stealth) crits.
//   mage     — arcane + ELEMENTAL caster (the elemental book moved here off the
//              huntress); 충전(charge) amplifies the next spell. Glass cannon.
//
// Balance: damage/ult spells with power ≥24 are POST-GAME learns (L17+, beyond the
// harness L16 ceiling) so they don't inflate the tuned boss ladder. Re-run
// `npm run balance` (3 passes) after touching learnsets / base stats.

export const PARTY_MEMBERS = {
  knight: {
    id: 'knight', name: '기사', sprite: 'knight',
    base: { maxHp: 42, maxMp: 10, atk: 10, def: 8, spd: 6 },
    // Growth trimmed ~20% (maxHp/atk/def) for a gentler level-up curve — spd/MP
    // kept (turn-order + magicScale tuning). Post-game bosses re-trimmed to match.
    growth: { maxHp: 4.8, maxMp: 1.5, atk: 1.6, def: 1.6, spd: 1 },
    // 심판의 빛(smite)은 L1 기본기 (2026-07-15) — 성기사 리더 솔로 스타트에서
    // 저렙 킷이 힐뿐이라 기본공격만 가능하던 문제. 공격 스킬 하나는 처음부터.
    spells: ['heal', 'smite'],
    learn: { 6: 'shield_wall', 9: 'masheal', 11: 'cleanse', 13: 'masscleanse', 15: 'masbarrier', 17: 'holy_nova', 19: 'divinewrath', 20: 'holyblade' },
  },
  warrior: {
    id: 'warrior', name: '전사', sprite: 'warrior',
    base: { maxHp: 38, maxMp: 6, atk: 14, def: 6, spd: 7 },
    growth: { maxHp: 5.6, maxMp: 1, atk: 2.4, def: 0.8, spd: 1 },
    spells: ['crushblow'],
    // 분노(rage)는 L15 습득 — 늪지(L15)부터 AI/하네스에 반영. crushblow는 L1 주력기.
    // quake(대지가르기) L10 — 지면강타 earth AoE로 중반 빈 레벨을 메움(balance 재측정 완료).
    learn: { 4: 'warcry', 6: 'sunder', 8: 'taunt', 10: 'quake', 11: 'whirlwind', 13: 'warroar', 15: 'bloodlust', 17: 'berserk' },
  },
  huntress: {
    id: 'huntress', name: '사냥꾼', sprite: 'huntress',
    base: { maxHp: 30, maxMp: 11, atk: 12, def: 4, spd: 12 },
    growth: { maxHp: 4.0, maxMp: 1.5, atk: 2.0, def: 0.8, spd: 2 },
    spells: ['aimedshot'],
    // 은신(stealth) L6 — 던전 보스(L7)부터 은신→치명 콤보가 AI/하네스에 반영.
    // Precision ranged / crit / affinity: single high-multiplier shots (aimedshot/piercing),
    // stealth→assassination combo, ONE AoE (arrowrain). Elemental affinity via weapons.
    learn: { 4: 'multishot', 6: 'stealth', 8: 'snaretrap', 10: 'piercingshot', 12: 'smokebomb', 14: 'arrowrain', 16: 'assassinate', 17: 'headshot', 18: 'venom_shot', 20: 'starfall' },
  },

  // Arcane + elemental caster (the elemental spellbook moved here off the
  // huntress). Deep mana = high magicScale (battle.js: spell power scales with
  // maxMp), so the mage's spells outgrow everyone's — paid for with the lowest
  // HP/def in the roster. 충전(charge, overcharge) amplifies the next spell ×1.5.
  // OPTIONAL recruit (not in STARTING_PARTY), so the tuned 3-hero kill-build
  // ladder is untouched — strong nukes (power≥24) still stay POST-GAME (L17+).
  mage: {
    id: 'mage', name: '마법사', sprite: 'mage',
    base: { maxHp: 26, maxMp: 22, atk: 8, def: 4, spd: 9 },
    growth: { maxHp: 3.2, maxMp: 3, atk: 1.2, def: 0.8, spd: 1.5 },
    spells: ['arcanebolt'],
    // Elemental coverage completed (2026-06-01): 대지(earth) quake fills the
    // last missing element, and 자장가(lullaby) gives an early single-target sleep CC.
    // All power<24 → still pre-L17, so the post-game nuke ladder + boss tuning hold
    // (mage is non-STARTING, so the 3-hero kill-build harness is untouched regardless).
    learn: {
      3: 'firebolt', 5: 'ice_lance', 6: 'lullaby', 7: 'arcaneblast',
      9: 'thunderclap', 11: 'firestorm', 12: 'quake',
      13: 'manashield', 14: 'haste', 15: 'blizzard', 16: 'overcharge',
      // Post-game nukes + elemental coverage (L17+) — past the balance harness ceiling.
      17: 'meteor', 18: 'masshaste', 20: 'cataclysm',
      22: 'venomcloud', 25: 'divinewrath', 26: 'meditate',
    },
  },

  // 쌍검사 (duelist) — fast glass-cannon gunslinger (총·폭탄·투척). Own kit now
  // (2026-05-30): multi-hit spray + bombs/bleed-burn burst. Role: melee risk / DoT
  // stacking. Sprays (quickdraw/rend/shurikenflurry multi-hit + bleed focus), AoEs
  // (fragbomb/buckshot/fanfire with burn/bleed), finisher (executioner, bonus vs
  // low-HP). High atk/spd, thin def/HP/MP → punished by tanking. NOT in STARTING_PARTY,
  // but reachable: pick as leader in CharacterSelect OR recruit via the bounty-hunter
  // NPC in town (11,5). Damage is physical (atk-scaled); element only drives affinity.
  duelist: {
    id: 'duelist', name: '쌍검사', sprite: 'duelist',
    base: { maxHp: 24, maxMp: 18, atk: 13, def: 4, spd: 13 },
    growth: { maxHp: 3.5, maxMp: 2, atk: 2, def: 0.8, spd: 2 },
    spells: ['quickdraw'],
    // 팬파이어/처형탄 L19/L23 — post-game growth parity with the other classes
    // (별무덤 L21 ~ 공허 L35 구간). Off the harness ladder (duelist non-sim).
    // headshot(단일 정밀 저격)는 사냥꾼 정체성으로 이관 — 쌍검사는 다단·탄막·출혈에 집중.
    learn: { 3: 'rend', 5: 'shurikenflurry', 7: 'smokegrenade', 9: 'fragbomb', 11: 'buckshot', 13: 'fanfire', 16: 'fullburst', 19: 'executioner', 23: 'venomcloud' },
  },
};

// The default starting party for the vertical slice.
export const STARTING_PARTY = ['knight', 'warrior', 'huntress'];

export function getMember(id) {
  return PARTY_MEMBERS[id] || null;
}

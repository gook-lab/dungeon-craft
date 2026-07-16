// Spell / skill definitions. Pure data — systems/battle.js resolveAction reads these.
//
// kind: 'damage' | 'heal' | 'mana' | 'buff' | 'ailment' | 'cure' | 'state'
// target: 'one' | 'allEnemies' | 'self' | 'oneAlly' | 'allAllies'
// power: damage/heal amount, buff multiplier (0.3 = +30% atk) or flat (def/spd/shield).
// element: 'fire'|'ice'|'thunder'|'holy'|'poison'|'wind'|'dark'|'earth'|'arcane'|'physical'
//   — drives elemental affinity (battle.js elementMultiplier): 신성→undead ×1.25,
//     화염↔냉기 mutual ×1.25 (and resisted ×0.8 same-element). 'arcane'/'physical'
//     are neutral (×1). Damage spells only.
// inflict/inflictChance/inflictTurns: thematic ailment applied on hit (if target
//   survives): 화염→burn, 냉기→freeze, 뇌전→shock, 독→poison, plus the new physical
//   debuffs atkdown(약화 변형)/defdown(방어 파괴)/slow(둔화).
//
// --- DAMAGE-SKILL extras (the class rework — 2026-05-29) ---------------------
// physical: true → atk-scaled (respects target def) instead of magic (maxMp-scaled,
//   ignores def). Warrior + huntress skills are physical; mage spells stay magic.
// melee:    true → benefits from the warrior 분노(rage) bonus (+dmg, lifesteal).
// hits:     N    → strikes N times (multishot) — each hit rolls variance/crit.
// pierce:   true → ignores target def (piercingshot).
// critBonus: 0..1 → added crit chance (×1.8 dmg). 은신(stealth) forces a crit.
//
// --- STATE skills (consumable / timed combat states) ------------------------
// kind:'state' enters a state on the caster, resolved purely in battle.js:
//   state:'stealth' (hunter) — next damaging skill is a guaranteed crit; grants
//     dodge until the hunter next acts. Consumed on use.
//   state:'rage' (warrior, via hpCost) — `turns` turns of melee +30% dmg + lifesteal.
//   state:'charge' (mage) — next spell is amplified ×1.5. Consumed on use.
// hpCost: fraction of maxHp paid to enter the state (bloodlust 0.15).

export const SPELLS = {
  // ===== Knight — holy / support =====
  heal: { id: 'heal', name: '치유', mpCost: 3, kind: 'heal', power: 16, target: 'oneAlly' },
  smite: { id: 'smite', name: '심판의 빛', mpCost: 4, kind: 'damage', power: 13, target: 'one', element: 'holy' },
  holy_nova: { id: 'holy_nova', name: '성스러운 빛', mpCost: 8, kind: 'heal', power: 18, target: 'allAllies' },
  shield_wall: { id: 'shield_wall', name: '방벽', mpCost: 6, kind: 'buff', stat: 'def', power: 6, target: 'allAllies' },
  cleanse: { id: 'cleanse', name: '정화', mpCost: 4, kind: 'cure', target: 'oneAlly' },
  // Support expansion (ported from share3 knight kit).
  masheal: { id: 'masheal', name: '전체 치유', mpCost: 10, kind: 'heal', power: 16, target: 'allAllies' },
  masscleanse: { id: 'masscleanse', name: '전체 정화', mpCost: 8, kind: 'cure', target: 'allAllies' },
  masbarrier: { id: 'masbarrier', name: '전체 방어막', mpCost: 9, kind: 'buff', stat: 'shield', power: 20, target: 'allAllies' },
  divinewrath: { id: 'divinewrath', name: '천벌', mpCost: 11, kind: 'damage', power: 13, target: 'allEnemies', element: 'holy' },
  holyblade: { id: 'holyblade', name: '성검 강타', mpCost: 12, kind: 'damage', power: 26, target: 'one', element: 'holy', ult: true }, // knight ult

  // ===== Warrior — melee / rage / debuff (physical) =====
  warcry: { id: 'warcry', name: '전투의 함성', mpCost: 4, kind: 'buff', stat: 'atk', power: 0.35, target: 'self' },
  crushblow: { id: 'crushblow', name: '분쇄 강타', mpCost: 2, kind: 'damage', power: 14, target: 'one', element: 'physical', physical: true, melee: true },
  whirlwind: { id: 'whirlwind', name: '회전베기', mpCost: 5, kind: 'damage', power: 10, target: 'allEnemies', element: 'physical', physical: true, melee: true },
  warroar: { id: 'warroar', name: '위협의 포효', mpCost: 3, kind: 'ailment', status: 'atkdown', turns: 3, target: 'allEnemies' },
  sunder: { id: 'sunder', name: '갑옷 파괴', mpCost: 3, kind: 'damage', power: 9, target: 'one', element: 'physical', physical: true, melee: true, inflict: 'defdown', inflictChance: 0.9, inflictTurns: 3 },
  taunt: { id: 'taunt', name: '도발', mpCost: 2, kind: 'buff', stat: 'def', power: 6, target: 'self', aggro: true },
  bloodlust: { id: 'bloodlust', name: '피의 갈증', mpCost: 0, hpCost: 0.15, kind: 'state', state: 'rage', turns: 3, target: 'self' },
  berserk: { id: 'berserk', name: '무쌍난무', mpCost: 10, kind: 'damage', power: 24, target: 'one', element: 'physical', physical: true, melee: true, ult: true }, // warrior ult

  // ===== Huntress — physical ranged / assassination =====
  stealth: { id: 'stealth', name: '은신', mpCost: 3, kind: 'state', state: 'stealth', target: 'self' },
  aimedshot: { id: 'aimedshot', name: '정조준', mpCost: 3, kind: 'damage', power: 16, target: 'one', element: 'physical', physical: true, critBonus: 0.5 },
  multishot: { id: 'multishot', name: '연사', mpCost: 4, kind: 'damage', power: 4, hits: 5, atkScale: 0.4, target: 'one', element: 'physical', physical: true, critBonus: 0.3 }, // 사냥꾼 다단 = 크리 연동(정밀 정체성)
  piercingshot: { id: 'piercingshot', name: '관통 사격', mpCost: 5, kind: 'damage', power: 18, target: 'one', element: 'physical', physical: true, pierce: true },
  // 그림자 일격 — only usable from 은신(stealth): the assassination finisher lands
  // the stealth crit (×1.8). requiresStealth gates it in the resolver + battle UI
  // (greyed unless cloaked) + the balance harness's spell picker.
  assassinate: { id: 'assassinate', name: '그림자 일격', mpCost: 6, kind: 'damage', power: 26, target: 'one', element: 'physical', physical: true, requiresStealth: true },
  snaretrap: { id: 'snaretrap', name: '강철 덫', mpCost: 4, kind: 'damage', power: 8, target: 'one', element: 'physical', physical: true, inflict: 'slow', inflictChance: 0.9, inflictTurns: 2 },
  smokebomb: { id: 'smokebomb', name: '연막탄', mpCost: 3, kind: 'buff', stat: 'eva', power: 2, target: 'self', debuffEnemyAcc: true },
  arrowrain: { id: 'arrowrain', name: '화살비', mpCost: 7, kind: 'damage', power: 9, target: 'allEnemies', element: 'physical', physical: true, inflict: 'weaken', inflictChance: 0.4, inflictTurns: 2 },
  venom_shot: { id: 'venom_shot', name: '독화살', mpCost: 5, kind: 'damage', power: 10, target: 'one', element: 'poison', physical: true, inflict: 'poison', inflictChance: 0.7, inflictTurns: 3 },
  starfall: { id: 'starfall', name: '별빛 연사', mpCost: 10, kind: 'damage', power: 25, target: 'one', element: 'physical', physical: true, ult: true }, // huntress ult

  // ===== Duelist — fast glass-cannon gunslinger (총·폭탄·투척; physical, atk-scaled).
  // Multi-hit shooters carry atkScale so N hits ≈ one strong shot (like 연사). 출혈
  // (bleed) is the duelist's signature physical DoT; fragbomb spreads 화상(burn). =====
  quickdraw: { id: 'quickdraw', name: '쾌속 사격', mpCost: 3, kind: 'damage', power: 7, hits: 4, atkScale: 0.5, target: 'one', element: 'physical', physical: true, inflict: 'bleed', inflictChance: 0.4, inflictTurns: 2 }, // 쌍검사 다단 = 출혈 스택(근접 리스크 정체성)
  rend: { id: 'rend', name: '난자', mpCost: 4, kind: 'damage', power: 9, hits: 3, atkScale: 0.5, target: 'one', element: 'physical', physical: true, inflict: 'bleed', inflictChance: 0.8, inflictTurns: 3 },
  shurikenflurry: { id: 'shurikenflurry', name: '표창 난사', mpCost: 4, kind: 'damage', power: 6, hits: 5, atkScale: 0.4, target: 'one', element: 'physical', physical: true },
  smokegrenade: { id: 'smokegrenade', name: '연막 수류탄', mpCost: 3, kind: 'buff', stat: 'eva', power: 0.4, target: 'self', debuffEnemyAcc: true },
  fragbomb: { id: 'fragbomb', name: '작약탄', mpCost: 6, kind: 'damage', power: 14, target: 'allEnemies', element: 'fire', physical: true, inflict: 'burn', inflictChance: 0.6, inflictTurns: 3 },
  buckshot: { id: 'buckshot', name: '산탄', mpCost: 5, kind: 'damage', power: 11, target: 'allEnemies', element: 'physical', physical: true, inflict: 'bleed', inflictChance: 0.5, inflictTurns: 2 },
  headshot: { id: 'headshot', name: '헤드샷', mpCost: 4, kind: 'damage', power: 22, target: 'one', element: 'physical', physical: true, critBonus: 0.4 },
  fullburst: { id: 'fullburst', name: '풀버스트', mpCost: 12, kind: 'damage', power: 18, hits: 3, atkScale: 0.85, target: 'allEnemies', element: 'fire', physical: true, inflict: 'burn', inflictChance: 0.7, inflictTurns: 3, ult: true }, // duelist ult — 다단 탄막(hits) so it out-damages the cheap multi-hit basics; cutscene via ult:true
  // Post-game learns (L17+, past the harness ladder — duelist is off the tuned
  // 3-hero sim anyway). 팬파이어 = buckshot의 상위 전체 연사(다단 탄막 + 출혈),
  // 처형탄 = headshot의 상위 단일 처형(고크리 + 관통).
  fanfire: { id: 'fanfire', name: '팬파이어', mpCost: 9, kind: 'damage', power: 12, hits: 3, atkScale: 0.6, target: 'allEnemies', element: 'physical', physical: true, inflict: 'bleed', inflictChance: 0.5, inflictTurns: 2 },
  executioner: { id: 'executioner', name: '처형탄', mpCost: 9, kind: 'damage', power: 28, target: 'one', element: 'physical', physical: true, pierce: true, critBonus: 0.6 },

  // ===== Mage — arcane / elemental (magic; scales with maxMp) =====
  arcanebolt: { id: 'arcanebolt', name: '비전 화살', mpCost: 3, kind: 'damage', power: 11, target: 'one', element: 'arcane' },
  arcaneblast: { id: 'arcaneblast', name: '비전 작렬', mpCost: 6, kind: 'damage', power: 16, target: 'one', element: 'arcane' },
  manashield: { id: 'manashield', name: '마나 방패', mpCost: 5, kind: 'buff', stat: 'shield', power: 18, target: 'self' },
  meditate: { id: 'meditate', name: '명상', mpCost: 2, kind: 'mana', power: 0.4, target: 'self' },
  haste: { id: 'haste', name: '가속', mpCost: 4, kind: 'buff', stat: 'spd', power: 4, target: 'oneAlly' },
  overcharge: { id: 'overcharge', name: '마력 충전', mpCost: 4, kind: 'state', state: 'charge', target: 'self' },
  masshaste: { id: 'masshaste', name: '신속 강화', mpCost: 9, kind: 'buff', stat: 'spd', power: 4, target: 'allAllies' },
  cataclysm: { id: 'cataclysm', name: '대재앙', mpCost: 14, kind: 'damage', power: 28, target: 'one', element: 'arcane' },

  // Elemental spellbook (single-target + AoE) — moved off huntress onto the mage.
  firebolt: { id: 'firebolt', name: '화염 화살', mpCost: 3, kind: 'damage', power: 11, target: 'one', element: 'fire', inflict: 'burn', inflictChance: 0.5, inflictTurns: 3 },
  ice_lance: { id: 'ice_lance', name: '얼음 창', mpCost: 5, kind: 'damage', power: 16, target: 'one', element: 'ice', inflict: 'freeze', inflictChance: 0.7, inflictTurns: 2 },
  firestorm: { id: 'firestorm', name: '화염 폭풍', mpCost: 7, kind: 'damage', power: 9, target: 'allEnemies', element: 'fire', inflict: 'burn', inflictChance: 0.35, inflictTurns: 3 },
  thunderclap: { id: 'thunderclap', name: '뇌격', mpCost: 8, kind: 'damage', power: 12, target: 'allEnemies', element: 'thunder', inflict: 'shock', inflictChance: 0.35, inflictTurns: 3 },
  blizzard: { id: 'blizzard', name: '눈보라', mpCost: 9, kind: 'damage', power: 11, target: 'allEnemies', element: 'ice', inflict: 'freeze', inflictChance: 0.6, inflictTurns: 2 },
  venomcloud: { id: 'venomcloud', name: '독무', mpCost: 8, kind: 'damage', power: 7, target: 'allEnemies', element: 'poison', inflict: 'poison', inflictChance: 0.6, inflictTurns: 3 },
  // darkmist는 마법사 학습셋엔 없지만 dark_acolyte/necromancer 영입기(joinSkill)로 살아있음 — 유지.
  darkmist: { id: 'darkmist', name: '암흑 안개', mpCost: 9, kind: 'damage', power: 10, target: 'allEnemies', element: 'dark', inflict: 'weaken', inflictChance: 0.6, inflictTurns: 2 },
  // 늪의 마녀 영입 전용 스킬(joinSkill) — 어둠+독 저주. 자비 루트의 '파티 빌드 실변화'.
  witch_hex: { id: 'witch_hex', name: '마녀의 저주', mpCost: 5, kind: 'damage', power: 14, target: 'one', element: 'dark', inflict: 'poison', inflictChance: 0.6, inflictTurns: 3 },
  quake: { id: 'quake', name: '대지분쇄', mpCost: 9, kind: 'damage', power: 14, target: 'allEnemies', element: 'earth', inflict: 'weaken', inflictChance: 0.4, inflictTurns: 2 },
  lullaby: { id: 'lullaby', name: '자장가', mpCost: 5, kind: 'ailment', status: 'sleep', turns: 3, target: 'one' },
  meteor: { id: 'meteor', name: '메테오', mpCost: 12, kind: 'damage', power: 30, target: 'one', element: 'fire', inflict: 'burn', inflictChance: 0.7, inflictTurns: 3, ult: true },
};

export function getSpell(id) {
  return SPELLS[id] || null;
}

// Artifact system — collectible, non-sellable relics equipped in per-character
// slots (grow by level). PURE data + helpers; the resolver reads the merged
// passive/mod stack (same shape as items.equipPassives), so artifacts are just
// "another passive source" folded at buildHeroUnit — no new resolver branches
// beyond the shared damage-condition mults (weaknessDmg/hpBelow50) and survive1hp.
//
// Schema per artifact:
//   { id, name, rarity:'common'|'rare'|'legend', cat:'지속'|'공격'|'생존'|'자원'|'카르마',
//     affinity: classId|null,  // === unit.refId → effect ×AFFINITY_MUL (1.25)
//     source,                  // human-readable acquisition point (coverage-guarded)
//     mods?:  { spd?, atk?, def?, maxHp?, maxMp? },   // flat stat bonuses (equipBonus-style)
//     passive?: { crit?, lifesteal?, weaknessDmg?, hpBelow50?, execute?, dmgReduce?,
//                 survive1hp?, spellDmg?, spellMpCut? },  // combat passives
//     trigger?: { hpRegenEnd?, mpRegenEnd?, goldBonus?, fpGain?, recruitBonus? } } // scene-side
//
// TRIGGER MAP (where each fires):
//   passive.crit/lifesteal/execute/dmgReduce → merged into unit.passives (battle.js hooks)
//   passive.weaknessDmg  → physicalDamage/skillDamage/magicDamage, applied AFTER affinity when ▲
//   passive.hpBelow50    → same fns, when attacker.hp ≤ 50%
//   passive.survive1hp   → sets unit.lastStand at battle start (dealDamage already honours it)
//   passive.spellDmg/spellMpCut → magicDamage mult / spell MP floor (mage)
//   trigger.hpRegenEnd/mpRegenEnd → endBattle victory settle (scene)
//   trigger.goldBonus/fpGain/recruitBonus → endBattle / mercy (scene/main)

export const ART_AFFINITY_MUL = 1.25; // artifact.affinity === unit.refId → 그 효과 ×1.25
export const SET_BONUS_2 = 1.2;       // 같은 cat 2개 → 해당 계열 효과 ×1.2
export const SET_BONUS_3 = 1.4;       // 3개 전부 동일 cat → ×1.4

export const ARTIFACTS = {
  // --- 지속 (common/economy) ---
  rearward:    { id: 'rearward', name: '후열의 부적', rarity: 'common', cat: '지속', affinity: null, source: '마을 상자', trigger: { hpRegenEnd: 0.05 } },
  manashard:   { id: 'manashard', name: '마나석 조각', rarity: 'common', cat: '지속', affinity: null, source: '마을 상자', trigger: { mpRegenEnd: 3 } },
  lifedrink:   { id: 'lifedrink', name: '흡정의 목걸이', rarity: 'rare', cat: '지속', affinity: null, source: '항구 상자', passive: { lifesteal: 0.10 } },
  // --- 자원 ---
  swiftfeather:{ id: 'swiftfeather', name: '신속의 깃털', rarity: 'common', cat: '자원', affinity: null, source: '어둠숲 상자', mods: { spd: 4 } },
  fatestone:   { id: 'fatestone', name: '운명석', rarity: 'legend', cat: '자원', affinity: null, source: '용암 상자', trigger: { fpGain: 0.25 } },
  // --- 공격 ---
  lens:        { id: 'lens', name: '정밀 렌즈', rarity: 'rare', cat: '공격', affinity: 'huntress', source: '설원 보상', passive: { crit: 0.12 } },
  catalyst:    { id: 'catalyst', name: '원소 촉매', rarity: 'rare', cat: '공격', affinity: 'mage', source: '늪 보상', passive: { weaknessDmg: 0.15 } },
  berserk_seal:{ id: 'berserk_seal', name: '광전사의 인장', rarity: 'rare', cat: '공격', affinity: 'warrior', source: '지하 묘지 상자', passive: { hpBelow50: 0.25 } },
  clawgrip:    { id: 'clawgrip', name: '연격의 발톱', rarity: 'rare', cat: '공격', affinity: 'duelist', source: '수로 상자', passive: { bleedChance: 0.20 } },
  sage_eye:    { id: 'sage_eye', name: '현자의 눈', rarity: 'legend', cat: '공격', affinity: 'mage', source: '황좌 상자', passive: { spellDmg: 0.18, spellMpCut: 1 } },
  // --- 생존 ---
  wardrune:    { id: 'wardrune', name: '수호룬', rarity: 'rare', cat: '생존', affinity: null, source: '제국 상자', passive: { dmgReduce: 0.10 } },
  unbroken:    { id: 'unbroken', name: '불굴의 문장', rarity: 'legend', cat: '생존', affinity: 'knight', source: '대성채 상자', passive: { survive1hp: true } },
  // --- 카르마 ---
  mercy_relic: { id: 'mercy_relic', name: '자비의 성물', rarity: 'rare', cat: '카르마', affinity: null, source: '자비 루트 보상', trigger: { recruitBonus: 0.15 } },
  brand:       { id: 'brand', name: '처단자의 낙인', rarity: 'rare', cat: '카르마', affinity: null, source: '처단 루트 보상', trigger: { goldBonus: 0.30 } },
};

export function getArtifact(id) { return ARTIFACTS[id] || null; }
export const ALL_ARTIFACT_IDS = Object.keys(ARTIFACTS);

// Merge two passive objects (gear + artifact) into one unified stack the resolver
// reads. Sums numeric keys, unions the `resist` map, ORs `survive1hp`. PURE.
export function mergePassives(a, b) {
  const out = { ...(a || {}) };
  out.resist = { ...(out.resist || {}) };
  for (const k in (b || {})) {
    if (k === 'resist') { for (const s in b.resist) out.resist[s] = (out.resist[s] || 0) + b.resist[s]; }
    else if (k === 'survive1hp') out.survive1hp = out.survive1hp || b[k];
    else out[k] = (out[k] || 0) + b[k];
  }
  return out;
}

// Per-character artifact slot count by level (grows: 1→8→16).
export function artifactSlotCount(level) {
  if (level >= 16) return 3;
  if (level >= 8) return 2;
  return 1;
}

// Set bonus multiplier for a cat given the equipped artifact list: 3 same → ×1.4,
// ≥2 same → ×1.2, else ×1. Returns a { [cat]: mult } map. PURE.
export function computeSetBonus(equippedIds) {
  const counts = {};
  for (const id of equippedIds) { const a = ARTIFACTS[id]; if (a) counts[a.cat] = (counts[a.cat] || 0) + 1; }
  const out = {};
  for (const cat in counts) out[cat] = counts[cat] >= 3 ? SET_BONUS_3 : counts[cat] >= 2 ? SET_BONUS_2 : 1;
  return out;
}

// Which passive keys belong to which cat (for set-bonus scaling — a set boosts
// only its category's effects). Damage-ish → 공격, survival → 생존, regen → 지속, etc.
const CAT_PASSIVE = {
  공격: ['crit', 'weaknessDmg', 'hpBelow50', 'execute', 'spellDmg'],
  생존: ['dmgReduce', 'survive1hp'],
  지속: ['lifesteal'],
  자원: [],
  카르마: [],
};

// Merge a character's equipped artifacts into a passive object (SAME shape as
// items.equipPassives so battle.js reads one unified stack) + a stat-mod object +
// scene-trigger totals. Applies class affinity (×1.25 when artifact.affinity===refId)
// and set bonus (per-cat ×1.2/1.4) to that cat's effects. PURE.
export function artifactPassives(equippedIds, refId) {
  const ids = (equippedIds || []).filter(Boolean);
  const setMul = computeSetBonus(ids);
  const passive = {}; const mods = {}; const trigger = {};
  for (const id of ids) {
    const a = ARTIFACTS[id];
    if (!a) continue;
    const affMul = a.affinity && a.affinity === refId ? ART_AFFINITY_MUL : 1;
    const catMul = setMul[a.cat] || 1;
    if (a.mods) for (const k in a.mods) mods[k] = (mods[k] || 0) + a.mods[k] * affMul; // set bonus not applied to raw stats
    if (a.passive) for (const k in a.passive) {
      if (k === 'survive1hp') { passive.survive1hp = passive.survive1hp || !!a.passive[k]; continue; }
      const scaled = (CAT_PASSIVE[a.cat] || []).includes(k) ? affMul * catMul : affMul;
      passive[k] = (passive[k] || 0) + a.passive[k] * scaled;
    }
    if (a.trigger) for (const k in a.trigger) trigger[k] = (trigger[k] || 0) + a.trigger[k] * affMul;
  }
  return { passive, mods, trigger };
}

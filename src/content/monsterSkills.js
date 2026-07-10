// Monster skills — the enemy-side counterpart to the heroes' spells.js. Kept
// SEPARATE from spells.js because monster damage is atk-scaled (physicalDamage),
// never maxMp magic, and targets are caster-relative ('one'/'all' = the opposing
// side, 'self' = the caster). Resolved by `resolveMonsterSkill` in battle.js;
// the resolver stays PURE. FX choreographies live in fx/spellFx.js (DEFS[id],
// ported from share4/js/spellfx-monster.js); ids match 1:1.
//
// Fields:
//   kind: 'damage' | 'drain' | 'ailment' | 'selfbuff' | 'selfheal'
//   target: 'one' | 'all' | 'self'   (caster-relative)
//   dmgMult: weight on the caster's atk-scaled damage (AoE < 1 so it doesn't
//            one-shot the party; single-target ≥ 1). Default 1.
//   pierce:  fraction of the target's def ignored (0..1).
//   element: tag for affinity (fire/ice/holy matter) + FX colour.
//   inflict / inflictChance / inflictTurns: status applied on a damage hit.
//   healPct: drain → fraction of damage healed; selfheal → fraction of maxHp.
//   atkMult / spdBonus: selfbuff stat changes (one-shot, gate with `max:1` on
//            the monster's skill entry).
//
// summon (사령 소환) is DEFERRED to a later pass — it mutates state.units mid-
// battle (spoils/mercy/recruit invariants + renderer sprite spawn). Defined here
// for reference but intentionally NOT placed in any monster's skill pool yet.

export const MONSTER_SKILLS = {
  firebreath:  { id: 'firebreath',  name: '화염 브레스', kind: 'damage',  target: 'all', dmgMult: 0.55, element: 'fire',   inflict: 'burn',   inflictChance: 0.4, inflictTurns: 3 },
  venomspit:   { id: 'venomspit',   name: '맹독 분사',   kind: 'damage',  target: 'one', dmgMult: 0.85, element: 'poison', inflict: 'poison', inflictChance: 0.7, inflictTurns: 3 },
  monslam:     { id: 'monslam',     name: '대지 강타',   kind: 'damage',  target: 'one', dmgMult: 1.15, pierce: 0.5, element: 'earth' },
  lifedrain:   { id: 'lifedrain',   name: '영혼 흡수',   kind: 'drain',   target: 'one', dmgMult: 0.9,  element: 'dark', healPct: 0.6 },
  frostbreath: { id: 'frostbreath', name: '결빙 숨결',   kind: 'damage',  target: 'one', dmgMult: 0.8,  element: 'ice',    inflict: 'freeze', inflictChance: 0.5, inflictTurns: 2 },
  monshock:    { id: 'monshock',    name: '감전',        kind: 'ailment', target: 'one', status: 'shock',  turns: 2, element: 'thunder' },
  curse:       { id: 'curse',       name: '저주',        kind: 'ailment', target: 'all', status: 'weaken', turns: 3, element: 'dark' },
  frenzy:      { id: 'frenzy',      name: '광폭화',      kind: 'selfbuff', target: 'self', atkMult: 1.3, spdBonus: 4, element: 'physical' },
  monregen:    { id: 'monregen',    name: '재생',        kind: 'selfheal', target: 'self', healPct: 0.18, element: 'holy' },

  // --- Behaviour-archetype kit (ported from game's enemyAbilities, adapted to
  //     turn-based). summon stays deferred (see below); these three don't touch
  //     the spoils/recruit invariants. ---
  // 자폭 (kamikaze, powder_skeleton/bog_zombie/lava_slug): big AoE blast, then the
  // caster dies — a glass-cannon trade. kind 'selfdestruct' handled in battle.js.
  kamikaze:    { id: 'kamikaze',    name: '자폭',        kind: 'selfdestruct', target: 'all', dmgMult: 1.1, pierce: 0.3, element: 'fire' },
  // 전열 고무 (buffer, war_drummer/elite): rallies the whole enemy line — every
  // living ally gets an atk/spd surge. kind 'allybuff' targets the caster's side.
  warcry:      { id: 'warcry',      name: '전열 고무',   kind: 'allybuff', target: 'allies', atkMult: 1.25, spdBonus: 2, element: 'physical' },
  // 룬 보호막 (shielded, rune_guardian/wraith_lich): grants an absorb shield to
  // self + allies (soaked first in dealDamage). kind 'guard'.
  barrier:     { id: 'barrier',     name: '룬 보호막',   kind: 'guard', target: 'allies', shieldPct: 0.3, element: 'holy' },

  // --- Bestiary-2 확장 키트 (2026-05-30, ported from share4 spellfx-monster2) ---
  // Damage stays atk-scaled (dmgMult), NEVER flat power — the spec's `power` is
  // translated to weights so these land on the same tuned ladder as the originals.
  // New resolver fields: hits (multi-strike), highCrit (CRIT_MULT chance), defMult
  // (selfbuff def), and `chance` on ailments (partial-land; omit = always).
  voidblast:   { id: 'voidblast',   name: '공허 폭발',   kind: 'damage',  target: 'all', dmgMult: 0.6,  element: 'dark' },
  shadowbolt:  { id: 'shadowbolt',  name: '그림자 화살', kind: 'damage',  target: 'one', dmgMult: 0.95, element: 'dark' },
  petrify:     { id: 'petrify',     name: '석화',        kind: 'ailment', target: 'one', status: 'petrify', turns: 2, chance: 0.7, element: 'earth' },
  webshot:     { id: 'webshot',     name: '거미줄',      kind: 'ailment', target: 'one', status: 'slow',    turns: 3, element: 'physical' },
  screech:     { id: 'screech',     name: '음파 비명',   kind: 'ailment', target: 'all', status: 'blind',   turns: 2, element: 'physical' },
  tonguelash:  { id: 'tonguelash',  name: '혀 채찍',     kind: 'damage',  target: 'one', dmgMult: 0.8,  element: 'physical', inflict: 'stun', inflictChance: 0.6, inflictTurns: 1 },
  wardrum:     { id: 'wardrum',     name: '전열 고무',   kind: 'allybuff', target: 'allies', atkMult: 1.3, spdBonus: 3, element: 'physical' },
  stoneskin:   { id: 'stoneskin',   name: '석화 방벽',   kind: 'selfbuff', target: 'self', defMult: 1.5, element: 'earth' },
  flurry:      { id: 'flurry',      name: '연속 할퀴기', kind: 'damage',  target: 'one', dmgMult: 0.45, hits: 3, element: 'physical' },
  divebomb:    { id: 'divebomb',    name: '급강하',      kind: 'damage',  target: 'one', dmgMult: 1.0,  highCrit: true, element: 'wind' },
  eruption:    { id: 'eruption',    name: '용암 분출',   kind: 'damage',  target: 'all', dmgMult: 0.6,  element: 'fire', inflict: 'burn', inflictChance: 0.5, inflictTurns: 3 },

  // 사령 소환 (necromancer): raises `count` minions onto the enemy line. kind
  // 'summon' (battle.js): summoned units grant NO xp/gold, are unspareable/
  // unrecruitable, and aren't tallied as slain — so they can't be farmed and never
  // pollute the mercy/slain ending ratio, yet still COUNT for victory. ALWAYS gate
  // with `max` on the monster's skill entry (무한 소환 → 난이도 폭주). `fieldCap`
  // caps the board size. Re-run `npm run balance` after touching this.
  summon:      { id: 'summon',      name: '사령 소환',   kind: 'summon',  spawn: 'walker', count: 2, fieldCap: 8 },
  // 거미 산란 (brood_mother): the spider-queen variant of summon — raises spiders
  // instead of skeletons. Same summon invariants (no xp/mercy/slain; gate with max).
  broodspawn:  { id: 'broodspawn',  name: '거미 산란',   kind: 'summon',  spawn: 'spider', count: 2, fieldCap: 8 },
};

export function getMonsterSkill(id) {
  return MONSTER_SKILLS[id] || null;
}

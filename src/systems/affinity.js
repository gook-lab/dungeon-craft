// Elemental affinity — a damage spell's `element` (spells.js) vs the target's
// `family` tag (monsters.js: undead/icy/fiery/void/…). Single source of truth,
// shared by BOTH the pure resolver (battle.elementMultiplier) and the battle UI
// (the skill-info panel's 상성 badge), so the number you preview is the number
// you deal.
//
// DELIBERATELY MILD — STRONG ×1.25 / RESIST ×0.8 (not the classic ×2/×0.5), so it
// nudges spell choice without trivializing fights or hard-walling a caster (see
// CLAUDE.md). Bump these if you want elements to bite harder — then re-run
// `npm run balance` (the harness reads this via elementMultiplier).

export const AFFINITY_STRONG = 1.25;
export const AFFINITY_RESIST = 0.8;

// Per-element: families it hits HARD (strong → more dmg) and families that shrug
// it off (resist → less dmg). Untagged / neutral elements (thunder/earth/wind/
// arcane/physical) and untagged targets are ×1.
export const AFFINITY = {
  fire: { strong: ['icy'], resist: ['fiery', 'fire'] },          // 화염: 얼음 특효, 불 계열 반감
  ice: { strong: ['fiery', 'fire'], resist: ['icy'] },           // 냉기: 불 특효, 얼음 반감
  holy: { strong: ['undead', 'void'], resist: [] },              // 신성: 언데드·공허 특효
  poison: { strong: [], resist: ['undead', 'void'] },            // 독: 언데드·공허에 잘 안 먹힘
  dark: { strong: ['void'], resist: [] },                        // 암흑: 공허 특효
  thunder: { strong: [], resist: [] },
  earth: { strong: [], resist: [] },
  wind: { strong: [], resist: [] },
  arcane: { strong: [], resist: [] },
  physical: { strong: [], resist: [] },
};

// Damage multiplier for `element` vs a target `family`. Pure.
export function affinityMult(element, family) {
  if (!element || !family) return 1;
  const a = AFFINITY[element];
  if (!a) return 1;
  if (a.strong.includes(family)) return AFFINITY_STRONG;
  if (a.resist.includes(family)) return AFFINITY_RESIST;
  return 1;
}

// 'strong' | 'resist' | 'neutral' — drives the UI 상성 badge (▲약점 / ▼반감 / ●보통).
export function affinityKind(element, family) {
  const m = affinityMult(element, family);
  return m > 1 ? 'strong' : m < 1 ? 'resist' : 'neutral';
}

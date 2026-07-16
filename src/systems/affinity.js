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
// it off (resist → less dmg). `arcane`/`physical` stay neutral (×1); untagged
// targets are ×1. Families (monsters.js): undead/icy/fiery/fire/void (elemental)
// + rocky(석·구조물)/metal(기갑)/aerial(공중)/beast(야수) — the physical-element
// activation layer so 대지/뇌전/바람 무기가 실제 약점을 노린다(shared with mage
// 원소 주문). 스토리 보스(bog_witch/dark_warden 등)는 무태깅=중립 유지.
export const AFFINITY = {
  fire: { strong: ['icy'], resist: ['fiery', 'fire'] },          // 화염: 얼음 특효, 불 계열 반감
  ice: { strong: ['fiery', 'fire'], resist: ['icy'] },           // 냉기: 불 특효, 얼음 반감
  holy: { strong: ['undead', 'void'], resist: [] },              // 신성: 언데드·공허 특효
  poison: { strong: [], resist: ['undead', 'void'] },            // 독: 언데드·공허에 잘 안 먹힘
  dark: { strong: ['void'], resist: [] },                        // 암흑: 공허 특효
  thunder: { strong: ['metal', 'aerial'], resist: ['rocky'] },   // 뇌전: 금속갑·공중(낙뢰) 특효, 바위/구조물엔 접지 반감
  earth: { strong: ['rocky'], resist: ['aerial'] },              // 대지: 석·구조물 특효, 공중은 회피(반감)
  wind: { strong: ['beast'], resist: ['rocky'] },                // 바람: 야수 특효, 석·구조물엔 반감
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

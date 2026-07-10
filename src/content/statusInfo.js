// Status-ailment display data — single source for Korean names + one-line effect
// descriptions, shared by the battle spell tooltip and the field-menu glossary so
// the player can learn what each icon means. PURE data; effects mirror battle.js
// (poison/burn DoT, sleep/shock/petrify/stun skip-turn family, freeze/slow speed,
// weaken/atkdown/defdown stat debuffs, blind miss-chance).

export const STATUS_KR = {
  poison: '독', sleep: '수면', weaken: '약화', burn: '화상', shock: '감전', freeze: '동상',
  atkdown: '위협', defdown: '방어약화', slow: '둔화', petrify: '석화', stun: '기절', blind: '실명',
  bleed: '출혈',
};

export const STATUS_DESC = {
  poison: '매 턴 HP가 깎인다 (지속 피해)',
  burn: '매 턴 HP가 깎인다 (화염 지속 피해)',
  bleed: '매 턴 HP가 깎인다 (물리 출혈 — 언데드 면역)',
  sleep: '행동 불가 — 피격하면 깨어난다',
  shock: '일정 확률로 턴을 잃는다 (마비)',
  freeze: '행동 순서·공격력 하락 (동상)',
  weaken: '공격력 30% 감소',
  atkdown: '공격력 20% 감소 (위협)',
  defdown: '방어력 40% 감소 (갑옷 파괴)',
  slow: '행동 순서가 느려진다',
  petrify: '행동 불가 (석화)',
  stun: '행동 불가 (기절, 짧게)',
  blind: '50% 확률로 공격이 빗나간다',
};

// Display order for the glossary (DoT → skip-turn → speed → stat debuffs).
export const STATUS_ORDER = ['poison', 'burn', 'bleed', 'sleep', 'shock', 'freeze', 'slow', 'weaken', 'atkdown', 'defdown', 'petrify', 'stun', 'blind'];

export function statusDesc(id) { return STATUS_DESC[id] || ''; }

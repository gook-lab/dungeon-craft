// 동료별 후일담 (게임 엔딩 후 동료들의 짧은 묘사)
// 리더(파티[0])의 엔딩 후 각 동료별로 1~2줄 후일담.
// 분기: 엔딩 톤 × 유대(높음/보통/낮음) × 자비 성향(긍정 유대 유무).
// PURE — main.js와 menuScene이 호출해 후일담을 렌더.

import { bondStrength, pairsFor } from '../systems/bonds.js';

// 동료별 엔딩 후 후일담 데이터
// 구조: { refId: { tone: { bondLevel: { positive: string, negative: string } } } }
// tone: 'merciful' | 'ruthless' | 'mixed' | 'true'
// bondLevel: 'high' (3+) | 'medium' (1-2) | 'low' (0)
// positive/negative: bondPolarity 또는 bonds의 감정 분포에 따라 선택
export const ALLY_EPILOGUES = {
  // 어둠숲의 감시자 — 숲지기로서의 관찰자 정체성
  dark_warden: {
    merciful: {
      high: { positive: '그는 당신의 뒤편 나무 위에 앉아, 환해진 숲을 지켜본다.', negative: '그는 당신의 뒤편 나무 위에 앉아, 여전히 조용한 숲을 지켜본다.' },
      medium: { positive: '숲의 감시자는 검을 거두고, 흙에서 자라난 새 나뭇가지 위에 선다.', negative: '숲의 감시자는 검을 거두고, 다시 그림자가 되기로 한다.' },
      low: { positive: '어둠숲의 감시자는 당신을 바라본 뒤, 숨을 내쉰다.', negative: '어둠숲의 감시자는 당신을 바라본 뒤, 무언가가 부서진 듯 음울하다.' },
    },
    ruthless: {
      high: { positive: '그는 당신의 뒤편 가지에서, 파괴된 세계를 지켜본다.', negative: '그는 당신의 뒤편 가지에서, 마침내 무언가가 끝났음을 느낀다.' },
      medium: { positive: '감시자의 눈에 무언가가 남아있다. 진정한 끝을 본 것이다.', negative: '감시자의 눈이 닫힌다. 이제 더 지킬 것도 부술 것도 없다.' },
      low: { positive: '그는 당신의 곁을 떠난다. 당신의 방식을 이해할 수 없었을 것 같다.', negative: '그는 당신을 바라본다. 깊은 의문이 눈에 남아있다.' },
    },
    mixed: {
      high: { positive: '숲의 감시자는 미소 짓는다. 그것이 처음인 것 같다.', negative: '감시자는 당신을 바라본다. 그 눈에는 여러 감정이 섞여있다.' },
      medium: { positive: '그는 조용히 말한다. "여정이 끝났군."', negative: '"모든 것이 변했다." 그의 목소리가 어둡다.' },
      low: { positive: '감시자는 당신을 지나쳐간다. 무언가가 일치하지 않았던 것 같다.', negative: '그는 당신의 곁을 떠난다. 말을 남기지 않는다.' },
    },
    true: {
      high: { positive: '어둠이 사라진 숲. 감시자는 이제 진정한 숲지기가 된다.', negative: '감시자는 빛나는 숲을 지켜본다. 새로운 방어자로서.' },
      medium: { positive: '그는 밝아진 숲을 바라본다. 처음으로 자유롭다는 생각이 든다.', negative: '감시자의 검이 다시 빛난다. 이번엔 보호를 위해.' },
      low: { positive: '"다시 만나자." 그의 말이 가볍다.', negative: '그는 말 없이 떠난다. 역할을 되찾은 듯하다.' },
    },
  },

  // 봉인의 수호상 — 맹세의 해제와 새로운 길
  seal_guardian: {
    merciful: {
      high: { positive: '수호상은 부서진 봉인 앞에서 무릎을 꿇는다. 이제 지킬 것이 없으므로.', negative: '수호상은 봉인의 자리에 선다. 이번엔 자발적으로.' },
      medium: { positive: '그것의 빛이 희미해진다. 맹세에서 풀려난 안도감으로.', negative: '수호상은 관찰한다. 봉인이 없는 세계를 처음 본다.' },
      low: { positive: '당신의 곁을 떠나며, 무언가가 완성됐다는 느낌이 드는 듯하다.', negative: '수호상은 당신을 바라본다. 새로운 맹세를 기다리는 듯.' },
    },
    ruthless: {
      high: { positive: '봉인의 자리에서, 수호상은 당신을 바라본다. 파괴의 증인으로.', negative: '그것은 당신을 따른다. 이제 지킬 것 없이, 오직 파괴만 남겨두려.' },
      medium: { positive: '맹세는 완성됐다. 수호상은 당신의 여정의 한 부분이 된다.', negative: '그것은 조용히 당신의 뒤를 따른다. 더 이상 묻지 않으며.' },
      low: { positive: '수호상은 방황한다. 새로운 목적을 찾으려 하지만 찾지 못한다.', negative: '그것은 당신을 떠난다. 당신의 방식을 이해할 수 없어.' },
    },
    mixed: {
      high: { positive: '봉인이 풀렸다. 수호상은 이제 당신의 맹세인 듯하다.', negative: '그것은 당신을 따른다. 복잡한 감정으로 부풀어.' },
      medium: { positive: '수호상의 빛이 흔들린다. 하지만 당신을 믿는다.', negative: '관찰자의 눈빛이 변한다. 뭔가가 결정되지 않은 채로 남겨졌다는 듯이.' },
      low: { positive: '당신과 수호상의 길이 갈라진다. 하지만 서로 무언가를 배웠을 것이다.', negative: '그것은 말 없이 떠난다. 당신의 선택을 인정하지만 따르지는 않는다.' },
    },
    true: {
      high: { positive: '영원한 봉인이 벗겨졌다. 수호상은 이제 자유로운 의지로 당신의 곁에 선다.', negative: '별빛이 돌아왔다. 수호상은 그 빛 속에서 참된 모습을 드러낸다.' },
      medium: { positive: '맹세는 끝났다. 수호상은 당신과 함께 새 세상을 본다.', negative: '봉인의 무게에서 해방되어, 수호상은 이제 진정한 선택을 할 수 있다.' },
      low: { positive: '당신과 함께 새 세상으로. 수호상도 그 길을 간다.', negative: '"고마워." 그것의 첫 말이다. 완전히 자유로운 존재로서.' },
    },
  },

  // 타락한 별 — 구원받은 자의 제2의 시작
  fallen_star: {
    merciful: {
      high: { positive: '별이 다시 빛난다. 당신의 자비 속에서.', negative: '별은 흐릿해진다. 하지만 사라지지 않는다.' },
      medium: { positive: '별의 저주가 풀렸다. 그것은 처음으로 환해진 하늘을 본다.', negative: '별은 당신을 따른다. 아직 어디로 가야 할지 모르지만.' },
      low: { positive: '당신 덕분에 별이 살아났다. 그것이 감사의 전부다.', negative: '별은 당신의 곁에 있다. 말 없이, 하지만 충실하게.' },
    },
    ruthless: {
      high: { positive: '별은 당신의 손에 구속된다. 아니면, 복종하는 걸 선택했을 수도.', negative: '별은 당신을 따른다. 저주에서 탈출한 대가로.' },
      medium: { positive: '별이 우는 소리가 들린다. 그것은 당신의 행동을 증오한다.', negative: '별은 당신 옆에서 불타고 있다. 모두를 태울 불로.' },
      low: { positive: '별은 당신을 떠난다. 남은 것은 그을음뿐이다.', negative: '별은 저주를 그대로 품은 채 당신의 뒤를 따른다.' },
    },
    mixed: {
      high: { positive: '별이 불안정하게 빛난다. 감사와 두려움이 섞여서.', negative: '별은 떨며 당신을 따른다. 이해할 수 없는 존재를 따르며.' },
      medium: { positive: '저주받은 별이 처음으로 미소 짓는 것 같다.', negative: '별은 당신을 바라본다. 완전히 이해할 수 없는 눈으로.' },
      low: { positive: '별과 당신은 각자의 길을 간다. 하지만 무언가가 연결되어있는 듯하다.', negative: '별은 떠난다. 또 다른 저주인지 축복인지 모를 상태로.' },
    },
    true: {
      high: { positive: '별이 다시 하늘에 뜬다. 이번엔 영원한 빛으로.', negative: '별은 하늘로 돌아간다. 당신과 함께, 새로운 무한성 속으로.' },
      medium: { positive: '저주는 완전히 풀렸다. 별은 당신과 함께 새 우주를 본다.', negative: '별의 빛이 회복된다. 모든 것이 끝났음을 알며.' },
      low: { positive: '"다시 만나자." 별이 하늘로 올라간다.', negative: '별은 무한하고 고독한 높이로 돌아간다. 이제 혼자가 아니라는 것을 알며.' },
    },
  },

  // 늪의 마녀 — 고독한 힘의 동반자
  bog_witch: {
    merciful: {
      high: { positive: '마녀는 당신의 곁에서 미소 짓는다. 처음으로 혼자가 아닌 채로.', negative: '마녀는 당신을 따른다. 여전히 무언가를 경계하는 눈으로.' },
      medium: { positive: '그녀의 지팡이에서 자주색 빛이 희미하게 난다. 평화로운.', negative: '마녀는 당신의 옆에 선다. 과거는 지났지만, 그 흔적은 남는다.' },
      low: { positive: '당신 덕분에, 그녀는 마침내 외로움을 내려놓는다.', negative: '마녀는 당신과 함께 여행한다. 아직도 의심스럽지만, 점점 풀리고 있다.' },
    },
    ruthless: {
      high: { positive: '마녀는 당신 곁에서 웃는다. 그 웃음이 얼마나 어두운지 자신도 모를 것 같다.', negative: '마녀는 당신을 따른다. 당신의 파괴에 취해서.' },
      medium: { positive: '그녀는 당신의 결정을 인정한다. 그녀도 비슷한 길을 걸었으니까.', negative: '마녀는 당신과 함께 마침내 자신의 방식을 깨닫는다.' },
      low: { positive: '마녀는 당신을 떠난다. 당신도 그녀처럼 고독하지 않냐고 묻으며.', negative: '마녀는 혼자가 되길 택한다. 당신과 다른 고독을 선택하며.' },
    },
    mixed: {
      high: { positive: '마녀는 당신을 바라본다. 당신도 복잡한 사람인 듯, 그녀는 생각한다.', negative: '그녀와 당신이 이해하는 방식이 다르지만, 함께 간다.' },
      medium: { positive: '마녀의 눈이 부드러워진다. 아직은, 완전하진 않지만.', negative: '마녀는 당신과 함께 가길 선택한다. 어떤 이유로든.' },
      low: { positive: '마녀와 당신의 길이 갈라진다. 하지만 서로 뭔가를 이해했을 것이다.', negative: '마녀는 당신을 떠난다. 더 나은 고독을 찾으러.' },
    },
    true: {
      high: { positive: '마녀의 저주가 풀린다. 별빛 아래서, 그녀는 처음으로 진정한 미소를 짓는다.', negative: '마녀는 마침내 자유로워진다. 그 자유가 당신의 손을 통해 왔다는 것을 알며.' },
      medium: { positive: '고독함은 사라지지 않는다. 하지만 이제 그것도 견딜 수 있을 것 같다.', negative: '마녀는 당신과 함께 무한함을 바라본다. 그것도 나쁘지 않다고 생각하며.' },
      low: { positive: '마녀는 당신에게 감사한다. 말로는 하지 않지만.', negative: '"지금이 답인가?" 마녀가 물으며 당신을 따른다.' },
    },
  },

  // 다리 파수꾼 — 사슬에서의 해방
  bridge_warden: {
    merciful: {
      high: { positive: '파수꾼은 처음으로 사슬 없이 서 있다. 당신 옆에서.', negative: '파수꾼은 당신을 따른다. 더 이상 경계하지 않는 눈으로.' },
      medium: { positive: '그의 눈에 감사가 비친다. 당신이 그를 풀어주었으니까.', negative: '파수꾼은 조용히 당신을 따른다. 새로운 주인이 아닌, 동료로서.' },
      low: { positive: '그는 당신에게 한 번 절을 한다. 자발적으로.', negative: '파수꾼은 당신의 곁에 선다. 여전히 누군가를 지키고 싶은 듯하다.' },
    },
    ruthless: {
      high: { positive: '파수꾼은 당신 앞에서 무릎을 꿇는다. 이제는 두려움으로가 아니라, 승복으로.', negative: '파수꾼은 당신을 따른다. 이제는 당신의 명령 없이도.' },
      medium: { positive: '그의 사슬은 부러졌다. 하지만 무언가가 여전히 그를 묶고 있다.', negative: '파수꾼은 당신에게 충성한다. 그것이 남은 유일한 정체성이니까.' },
      low: { positive: '파수꾼은 당신을 떠난다. 새로운 사슬을 찾으러 떠난다.', negative: '그는 당신의 곁에 있다. 하지만 여전히 불안정하다.' },
    },
    mixed: {
      high: { positive: '파수꾼의 눈이 흔들린다. 자유와 충성 사이에서.', negative: '그는 당신을 따른다. 새로운 의지로, 아직도 낡은 습관으로.' },
      medium: { positive: '사슬은 풀렸다. 하지만 그 자리는 여전히 아프다.', negative: '파수꾼은 당신과 함께 가길 택한다. 이유는 모르지만.' },
      low: { positive: '당신과 파수꾼은 각자의 길을 간다. 서로를 이해하진 못했지만 존경한다.', negative: '파수꾼은 떠난다. 또 다른 사슬이 필요할 때까지, 또는 영원히.' },
    },
    true: {
      high: { positive: '파수꾼의 사슬이 금으로 변한다. 아니, 처음부터 그것은 사슬이 아니라 별빛이었을 것이다.', negative: '파수꾼은 하늘 아래서, 처음으로 자유롭다. 또는 당신 옆에 있다.' },
      medium: { positive: '사슬의 흔적이 사라진다. 그 자리에 빛만 남는다.', negative: '파수꾼은 당신과 함께 무한함을 지킨다. 이번엔 자발적으로.' },
      low: { positive: '파수꾼은 당신에게 감사한다. 그리고 떠난다. 이제는 자유롭게.', negative: '"이곳이 내 새로운 다리인가?" 파수꾼이 당신 옆에서 물으며 미소 짓는다.' },
    },
  },

  // 화염 사냥개 — 갇혔던 생명의 열정
  ember_hound: {
    merciful: {
      high: { positive: '사냥개는 자유의 불로 타오른다. 당신을 따르며.', negative: '사냥개는 당신의 곁에서 타고 있다. 소박하지만 진정한 불로.' },
      medium: { positive: '그것은 감사의 포효를 내뱉는다. 당신을 위해.', negative: '갇혔던 불이 이제 당신 옆에서 타오른다.' },
      low: { positive: '사냥개는 당신을 따른다. 그것이 감사하는 방식이다.', negative: '그것은 당신의 곁에서 조용히 탄다. 평온하게.' },
    },
    ruthless: {
      high: { positive: '사냥개의 불이 걷잡을 수 없다. 당신의 파괴에 취해서.', negative: '갇혔던 불이 마침내 해방된다. 당신을 따르는 살무사로서.' },
      medium: { positive: '그것은 당신을 위해 타오른다. 모든 것을 태우도록.', negative: '사냥개는 당신의 도구가 되길 선택했다. 또는 선택당했을 수도.' },
      low: { positive: '사냥개는 당신을 떠난다. 더 큰 불을 찾으러.', negative: '그것은 당신의 곁에 있다. 하지만 불이 점점 사나워진다.' },
    },
    mixed: {
      high: { positive: '사냥개의 불이 떨린다. 기쁨과 두려움을 품은 채.', negative: '그것은 당신을 따른다. 아직도 갇혀있는 듯한 감정으로.' },
      medium: { positive: '불이 안정된다. 당신 옆에서, 평온한 타오름으로.', negative: '사냥개는 당신과 함께 가길 택한다. 무언가가 완성되지 않은 채로.' },
      low: { positive: '사냥개와 당신은 각자의 길을 간다. 하지만 그것의 불은 당신을 기억할 것이다.', negative: '그것은 당신을 떠난다. 더 이상 갇혀있고 싶지 않아.' },
    },
    true: {
      high: { positive: '사냥개의 불이 별빛으로 변한다. 아니, 그것은 처음부터 별빛이었을 것이다.', negative: '갇혔던 불이 무한한 하늘로 타오른다. 당신과 함께.' },
      medium: { positive: '불의 고통이 사라진다. 남은 것은 순수한 생명의 에너지다.', negative: '사냥개는 당신 옆에서 타오른다. 이제는 기쁨과 함께.' },
      low: { positive: '사냥개는 당신에게 감사하며 떠난다. 자유로운 광야로.', negative: '"이것도 자유인가?" 사냥개가 당신 옆에서 묻는다. 아직도 타오르며.' },
    },
  },
};

// 동료 후일담 가져오기
export function allyEpilogueFor(refId, tone, bonds) {
  const allyData = ALLY_EPILOGUES[refId];
  if (!allyData || !allyData[tone]) return null;

  const toneData = allyData[tone];

  // bondStrength 계산: 이 동료가 다른 누구와의 유대에서 얼마나 강한 감정을 가졌는가
  const strength = bondStrength(bonds || {}, refId);
  let level = 'low';
  if (strength >= 3) level = 'high';
  else if (strength >= 1) level = 'medium';

  // 동료의 bonds에 긍정 감정이 있는가 — refId의 모든 pair들 중 긍정 감정 존재 여부
  const pairs = pairsFor(bonds || {}, refId);
  const hasPositive = pairs.some((p) => Array.isArray(p.emotions)
    && p.emotions.some((e) => ['admiration', 'loyalty', 'affection'].includes(e))
  );

  const epilogueData = toneData[level];
  if (!epilogueData) return null;

  return hasPositive ? epilogueData.positive : epilogueData.negative;
}

// 특정 동료가 파티에 있었는지 확인 (표시 여부 결정)
export function shouldShowAllyEpilogue(refId, allyIds) {
  return allyIds && allyIds.some((a) => a.refId === refId);
}

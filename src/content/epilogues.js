// 클래스별 에필로그 (Unity DIALOGUE.md 에필로그의 자비 렌즈 재서술) — PURE 데이터.
// EndingScene이 리더(파티[0])의 클래스로 골라 결말 요약 아래에 표시한다. 톤(자비/
// 정복/여정/진정한)은 엔딩 타이틀·하늘이 이미 전달하므로 에필로그는 클래스 정체성
// 하나에 집중한다 — 같은 결말이라도 "누구의 눈으로 끝났는가"가 달라지도록.

export const EPILOGUES = {
  knight: [
    '기사는 마을의 화톳불 앞에 무릎을 꿇고, 검을 땅에 세웠다.',
    '"서약은 지켰다. 이제 — 누군가를 지키는 일은, 검이 아니어도 되겠지."',
  ],
  warrior: [
    '전사는 황야의 무덤가에 도끼를 내려놓고 해가 뜨는 것을 보았다.',
    '"돌아갈 고향은 없다. 하지만 이제, 여기가 모두의 고향이 될 것이다."',
  ],
  huntress: [
    '사냥꾼은 어둠숲의 가장 높은 가지에 올라, 돌아온 별하늘을 겨눴다 — 쏘지 않았다.',
    '"부패는 끝났지만, 경계는 끝나지 않는다. 다음 것이 올 때까지 — 내가 지켜본다."',
  ],
  mage: [
    '마법사는 의식장의 재를 한 줌 병에 담았다. 균열의 울음을, 이제는 이해하고 싶었다.',
    '"봉인은 시작일 뿐이다. 문이 왜 열렸는지 아는 자만이, 다시 닫아 둘 수 있으니."',
  ],
  duelist: [
    '쌍검사는 크레이터 가장자리에 두 자루 검을 나란히 꽂았다.',
    '"광기는 끝났다. 그럼 이제 나는… 누구지?" — 처음으로, 그 물음이 두렵지 않았다.',
  ],
};

export function epilogueFor(refId) { return EPILOGUES[refId] || null; }

// Karma-conditioned epilogue closer (one-liner appended after class epilogue).
export function karmaEpilogueLine(karma) {
  if (!karma) return '';
  if (karma > 0) return '저 뒤에서, 구원받은 영혼들의 발자국이 따라왔다.';
  if (karma < 0) return '저 뒤에서, 어둠의 그림자가 천천히 길어갔다.';
  return '';
}

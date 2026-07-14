// Quest definitions + PURE completion logic (no Pixi, no save writes — the
// scene/main layer reads these to drive offer/turn-in and grant rewards).
//
// A quest is offered by a giver NPC (talk → accept → 'active'), tracked in the
// quest log (menu X → 퀘스트), and turned in at the same giver once its `cond`
// is met (→ 'done', reward granted). State lives in save.quests = { id: state }.
//
// cond.type — checked against runtime (flags / inventory) by isQuestComplete:
//   boss    { flag }            → runtime.flags[flag] === true
//   mercy   { count }           → runtime.flags.mercied >= count
//   slay    { count }           → runtime.flags.slain   >= count
//   collect { item, count }     → runtime.inventory[item] >= count
//   reach   { map }             → runtime.visitedMaps includes map
//   talk    { npcId }           → runtime.talkedNpcs includes npcId
//
// reward — granted on turn-in: { gold?, item?, xp? } (xp split across party).

export const QUESTS = {
  // Town elder — the crypt's skeleton king (kill-a-boss).
  q_crypt: {
    id: 'q_crypt', name: '뼈의 군주', giver: '마을 장로',
    desc: '지하묘의 해골 왕을 막아라.',
    cond: { type: 'boss', flag: 'bossDefeated' },
    reward: { gold: 120, item: 'studded_leather' },
    offer: ['해골 왕이 지하묘에서 깨어났네. 한때 이 마을의 기사였지...', '동쪽 황야를 지나 지하묘로. 그를 막아주겠나?'],
    active: ['해골 왕은 아직 지하묘에 잠들지 못했네. 부디 서둘러 주게.'],
    done: ['해냈군... 고맙네. 이 갑옷이 자네 여정에 도움이 되길.'],
  },
  // Town elder — the mercy path (game's core theme): spare/recruit 5 foes.
  q_mercy: {
    id: 'q_mercy', name: '길 잃은 영혼들', giver: '마을 장로',
    desc: '적 다섯을 베지 말고 살려 보내라 (자비 / 영입).',
    cond: { type: 'mercy', count: 5 },
    reward: { gold: 90, item: 'sage_amulet' },
    offer: ['검을 드는 것만이 길은 아닐세.', '부패에 삼켜진 자들 — 다섯을 살려 보내 보게. 무엇이 달라지는지 보게나.'],
    active: ['아직 더 많은 영혼을 구할 수 있네. 자비를 잊지 말게.'],
    done: ['자네가 살린 자들이 이 땅을 바꾸고 있네. 이 부적을 받게 — 현자의 가호일세.'],
  },
  // Shop keeper — a fetch quest (collect herbs).
  q_herbs: {
    id: 'q_herbs', name: '약초 보충', giver: '상점 주인',
    desc: '약초 5개를 모아 상점 주인에게 가져가라.',
    cond: { type: 'collect', item: 'herb', count: 5 },
    reward: { gold: 60, item: 'mana_drop' },
    offer: ['재고가 떨어졌어요. 약초 5개만 구해다 주시면 사례할게요!'],
    active: ['약초 5개가 필요해요. (지금 가진 약초를 확인해 보세요.)'],
    done: ['딱 맞네요! 고마워요. 이거 가져가세요.'],
  },
  // Empire refugee veteran — the bog witch (late-game kill-a-boss).
  q_witch: {
    id: 'q_witch', name: '늪의 저주', giver: '늙은 병사',
    desc: '마녀의 늪에서 늪의 마녀를 막아라.',
    cond: { type: 'boss', flag: 'swampBossDefeated' },
    reward: { gold: 250, item: 'ward_amulet' },
    offer: ['늪의 마녀... 부패의 한 갈래요. 그녀를 멈추지 않으면 제국의 폐허까지 독무가 번질 거요.', '서쪽 늪으로 가시오.'],
    active: ['늪의 마녀는 아직 그 가마솥 곁에 있소.'],
    done: ['늪이 잠잠해졌군... 고맙소. 이 부적을 받으시오.'],
  },

  // --- POST-GAME region quests (lava / void). Givers stand at each gate; the
  // boss quests gate on the superboss clear flags (no `final`), the cache quests
  // ask you to farm the region. Off the balance ladder — pure endgame content. ---

  // Lava (불의 분화구) — slay the magma drake.
  q_drake: {
    id: 'q_drake', name: '분화구의 폭군', giver: '화산 조사대장',
    desc: '불의 분화구 깊은 곳의 마그마 드레이크를 토벌하라.',
    cond: { type: 'boss', flag: 'magmaDrakeDefeated' },
    reward: { gold: 500, item: 'vitality_charm' },
    offer: ['분화구가 깨어났소. 마그마 드레이크 — 제국이 무너진 뒤에도 살아남은 옛 재앙이지.', '동쪽 용암길 끝, 그 둥지로. 살아 돌아오시오.'],
    active: ['드레이크는 아직 분화구를 지배하고 있소. 화상에 대비하시오.'],
    done: ['분화구가 식어가는군... 자네는 진정한 영웅이오. 이 부적을 받으시오.'],
  },
  // Lava — gather Fabula draughts forged in the magma heat (farm the crater).
  q_lava_cache: {
    id: 'q_lava_cache', name: '용암 속 운명', giver: '잿불 연금술사',
    desc: '분화구의 적들이 떨구는 운명의 영약 3개를 모아라.',
    cond: { type: 'collect', item: 'fp_potion', count: 3 },
    reward: { gold: 200, item: 'guardian_shield' },
    offer: ['용암의 열기가 운명의 결정을 빚어내요. 분화구의 마물에게서 영약 3개만 모아다 주시면…', '이 방패로 보답하죠.'],
    active: ['운명의 영약 3개가 필요해요. (분화구의 마물을 사냥해 보세요.)'],
    done: ['이거예요! 고마워요. 이 방패가 당신을 지켜줄 거예요.'],
  },

  // Void (공허의 균열) — banish the abyss lord.
  q_voidlord: {
    id: 'q_voidlord', name: '심연의 끝', giver: '공허 감시자',
    desc: '공허의 균열 가장 깊은 곳, 심연의 군주를 추방하라.',
    cond: { type: 'boss', flag: 'voidLordDefeated' },
    reward: { gold: 700, item: 'guard_brooch' },
    offer: ['별빛이 꺼진 곳 — 심연의 군주가 차원을 갉아먹고 있소.', '이 세계의 마지막 위협이오. 그대만이 그를 막을 수 있소.'],
    active: ['군주는 아직 공허의 옥좌에 있소. 저주에 대비하시오.'],
    done: ['차원이 다시 봉합되었군… 그대가 세계를 구했소. 이 브로치를 받으시오 — 감시자의 증표요.'],
  },
  // Void — recover the awakening relics scattered in the rift (farm the void).
  q_void_relics: {
    id: 'q_void_relics', name: '잊혀진 각성', giver: '공허 사서',
    desc: '공허에 흩어진 각성의 비약 3개를 회수하라.',
    cond: { type: 'collect', item: 'awakening', count: 3 },
    reward: { gold: 300, item: 'sage_amulet' },
    offer: ['균열에 삼켜진 영혼들이 각성의 비약을 떨구지요.', '셋만 회수해 주시면 — 현자의 부적으로 보답하리다.'],
    active: ['각성의 비약 3개가 필요하오. (공허의 마물을 사냥해 보시오.)'],
    done: ['훌륭하오… 이 부적이 그대의 정신을 지켜주리다.'],
  },
  // Void — lay the trapped imperial lich to rest (kill the wraith_lich miniboss).
  q_wraith: {
    id: 'q_wraith', name: '묶인 술사', giver: '공허의 속죄자',
    desc: '균열에 묶인 망령 리치를 처치해 그 한을 풀어 주어라.',
    cond: { type: 'boss', flag: 'wraithLichDefeated' },
    reward: { gold: 400, item: 'guardian_shield' },
    offer: ['저 깊은 곳, 무너진 제국의 술사가 죽음에도 놓이지 못한 채 묶여 있소.', '그를 끝내 주시오 — 그것이 자비요. 보답은 잊지 않으리다.'],
    active: ['망령 리치는 아직 룬에 묶여 신음하고 있소. 보호막을 깨야 하오.'],
    done: ['술사의 한이 마침내 풀렸군… 이 방패를 받으시오. 속죄의 무게가 담겨 있소.'],
  },
};

// --- 로어 사이드퀘 (Unity QUEST_TEXT.md 재서술 — 자비 렌즈). 전부 기존 cond/
// 플래그/아이템만 사용 (신규 메커니즘 0): 옵셔널 미니보스를 지목해 발견성을 올리고,
// 지역마다 로어를 한 겹 얹는다. ---

Object.assign(QUESTS, {
  // 어둠숲 — 감시자의 정체 (1막 로어). 마을의 늙은 사냥꾼이 옛 동료의 개를 부탁한다.
  q_warden_rest: {
    id: 'q_warden_rest', name: '묘지기의 안식', giver: '늙은 사냥꾼',
    desc: '어둠숲의 감시자를 잠재워라 — 베든, 살려 보내든.',
    cond: { type: 'boss', flag: 'darkWardenDefeated' },
    reward: { gold: 100, item: 'antidote' },
    offer: ['남쪽 어둠숲의 그 짐승... 원래는 묘지기 노인의 사냥개였네. 주인이 부패에 스러진 뒤에도 무덤가를 안 떠났지.', '부패가 그 충직함마저 비틀어 버렸어. 부탁하네 — 어떤 식으로든, 그 아이를 쉬게 해 주게.'],
    active: ['숲의 개는 아직 무덤가를 배회하고 있네. 황야 남쪽일세.'],
    done: ['...그런가. 고맙네. 그 아이도, 노인도 이제야 편하겠지. 이걸 받게 — 숲에선 독이 흔하니.'],
  },
  // 서리첨탑 — 서리 여왕 미니보스 지목 (기존 옵셔널 콘텐츠 발견성).
  q_frozen_kin: {
    id: 'q_frozen_kin', name: '얼어붙은 동족', giver: '산사람 생존자',
    desc: '서리첨탑의 서리 여왕을 잠재워라.',
    cond: { type: 'boss', flag: 'frostQueenDefeated' },
    reward: { gold: 150, item: 'frost_blade' },
    offer: ['우리 산사람들은 첨탑 그늘에서 대대로 살았소. 여왕이라 불리는 그것이 오기 전까지는.', '그녀도 한때는 산을 지키던 정령이었다 하오. 탑 깊은 곳 — 부디, 동족들의 한을 풀어 주시오.'],
    active: ['여왕은 아직 탑의 서쪽 그늘에 있소. 냉기에 대비하시오.'],
    done: ['산바람이 부드러워졌소... 느껴지오? 이 검은 여왕의 얼음으로 벼린 것 — 그대의 것이오.'],
  },
  // 지하 의식장 — 수호 기사단 서약 로어 (2막 존과 연계).
  q_broken_oath: {
    id: 'q_broken_oath', name: '부서진 서약', giver: '유물 학자',
    desc: '지하 의식장의 봉인의 파수병을 잠재워라.',
    cond: { type: 'boss', flag: 'sealGuardianDefeated' },
    reward: { gold: 200, item: 'guardian_shield' },
    offer: ['폐허 시가지 남쪽 지하에 옛 의식장이 있다네. 수호 기사단의 마지막 파수병이 아직 그곳을 지키지.', '수백 년을... 이미 무너진 서약을 지키면서 말일세. 그 서약을 끝내 주게 — 학자로서, 그 끝을 기록하고 싶네.'],
    active: ['파수병은 아직 제단을 지키고 있네. 시가지 남쪽 계단일세.'],
    done: ['서약의 끝을 기록했네... 장엄했겠지. 이 방패는 기사단의 유물 — 서약을 이어받을 자격이 자네에게 있네.'],
  },
  // 핏빛 백작 — 광기의 칼날 로어 (쌍검사 결, 옵셔널 미니보스 지목).
  q_bloods_madness: {
    id: 'q_bloods_madness', name: '광기의 핏줄', giver: '떠도는 검객',
    desc: '폐허 시가지의 핏빛 백작을 잠재워라.',
    cond: { type: 'boss', flag: 'bloodCountDefeated' },
    reward: { gold: 200, item: 'duelist_gunblade' },
    offer: ['시가지 서쪽 그늘에 백작이라 불리는 것이 있소. 나와 같은 유파의 검객이었지 — 광기가 그를 삼키기 전까지는.', '그의 검은 내가 거둬야 했소. 늦었지만... 그대가 대신 끝내 준다면, 내 예비 검을 드리리다.'],
    active: ['백작은 아직 시가지 서쪽에 도사리고 있소.'],
    done: ['...끝났구려. 유파의 빚을 그대가 갚아 주었소. 약속한 검이오 — 반격의 결을 익힌 물건이지.'],
  },
  // 별무덤 — 자비 카운터 퀘스트 (자비=파워 테마의 사이드퀘 변주).
  q_star_mercy: {
    id: 'q_star_mercy', name: '살려 보낸 빛', giver: '별지기',
    desc: '부패에 붙들린 것들을 열둘, 베지 말고 살려 보내라 (자비 / 영입).',
    cond: { type: 'mercy', count: 12 },
    reward: { gold: 250, item: 'lucky_charm' },
    offer: ['별들은 균열과 싸울 때 아무것도 베지 않았소. 제 몸을 던져 막았을 뿐.', '부패에 붙들린 것들을 열둘, 살려 보내 보시오. 별의 방식이 무엇을 남기는지 — 지켜보겠소.'],
    active: ['아직이오. 검을 거두는 손이 더 필요하오.'],
    done: ['보았소. 그대 안에 별과 같은 것이 있구려. 이 부적은 떨어진 별의 파편 — 행운은 살리는 자를 따르는 법이오.'],
  },
  // 용비늘 단조 — collect 사이드퀘 (lava_gate 보물/상점의 dragon_scale 회수 동기).
  q_scale_forge: {
    id: 'q_scale_forge', name: '용비늘 단조', giver: '완고한 노장장이',
    desc: '용비늘 갑옷 한 벌을 구해 노장장이에게 가져가라.',
    cond: { type: 'collect', item: 'dragon_scale', count: 1 },
    reward: { gold: 800, item: 'elixir' },
    offer: ['평생 강철만 두드렸지만, 용의 비늘만은 만져 본 적이 없네.', '분화구 어딘가에 용비늘 갑옷이 잠들어 있다 들었네. 한 벌만 구해다 주게 — 값은 섭섭잖게 치르지.'],
    active: ['용비늘 갑옷 한 벌일세. 분화구를 뒤져 보게. (지금 가진 것을 확인해 보게.)'],
    done: ['오오... 이것이 용의 비늘인가. 여한이 없네. 약속한 값일세 — 그리고 이 영약은 덤이야.'],
  },
});

// --- 목표 다양화 라운드 (2026-07-15): 사냥(slay 첫 사용) · 탐사(reach) · 전언
// (talk) — condMet은 세 타입을 이미 지원했지만 콘텐츠가 처음 쓴다. slay/mercy
// 카운터는 게임 누적치(기존 q_mercy 관례와 동일 — 수주 전 진행분 소급 인정). ---

Object.assign(QUESTS, {
  // 사냥 의뢰 (초반) — 잔혹 성향 기버: 자비 퀘스트(q_mercy)의 거울상.
  q_hunt_wild: {
    id: 'q_hunt_wild', name: '황야의 사냥 의뢰', giver: '사냥길 안내인',
    desc: '부패에 삼켜진 마수 열다섯을 처치하라.',
    cond: { type: 'slay', count: 15 },
    reward: { gold: 100, item: 'bronze_sword' },
    offer: ['사제는 살려 보내라 하던가? 흥. 부패가 뼛속까지 스민 것들은 못 돌아와.', '열다섯. 그만큼은 베어야 길이 안전해지네. 의뢰를 받겠나?'],
    active: ['아직 부족하네. 황야도 숲도, 마수는 얼마든지 있지.'],
    done: ['확실한 솜씨군. 약속한 값과 — 내 예비 검일세. 어느 쪽 길을 걷든, 자네 몫이지.'],
  },
  // 사냥 의뢰 (후반) — 제국 야영지의 전리품 수집상.
  q_hunt_wastes: {
    id: 'q_hunt_wastes', name: '폐허의 소탕전', giver: '전리품 수집상',
    desc: '부패의 권속 마흔을 처치하라.',
    cond: { type: 'slay', count: 40 },
    reward: { gold: 350, item: 'swift_boots' },
    offer: ['폐허 장사는 목숨 장사요. 권속들이 줄어야 수레가 다니지.', '마흔. 지금까지 벤 것도 쳐 주겠소 — 장부는 정직하니까.'],
    active: ['장부를 봤소. 아직 마흔이 안 되오. 서두르시오.'],
    done: ['마흔... 확인했소. 값이오. 이 장화는 죽은 척후병의 것 — 산 자가 신어야지.'],
  },
  // 탐사 (옵셔널 존 발견성) — 심연의 다리(empire_bridge)는 안 가도 되는 맵이라
  // 존재 자체를 모르기 쉽다. reach 퀘스트가 지도 바깥을 가리킨다.
  q_scout_bridge: {
    id: 'q_scout_bridge', name: '무너진 다리', giver: '다리 목수',
    desc: '야영지 동쪽, 심연의 다리에 다녀와라.',
    cond: { type: 'reach', map: 'empire_bridge' },
    reward: { gold: 180, item: 'mana_drop' },
    offer: ['제국이 무너지기 전, 내가 놓은 다리요. 심연 위에 걸린 마지막 다리지.', '아직 서 있는지... 이 눈으로는 볼 용기가 없소. 대신 가서 봐 주겠소?'],
    active: ['다리는 야영지 동쪽이오. 부디 조심하시오 — 파수꾼이 아직 있다면, 그는 내 친구였소.'],
    done: ['서 있단 말이지... 그 친구가 아직 지키고 있었군. 고맙소. 정말 고맙소.'],
  },
  // 탐사 (포스트게임) — 드레이크 둥지 정찰: q_drake(토벌)와 별개의 선행 정찰.
  q_scout_core: {
    id: 'q_scout_core', name: '심부 정찰', giver: '조사대 신참',
    desc: '불의 분화구 심부에 발을 들여라.',
    cond: { type: 'reach', map: 'lava_core' },
    reward: { gold: 250, item: 'fp_potion' },
    offer: ['대장은 토벌 얘기뿐이지만... 심부 지형을 아는 사람이 아무도 없어요.', '먼저 들어가서 보고만 와 주세요. 싸우지 않아도 돼요 — 돌아오기만 하면.'],
    active: ['심부는 용암길 동쪽 끝이에요. 발판이 무너진 곳이 많대요.'],
    done: ['살아 돌아왔네요...! 지형은 기록했어요. 이 영약은 제 몫이었지만 — 당신이 받아야죠.'],
  },
  // 전언 (talk 첫 사용) — 마을 여관 안주인 → 서리첨탑의 산사람 생존자.
  q_message_frost: {
    id: 'q_message_frost', name: '산으로 가는 전언', giver: '여관 안주인',
    desc: '서리첨탑의 산사람 생존자에게 안부를 전하라.',
    cond: { type: 'talk', npcId: 'frost_survivor' },
    reward: { gold: 70, item: 'antidote' },
    offer: ['산사람 마을에 사촌이 있어요. 첨탑에 그것이 온 뒤로 소식이 끊겼죠.', '살아만 있다면... 이 말만 전해 줘요. "여관 등불은 계속 켜 두겠다"고.'],
    active: ['사촌은 첨탑 입구 쪽에 있을 거예요. 산사람들은 쉽게 안 죽어요.'],
    done: ['살아 있대요?! ...고마워요. 정말. 등불 값이라 생각하고 받아 줘요.'],
  },
});

export function getQuest(id) { return QUESTS[id] || null; }

// PURE: is a single condition satisfied by the current runtime state? The ONE
// place cond types live — quests (isQuestComplete) and questlines (stage conds)
// both delegate here, so a new cond type is added once and works everywhere.
//   reach { map }   → runtime.visitedMaps includes map   (fieldScene.loadMap records,
//                     persistent + first-visit-only — re-entry is a no-op)
//   talk  { npcId } → runtime.talkedNpcs includes npcId  (main.openDialog records;
//                     npcId = the map object's PLACEMENT id, e.g. enoch_act1 —
//                     the same NPC re-placed in another act uses a new id)
export function condMet(cond, runtime) {
  const c = cond || {};
  const flags = runtime.flags || {};
  const inv = runtime.inventory || {};
  switch (c.type) {
    case 'boss': return flags[c.flag] === true;
    case 'mercy': return (flags.mercied || 0) >= c.count;
    case 'slay': return (flags.slain || 0) >= c.count;
    case 'collect': return (inv[c.item] || 0) >= c.count;
    case 'reach': return (runtime.visitedMaps || []).includes(c.map);
    case 'talk': return (runtime.talkedNpcs || []).includes(c.npcId);
    default: return false;
  }
}

// PURE: is the quest's condition satisfied by the current runtime state?
export function isQuestComplete(quest, runtime) {
  if (!quest) return false;
  return condMet(quest.cond, runtime);
}

// One-line progress hint for the quest log (e.g. "자비 3/5", "약초 2/5").
export function questProgress(quest, runtime) {
  const c = quest.cond || {};
  const flags = runtime.flags || {};
  const inv = runtime.inventory || {};
  if (c.type === 'mercy') return `자비 ${Math.min(flags.mercied || 0, c.count)}/${c.count}`;
  if (c.type === 'slay') return `처치 ${Math.min(flags.slain || 0, c.count)}/${c.count}`;
  if (c.type === 'collect') return `${c.item} ${Math.min(inv[c.item] || 0, c.count)}/${c.count}`;
  return isQuestComplete(quest, runtime) ? '완료 가능' : '진행 중';
}

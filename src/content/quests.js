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
// (reach/visited deferred — needs a visited-map tracker; boss flags proxy it.)
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

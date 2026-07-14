// 다단계 퀘스트라인 (메인 스토리 스파인) + PURE 스테이지 로직 — no Pixi, no save
// writes (battle.js 패턴: advanceQuestlines는 넘겨받은 runtime을 전진시키고 이벤트
// 기술자를 반환; 토스트/보상/저장 사이드이펙트는 main.js game.tickQuestlines 담당).
//
// 상태는 save.questlines = { id: { stage, status } } (status: 'active' | 'done').
// 엔트리가 없으면 { stage: 0, status: 'active' }로 취급 — v1 퀘스트라인은 새 게임부터
// 자동 활성(메인 스토리)이며 NPC 수주형 퀘스트라인은 후속 작업. cond 판정은 quests.js
// condMet 공유(cond 타입은 거기 한 곳에만 추가).
//
// 스테이지 시맨틱 — 시퀀스 게이트가 아니라 체크리스트:
//   스테이지는 엄격히 순서대로 전진하지만, 이미 충족된 cond(선-방문한 맵, 선-대화한
//   NPC — visitedMaps/talkedNpcs는 영구 기록)는 그 스테이지가 current가 되는 즉시
//   소급 완료된다. 그래서 advance는 루프: 한 tick에 여러 스테이지가 연쇄 전진할 수
//   있고, 이벤트는 퀘스트라인당 1개(최종 도달 지점)만 낸다 — 토스트 스팸 방지.

import { condMet } from './quests.js';

export const QUESTLINES = {
  // 1막 「재의 계시」 — 방랑자 에녹의 인도. 마을 → 어둠숲 → 지하묘(해골 왕).
  ql_act1: {
    id: 'ql_act1',
    name: '1막 · 재의 계시',
    stages: [
      { cond: { type: 'talk', npcId: 'enoch_act1' }, desc: '마을의 방랑자 에녹과 이야기한다' },
      { cond: { type: 'reach', map: 'darkforest' }, desc: '황야 남쪽, 어둠숲에 들어선다' },
      { cond: { type: 'boss', flag: 'darkWardenDefeated' }, desc: '어둠숲의 감시자를 잠재운다' },
      { cond: { type: 'boss', flag: 'bossDefeated' }, desc: '지하묘의 해골 왕을 막는다' },
    ],
    reward: { gold: 150, item: 'elixir' },
  },

  // 2막 「잿더미의 진실」 — 서리첨탑 → 늪 → 제국 폐허 지하(의식장) → 황제.
  // `after` 게이팅: 1막 완료 전에는 전진·로그 노출 모두 잠김 (스포일러 방지).
  ql_act2: {
    id: 'ql_act2',
    name: '2막 · 잿더미의 진실',
    after: 'ql_act1',
    stages: [
      { cond: { type: 'talk', npcId: 'enoch_act2' }, desc: '서리첨탑 입구의 에녹과 이야기한다' },
      { cond: { type: 'boss', flag: 'frostBossDefeated' }, desc: '서리첨탑의 늑대인간 왕을 잠재운다' },
      { cond: { type: 'boss', flag: 'swampBossDefeated' }, desc: '마녀의 늪, 늪의 마녀를 막는다' },
      { cond: { type: 'reach', map: 'ruins_below' }, desc: '제국 폐허 아래, 지하 의식장을 찾아낸다' },
      { cond: { type: 'boss', flag: 'sealGuardianDefeated' }, desc: '봉인의 파수병을 잠재운다' },
      { cond: { type: 'boss', flag: 'empireBossDefeated' }, desc: '옥좌의 타락한 황제와 대면한다' },
    ],
    reward: { gold: 400, item: 'elixir' },
  },

  // 3막 「최후의 등반」 — 분화구 → 별무덤(떨어진 별) → 드레이크 → 공허의 군주.
  // 마지막 스테이지 완주가 곧 트루 엔딩(void_lord trueEnding 라우팅과 겹친다 —
  // 완료 토스트는 엔딩 진입 전 승리창에 실린다).
  ql_act3: {
    id: 'ql_act3',
    name: '3막 · 최후의 등반',
    after: 'ql_act2',
    stages: [
      { cond: { type: 'talk', npcId: 'enoch_act3' }, desc: '불의 분화구, 에녹과 이야기한다' },
      { cond: { type: 'reach', map: 'starfall' }, desc: '분화구 남쪽 잿길, 별무덤에 들어선다' },
      { cond: { type: 'boss', flag: 'fallenStarDefeated' }, desc: '별의 무덤, 떨어진 별을 잠재운다' },
      { cond: { type: 'boss', flag: 'magmaDrakeDefeated' }, desc: '분화구 심부의 마그마 드레이크를 토벌한다' },
      { cond: { type: 'boss', flag: 'voidLordDefeated' }, desc: '공허의 균열, 심연의 군주를 추방한다' },
    ],
    reward: { gold: 1000, item: 'awakening' },
  },

  // 사이드 퀘스트라인 「순례 · 재의 길」 (2026-07-15, 첫 non-막 라인) — `after`
  // 없음(새 게임부터 활성). 에녹의 다중 배치 talk 패턴 재사용: 같은 순례자가
  // 당신보다 한 걸음 앞서 세계를 걷고, 리전이 열릴 때마다 그를 다시 만난다.
  // 진행 게이트는 리전 해금 자체(frost/lava가 보스 플래그로 잠겨 있음)라 막
  // 진행과 자연 동기화된다.
  ql_pilgrim: {
    id: 'ql_pilgrim',
    name: '순례 · 재의 길',
    stages: [
      { cond: { type: 'talk', npcId: 'pilgrim_town' }, desc: '마을의 순례자와 이야기한다' },
      { cond: { type: 'talk', npcId: 'pilgrim_frost' }, desc: '서리첨탑에서 순례자를 다시 만난다' },
      { cond: { type: 'talk', npcId: 'pilgrim_lava' }, desc: '불의 분화구, 순례의 끝에서 그와 이야기한다' },
    ],
    reward: { gold: 300, item: 'sage_amulet' },
  },
};

// `after` 게이트가 열려 있는가 — 선행 퀘스트라인이 없거나 완료됐으면 true.
// advanceQuestlines(전진)와 menuScene(로그 노출)이 같은 판정을 공유한다.
export function questlineUnlocked(runtime, ql) {
  return !ql.after || questlineState(runtime, ql.after).status === 'done';
}

export function getQuestline(id) { return QUESTLINES[id] || null; }

// 퀘스트라인의 현재 상태. 세이브에 엔트리가 없으면 자동-활성 시작점.
export function questlineState(runtime, id) {
  const e = (runtime.questlines || {})[id];
  return e && typeof e === 'object' ? e : { stage: 0, status: 'active' };
}

// PURE: 이 스테이지의 cond가 지금 충족돼 있는가.
export function isStageComplete(stage, runtime) {
  return !!stage && condMet(stage.cond, runtime);
}

// 퀘스트 로그용 진행 문자열: "2/4 — 다음: <desc>" (완료 시 "완료").
export function questlineProgress(ql, runtime) {
  const st = questlineState(runtime, ql.id);
  if (st.status === 'done') return '완료';
  const next = ql.stages[st.stage];
  return `${st.stage}/${ql.stages.length} — 다음: ${next ? next.desc : '?'}`;
}

// PURE: 이 npcId가 지금 어느 해금된 퀘스트라인의 "현재 talk 스테이지" 타겟인가.
// fieldScene이 NPC 라벨에 ! 마커를 붙이는 데 쓴다 (퀘스트 기버 관례와 통일).
export function isTalkTarget(runtime, npcId) {
  if (typeof npcId !== 'string') return false;
  for (const ql of Object.values(QUESTLINES)) {
    if (!questlineUnlocked(runtime, ql)) continue;
    const st = questlineState(runtime, ql.id);
    if (st.status === 'done') continue;
    const cur = ql.stages[st.stage];
    if (cur && cur.cond.type === 'talk' && cur.cond.npcId === npcId) return true;
  }
  return false;
}

// 트래커 기록 헬퍼 (PURE) — 최초 1회만 push, 기록했으면 true. 씬/메인은 이걸 부른
// 직후 tick하면 된다 (fieldScene.loadMap → recordVisit, main.openDialog → recordTalk).
export function recordVisit(runtime, mapId) {
  if (!Array.isArray(runtime.visitedMaps)) runtime.visitedMaps = [];
  if (typeof mapId !== 'string' || runtime.visitedMaps.includes(mapId)) return false;
  runtime.visitedMaps.push(mapId);
  return true;
}
export function recordTalk(runtime, npcId) {
  if (!Array.isArray(runtime.talkedNpcs)) runtime.talkedNpcs = [];
  if (typeof npcId !== 'string' || runtime.talkedNpcs.includes(npcId)) return false;
  runtime.talkedNpcs.push(npcId);
  return true;
}

// 충족된 스테이지를 루프로 연쇄 전진시키고 이벤트 기술자를 반환한다.
// runtime.questlines를 직접 갱신(리졸버가 state를 갱신하는 것과 같은 계약);
// 저장·토스트·보상 지급은 호출자(main.js)의 일이다.
// 이벤트: { id, name, stage, total, status, nextDesc, reward? } — 퀘스트라인당
// 최대 1개(이번 tick의 최종 도달 지점), status가 'done'으로 넘어간 이벤트에만
// reward가 실린다.
export function advanceQuestlines(runtime) {
  const events = [];
  if (!runtime.questlines || typeof runtime.questlines !== 'object') runtime.questlines = {};
  for (const ql of Object.values(QUESTLINES)) {
    if (!questlineUnlocked(runtime, ql)) continue; // `after` 선행 미완 → 잠김
    const cur = questlineState(runtime, ql.id);
    if (cur.status === 'done') continue;
    let stage = cur.stage;
    while (stage < ql.stages.length && condMet(ql.stages[stage].cond, runtime)) stage++;
    if (stage === cur.stage) continue; // no progress this tick
    const done = stage >= ql.stages.length;
    const next = { stage, status: done ? 'done' : 'active' };
    runtime.questlines[ql.id] = next;
    // 완료가 다음 막을 여는 경우(after === this id) 이벤트에 실어 챕터 카드를 띄운다.
    const unlocked = done
      ? Object.values(QUESTLINES).find((n) => n.after === ql.id) || null
      : null;
    events.push({
      id: ql.id,
      name: ql.name,
      stage,
      total: ql.stages.length,
      status: next.status,
      nextDesc: done ? null : ql.stages[stage].desc,
      reward: done ? (ql.reward || null) : null,
      unlocked: unlocked ? { id: unlocked.id, name: unlocked.name } : null,
    });
  }
  return events;
}

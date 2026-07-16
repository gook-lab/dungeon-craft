// Save/load — defensive validation with `??` fallbacks (mirrors game's save.js
// philosophy). Storage is injectable so the validator is unit-testable headless
// without a real localStorage. Flat single-slot JSON (slice scope — no
// migration harness; add field-level defaults here when new fields appear).

import { EMOTIONS, MAX_EMOTIONS_PER_PAIR } from '../systems/bonds.js';
import { QUESTLINES } from '../content/questlines.js';

const KEY = 'dragon_crypt_save_v1';
const VERSION = 1;
const FABULA_CAP = 6; // max banked Fabula Points (mirrors design 20260529-133914)
// Max members deployed to a battle at once (출전 인원). The rest of the owned
// roster sits on the bench. Heroes AND recruited monster allies share these slots.
export const MAX_ACTIVE = 4;

// Clamp an equipment upgrade level to [0, 5] (강화 cap). Bad/old → 0.
function clampPlus(v) { return Number.isFinite(v) ? Math.max(0, Math.min(5, Math.floor(v))) : 0; }

export function freshSave() {
  return {
    version: VERSION,
    // Start as the knight alone — 전사/사냥꾼 join via town NPCs (talk to recruit).
    // The reactive-party design wants the player to assemble the trio, not open
    // with two strangers already in tow.
    party: [
      { id: 'knight', level: 1, xp: 0, hp: null, mp: null, equip: { weapon: null, armor: null, accessory: null, plus: { weapon: 0, armor: 0, accessory: 0 } } },
    ],
    // 출전 명단 (active battle lineup, ≤MAX_ACTIVE) — refIds resolving to a party
    // hero or a recruited ally. The character-select start overrides party[0]/active
    // with the chosen leader; everyone else joins to the bench and is deployed here.
    active: ['knight'],
    gold: 0,
    inventory: { herb: 3 },
    mapId: 'town',
    pos: { x: 7, y: 9 },
    openedChests: [],
    // 누적 플레이타임 (초) — 메인 루프가 runtime에 적산, 타이틀 슬롯 카드가 표시.
    playtime: 0,
    // 룬게이트 빠른이동 — 활성화한 맵 id 목록(현지 룬게이트 상호작용 시 추가). 마을 기본 활성.
    runegates: ['town'],
    // 도감(Bestiary): refIds of every monster the party has faced in battle.
    seen: [],
    // Quest log: { questId: 'active' | 'done' } (see content/quests.js).
    quests: {},
    // 다단계 퀘스트라인 진행: { id: { stage, status:'active'|'done' } }
    // (content/questlines.js). 엔트리 없음 = stage 0 자동-활성(메인 스토리).
    questlines: {},
    // reach/talk cond 트래커 — 방문한 맵 id / 대화한 NPC 배치 id (영구 기록,
    // 최초 1회만 push; 기록 훅은 fieldScene.loadMap / main.openDialog).
    visitedMaps: [],
    talkedNpcs: [],
    // Recruited monsters (reserve roster) + which one joins the active party.
    allies: [],
    activeAlly: null,
    // Fabula Points (party-wide meta-currency: earned by mercy + first Crisis,
    // spent on the 운명 battle command) and Bonds (per-hero co-survival points →
    // max-HP bonus). The "mercy = power" loop. See design 20260529-133914.
    fabula: 0,
    bonds: {},
    // 회차+ (NG+): 0 = 1회차. 회차마다 적 스탯 +25%/골드 +15% (씬 레이어 스케일).
    ngPlus: 0,
    // mercied/slain drive the playstyle-reactive dialogue + ending branch.
    flags: {
      bossDefeated: false, frostBossDefeated: false, swampBossDefeated: false,
      // Fallen Empire progression: knight miniboss (+ its spare/slay branch
      // that gates the throne gates) and the new final boss, the emperor.
      empireKnightDefeated: false, empireKnight_spared: false, empireKnight_slain: false, empireBossDefeated: false,
      // Post-game superboss clears (gate the void / count toward completion).
      magmaDrakeDefeated: false, voidLordDefeated: false,
      // Optional minibosses (서리 여왕 / 핏빛 백작 / 망령 리치 / 다리 파수꾼 / 어둠숲 감시자) — spareable field bosses.
      frostQueenDefeated: false, bloodCountDefeated: false, wraithLichDefeated: false, bridgeWardenDefeated: false, darkWardenDefeated: false, sealGuardianDefeated: false, fallenStarDefeated: false,
      // v3 옵션 던전 미니보스 (성채 집사 / 화염 파수장).
      citadelSeneschalDefeated: false, flameWardenDefeated: false,
      // joinedKnight: the chosen leader's join flag is preset at new-game so their
      // town recruit NPC stays hidden (you can't re-recruit your own leader).
      joinedKnight: false, joinedWarrior: false, joinedHuntress: false, joinedMage: false, joinedDuelist: false,
      // Caged-monster rescue (자비 셋피스) — freed beast joins the ally bench.
      freedHound: false,
      // Moral-choice rooms (탈영병/얼음 사냥꾼/늪 영혼) — one-time; pick fed mercied/slain.
      deserterJudged: false, frozenHunterJudged: false, mireSoulJudged: false,
      // 항구 밀수 창고 도덕 선택 (신고/눈감기 — mercied/slain 연동).
      portSmugglerJudged: false,
      // Dungeon trigger-kit key items (chest loot.flag → requires-door). Each
      // door-gating key needs an entry here + in validateSave or it dies on reload.
      crypt_key: false, bog_key: false,
      intro: false, mercied: 0, slain: 0,
    },
  };
}

// Validate a parsed object against the fresh shape. Missing/wrong-type fields
// fall back to defaults — an old or corrupt save never crashes the game.
export function validateSave(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const fresh = freshSave();
  const member = (m, fb) => {
    const o = m && typeof m === 'object' ? m : {};
    return {
      id: typeof o.id === 'string' ? o.id : fb.id,
      level: Number.isFinite(o.level) ? o.level : 1,
      xp: Number.isFinite(o.xp) ? o.xp : 0,
      hp: Number.isFinite(o.hp) ? o.hp : null,
      mp: Number.isFinite(o.mp) ? o.mp : null,
      equip: {
        weapon: o.equip && typeof o.equip.weapon === 'string' ? o.equip.weapon : null,
        armor: o.equip && typeof o.equip.armor === 'string' ? o.equip.armor : null,
        accessory: o.equip && typeof o.equip.accessory === 'string' ? o.equip.accessory : null,
        // Per-slot upgrade level (강화, 0–5). Clamped; old saves → 0.
        plus: {
          weapon: clampPlus(o.equip && o.equip.plus && o.equip.plus.weapon),
          armor: clampPlus(o.equip && o.equip.plus && o.equip.plus.armor),
          accessory: clampPlus(o.equip && o.equip.plus && o.equip.plus.accessory),
        },
      },
    };
  };
  const vParty = Array.isArray(d.party) && d.party.length
    ? d.party.map((m, i) => member(m, fresh.party[i] || fresh.party[0]))
    : fresh.party;
  // Recruited monsters. Old saves predate this field → []. Each entry keeps a
  // monster refId + its own level/xp/carried hp (mp unused — allies cast no
  // spells this pass). Drop malformed entries (no string refId) defensively.
  const vAllies = Array.isArray(d.allies)
    ? d.allies.filter((a) => a && typeof a.refId === 'string').map((a) => ({
      refId: a.refId,
      level: Number.isFinite(a.level) ? a.level : 1,
      xp: Number.isFinite(a.xp) ? a.xp : 0,
      hp: Number.isFinite(a.hp) ? a.hp : null,
      mp: Number.isFinite(a.mp) ? a.mp : null,
    }))
    : [];
  // Legacy single-ally deploy slot (pre-roster-unification). Kept for migration:
  // a save predating `active` folds it into the derived lineup below.
  const vActiveAlly = (typeof d.activeAlly === 'string' && vAllies.some((a) => a.refId === d.activeAlly))
    ? d.activeAlly : null;
  // Active battle lineup (출전 명단, ≤MAX_ACTIVE): refIds that resolve to a party
  // hero OR a recruited ally (unified roster). Filter to owned ids, dedupe, cap.
  // Empty/missing (old save) → derive from the party (capped) + the legacy
  // activeAlly so a pre-roster save keeps its fighters.
  const ownedIds = new Set([...vParty.map((p) => p.id), ...vAllies.map((a) => a.refId)]);
  let vActive = Array.isArray(d.active)
    ? [...new Set(d.active.filter((id) => typeof id === 'string' && ownedIds.has(id)))].slice(0, MAX_ACTIVE)
    : [];
  if (!vActive.length) {
    vActive = vParty.map((p) => p.id).slice(0, MAX_ACTIVE);
    if (vActiveAlly && !vActive.includes(vActiveAlly) && vActive.length < MAX_ACTIVE) vActive.push(vActiveAlly);
  }
  return {
    version: VERSION,
    party: vParty,
    active: vActive,
    gold: Number.isFinite(d.gold) ? d.gold : 0,
    inventory: d.inventory && typeof d.inventory === 'object' ? { ...d.inventory } : { ...fresh.inventory },
    mapId: typeof d.mapId === 'string' ? d.mapId : fresh.mapId,
    pos: d.pos && Number.isFinite(d.pos.x) && Number.isFinite(d.pos.y) ? { x: d.pos.x, y: d.pos.y } : { ...fresh.pos },
    openedChests: Array.isArray(d.openedChests) ? d.openedChests.filter((c) => typeof c === 'string') : [],
    playtime: Number.isFinite(d.playtime) && d.playtime >= 0 ? Math.round(d.playtime) : 0,
    // 룬게이트 활성 맵 (문자열 id, 중복 제거). 구 세이브는 최소 'town' 보장.
    runegates: (() => { const a = Array.isArray(d.runegates) ? [...new Set(d.runegates.filter((x) => typeof x === 'string'))] : []; if (!a.includes('town')) a.push('town'); return a; })(),
    // 도감 seen-monster ids (string refIds, deduped).
    seen: Array.isArray(d.seen) ? [...new Set(d.seen.filter((s) => typeof s === 'string'))] : [],
    // Quest log: keep only string keys whose state is 'active' | 'done'.
    quests: (d.quests && typeof d.quests === 'object' && !Array.isArray(d.quests))
      ? Object.fromEntries(Object.entries(d.quests).filter(([, v]) => v === 'active' || v === 'done'))
      : {},
    // 퀘스트라인: 정의된 id만, { stage: 음수 불가 정수(스테이지 수로 클램프),
    // status: 'active'|'done' 화이트리스트 }. 손상/미정의 엔트리는 드롭 —
    // 드롭 = "stage 0 자동-활성"의 안전 기본값이라 진행만 잃지 크래시는 없다.
    questlines: (d.questlines && typeof d.questlines === 'object' && !Array.isArray(d.questlines))
      ? Object.fromEntries(Object.entries(d.questlines)
        .filter(([k, v]) => QUESTLINES[k] && v && typeof v === 'object'
          && (v.status === 'active' || v.status === 'done'))
        .map(([k, v]) => [k, {
          stage: Math.max(0, Math.min(QUESTLINES[k].stages.length, Math.floor(Number(v.stage) || 0))),
          status: v.status,
        }]))
      : {},
    // reach/talk 트래커: 문자열만, dedupe. 구세이브(필드 부재) → [].
    visitedMaps: Array.isArray(d.visitedMaps) ? [...new Set(d.visitedMaps.filter((m) => typeof m === 'string'))] : [],
    talkedNpcs: Array.isArray(d.talkedNpcs) ? [...new Set(d.talkedNpcs.filter((n) => typeof n === 'string'))] : [],
    allies: vAllies,
    // Legacy single deploy slot — superseded by `active`, retained for old-save
    // round-trips (validated above as vActiveAlly).
    activeAlly: vActiveAlly,
    // Fabula Points: clamp to [0, FABULA_CAP]. Old saves predate this → 0.
    fabula: Number.isFinite(d.fabula) ? Math.max(0, Math.min(FABULA_CAP, Math.floor(d.fabula))) : 0,
    // 회차+: 음수 불가 정수 클램프 (상한 99 — 폭주 세이브 방어). 구세이브 → 0.
    ngPlus: Number.isFinite(d.ngPlus) ? Math.max(0, Math.min(99, Math.floor(d.ngPlus))) : 0,
    // Bonds: { "a|b": ["loyalty",…] } (emotion arrays, ≤3, valid ids only).
    // Pre-B saves stored numeric points → not arrays → dropped (bonds reset).
    bonds: (d.bonds && typeof d.bonds === 'object' && !Array.isArray(d.bonds))
      ? Object.fromEntries(Object.entries(d.bonds)
        .filter(([k, v]) => typeof k === 'string' && Array.isArray(v))
        .map(([k, v]) => [k, [...new Set(v.filter((e) => EMOTIONS.includes(e)))].slice(0, MAX_EMOTIONS_PER_PAIR)])
        .filter(([, v]) => v.length))
      : {},
    flags: {
      bossDefeated: d.flags ? d.flags.bossDefeated === true : false,
      frostBossDefeated: d.flags ? d.flags.frostBossDefeated === true : false,
      swampBossDefeated: d.flags ? d.flags.swampBossDefeated === true : false,
      empireKnightDefeated: d.flags ? d.flags.empireKnightDefeated === true : false,
      empireKnight_spared: d.flags ? d.flags.empireKnight_spared === true : false,
      empireKnight_slain: d.flags ? d.flags.empireKnight_slain === true : false,
      empireBossDefeated: d.flags ? d.flags.empireBossDefeated === true : false,
      magmaDrakeDefeated: d.flags ? d.flags.magmaDrakeDefeated === true : false,
      voidLordDefeated: d.flags ? d.flags.voidLordDefeated === true : false,
      frostQueenDefeated: d.flags ? d.flags.frostQueenDefeated === true : false,
      bloodCountDefeated: d.flags ? d.flags.bloodCountDefeated === true : false,
      wraithLichDefeated: d.flags ? d.flags.wraithLichDefeated === true : false,
      bridgeWardenDefeated: d.flags ? d.flags.bridgeWardenDefeated === true : false,
      darkWardenDefeated: d.flags ? d.flags.darkWardenDefeated === true : false,
      sealGuardianDefeated: d.flags ? d.flags.sealGuardianDefeated === true : false,
      fallenStarDefeated: d.flags ? d.flags.fallenStarDefeated === true : false,
      citadelSeneschalDefeated: d.flags ? d.flags.citadelSeneschalDefeated === true : false,
      flameWardenDefeated: d.flags ? d.flags.flameWardenDefeated === true : false,
      // Town companion recruits — persist so the NPC stays gone + isn't re-recruitable.
      joinedKnight: d.flags ? d.flags.joinedKnight === true : false,
      joinedWarrior: d.flags ? d.flags.joinedWarrior === true : false,
      joinedHuntress: d.flags ? d.flags.joinedHuntress === true : false,
      joinedMage: d.flags ? d.flags.joinedMage === true : false,
      // joinedDuelist: 쌍검사 leader-preset / recruit flag (recruit NPC pending — other session).
      joinedDuelist: d.flags ? d.flags.joinedDuelist === true : false,
      // Caged-monster rescue (자비 셋피스): persist so the freed beast's NPC
      // stays gone + it isn't re-recruitable. The cage SWITCH is runtime-only.
      freedHound: d.flags ? d.flags.freedHound === true : false,
      deserterJudged: d.flags ? d.flags.deserterJudged === true : false,
      frozenHunterJudged: d.flags ? d.flags.frozenHunterJudged === true : false,
      mireSoulJudged: d.flags ? d.flags.mireSoulJudged === true : false,
      portSmugglerJudged: d.flags ? d.flags.portSmugglerJudged === true : false,
      // Dungeon trigger-kit key items (chest loot.flag → requires-door).
      crypt_key: d.flags ? d.flags.crypt_key === true : false,
      bog_key: d.flags ? d.flags.bog_key === true : false,
      intro: d.flags ? d.flags.intro === true : false,
      mercied: d.flags && Number.isFinite(d.flags.mercied) ? d.flags.mercied : 0,
      slain: d.flags && Number.isFinite(d.flags.slain) ? d.flags.slain : 0,
    },
  };
}

// --- Save ↔ runtime mapping ----------------------------------------------------
// Gotcha #11의 네 지점(freshSave/validateSave/toRuntime/runtimeToSave)을 이 파일
// 하나에 모은다: 새 영속 필드는 여기 네 곳 + save.test 라운드트립 어서션만 고치면
// 되고, 한 곳이라도 빠지면 아래 라운드트립 테스트가 즉시 잡는다. main.js는 이 둘을
// 호출만 한다 (hand-built 매핑이 main.js에 숨어 조용히 필드를 떨구던 사고 방지).

// Validated save → mutable runtime state (deep-enough copies so runtime writes
// never alias the save object).
export function toRuntime(save) {
  return {
    party: save.party.map((p) => ({ refId: p.id, level: p.level, xp: p.xp, hp: p.hp, mp: p.mp, equip: { ...(p.equip || {}) } })),
    active: Array.isArray(save.active) ? [...save.active] : [],
    gold: save.gold,
    inventory: { ...save.inventory },
    mapId: save.mapId,
    pos: { ...save.pos },
    openedChests: [...(save.openedChests || [])],
    playtime: save.playtime || 0,
    runegates: [...(save.runegates || ['town'])],
    seen: [...(save.seen || [])],
    quests: { ...(save.quests || {}) },
    questlines: Object.fromEntries(Object.entries(save.questlines || {}).map(([k, v]) => [k, { ...v }])),
    visitedMaps: [...(save.visitedMaps || [])],
    talkedNpcs: [...(save.talkedNpcs || [])],
    allies: (save.allies || []).map((a) => ({ ...a })),
    activeAlly: save.activeAlly || null,
    fabula: save.fabula || 0,
    bonds: { ...(save.bonds || {}) },
    ngPlus: save.ngPlus || 0,
    flags: { ...save.flags },
  };
}

// Runtime state → save shape (the exact inverse of toRuntime; fed to writeSave,
// which re-validates). PURE — unit-testable round-trip guard.
export function runtimeToSave(runtime) {
  return {
    version: VERSION,
    party: runtime.party.map((p) => ({ id: p.refId, level: p.level, xp: p.xp, hp: p.hp, mp: p.mp, equip: { ...p.equip } })),
    active: [...(runtime.active || [])],
    gold: runtime.gold,
    inventory: { ...runtime.inventory },
    mapId: runtime.mapId,
    pos: { ...runtime.pos },
    openedChests: [...(runtime.openedChests || [])],
    playtime: Math.round(runtime.playtime || 0),
    runegates: [...(runtime.runegates || ['town'])],
    seen: [...(runtime.seen || [])],
    quests: { ...(runtime.quests || {}) },
    questlines: Object.fromEntries(Object.entries(runtime.questlines || {}).map(([k, v]) => [k, { ...v }])),
    visitedMaps: [...(runtime.visitedMaps || [])],
    talkedNpcs: [...(runtime.talkedNpcs || [])],
    allies: (runtime.allies || []).map((a) => ({ ...a })),
    activeAlly: runtime.activeAlly || null,
    fabula: runtime.fabula || 0,
    bonds: { ...(runtime.bonds || {}) },
    ngPlus: runtime.ngPlus || 0,
    flags: { ...runtime.flags },
  };
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* node / no DOM */ }
  return null;
}

// --- Save slots ---------------------------------------------------------------
// Multiple save files. Slot 1 reuses the legacy single-slot KEY (so existing
// saves appear in slot 1 automatically — zero-migration backward compat); slots
// 2+ get a suffixed key. `slot` is the LAST param on each storage fn so the
// existing (data, storage) call shape — used by tests + main.js — keeps working.
export const SAVE_SLOTS = 3;
function slotKey(slot) { return (slot && slot > 1) ? `${KEY}_s${slot}` : KEY; }

export function loadSave(storage = defaultStorage(), slot = 1) {
  if (!storage) return freshSave();
  try {
    const raw = storage.getItem(slotKey(slot));
    if (!raw) return freshSave();
    return validateSave(JSON.parse(raw));
  } catch {
    return freshSave();
  }
}

export function writeSave(data, storage = defaultStorage(), slot = 1) {
  if (!storage) return false;
  try {
    storage.setItem(slotKey(slot), JSON.stringify(validateSave(data)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage = defaultStorage(), slot = 1) {
  if (storage) try { storage.removeItem(slotKey(slot)); } catch { /* ignore */ }
}

export function hasSave(storage = defaultStorage(), slot = 1) {
  try { return !!(storage && storage.getItem(slotKey(slot))); } catch { return false; }
}

// A compact summary of a slot for the title slot-picker, or null if empty.
// { party:[ids], level (highest), mapId, gold }.
export function slotSummary(storage = defaultStorage(), slot = 1) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(slotKey(slot));
    if (!raw) return null;
    const d = validateSave(JSON.parse(raw));
    return {
      party: d.party.map((p) => p.id),
      members: d.party.map((p) => ({ id: p.id, level: p.level || 1 })),
      level: d.party.reduce((m, p) => Math.max(m, p.level || 1), 1),
      mapId: d.mapId,
      gold: d.gold,
      playtime: d.playtime || 0,
    };
  } catch { return null; }
}

// Bootstrap — wires renderer + input + scene manager and builds the `game`
// context that scenes use to navigate (no scene imports another; they call
// game.toX). State machine is the scene stack (engine/sceneManager.js).

import { createRenderer } from './engine/renderer.js';
import { createInput } from './engine/input.js';
import { createSceneManager } from './engine/sceneManager.js';
import { createRng } from './util/rng.js';
import { createAudio } from './util/audio.js';
import { ensureFonts } from './ui/font.js';
import { loadSave, writeSave, freshSave, clearSave, hasSave, slotSummary, SAVE_SLOTS, MAX_ACTIVE, toRuntime, runtimeToSave } from './data/save.js';
import { TitleScene } from './scenes/titleScene.js';
import { CharacterSelectScene } from './scenes/characterSelectScene.js';
import { FieldScene } from './scenes/fieldScene.js';
import { BattleScene } from './scenes/battleScene.js';
import { DialogScene } from './scenes/dialogScene.js';
import { MenuScene } from './scenes/menuScene.js';
import { ShopScene } from './scenes/shopScene.js';
import { WarpScene } from './scenes/warpScene.js';
import { EndingScene } from './scenes/endingScene.js';
import { levelForXp, spellsLearnedBetween, statsAtLevel, xpToReach } from './systems/progression.js';
import { spoils, branchOutcome } from './systems/battle.js';
import { addEmotion, NEGATIVE_EMOTIONS, bondKey, bondPolarity } from './systems/bonds.js';
import { BOND_SKILLS, bondModForCombo, availableBondStrikes } from './content/bondSkills.js';
import { getSpell } from './content/spells.js';
import { getItem, rollDrops } from './content/items.js';
import { getMonster } from './content/monsters.js';
import { getQuest, isQuestComplete } from './content/quests.js';
import { advanceQuestlines, recordTalk } from './content/questlines.js';
import { getMap } from './content/maps/index.js';
import { getDialog, toneFromFlags, tonedDialogId } from './content/dialog.js';

// save ↔ runtime 매핑은 data/save.js의 toRuntime/runtimeToSave가 담당 (Gotcha #11
// 네 지점이 그 파일 하나에 모여 라운드트립 테스트로 보호된다).

const FABULA_CAP = 6;
const BOND_CAP = 10;

const memberName = (refId) => ({ knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' }[refId] || refId);

async function main() {
  const mount = document.getElementById('game');
  const renderer = await createRenderer(mount);
  const input = createInput();
  const scenes = createSceneManager(renderer.root);
  const rng = createRng(((Date.now ? Date.now() : 1) & 0x7fffffff) || 1);

  const audio = createAudio();
  const game = { renderer, input, scenes, rng, audio };
  game.slot = 1; // active save slot — set by the title slot-picker (startGame)
  game.runtime = toRuntime(loadSave()); // placeholder until a slot is chosen
  game.field = null;

  // Load Galmuri font before first render so PIXI.Text bakes with the correct face.
  await ensureFonts();

  // Unlock Web Audio on the first user gesture (autoplay policy).
  const unlockOnce = () => { audio.unlock(); window.removeEventListener('keydown', unlockOnce); };
  window.addEventListener('keydown', unlockOnce);

  game.hasSave = (slot) => hasSave(undefined, slot ?? game.slot);
  // Slot-picker support for the title: per-slot summaries + delete.
  game.slotSummaries = () => Array.from({ length: SAVE_SLOTS }, (_, i) => ({ slot: i + 1, summary: slotSummary(undefined, i + 1) }));
  game.deleteSlot = (slot) => clearSave(undefined, slot);

  game.saveNow = () => { writeSave(runtimeToSave(game.runtime), undefined, game.slot); };

  // The heroes a new game may pick as its leader. Whoever isn't picked joins later
  // via a recruit NPC; the chosen one's joined flag is preset so its NPC stays
  // hidden (you can't re-recruit your own leader). 쌍검사 recruit NPC pending (other session).
  const LEADER_FLAG = { knight: 'joinedKnight', warrior: 'joinedWarrior', huntress: 'joinedHuntress', mage: 'joinedMage', duelist: 'joinedDuelist' };

  game.startGame = (isNew, slot) => {
    if (slot) game.slot = slot;
    // New game → pick a leader first; the select scene calls game.beginGame(leaderId).
    if (isNew) { scenes.push(new CharacterSelectScene(game)); return; }
    game.runtime = toRuntime(loadSave(undefined, game.slot));
    game.enterField();
  };

  // Begin a fresh run with the chosen leader: start solo (the other heroes join
  // via the town/empire recruit NPCs) with that hero as party[0] + sole active.
  // 회차+(NG+) 재시작이면 _ngCarry(회차 수 + 도감)를 새 세이브에 승계한다.
  game.beginGame = (leaderId) => {
    clearSave(undefined, game.slot);
    game.runtime = toRuntime(freshSave());
    if (game._ngCarry) {
      game.runtime.ngPlus = game._ngCarry.ngPlus;
      game.runtime.seen = [...game._ngCarry.seen];
      game._ngCarry = null;
    }
    const lead = { ...game.runtime.party[0], refId: leaderId };
    game.runtime.party = [lead];
    game.runtime.active = [leaderId];
    if (LEADER_FLAG[leaderId]) game.runtime.flags[LEADER_FLAG[leaderId]] = true;
    game.enterField();
  };

  // 회차+ (NG+): 엔딩에서 제안 — 수락하면 도감(seen)을 승계하고 회차 카운트를 올린
  // 채 리더 재선택부터 새 여정. 적 스탯 +25%/회차(battleScene), 골드 +15%/회차
  // (endBattle) — 스케일은 전부 씬/메인 레이어라 리졸버·밸런스 해니스 비접촉.
  game.offerNgPlus = () => {
    const ng = (game.runtime.ngPlus || 0) + 1;
    scenes.push(new DialogScene(game), {
      speaker: '',
      lines: ['여정이 끝났다. 하지만 에녹의 말처럼 — 새로운 균열이 언젠가, 어딘가에서 깨어난다.'],
      choices: ['자유 탐험 (타이틀로)', `회차+ ${ng} 시작 — 적이 강해진 새 여정 (도감 승계)`],
      onChoice: (i) => {
        if (i === 1) {
          game._ngCarry = { ngPlus: ng, seen: [...(game.runtime.seen || [])] };
          while (scenes.depth > 0) scenes.pop();
          game.field = null;
          scenes.push(new CharacterSelectScene(game));
        } else {
          game.toTitle();
        }
      },
    });
  };

  // Push the field for the current runtime + play the one-time prologue/tutorial.
  game.enterField = () => {
    game.field = new FieldScene(game);
    scenes.push(game.field, { mapId: game.runtime.mapId, x: game.runtime.pos.x, y: game.runtime.pos.y });
    game.audio.setMusic('field');
    game.saveNow();
    // Opening prologue — shown once per save (gated by flags.intro). Sets the
    // shared-universe premise + the mercy theme before the player takes a step.
    if (!game.runtime.flags.intro) {
      game.runtime.flags.intro = true;
      game.saveNow();
      const pro = getDialog('prologue');
      // Prologue → controls/objective tutorial → field (once per new game).
      // 튜토리얼 뒤 1막 챕터 타이틀 카드 — 퀘스트라인의 첫 목표(에녹)를 짚어 준다.
      // 회차+면 회차 배지 라인을 덧붙인다 (적 강화 인지).
      const ngLine = (game.runtime.ngPlus || 0) > 0
        ? [`— 회차 ${game.runtime.ngPlus + 1} · 부패가 더 짙게 깨어났다 (적 강화) —`] : [];
      const chapterCard = () => game.showLines('', ['— 1막 · 재의 계시 —', ...ngLine, '낯선 방랑자가 마을에서 너를 기다린다. (X 메뉴 → 퀘스트)']);
      const afterPrologue = () => scenes.push(new DialogScene(game), { dialogId: 'tutorial', afterClose: chapterCard });
      if (pro) scenes.push(new DialogScene(game), { speaker: pro.speaker, lines: pro.lines, afterClose: afterPrologue });
      else afterPrologue();
    }
  };

  game.resumeField = () => { game.field?.resume(); game.saveNow(); };

  // 퀘스트라인 tick — 4개 뮤테이션 지점에서 명시 호출: endBattle 승리(플래그/드랍
  // 반영 후), fieldScene.loadMap(reach 기록 후), openDialog 종료(talk 기록 후),
  // openChest(수집 반영 후). saveNow 내부에서는 절대 호출하지 않는다(영속화 순수성 —
  // 2026-05-31 확정). 전진 이벤트를 메시지로 바꾸고 완료 보상을 지급한 뒤 저장한다.
  // { collect:true } 호출자는 메시지 배열을 받아 자기 다이얼로그에 싣고(전투 승리창),
  // 기본 호출은 진행 토스트 다이얼로그를 직접 띄운다.
  game.tickQuestlines = ({ collect } = {}) => {
    const events = advanceQuestlines(game.runtime);
    if (!events.length) return [];
    const msgs = [];
    for (const ev of events) {
      if (ev.status === 'done') {
        msgs.push(`퀘스트 완료 — 「${ev.name}」!`);
        const r = ev.reward || {};
        if (r.gold) { game.runtime.gold += r.gold; msgs.push(`${r.gold} 골드를 받았다!`); }
        if (r.item) {
          game.runtime.inventory[r.item] = (game.runtime.inventory[r.item] || 0) + 1;
          msgs.push(`${getItem(r.item) ? getItem(r.item).name : r.item}을(를) 받았다!`);
        }
        // 다음 막 챕터 카드 (after 체인이 방금 열림).
        if (ev.unlocked) msgs.push(`— ${ev.unlocked.name} —`, '이야기가 계속된다... (X 메뉴 → 퀘스트)');
      } else {
        msgs.push(`퀘스트 진행 — 「${ev.name}」 (${ev.stage}/${ev.total})`);
        msgs.push(`다음 목표: ${ev.nextDesc}`);
      }
    }
    game.saveNow();
    if (!collect) game.showLines('', msgs);
    return msgs;
  };

  // Final-boss victory → ending screen → title. The cleared save is kept (so
  // "이어하기" drops the player back into the swamp for post-game free roam).
  game.toEnding = (tone) => {
    game.audio?.setMusic('off');
    scenes.push(new EndingScene(game), { tone });
  };
  game.toTitle = () => {
    while (scenes.depth > 0) scenes.pop();
    game.field = null;
    game.audio?.setMusic('off');
    scenes.push(new TitleScene(game));
  };
  game.reloadFieldTo = (mapId, x, y) => { game.field.loadMap(mapId, x, y, 'south'); game.field.busy = false; game.saveNow(); };

  // 도덕 선택 방 (C단계): an NPC with `moral` opens a terminal-choice dialog; the
  // pick feeds the mercy ratio (mercied/slain → tone → ending) for a real, systemic
  // consequence, grants the outcome reward, and sets the one-time flag. Table-driven
  // so each region can add its own non-combat moral fork. choice 0 = mercy.
  const MORALS = {
    // empire — a captured imperial deserter the refugees would execute.
    deserter: {
      spared: { dialog: 'moral_deserter_spared', items: { guard_brooch: 1 } },
      slain: { dialog: 'moral_deserter_slain', gold: 120, items: { elixir: 1 } },
    },
    // frost — a hunter frozen alive in the ice; free him, or smash the ice for loot.
    frozen_hunter: {
      spared: { dialog: 'moral_hunter_spared', items: { ward_amulet: 1 } },
      slain: { dialog: 'moral_hunter_slain', gold: 140, items: { antidote: 1 } },
    },
    // swamp — a soul half-drowned in the mire; lay it to rest, or drain its power.
    mire_soul: {
      spared: { dialog: 'moral_soul_spared', items: { sage_amulet: 1 } },
      slain: { dialog: 'moral_soul_slain', gold: 200, items: { elixir: 1 } },
    },
  };
  game.resolveMoral = (obj, pick) => {
    game.runtime.flags[obj.flag] = true;
    const m = MORALS[obj.moral];
    if (!m) { game.saveNow(); game.resumeField(); return; }
    const out = pick === 0 ? m.spared : m.slain;
    if (pick === 0) game.runtime.flags.mercied = (game.runtime.flags.mercied || 0) + 1;
    else game.runtime.flags.slain = (game.runtime.flags.slain || 0) + 1;
    if (out.gold) game.runtime.gold += out.gold;
    for (const [id, n] of Object.entries(out.items || {})) game.runtime.inventory[id] = (game.runtime.inventory[id] || 0) + n;
    game.saveNow();
    const d = getDialog(out.dialog) || { speaker: '', lines: ['...'] };
    game.showLines(d.speaker || '', d.lines);
  };

  game.openDialog = (dialogId, obj) => {
    // Moral-choice NPC: open the choice dialog; resolveMoral applies the outcome.
    if (obj && obj.moral && !game.runtime.flags[obj.flag]) {
      scenes.push(new DialogScene(game), { dialogId, onChoice: (i) => game.resolveMoral(obj, i) });
      return;
    }
    // Boss tile interaction (face it) → just show its intro line; stepping onto
    // it is what starts the fight (handled in field.arrive → startBossEncounter).
    // Reactive NPCs: swap to a `${id}_${tone}` variant if one exists (DD3 — the
    // town reacts to the party's playstyle without an explicit morality meter).
    // 재대화 변형: talk 타겟 NPC와 이미 대화했고 `${id}_done` 엔트리가 있으면
    // 계시를 반복하는 대신 짧은 리마인더로 스왑 (에녹 — 막마다 한 번의 계시).
    const baseId = (obj && obj.npcId && (game.runtime.talkedNpcs || []).includes(obj.npcId)
      && getDialog(`${dialogId}_done`)) ? `${dialogId}_done` : dialogId;
    // 톤↔유대 커플링 v1: 파티 유대가 어둡게 물들었으면(부정 극 우세) `${id}_grim`
    // 변형을 톤 변형보다 우선 스왑 — 대사가 자비 비율뿐 아니라 "파티 안의 공기"에도
    // 반응한다 (현재 에녹 3차 계시만 저술; 변형이 없으면 톤 경로로 폴백).
    const grim = bondPolarity(game.runtime.bonds) === 'dark' && getDialog(`${baseId}_grim`)
      ? `${baseId}_grim` : null;
    const resolved = grim || tonedDialogId(baseId, game.runtime.flags);
    // Companion-recruit NPC: on dialog close, fold the hero into the party (once).
    // recruitHero chains its own join-line dialog → resume, so DON'T also resume
    // here on that path (would resume the field under the join-line dialog).
    // Caged-monster rescue (자비=파워 셋피스): a `recruitAlly` field on a freed
    // captive folds it into the ally bench on dialog close (parallel to a hero
    // `recruit`, but it joins the monster roster, not the party).
    const baseAfter = obj && obj.recruit && !game.runtime.flags[obj.flag]
      ? () => game.recruitHero(obj.recruit, obj.flag)
      : obj && obj.recruitAlly && !game.runtime.flags[obj.flag]
        ? () => game.recruitAlly(obj.recruitAlly, obj.flag)
        : () => game.resumeField();
    // talk 트래커: npcId(배치별 고유 id — 같은 인물도 막마다 다른 id)를 가진 NPC와의
    // 대화 종료 시 기록 + 퀘스트라인 tick. 진행 토스트가 있으면 그 닫힘이 baseAfter를
    // 이어받는다 (진행 없음 → baseAfter 직행).
    const afterClose = () => {
      if (obj && obj.npcId) recordTalk(game.runtime, obj.npcId);
      const msgs = game.tickQuestlines({ collect: true });
      if (msgs.length) game.showLines('', msgs, baseAfter);
      else baseAfter();
    };
    scenes.push(new DialogScene(game), { dialogId: resolved, afterClose });
  };

  // Add a starting-roster hero (전사/사냥꾼) to the active party via a town NPC.
  // Idempotent: a set join flag means already recruited. New member starts at the
  // party's current lead level so it isn't dead weight when joining mid-run. Sets
  // the join flag (hides the NPC on resumeField rebuild) then shows a join line
  // whose close resumes the field.
  game.recruitHero = (refId, flag) => {
    if (!game.runtime.flags[flag] && !game.runtime.party.some((p) => p.refId === refId)) {
      const lead = game.runtime.party[0];
      const level = lead ? lead.level : 1;
      game.runtime.party.push({ refId, level, xp: xpToReach(level), hp: null, mp: null, equip: { weapon: null, armor: null, accessory: null } });
    }
    game.runtime.flags[flag] = true;
    game.deployIfRoom(refId);
    game.saveNow();
    if ((game.runtime.active || []).includes(refId)) {
      game.showLines(memberName(refId), [`${memberName(refId)}가 파티에 합류했다!`, '— 전열에 합류했다.']);
    } else {
      game.promptSwap(refId, memberName(refId)); // active full → choose who to swap out
    }
  };

  // Display name for any lineup member (hero OR recruited monster ally).
  game.lineupName = (id) => { const n = memberName(id); return n !== id ? n : ((getMonster(id) || {}).name || id); };

  // When a new member joins but the active lineup (≤MAX_ACTIVE) is full, ask which
  // deployed member to swap out. The newcomer takes that member's exact slot; the
  // swapped-out member drops to the bench (re-deploy via X 메뉴 → 편성). Picking
  // "교체 안 함" leaves the newcomer benched.
  game.promptSwap = (refId, name) => {
    const active = game.runtime.active || [];
    const choices = active.map((id) => game.lineupName(id)).concat(['교체 안 함 (대기열로)']);
    scenes.push(new DialogScene(game), {
      speaker: name,
      lines: [`${name}가 합류했다! 하지만 출전 인원이 가득 찼다.`, '누구와 교체할까?'],
      choices,
      onChoice: (i) => {
        const act = game.runtime.active || [];
        if (i >= 0 && i < act.length) {
          const outName = game.lineupName(act[i]);
          act.splice(i, 1, refId); // newcomer takes the swapped-out member's slot
          game.saveNow();
          game.showLines(name, [`${outName} ↔ ${name} 교체!`, `— ${outName}는 대기열로 (X 메뉴 → 편성).`]);
        } else {
          game.showLines(name, ['— 대기열에 들어갔다 (X 메뉴 → 편성에서 출전 인원 변경).']);
        }
      },
    });
  };

  // Free a caged monster in the overworld → it joins the ally bench (자비=파워).
  // Mirrors recruitHero but for the monster roster (runtime.allies, the same list
  // battle-recruit feeds). Idempotent via the join flag; starts at the lead's
  // level so it isn't dead weight. Deploy it from the field menu → 동료.
  game.recruitAlly = (refId, flag) => {
    const m = getMonster(refId);
    const lead = game.runtime.party[0];
    const level = lead ? lead.level : 1;
    if (!game.runtime.flags[flag] && !(game.runtime.allies || []).some((a) => a.refId === refId)) {
      game.runtime.allies.push({ refId, level, xp: xpToReach(level), hp: null, mp: null });
    }
    game.runtime.flags[flag] = true;
    game.deployIfRoom(refId);
    game.saveNow();
    const name = m ? m.name : refId;
    if ((game.runtime.active || []).includes(refId)) {
      game.showLines(name, [m && m.recruitLine ? m.recruitLine : `${name}가 너를 따르기로 했다!`, '— 전열에 합류했다.']);
    } else {
      game.showLines(name, [m && m.recruitLine ? m.recruitLine : `${name}가 너를 따르기로 했다!`], () => game.promptSwap(refId, name));
    }
  };

  // Slot a newly-acquired member (hero or ally) into the active lineup if there's
  // an open slot (≤MAX_ACTIVE); otherwise it waits on the bench. Idempotent.
  game.deployIfRoom = (refId) => {
    if (!Array.isArray(game.runtime.active)) game.runtime.active = [];
    if (!game.runtime.active.includes(refId) && game.runtime.active.length < MAX_ACTIVE) game.runtime.active.push(refId);
  };
  game.showLines = (speaker, lines, afterClose) =>
    scenes.push(new DialogScene(game), { speaker, lines, afterClose: afterClose || (() => game.resumeField()) });

  game.openMenu = (mode) => scenes.push(new MenuScene(game), { mode });
  game.openShop = (shop) => scenes.push(new ShopScene(game), { shop });
  game.openWarp = () => scenes.push(new WarpScene(game));

  // Quest giver NPC interaction. State machine on save.quests[id]:
  //   (none) → show offer, accept (→ 'active')
  //   'active' + complete → turn in: grant reward, consume collect items (→ 'done')
  //   'active' + not complete → progress line
  //   'done' → thank-you line
  game.talkQuest = (questId) => {
    const q = getQuest(questId);
    if (!q) { game.resumeField(); return; }
    const state = game.runtime.quests[questId];
    if (!state) {
      game.runtime.quests[questId] = 'active';
      game.saveNow();
      game.showLines(q.giver, [...q.offer, `— 퀘스트 「${q.name}」 수락! (X 메뉴 → 퀘스트)`]);
      return;
    }
    if (state === 'done') { game.showLines(q.giver, q.done); return; }
    // active:
    if (!isQuestComplete(q, game.runtime)) { game.showLines(q.giver, q.active); return; }
    // turn in → reward
    const r = q.reward || {};
    const msgs = [...q.done];
    if (q.cond.type === 'collect') { // consume the fetched items
      game.runtime.inventory[q.cond.item] = Math.max(0, (game.runtime.inventory[q.cond.item] || 0) - q.cond.count);
    }
    if (r.gold) { game.runtime.gold += r.gold; msgs.push(`${r.gold} 골드를 받았다!`); }
    if (r.item) {
      game.runtime.inventory[r.item] = (game.runtime.inventory[r.item] || 0) + 1;
      msgs.push(`${getItem(r.item) ? getItem(r.item).name : r.item}을(를) 받았다!`);
    }
    game.runtime.quests[questId] = 'done';
    game.saveNow();
    game.showLines(q.giver, msgs);
  };

  game.tryInn = () => {
    if (game.runtime.gold >= 10) {
      game.runtime.gold -= 10;
      for (const p of game.runtime.party) {
        const st = statsAtLevel(p.refId, p.level).stats;
        p.hp = st.maxHp; p.mp = st.maxMp;
      }
      game.saveNow();
      game.showLines('여관 주인', ['푹 쉬었다! HP와 MP를 모두 회복했다.']);
    } else {
      game.showLines('여관 주인', ['골드가 부족하시네요... (10G 필요)']);
    }
  };

  game.startBattle = (encounter, biome) => {
    scenes.push(new BattleScene(game), { monsters: encounter.monsters, biome });
  };

  game.startBossEncounter = (obj, biome) => {
    scenes.push(new DialogScene(game), {
      dialogId: obj.talk || 'boss_intro',
      afterClose: () => scenes.push(new BattleScene(game), { monsters: [obj.ref], isBoss: true, bossObj: obj, biome }),
    });
  };

  game.endBattle = (outcome, state, opts = {}) => {
    scenes.pop(); // remove battle scene
    game.audio?.setMusic('field'); // back to overworld music
    const heroUnits = state.units.filter((u) => u.side === 'hero');
    // 도감(Bestiary): record every monster faced this battle as 'seen'.
    if (!Array.isArray(game.runtime.seen)) game.runtime.seen = [];
    for (const u of state.units) {
      if (u.side === 'enemy' && u.refId && !game.runtime.seen.includes(u.refId)) game.runtime.seen.push(u.refId);
    }
    // Write surviving hp/mp back to runtime.
    for (const p of game.runtime.party) {
      const u = heroUnits.find((h) => h.id === p.refId);
      if (u) { p.hp = Math.max(0, Math.floor(u.hp)); p.mp = u.mp; }
    }

    if (outcome === 'victory') {
      const sp = spoils(state);
      // 회차+ 골드 보정 (+15%/회차) — xp는 그대로 (강해진 적 = 도전, 골드 = 보상).
      const ngGold = Math.round(sp.gold * (1 + 0.15 * (game.runtime.ngPlus || 0)));
      game.runtime.gold += ngGold;
      const msgs = [`${sp.xp} 경험치와 ${ngGold} 골드를 얻었다!`];
      // Battle loot — diverse drops (consumable / 운명의 모래시계 / tier-scaled gear).
      for (const id of rollDrops(state.units.filter((u) => u.side === 'enemy'), game.rng)) {
        game.runtime.inventory[id] = (game.runtime.inventory[id] || 0) + 1;
        const it = getItem(id);
        if (it) msgs.push(`${it.name}을(를) 손에 넣었다!`);
      }
      for (const p of game.runtime.party) {
        const u = heroUnits.find((h) => h.id === p.refId);
        if (!u) continue; // not in this battle (defensive); KO'd members DO gain XP
        // (no death XP penalty — fallen heroes still earn full XP; if it levels
        // them up, the HP/MP restore below also revives them.)
        const oldLevel = p.level;
        p.xp += sp.xp;
        const newLevel = levelForXp(p.xp);
        if (newLevel > oldLevel) {
          const newMax = statsAtLevel(p.refId, newLevel).stats;
          p.level = newLevel;
          // Level-up fully restores HP/MP (DQ convention) — a felt reward.
          p.hp = newMax.maxHp;
          p.mp = newMax.maxMp;
          game.audio?.play('levelup');
          msgs.push(`${memberName(p.refId)}는 레벨 ${newLevel}이 되었다! HP/MP 완전 회복!`);
          for (const sid of spellsLearnedBetween(p.refId, oldLevel, newLevel)) {
            msgs.push(`${memberName(p.refId)}는 ${getSpell(sid).name}를 익혔다!`);
          }
        }
      }
      // Recruited monsters join the reserve roster (resolved='recruited' units
      // stay in state.units with side=enemy/alive=false — see battle.js spare/recruit).
      for (const u of state.units) {
        if (u.resolved === 'recruited') {
          game.runtime.allies.push({ refId: u.refId, level: 1, xp: 0, hp: null, mp: null });
          game.deployIfRoom(u.refId);
          msgs.push(`${u.name}가 동료가 되었다!`);
        }
      }
      // Fabula Points: each mercy act this battle (spare/recruit) banks 1 FP,
      // capped. The "구원 = 자원" half of the loop. (Crisis FP is banked live in
      // battleScene.) See design 20260529-133914.
      // Mercy banks +1 FP per battle (not per enemy) — FP stays a scarce clutch
      // resource; the durable mercy reward is Bonds (below). Balance-tuned via
      // scripts/balance.js: per-enemy FP made rally spammable → bosses trivial.
      if ((state.mercied || 0) > 0) {
        const before = game.runtime.fabula || 0;
        game.runtime.fabula = Math.min(FABULA_CAP, before + 1);
        if (game.runtime.fabula > before) msgs.push('운명의 실(파불라 포인트) +1');
      }
      // Bonds: each of three axes deepens on a battle event, and the POLE it
      // grows is set by whether you showed mercy this fight — the merciful path
      // grows positive poles (sustain), the ruthless path negative ones (glass
      // cannon). Gated on someone-hurt so trivial no-damage fights can't farm.
      const allSurvived = game.runtime.party.every((p) => {
        const u = heroUnits.find((h) => h.id === p.refId);
        return u && u.alive;
      });
      const someoneHurt = heroUnits.some((u) => u.alive && u.hp < u.maxHp);
      const showedMercy = (state.mercied || 0) > 0;
      // Bonds form among the heroes who actually FOUGHT this battle (active lineup,
      // excluding monster allies) — not benched members. Ally unit ids are
      // `ally_<refId>`, so matching against party refIds drops them.
      const partyIds = heroUnits.filter((u) => game.runtime.party.some((p) => p.refId === u.id)).map((u) => u.id);
      const isParty = (id) => partyIds.includes(id);
      const newBonds = [];
      // Snapshot which bond-strike pairs were ALREADY unlocked (≥1 emotion) before
      // this battle's fold, so we can toast a pair the FIRST time its combo unlocks
      // (discoverability — the 운명 menu row alone is too quiet; design D8). Bonds
      // never empty back out, so this fires exactly once per pair.
      const bondUnlockedBefore = {};
      for (const key of Object.keys(BOND_SKILLS)) bondUnlockedBefore[key] = (game.runtime.bonds[key] || []).length > 0;
      const noteBond = (a, b, emo) => { if (addEmotion(game.runtime.bonds, a, b, emo)) newBonds.push(emo); };
      const pairwise = (ids, emo) => {
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++) noteBond(ids[i], ids[j], emo);
      };
      // Each trigger grows ONE axis; the pole is set by mercy (or, on the care
      // axis, by the revive/abandon outcome). Three axes, two poles each.
      // Axis TRUST — co-survival: whole party came through a bloodied fight.
      //   mercy → 충성(loyalty, +def) · slaughter → 불신(mistrust, +atk%).
      if (allSurvived && someoneHurt && partyIds.length >= 2) {
        pairwise(partyIds, showedMercy ? 'loyalty' : 'mistrust');
      }
      // Axis CARE — revive vs abandon: saved a fallen ally → 애정(affection,
      //   Crisis surge); a hero fell and was NOT revived (left behind) →
      //   증오(hatred, death-rage surge) curdling between the survivors.
      const revivedIds = new Set((state.revives || []).map(([, t]) => t));
      for (const [by, target] of (state.revives || [])) {
        if (isParty(by) && isParty(target)) noteBond(by, target, 'affection');
      }
      const abandoned = heroUnits.some((u) => isParty(u.id) && !u.alive && !revivedIds.has(u.id));
      if (abandoned) {
        const survivors = heroUnits.filter((u) => isParty(u.id) && u.alive).map((u) => u.id);
        pairwise(survivors, 'hatred');
      }
      // Axis RESPECT — shared Crisis: ≥2 heroes weathered Crisis together.
      //   mercy → 존경(admiration, +atk) · ruthless → 멸시(contempt, +atk bigger).
      const crisis = (opts.crisisHeroes || []).filter(isParty);
      pairwise(crisis, showedMercy ? 'admiration' : 'contempt');
      if (newBonds.length) {
        const dark = newBonds.some((e) => NEGATIVE_EMOTIONS.includes(e));
        msgs.push(dark ? '어두운 유대가 깊어졌다.' : '전우의 유대가 깊어졌다.');
      }
      // 인연공격 해금 토스트: any combo pair that just crossed 0 → ≥1 emotion.
      for (const key of Object.keys(BOND_SKILLS)) {
        if (bondUnlockedBefore[key] || (game.runtime.bonds[key] || []).length === 0) continue;
        const combo = BOND_SKILLS[key];
        const nameOf = (rid) => (heroUnits.find((u) => u.refId === rid)?.name) || rid;
        msgs.push(`${combo.pair.map(nameOf).join('와(과) ')}의 인연공격 「${combo.name}」이(가) 각성했다!`);
      }
      // Fold this battle's mercy/slain tally into the persistent run counters
      // (drives reactive NPC dialogue + the ending branch).
      game.runtime.flags.mercied = (game.runtime.flags.mercied || 0) + (state.mercied || 0);
      game.runtime.flags.slain = (game.runtime.flags.slain || 0) + (state.slain || 0);
      let isFinal = false;
      let isTrueEnding = false;
      let endTone = 'mixed';
      if (opts.isBoss && opts.bossObj) {
        game.runtime.flags[opts.bossObj.flag || 'bossDefeated'] = true;
        // Branch bosses (e.g. the empire's fallen knight): record HOW this
        // specific enemy was resolved as a `${branchFlag}_spared|_slain` flag,
        // so map portals gated on `requires` can open the right path. Reads the
        // unit's own resolution (branchOutcome), not the battle-wide mercy tally.
        if (opts.bossObj.branchFlag) {
          const outcome = branchOutcome(state, opts.bossObj.ref);
          game.runtime.flags[`${opts.bossObj.branchFlag}_${outcome}`] = true;
        }
        // Ending branch by mercy ratio: merciful (≥70% spared) / ruthless
        // (≥70% slain) / mixed. Boss win dialog can opt in via win_merciful /
        // win_ruthless keys; falls back to the neutral win line. 톤↔유대 커플링:
        // 파티 유대가 부정 극 우세면 `${win}_grim`이 톤 변형보다 우선한다
        // (openDialog의 grim 스왑과 같은 규칙 — 저술된 보스만 opt-in).
        endTone = toneFromFlags(game.runtime.flags);
        const grimWin = bondPolarity(game.runtime.bonds) === 'dark'
          ? getDialog(`${opts.bossObj.win}_grim`) : null;
        const branched = grimWin || getDialog(`${opts.bossObj.win}_${endTone}`);
        const winDialog = branched || getDialog(opts.bossObj.win);
        if (winDialog) msgs.push(...winDialog.lines);
        isFinal = !!opts.bossObj.final;
        // Deepest post-game superboss (심연의 군주) → the TRUE ending, regardless
        // of mercy tone. Distinct from the story finale (the emperor's `final`).
        isTrueEnding = !!opts.bossObj.trueEnding;
      }
      // 퀘스트라인 tick — 보스 플래그/드랍/자비·처치 폴드가 끝난 지점. 전진 메시지를
      // 승리창에 함께 싣는다 (tick이 보상 지급 + saveNow까지 수행).
      msgs.push(...game.tickQuestlines({ collect: true }));
      game.saveNow();
      // Final/true-ending boss → ending screen → title; every other fight resumes.
      const after = isTrueEnding ? () => game.toEnding('true')
        : isFinal ? () => game.toEnding(endTone)
          : () => game.resumeField();
      game.showLines('', msgs, after);
    } else if (outcome === 'defeat') {
      // Gentle wipe penalty: lose only 10% gold (was 50%), revive + return to town.
      const lost = game.runtime.gold - Math.floor(game.runtime.gold * 0.9);
      game.runtime.gold -= lost;
      for (const p of game.runtime.party) {
        const st = statsAtLevel(p.refId, p.level).stats;
        p.hp = st.maxHp; p.mp = st.maxMp;
      }
      game.runtime.mapId = 'town';
      game.runtime.pos = { x: 7, y: 9 };
      game.saveNow();
      game.showLines('', ['전멸했다...', `정신을 차려보니 마을이었다. 골드 ${lost}을(를) 잃었다.`],
        () => game.reloadFieldTo('town', 7, 9));
    } else { // fled
      game.resumeField();
    }
  };

  // Boot at title.
  scenes.push(new TitleScene(game));




  // Main loop.
  renderer.app.ticker.add((ticker) => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    input.tick(dt);
    scenes.update(dt);
    input.endFrame();
  });

  window.addEventListener('resize', () => {
    const { w, h } = renderer.screen;
    scenes.resize(w, h);
  });

  // --- DEV debug hooks (window.__game / __dbg) — QA convenience only, stripped from
  // production builds via import.meta.env.DEV. Lets headless QA force a battle + seed
  // runtime state directly (no field-walk / RNG encounter / keyboard flakiness).
  //   __dbg.battle(['goblin','goblin'])  → start a battle right now
  //   __dbg.seed({party:[{id:'duelist',level:18}], fabula:6, bonds:{'knight|warrior':['loyalty']}})
  //   __dbg.state()                      → current scene + battle snapshot
  if (import.meta.env && import.meta.env.DEV) {
    window.__game = game;
    window.__dbg = {
      seed(o = {}) {
        const r = game.runtime;
        if (o.fabula != null) r.fabula = o.fabula;
        if (o.gold != null) r.gold = o.gold;
        if (o.bonds) r.bonds = { ...r.bonds, ...o.bonds };
        if (o.flags) r.flags = { ...r.flags, ...o.flags };
        if (o.party) r.party = o.party.map((p) => ({ refId: p.id || p.refId, level: p.level || 1, xp: p.xp, hp: p.hp, mp: p.mp, equip: { ...(p.equip || {}) } }));
        return { fabula: r.fabula, party: r.party.map((p) => `${p.refId} L${p.level}`), bonds: r.bonds };
      },
      battle(monsters, biome) {
        const ms = Array.isArray(monsters) ? monsters : (monsters ? [monsters] : ['goblin', 'goblin']);
        game.startBattle({ monsters: ms }, biome || 'wild');
        return `battle: ${ms.join(', ')}`;
      },
      bond(comboId, targetIdx = 0) {
        // Fire a bond strike/ult directly (assembles the action like commitBondStrike).
        // Needs the actor bonded to enough living partners — seed bonds first.
        const bs = scenes.top;
        if (!bs || !bs.state || !bs.actor) return 'no battle / actor';
        const bonds = game.runtime.bonds || {};
        const list = availableBondStrikes(bs.state, bonds, 999, bs.actor.refId);
        const entry = list.find((e) => e.id === comboId);
        if (!entry) return `not available for ${bs.actor.refId} — got: [${list.map((e) => e.id).join(', ')}]`;
        const partners = entry.partnerRefs.map((ref) => bs.heroUnits.find((h) => h.refId === ref && h.alive)).filter(Boolean);
        const mod = bondModForCombo(bonds, bs.actor.refId, entry.partnerRefs);
        const foes = bs.state.units.filter((u) => u.side === 'enemy' && u.alive);
        bs.applyAction({ type: 'bondStrike', actorId: bs.actor.id, partnerIds: partners.map((u) => u.id), comboId: entry.id, name: entry.name, base: entry.base, mod, targetId: (foes[targetIdx] || foes[0]).id });
        return `bond ${comboId} (${[bs.actor.refId, ...entry.partnerRefs].join('·')})`;
      },
      cast(spellId, targetIdx = 0) {
        // Directly fire a hero's spell from the current battle (skips menu keyboard
        // nav — the recurring FX-QA pain). Needs a hero command menu open (actor set).
        const bs = scenes.top;
        if (!bs || !bs.state || !bs.actor) return 'no active battle / actor (open a hero command first)';
        const foes = bs.state.units.filter((u) => u.side === 'enemy' && u.alive);
        const tgt = foes[targetIdx] || foes[0];
        bs.applyAction({ type: 'spell', actorId: bs.actor.id, spellId, targetId: tgt && tgt.id });
        return `cast ${spellId} by ${bs.actor.name}`;
      },
      state() {
        const top = scenes.top; const s = top && top.state;
        return {
          scene: top && top.constructor ? top.constructor.name : null,
          fabula: game.runtime.fabula,
          party: game.runtime.party.map((p) => p.refId),
          battle: s && s.units ? { round: s.round, bondUsed: s.bondStrikeUsed, units: s.units.map((u) => ({ name: u.name, side: u.side, hp: u.hp, maxHp: u.maxHp, alive: u.alive, status: Object.keys(u.status || {}) })) } : null,
        };
      },
    };
  }
}

main();

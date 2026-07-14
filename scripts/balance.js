// Headless turn-based balance harness. Simulates auto-battles through the pure
// systems/battle.js resolver (no Pixi) to read the per-region difficulty curve:
// win rate, average rounds, party HP% remaining, and hero deaths.
//
// Run: node scripts/balance.js [seedsPerScenario]
//
// A simple party AI: heal an ally below 45% if affordable; else cast the best
// affordable damage spell (AoE when 2+ enemies); else attack the weakest enemy;
// drink a herb when a hero drops below 30% and herbs remain. Enemy AI is the
// game's enemyChooseAction. Boss phase-2 enrage is applied each step.

import {
  createBattle, currentActor, advanceTurn, isOver, resolveAction,
  enemyChooseAction, buildEnemyUnit, living, findUnit, enrageBosses, tickStatus, canMercy,
} from '../src/systems/battle.js';
import { buildHeroUnit } from '../src/systems/progression.js';
import { STARTING_PARTY } from '../src/content/party.js';
import { getSpell } from '../src/content/spells.js';
import { getItem } from '../src/content/items.js';
import { createRng } from '../src/util/rng.js';
import { BOND_SKILLS, bondModForCombo } from '../src/content/bondSkills.js';
import { bondKey } from '../src/systems/bonds.js';

// Region scenarios: expected party level + gear tier + encounter pool / boss.
const SCENARIOS = [
  { name: 'wild  (L2)', level: 2, equip: {}, pool: ['goblin', 'wolf', 'spider', 'bat', 'walker', 'hornet'], min: 1, max: 2, herbs: 2 },
  // 어둠숲 (1막 스토리 존, wild 반 계단 위) — 맵 encounters와 동기 (min/max/pool).
  { name: 'dkfrst(L3)', level: 3, equip: {}, pool: ['wolf', 'spider', 'hornet', 'walker'], min: 1, max: 3, herbs: 3 },
  { name: 'dkWARDEN(L3)', level: 3, equip: { weapon: 'bronze_sword' }, boss: 'dark_warden', herbs: 3 },
  { name: 'dungeon(L5)', level: 5, equip: { weapon: 'bronze_sword', armor: 'leather_armor' }, pool: ['imp', 'wisp', 'walker', 'spider', 'brood_mother', 'bone_archer', 'powder_skeleton', 'giant_spider', 'dark_acolyte'], min: 2, max: 4, herbs: 4 },
  { name: 'dungBOSS(L7)', level: 7, equip: { weapon: 'iron_sword', armor: 'chain_armor' }, boss: 'skeleton_king', herbs: 5 },
  { name: 'frost (L10)', level: 10, equip: { weapon: 'iron_sword', armor: 'chain_armor', accessory: 'power_ring' }, pool: ['frost_wisp', 'ice_golem', 'void_walker', 'chimera', 'frost_crow', 'yeti', 'frost_wolf', 'ice_wraith'], min: 2, max: 4, herbs: 6 },
  { name: 'frostBOSS(L12)', level: 12, equip: { weapon: 'silver_sword', armor: 'plate_armor', accessory: 'power_ring' }, boss: 'werewolf_king', herbs: 8 },
  { name: 'swamp (L15)', level: 15, equip: { weapon: 'silver_sword', armor: 'plate_armor', accessory: 'swift_boots' }, pool: ['mud_crawler', 'bog_brute', 'swamp_runner', 'giant_frog', 'medusa_head', 'bog_zombie', 'bog_leech'], min: 2, max: 5, herbs: 8 },
  { name: 'swampBOSS(L16)', level: 16, equip: { weapon: 'frost_blade', armor: 'mythril_mail', accessory: 'vitality_charm' }, boss: 'bog_witch', herbs: 9 },
  // 지하 의식장 (2막 스토리 존, swamp 이후·황제 전 밴드) — 맵 encounters와 동기.
  { name: 'ruins (L16)', level: 16, equip: { weapon: 'frost_blade', armor: 'mythril_mail', accessory: 'vitality_charm' }, pool: ['rusty_soldier', 'spirit_guard', 'wraith_sentinel', 'stone_gargoyle'], min: 2, max: 4, herbs: 9 },
  { name: 'sealGRD(L16)', level: 16, equip: { weapon: 'frost_blade', armor: 'mythril_mail', accessory: 'vitality_charm' }, boss: 'seal_guardian', herbs: 9 },
  // --- POST-GAME bosses: fought by the 4-hero party (incl. mage) at higher
  // levels. Story final (emperor) + two optional superbosses (drake, void lord).
  // Healthy target: 70-95% win with real attrition (deaths 0.3-1.5, not a wipe).
  { name: 'EMPEROR(L18)', level: 18, party: ['knight', 'warrior', 'huntress', 'mage'], equip: { weapon: 'flame_brand', armor: 'mythril_mail', accessory: 'vitality_charm' }, boss: 'fallen_emperor', herbs: 10 },
  // 별무덤 (3막 스토리 리전, 황제 후·드레이크 전 L21 밴드) — 맵 encounters와 동기.
  { name: 'starfl(L21)', level: 21, party: ['knight', 'warrior', 'huntress', 'mage'], equip: { weapon: 'flame_brand', armor: 'mythril_mail', accessory: 'power_ring' }, pool: ['star_husk', 'star_moth', 'revenant', 'reaper'], min: 2, max: 4, herbs: 10 },
  { name: 'FSTAR(L21)', level: 21, party: ['knight', 'warrior', 'huntress', 'mage'], equip: { weapon: 'flame_brand', armor: 'mythril_mail', accessory: 'power_ring' }, boss: 'fallen_star', herbs: 11 },
  { name: 'DRAKE(L25)', level: 25, party: ['knight', 'warrior', 'huntress', 'mage'], equip: { weapon: 'flame_brand', armor: 'dragon_scale', accessory: 'power_ring' }, boss: 'magma_drake', herbs: 12 },
  { name: 'VOIDLORD(L35)', level: 35, party: ['knight', 'warrior', 'huntress', 'mage'], equip: { weapon: 'flame_brand', armor: 'dragon_scale', accessory: 'sage_amulet' }, boss: 'void_lord', herbs: 15 },
];

function equipBonus(equipIds) {
  const out = { atk: 0, def: 0, spd: 0, maxHp: 0, maxMp: 0 };
  for (const id of Object.values(equipIds || {})) {
    const it = id ? getItem(id) : null;
    if (it) for (const k of Object.keys(out)) out[k] += it[k] || 0;
  }
  return out;
}

// Effective single-target power: physical skills add the caster's atk on top of
// `power` (skillDamage scales with strength), so a physical skill out-values a
// plain attack at much lower nominal `power` than a magic spell does.
function effPower(s, actor) {
  const base = (s.power || 0) * (s.hits || 1) * (s.atkScale != null && s.hits > 1 ? 1 : 1);
  return s.physical ? base + actor.atk : base;
}

// Model the class state kits so the harness sees their payoff: a warrior enters
// 분노(rage) when healthy and not raging; a huntress cloaks (은신) before a
// crit-finisher. Returns a state action or null. Mirrors a competent player.
function chooseStateAction(state, actor) {
  const spells = actor.spells.map(getSpell).filter(Boolean);
  const rage = spells.find((s) => s.kind === 'state' && s.state === 'rage');
  if (rage && actor.rage <= 0 && actor.hp > actor.maxHp * 0.55 && actor.mp >= rage.mpCost) {
    return { type: 'spell', actorId: actor.id, spellId: rage.id };
  }
  const cloak = spells.find((s) => s.kind === 'state' && s.state === 'stealth');
  const finisher = spells.find((s) => s.kind === 'damage' && s.physical && (s.power || 0) >= 18);
  const strongTarget = living(state, 'enemy').some((e) => e.hp > e.maxHp * 0.6);
  if (cloak && finisher && !actor.stealth && strongTarget && actor.mp >= cloak.mpCost + finisher.mpCost) {
    return { type: 'spell', actorId: actor.id, spellId: cloak.id };
  }
  return null;
}

// Best hero action this turn (see header for the heuristic).
function chooseHeroAction(state, actor, herbs) {
  const enemies = living(state, 'enemy');
  const allies = living(state, 'hero');
  // Heal a badly hurt ally if a heal spell is affordable.
  const lowAlly = allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (lowAlly && lowAlly.hp / lowAlly.maxHp < 0.45) {
    const healSpell = actor.spells.map(getSpell).find((s) => s && s.kind === 'heal' && s.mpCost <= actor.mp);
    if (healSpell) return { type: 'spell', actorId: actor.id, spellId: healSpell.id, targetId: lowAlly.id };
    // self critical → herb
    if (actor.hp / actor.maxHp < 0.3 && herbs.count > 0) { herbs.count--; return { type: '_herb', actorId: actor.id, targetId: actor.id }; }
  }
  // Set up a combat state when it pays off (warrior 분노 / huntress 은신).
  const stateAct = chooseStateAction(state, actor);
  if (stateAct) return stateAct;
  // Best affordable damage spell (prefer AoE when 2+ enemies).
  const dmgSpells = actor.spells.map(getSpell).filter((s) => s && s.kind === 'damage' && s.mpCost <= actor.mp
    && !(s.requiresStealth && !actor.stealth)); // 그림자 일격류는 은신 상태에서만 (cloak first)
  if (dmgSpells.length) {
    const aoe = dmgSpells.find((s) => s.target === 'allEnemies');
    if (enemies.length >= 2 && aoe) return { type: 'spell', actorId: actor.id, spellId: aoe.id };
    const single = dmgSpells.filter((s) => s.target === 'one').sort((a, b) => effPower(b, actor) - effPower(a, actor))[0];
    const target = enemies.slice().sort((a, b) => a.hp - b.hp)[0];
    // Cast a single-target spell only if it beats a plain attack meaningfully.
    if (single && effPower(single, actor) > actor.atk * 0.6 && actor.mp >= single.mpCost) {
      return { type: 'spell', actorId: actor.id, spellId: single.id, targetId: target.id };
    }
  }
  // Default: focus-fire the weakest enemy.
  const target = enemies.slice().sort((a, b) => a.hp - b.hp)[0];
  return { type: 'attack', actorId: actor.id, targetId: target.id };
}

function runBattle(sc, rng, opts = {}) {
  const equip = equipBonus(sc.equip);
  // Post-game scenarios pass a 4-hero party (incl. the recruited mage); the
  // main ladder uses the default 3-hero STARTING_PARTY.
  // NOTE (2026-05-30 출전 4인): the player can now deploy up to MAX_ACTIVE=4
  // members (character-select start + 편성 bench). The harness still models the
  // tuned 3-hero ladder — a 4th deployed unit is strictly a player advantage
  // (more actions/HP), never a difficulty spike, so the bosses stay beatable.
  // The ladder is NOT re-tuned for 4; it's the floor the player can exceed.
  const roster = sc.party || STARTING_PARTY;
  const heroes = roster.map((id) => buildHeroUnit(id, sc.level, { id, equip }));
  // Mercy-build model: representative accrued bonds (HP/def/atk fold) + a Fabula
  // pool the AI spends on rally/inspire. Approximates a player who spared often.
  const s = Math.min(5, Math.floor(sc.level / 3)); // representative bond strength
  // Bond fold mirrors battleScene.enter: +3%/pt maxHp (cap +15% at str 5), +2 def,
  // +1 atk. Nerfed 2026-05-29 from +5%/cap+25% (mercy-ceiling fix — see TODOS).
  if (opts.mercy) {
    for (const h of heroes) { h.maxHp = Math.floor(h.maxHp * (1 + 0.03 * s)); h.hp = h.maxHp; h.def += 2; h.atk += 1; }
  }
  // Ruthless-build model: negative-bond fold (glass cannon) — offense only, NO
  // maxHp/def. Mirrors battleScene.enter's negative branch: +3 atk (멸시 contempt)
  // + ~+12% atkBuff (불신 mistrust ×2). Earns less Fabula (no mercy FP).
  if (opts.ruthless) {
    for (const h of heroes) { h.atk += 3; h.atkBuff = (h.atkBuff || 0) + 0.12; }
  }
  // FP 모델: 트래시전은 전투 내 수급(~+1 mercy +1 Crisis)만, 보스전은 트래시에서
  // 뱅킹해 온 풀을 가정(실제 경제: FP는 전투 간 이월, 캡 6) — 듀오 인연공격(3 FP)
  // 이 보스전에서 발동 가능해진다 (전투당 1회, bondUsed 게이트 = state.bondStrikeUsed 모델).
  const banked = sc.boss ? (opts.mercy ? 4 : 3) : (opts.mercy ? 2 : 1);
  const fp = { count: (opts.mercy || opts.ruthless) ? banked : 0, inspired: false, bondUsed: false };
  // 대표 유대 (bondModForCombo 라이더): mercy=긍정 극 / ruthless=부정 극.
  const REP_BONDS = opts.mercy
    ? { [bondKey('knight', 'warrior')]: ['loyalty', 'admiration'] }
    : { [bondKey('knight', 'warrior')]: ['mistrust', 'contempt'] };
  const monsters = sc.boss ? [sc.boss] : (() => {
    const n = rng.int(sc.min, sc.max); const out = [];
    for (let i = 0; i < n; i++) out.push(rng.pick(sc.pool));
    return out;
  })();
  const enemies = monsters.map((m) => buildEnemyUnit(m));
  const state = createBattle(heroes, enemies);
  const herbs = { count: sc.herbs || 0 };

  let guard = 0;
  while (!isOver(state) && guard++ < 400) {
    const actor = currentActor(state);
    if (!actor) { advanceTurn(state); continue; }
    const ts = tickStatus(actor, rng);
    if (!actor.alive) { advanceTurn(state); continue; }
    if (ts.skip) { advanceTurn(state); continue; } // asleep
    let action;
    if (actor.side === 'hero') {
      // Mercy-build AI: spend Fabula on rally (revive) / inspire (party buff).
      if ((opts.mercy || opts.ruthless) && fp.count > 0) {
        const ko = state.units.find((u) => u.side === 'hero' && !u.alive);
        if (ko && fp.count >= 2) { fp.count -= 2; resolveAction(state, { type: 'rally', actorId: actor.id, targetId: ko.id }, rng); enrageBosses(state); advanceTurn(state); continue; }
        if (!fp.inspired && living(state, 'enemy').length >= 2 && fp.count >= 1) { fp.count -= 1; fp.inspired = true; resolveAction(state, { type: 'inspire', actorId: actor.id }, rng); advanceTurn(state); continue; }
      }
      // 인연공격 모델 (보스전, 전투당 1회): 기사가 전사와의 듀오 '맹세의 돌격'을
      // FP 3으로 발동 — scene의 commitBondStrike 계약 그대로 (base + bond mod 라이더).
      if ((opts.mercy || opts.ruthless) && sc.boss && !fp.bondUsed && fp.count >= 3 && actor.refId === 'knight') {
        const partner = state.units.find((u) => u.side === 'hero' && u.refId === 'warrior' && u.alive);
        const target = living(state, 'enemy')[0];
        const combo = BOND_SKILLS[bondKey('knight', 'warrior')];
        if (partner && target && combo) {
          fp.count -= 3; fp.bondUsed = true;
          const mod = bondModForCombo(REP_BONDS, 'knight', ['warrior']);
          resolveAction(state, { type: 'bondStrike', actorId: actor.id, partnerIds: [partner.id], comboId: combo.id, base: combo.base, mod, targetId: target.id }, rng);
          enrageBosses(state); advanceTurn(state); continue;
        }
      }
      action = chooseHeroAction(state, actor, herbs);
      if (action.type === '_herb') { actor.hp = Math.min(actor.maxHp, actor.hp + (getItem('herb').effect.hp || 22)); advanceTurn(state); continue; }
    } else {
      action = enemyChooseAction(state, actor.id, rng);
    }
    if (action) resolveAction(state, action, rng);
    enrageBosses(state);
    advanceTurn(state);
  }

  const outcome = isOver(state);
  const aliveHeroes = living(state, 'hero');
  const hpPct = heroes.reduce((s, h) => s + Math.max(0, h.hp) / h.maxHp, 0) / heroes.length;
  return {
    win: outcome === 'victory',
    rounds: state.round,
    hpPct,
    deaths: heroes.length - aliveHeroes.length,
  };
}

function runTable(title, seeds, opts) {
  console.log(`\n── ${title} ──`);
  console.log('scenario        win%   avgRounds  avgHP%remain  avgDeaths');
  console.log('─'.repeat(62));
  for (const sc of SCENARIOS) {
    let wins = 0, rounds = 0, hp = 0, deaths = 0;
    for (let s = 1; s <= seeds; s++) {
      const r = runBattle(sc, createRng(s * 2654435761), opts);
      if (r.win) wins++;
      rounds += r.rounds; hp += r.hpPct; deaths += r.deaths;
    }
    const pct = (n) => (100 * n / seeds).toFixed(0);
    console.log(
      `${sc.name.padEnd(15)} ${pct(wins).padStart(3)}%   ${(rounds / seeds).toFixed(1).padStart(6)}     ${(100 * hp / seeds).toFixed(0).padStart(5)}%       ${(deaths / seeds).toFixed(2).padStart(5)}`
    );
  }
}

function main() {
  const seeds = parseInt(process.argv[2] || '200', 10);
  console.log(`Dragon Crypt balance — ${seeds} battles/scenario`);
  runTable('BASELINE (kill build, no bonds/FP)', seeds, {});
  runTable('MERCY BUILD (pos. bonds: tanky + clutch FP)', seeds, { mercy: true });
  runTable('RUTHLESS BUILD (neg. bonds: glass cannon, less FP)', seeds, { ruthless: true });
  console.log('\nHealthy: encounters ~95-100% win; bosses 70-95% with real HP attrition.');
  console.log('Mercy build should be COMPARABLE to baseline — a bit tankier (bond HP) and');
  console.log('more clutch (rally), not a free pass. Big win%/HP% jumps → bond/FP too strong.');
}

main();

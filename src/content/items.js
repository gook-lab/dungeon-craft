// Item definitions. Pure data.
// kind: 'consumable' (use in battle/menu) | 'weapon' | 'armor'
// consumable: effect {hp?, mp?} applied to one ally
// weapon/armor: stat bonus folded by party.recompute (atk / def)
// sprite: pickup PNG key (reused from game assets) for inventory icons

export const ITEMS = {
  herb: { id: 'herb', name: '약초', kind: 'consumable', effect: { hp: 22 }, price: 8, sprite: 'pickup_potion_hp' },
  mana_drop: { id: 'mana_drop', name: '마나 물방울', kind: 'consumable', effect: { mp: 12 }, price: 12, sprite: 'pickup_potion_mana' },

  // --- Weapons (atk, sometimes a secondary stat) ---
  bronze_sword: { id: 'bronze_sword', name: '청동검', kind: 'weapon', atk: 3, price: 30, sprite: 'pickup_rune' },
  iron_sword: { id: 'iron_sword', name: '강철검', kind: 'weapon', atk: 6, price: 90, sprite: 'pickup_rune' },
  hunters_bow: { id: 'hunters_bow', name: '사냥꾼의 활', kind: 'weapon', atk: 7, spd: 2, price: 120, sprite: 'pickup_rune' },
  oak_staff: { id: 'oak_staff', name: '참나무 지팡이', kind: 'weapon', atk: 5, maxMp: 6, price: 0, sprite: 'pickup_rune' },
  silver_sword: { id: 'silver_sword', name: '은빛 검', kind: 'weapon', atk: 9, price: 0, sprite: 'pickup_rune' },
  frost_blade: { id: 'frost_blade', name: '서리검', kind: 'weapon', atk: 13, spd: 1, element: 'ice', price: 0, sprite: 'pickup_rune' },
  flame_brand: { id: 'flame_brand', name: '화염낙인검', kind: 'weapon', atk: 17, element: 'fire', price: 0, sprite: 'pickup_rune' },
  // Passive-effect weapons (특수효과 무기). Not class-LOCKED (finite pool, any hero),
  // but each passive leans into a class identity — equip to lean a build that way.
  assassin_dagger: { id: 'assassin_dagger', name: '암살자의 단검', kind: 'weapon', atk: 8, spd: 2, price: 180, sprite: 'pickup_rune', passive: { crit: 0.15 } },         // 사냥꾼 暗殺/치명
  crystal_staff: { id: 'crystal_staff', name: '수정 지팡이', kind: 'weapon', atk: 6, maxMp: 10, price: 190, sprite: 'pickup_rune', passive: { regenMp: 0.06 } },          // 마법사 지속
  berserker_axe: { id: 'berserker_axe', name: '광전사의 도끼', kind: 'weapon', atk: 11, price: 210, sprite: 'pickup_rune', passive: { counter: 0.25 } },                   // 전사 전열 반격
  paladin_mace: { id: 'paladin_mace', name: '성기사의 철퇴', kind: 'weapon', atk: 10, def: 2, price: 230, sprite: 'pickup_rune', passive: { regenHp: 0.04 } },             // 기사 자가회복
  guardian_greatsword: { id: 'guardian_greatsword', name: '수호자의 대검', kind: 'weapon', atk: 12, def: 3, price: 300, sprite: 'pickup_rune', passive: { dmgReduce: 0.1 } }, // 탱커 브루저
  marksman_longbow: { id: 'marksman_longbow', name: '명궁의 장궁', kind: 'weapon', atk: 15, spd: 2, price: 340, sprite: 'pickup_rune', passive: { crit: 0.2 } },            // 사냥꾼 고티어 치명
  iron_dagger: { id: 'iron_dagger', name: '무쇠 단검', kind: 'weapon', atk: 5, spd: 3, price: 50, sprite: 'pickup_rune' },                                                 // 초반 경량
  battle_spear: { id: 'battle_spear', name: '전투 창', kind: 'weapon', atk: 12, price: 150, sprite: 'pickup_rune' },                                                       // 중반 일반
  runeblade: { id: 'runeblade', name: '룬검', kind: 'weapon', atk: 14, maxMp: 6, element: 'arcane', price: 280, sprite: 'pickup_rune' },                                  // 마검 하이브리드
  venom_fang: { id: 'venom_fang', name: '독아 단검', kind: 'weapon', atk: 9, spd: 2, price: 200, sprite: 'pickup_rune', passive: { resist: { poison: 0.5 } } },             // 독 면역 로그
  warlords_axe: { id: 'warlords_axe', name: '군주의 도끼', kind: 'weapon', atk: 16, price: 360, sprite: 'pickup_rune', passive: { counter: 0.2 } },                        // 고티어 전사 반격
  archmage_staff: { id: 'archmage_staff', name: '대마법사 지팡이', kind: 'weapon', atk: 9, maxMp: 16, price: 360, sprite: 'pickup_rune', passive: { crit: 0.15 } },        // 고티어 마법사 주문크리
  // 쌍검사(duelist) leaning weapons — high atk/spd glass-cannon w/ crit·riposte. Not
  // class-locked (slot-based equip pool), but built for the gunslinger.
  twin_fang_pistols: { id: 'twin_fang_pistols', name: '쌍아 권총', kind: 'weapon', atk: 13, spd: 3, price: 220, sprite: 'pickup_rune', passive: { crit: 0.18 } },           // 쌍검사 속사 치명
  duelist_gunblade: { id: 'duelist_gunblade', name: '결투의 건블레이드', kind: 'weapon', atk: 15, spd: 2, price: 300, sprite: 'pickup_rune', passive: { counter: 0.2 } },   // 쌍검사 반격 칼·총
  hollowpoint_revolver: { id: 'hollowpoint_revolver', name: '할로우포인트 리볼버', kind: 'weapon', atk: 18, spd: 3, price: 400, sprite: 'pickup_rune', passive: { crit: 0.22 } }, // 고티어 쌍검사 치명
  dragon_slayer: { id: 'dragon_slayer', name: '용살검', kind: 'weapon', atk: 20, price: 0, sprite: 'pickup_rune' },                                                        // 최상위(보상)
  // --- 원소 무기 확장 (물리 클래스가 무기로 모든 속성 상성을 공략) ---
  // atk는 동티어 일반 무기와 비슷하게 — 상성(약점 ▲/반감 ▼)으로 차별화하고
  // 순수 atk 우위로 필수화하지 않는다. 상성은 weaponElement→physical/basic 공격에 상속.
  // NOTE: holy/dark는 즉시 유효(undead/void 몹 다수). earth/thunder/wind는 현재 AFFINITY
  // 테이블이 비어 있어(강점 family 없음) ×1 — 향후 rocky/metal/aerial family 태깅 시 활성.
  stone_maul: { id: 'stone_maul', name: '대지 망치', kind: 'weapon', atk: 13, element: 'earth', price: 250, sprite: 'pickup_rune', passive: { dmgReduce: 0.06 } },          // 전사/나이트 중량
  storm_crossbow: { id: 'storm_crossbow', name: '뇌명 석궁', kind: 'weapon', atk: 12, spd: 2, element: 'thunder', price: 260, sprite: 'pickup_rune', passive: { crit: 0.12 } }, // 사냥꾼 석궁
  blessed_flail: { id: 'blessed_flail', name: '축성 철퇴', kind: 'weapon', atk: 11, def: 1, element: 'holy', price: 270, sprite: 'pickup_rune', passive: { regenHp: 0.04 } }, // 나이트 성물(언데드 특효)
  umbral_dagger: { id: 'umbral_dagger', name: '흑요 단검', kind: 'weapon', atk: 12, spd: 3, element: 'dark', price: 260, sprite: 'pickup_rune', passive: { crit: 0.15 } },    // 쌍검사/사냥꾼(공허 특효)
  // 처단 루트 전용 (원혼의 늪에서만 획득 — 상점/일반 loot 미등록). 마녀를 벤 자의 보상.
  hex_reliquary: { id: 'hex_reliquary', name: '저주의 성물', kind: 'accessory', atk: 6, spd: 4, price: 0, sprite: 'pickup_rune', passive: { crit: 0.12, resist: { poison: 0.6 } } },
  gale_bow: { id: 'gale_bow', name: '질풍궁', kind: 'weapon', atk: 13, spd: 3, element: 'wind', price: 280, sprite: 'pickup_rune', passive: { crit: 0.1 } },                 // 사냥꾼 경량(eva 미구현→crit)
  titan_greataxe: { id: 'titan_greataxe', name: '거인의 도끼', kind: 'weapon', atk: 19, element: 'earth', price: 0, sprite: 'pickup_rune', passive: { counter: 0.15 } },      // 고티어 대지 보상

  // --- Armor (def, sometimes +maxHp; cloth trades def for caster MP) ---
  cloth_robe: { id: 'cloth_robe', name: '천 로브', kind: 'armor', def: 1, maxMp: 8, price: 28, sprite: 'pickup_scroll' },      // caster early
  leather_armor: { id: 'leather_armor', name: '가죽 갑옷', kind: 'armor', def: 2, price: 25, sprite: 'pickup_scroll' },
  studded_leather: { id: 'studded_leather', name: '징박이 가죽', kind: 'armor', def: 3, spd: 1, price: 60, sprite: 'pickup_scroll' }, // light
  chain_armor: { id: 'chain_armor', name: '사슬 갑옷', kind: 'armor', def: 4, price: 80, sprite: 'pickup_scroll' },
  plate_armor: { id: 'plate_armor', name: '판금 갑옷', kind: 'armor', def: 7, maxHp: 12, price: 200, sprite: 'pickup_scroll' },
  guardian_shield: { id: 'guardian_shield', name: '수호의 방패', kind: 'armor', def: 7, price: 0, sprite: 'pickup_scroll' },
  knight_plate: { id: 'knight_plate', name: '기사 판금', kind: 'armor', def: 9, maxHp: 8, price: 320, sprite: 'pickup_scroll' }, // mid-high
  mythril_mail: { id: 'mythril_mail', name: '미스릴 갑옷', kind: 'armor', def: 12, maxHp: 24, price: 0, sprite: 'pickup_scroll' },
  dragon_scale: { id: 'dragon_scale', name: '용비늘 갑옷', kind: 'armor', def: 15, maxHp: 30, spd: 1, price: 700, sprite: 'pickup_scroll' }, // top tier
  padded_vest: { id: 'padded_vest', name: '누비 조끼', kind: 'armor', def: 2, maxHp: 6, price: 40, sprite: 'pickup_scroll' },                                                  // 초반
  scale_mail: { id: 'scale_mail', name: '비늘 갑옷', kind: 'armor', def: 5, spd: 1, price: 130, sprite: 'pickup_scroll' },                                                     // 중반 (def 5 채움)
  mage_robe: { id: 'mage_robe', name: '마도 로브', kind: 'armor', def: 3, maxMp: 14, price: 180, sprite: 'pickup_scroll' },                                                    // 캐스터 방어구
  spiked_armor: { id: 'spiked_armor', name: '가시 갑옷', kind: 'armor', def: 6, price: 240, sprite: 'pickup_scroll', passive: { counter: 0.2 } },                              // 가시 반격
  warded_plate: { id: 'warded_plate', name: '수호 판금', kind: 'armor', def: 8, maxHp: 16, price: 360, sprite: 'pickup_scroll', passive: { resistAll: 0.2 } },                 // 상태이상 저항 탱크
  phoenix_mail: { id: 'phoenix_mail', name: '불사조 갑옷', kind: 'armor', def: 10, maxHp: 20, price: 520, sprite: 'pickup_scroll', passive: { regenHp: 0.05 } },               // 고티어 재생 탱크

  // --- Accessories (varied bonuses) ---
  power_ring: { id: 'power_ring', name: '힘의 반지', kind: 'accessory', atk: 4, price: 110, sprite: 'pickup_rune' },
  swift_boots: { id: 'swift_boots', name: '신속의 장화', kind: 'accessory', spd: 5, price: 130, sprite: 'pickup_rune' },
  sage_amulet: { id: 'sage_amulet', name: '현자의 부적', kind: 'accessory', maxMp: 12, price: 150, sprite: 'pickup_rune' },
  vitality_charm: { id: 'vitality_charm', name: '활력의 부적', kind: 'accessory', maxHp: 28, price: 0, sprite: 'pickup_rune' },
  guard_brooch: { id: 'guard_brooch', name: '수호의 브로치', kind: 'accessory', def: 4, price: 0, sprite: 'pickup_rune' },
  ward_amulet: { id: 'ward_amulet', name: '방호의 부적', kind: 'accessory', def: 3, maxHp: 14, price: 170, sprite: 'pickup_rune' },
  // Passive-effect accessories (장신구 특수효과). `passive` is read live by the
  // resolver (not folded into stats). Numbers are a starting point — tune freely.
  antitoxin_charm: { id: 'antitoxin_charm', name: '해독 부적', kind: 'accessory', maxHp: 8, price: 160, sprite: 'pickup_rune', passive: { resist: { poison: 0.6, burn: 0.4 } } },
  regen_ring: { id: 'regen_ring', name: '재생의 반지', kind: 'accessory', maxHp: 10, price: 220, sprite: 'pickup_rune', passive: { regenHp: 0.05 } },
  thorn_band: { id: 'thorn_band', name: '가시 완갑', kind: 'accessory', def: 2, price: 200, sprite: 'pickup_rune', passive: { counter: 0.3 } },
  lucky_charm: { id: 'lucky_charm', name: '행운의 부적', kind: 'accessory', spd: 2, price: 210, sprite: 'pickup_rune', passive: { crit: 0.12 } },
  aegis_pendant: { id: 'aegis_pendant', name: '수호의 펜던트', kind: 'accessory', def: 3, maxHp: 12, price: 260, sprite: 'pickup_rune', passive: { dmgReduce: 0.12 } },
  berserker_ring: { id: 'berserker_ring', name: '광폭의 반지', kind: 'accessory', atk: 6, price: 240, sprite: 'pickup_rune' },                                                  // 고화력 반지
  focus_band: { id: 'focus_band', name: '집중의 띠', kind: 'accessory', maxMp: 10, price: 230, sprite: 'pickup_rune', passive: { crit: 0.1 } },                                // 캐스터 주문크리
  iron_brooch: { id: 'iron_brooch', name: '무쇠 브로치', kind: 'accessory', def: 5, maxHp: 10, price: 250, sprite: 'pickup_rune', passive: { dmgReduce: 0.08 } },              // 탱키
  phoenix_charm: { id: 'phoenix_charm', name: '불사조 부적', kind: 'accessory', maxHp: 16, price: 300, sprite: 'pickup_rune', passive: { regenHp: 0.06 } },                    // 고티어 재생

  // --- Consumables ---
  antidote: { id: 'antidote', name: '해독초', kind: 'consumable', effect: { cure: 'poison' }, price: 10, sprite: 'pickup_potion_mana' },
  awakening: { id: 'awakening', name: '각성의 종', kind: 'consumable', effect: { cure: 'sleep' }, price: 12, sprite: 'pickup_potion_mana' },
  elixir: { id: 'elixir', name: '엘릭서', kind: 'consumable', effect: { hp: 80, mp: 30 }, price: 0, sprite: 'pickup_potion_hp' },
  // 운명의 모래시계 — restores 1 Fabula Point (운명). Party-shared resource, so the
  // target hero is irrelevant; handled specially in battle/field item use.
  fp_potion: { id: 'fp_potion', name: '운명의 모래시계', kind: 'consumable', effect: { fabula: 1 }, price: 60, sprite: 'pickup_rune' },
  // Return scroll — warp to town from the field menu (not usable in battle;
  // battle filters out `effect.warp` consumables). Sold at the shop.
  return_scroll: { id: 'return_scroll', name: '귀환서', kind: 'consumable', effect: { warp: 'town' }, price: 30, sprite: 'pickup_scroll' },
};

// Bonus stat keys an equipment item may carry.
export const EQUIP_STATS = ['atk', 'def', 'spd', 'maxHp', 'maxMp'];

export function getItem(id) {
  return ITEMS[id] || null;
}

// --- Display helpers (shared by the battle item menu, equip screen, and shop
//     tooltips so they describe an item identically). PURE. -------------------
const ITEM_STAT_KR = { atk: '힘', def: '수비', spd: '민첩', maxHp: 'HP', maxMp: 'MP' };
const ITEM_CURE_KR = { poison: '독', sleep: '수면', weaken: '약화', burn: '화상', shock: '감전', freeze: '동상', atkdown: '위협', defdown: '방어약화', slow: '둔화', petrify: '석화', stun: '기절', blind: '실명', bleed: '출혈' };
const ITEM_KIND_KR = { consumable: '소모품', weapon: '무기', armor: '방어구', accessory: '장신구' };

export function itemKindKR(item) { return item ? (ITEM_KIND_KR[item.kind] || item.kind) : ''; }

// One-line effect summary: a consumable's effect, or a gear's stat bonuses.
export function itemSummary(item) {
  if (!item) return '';
  if (item.kind === 'consumable') {
    const e = item.effect || {};
    const parts = [];
    if (e.hp) parts.push(`HP ${e.hp} 회복`);
    if (e.mp) parts.push(`MP ${e.mp} 회복`);
    if (e.fabula) parts.push(`운명 +${e.fabula}`);
    if (e.cure) parts.push(`${ITEM_CURE_KR[e.cure] || e.cure} 치유`);
    if (e.warp) parts.push('마을로 귀환 (전투 중 사용 불가)');
    return parts.join(' · ') || '특수 효과';
  }
  const parts = [];
  for (const k of EQUIP_STATS) if (item[k]) parts.push(`${ITEM_STAT_KR[k]} +${item[k]}`);
  // Passive effects (✦) — make the accessory/weapon/armor 특수효과 visible in the
  // equip screen + shop (both call itemSummary). Folded after the stat line.
  for (const s of passiveParts(item.passive)) parts.push(s);
  return parts.join(' · ') || '효과 없음';
}

// Human-readable ✦passive descriptors for an item's `passive` object. Pure; used
// by itemSummary. pct rounds to whole percent. resist keys reuse ITEM_CURE_KR.
const PCT = (v) => `${Math.round(v * 100)}%`;
export function passiveParts(passive) {
  if (!passive) return [];
  const out = [];
  if (passive.counter) out.push(`✦반격 ${PCT(passive.counter)}`);
  if (passive.crit) out.push(`✦크리 +${PCT(passive.crit)}`);
  if (passive.dmgReduce) out.push(`✦피해 -${PCT(passive.dmgReduce)}`);
  if (passive.regenHp) out.push(`✦HP ${PCT(passive.regenHp)}/턴`);
  if (passive.regenMp) out.push(`✦MP ${PCT(passive.regenMp)}/턴`);
  if (passive.resistAll) out.push(`✦전 상태이상 ${PCT(passive.resistAll)} 저항`);
  if (passive.resist) for (const k in passive.resist) out.push(`✦${ITEM_CURE_KR[k] || k} ${PCT(passive.resist[k])} 저항`);
  return out;
}

// --- Equipment upgrades (강화) -------------------------------------------------
// Weapons/armor upgraded at the blacksmith, accessories at the jeweler. Each of
// the ≤5 levels adds +20% of the item's base stats. The level lives per-slot in
// equip.plus.{weapon|armor|accessory} (slot-bound: swapping a slot resets it).
export const MAX_UPGRADE = 5;
export const UPGRADE_STEP = 0.2; // +20% of the gear's stats per level (+5 = ×2)

// Gold to upgrade a slot from `plus` → `plus+1` (scales with item value + level).
export function upgradeCost(item, plus) {
  const base = Math.max(60, Math.round((item && item.price ? item.price : 0) * 0.4));
  return base * (plus + 1);
}

// Shared equipped-slot iterator — the one place that resolves the 3 slots +
// getItem + per-slot upgrade level. equipBonus (stats) and equipPassives (combat
// passives) both run through it so the slot-walk lives once. fn(item, plus, slot).
export function forEachEquipped(equip, fn) {
  if (!equip) return;
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const it = getItem(equip[slot]);
    if (!it) continue;
    fn(it, (equip.plus && equip.plus[slot]) || 0, slot);
  }
}

// Total stat bonus from a hero's equipped gear, with per-slot upgrade levels
// folded in. equip = { weapon, armor, accessory, plus?: { ...slot: level } }.
// Canonical — used by battleScene, equipScene, and the balance harness.
export function equipBonus(equip) {
  const out = { atk: 0, def: 0, spd: 0, maxHp: 0, maxMp: 0 };
  forEachEquipped(equip, (it, plus) => {
    const mult = 1 + UPGRADE_STEP * plus;
    for (const k of EQUIP_STATS) if (it[k]) out[k] += Math.floor(it[k] * mult);
  });
  return out;
}

// Combat PASSIVES from equipped gear (accessory특수효과), merged + clamped. Unlike
// equipBonus these are NOT folded into stats — they're read live by the resolver
// at hook points. `plus` (강화) does NOT scale passives in v1 (stats only). Caps:
// resist per-status ≤0.9 (no full immunity stacking), dmgReduce ≤0.4 (DoT stays
// meaningful), crit/counter ≤0.75, regen ≤0.2. An item declares `item.passive`.
export function equipPassives(equip) {
  const out = { resist: {}, regenHp: 0, regenMp: 0, counter: 0, crit: 0, dmgReduce: 0 };
  forEachEquipped(equip, (it) => {
    const p = it.passive;
    if (!p) return;
    if (p.resist) for (const k in p.resist) out.resist[k] = (out.resist[k] || 0) + p.resist[k];
    if (p.resistAll) for (const k of ['poison', 'burn', 'sleep', 'shock', 'weaken', 'freeze', 'atkdown', 'defdown', 'slow']) out.resist[k] = (out.resist[k] || 0) + p.resistAll;
    out.regenHp += p.regenHp || 0;
    out.regenMp += p.regenMp || 0;
    out.counter += p.counter || 0;
    out.crit += p.crit || 0;
    out.dmgReduce += p.dmgReduce || 0;
  });
  for (const k in out.resist) out.resist[k] = Math.min(0.9, out.resist[k]);
  out.regenHp = Math.min(0.2, out.regenHp);
  out.regenMp = Math.min(0.2, out.regenMp);
  out.counter = Math.min(0.75, out.counter);
  out.crit = Math.min(0.75, out.crit);
  out.dmgReduce = Math.min(0.4, out.dmgReduce);
  return out;
}

// Equipped weapon element (if any). Yields the element string from the equipped
// weapon (e.g. 'fire', 'ice', 'arcane'), or null if the weapon has no element.
// This allows physical classes to inherit elemental affinity from their weapon.
export function equipWeaponElement(equip) {
  if (!equip) return null;
  const weapon = getItem(equip.weapon);
  return weapon && weapon.element ? weapon.element : null;
}

// --- Battle loot (drops on victory) ---------------------------------------
// Tiered by encounter difficulty (total enemy xp). rollDrops returns 0-3 item
// ids: a likely consumable, an occasional 운명의 모래시계, and tier-scaled gear
// (a boss always rolls gear). Pure given an rng (rng-less → deterministic).
const DROP_CONSUMABLES = ['herb', 'herb', 'herb', 'mana_drop', 'mana_drop', 'antidote', 'awakening'];
const DROP_GEAR = {
  low: ['bronze_sword', 'iron_dagger', 'leather_armor', 'padded_vest', 'studded_leather', 'power_ring', 'cloth_robe'],
  mid: ['iron_sword', 'hunters_bow', 'battle_spear', 'chain_armor', 'scale_mail', 'mage_robe', 'swift_boots', 'sage_amulet', 'ward_amulet', 'assassin_dagger', 'crystal_staff', 'venom_fang', 'berserker_axe', 'paladin_mace', 'focus_band', 'berserker_ring', 'twin_fang_pistols', 'blessed_flail', 'storm_crossbow'],
  high: ['silver_sword', 'frost_blade', 'runeblade', 'plate_armor', 'knight_plate', 'spiked_armor', 'warded_plate', 'phoenix_mail', 'guardian_shield', 'vitality_charm', 'guard_brooch', 'guardian_greatsword', 'marksman_longbow', 'warlords_axe', 'archmage_staff', 'iron_brooch', 'phoenix_charm', 'duelist_gunblade', 'hollowpoint_revolver', 'stone_maul', 'umbral_dagger', 'gale_bow'],
};
export function rollDrops(enemies, rng) {
  const next = () => (rng ? rng.next() : 0.5);
  const pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(next() * arr.length))];
  const totalXp = (enemies || []).reduce((s, e) => s + (e.xp || 0), 0);
  const isBoss = (enemies || []).some((e) => e.boss);
  const tier = (totalXp >= 120 || isBoss) ? 'high' : totalXp >= 45 ? 'mid' : 'low';
  const out = [];
  if (next() < 0.7) out.push(pick(DROP_CONSUMABLES));                         // consumable (likely)
  if (next() < (isBoss ? 0.6 : tier === 'high' ? 0.18 : tier === 'mid' ? 0.1 : 0.05)) out.push('fp_potion');
  const gearChance = isBoss ? 1 : tier === 'high' ? 0.45 : tier === 'mid' ? 0.3 : 0.18;
  if (next() < gearChance) out.push(pick(DROP_GEAR[tier]));
  return out;
}

// Monster definitions — converted from game's bestiary identities into DQ-style
// turn-based stats. `sprite` is the enemy PNG key (east-facing, reused from
// game assets) drawn on the battle screen.
//
// ai: 'attack' = always basic attack on a random living hero.
//     'boss'   = alternates basic attack and a heavier strike (see battle.js).
// spd drives turn order. xp/gold awarded on kill (summed for the encounter).

export const MONSTERS = {
  walker:  { id: 'walker',  name: '해골 병사', maxHp: 26, atk: 8, def: 2, spd: 4,  xp: 5,  gold: 4,  ai: 'attack', sprite: 'walker', family: 'undead', joinSkill: 'crushblow', recruitLine: '해골 병사가 덜그럭거리며 너의 명령을 기다린다.' },
  goblin:  { id: 'goblin', family: 'beast',  name: '고블린',    maxHp: 22, atk: 9, def: 1, spd: 7,  xp: 6,  gold: 6,  ai: 'attack', sprite: 'goblin', joinSkill: 'crushblow', recruitLine: '고블린이 이를 드러내며 씩 웃는다 — 이제 네 편이다.' },
  wolf:    { id: 'wolf', family: 'beast',    name: '들개',      maxHp: 24, atk: 10, def: 1, spd: 10, xp: 7,  gold: 3,  ai: 'attack', sprite: 'wolf', skills: [{ id: 'flurry', chance: 0.4, cd: 2 }], joinSkill: 'aimedshot', recruitLine: '들개가 너를 새 우두머리로 인정했다.' },
  spider:  { id: 'spider', family: 'beast',  name: '독거미',    maxHp: 18, atk: 6, def: 0, spd: 13, xp: 4,  gold: 2,  ai: 'attack', sprite: 'spider', inflict: { status: 'poison', chance: 0.4, turns: 3 }, skills: [{ id: 'venomspit', chance: 0.35, cd: 2 }, { id: 'webshot', chance: 0.35, cd: 2 }], joinSkill: 'venom_shot', recruitLine: '독거미가 네 그림자에 슬그머니 자리를 튼다.' },
  bat:     { id: 'bat', family: 'aerial',     name: '박쥐',      maxHp: 14, atk: 5, def: 0, spd: 13, xp: 3,  gold: 1,  ai: 'attack', sprite: 'bat', skills: [{ id: 'screech', chance: 0.3, cd: 3 }], joinSkill: 'aimedshot', recruitLine: '박쥐가 파닥이며 네 어깨에 내려앉는다.' },
  imp:     { id: 'imp',     name: '임프',      maxHp: 24, atk: 11, def: 2, spd: 13, xp: 9,  gold: 8,  ai: 'attack', sprite: 'imp', family: 'fiery', inflict: { status: 'burn', chance: 0.4, turns: 3 }, skills: [{ id: 'firebreath', chance: 0.3, cd: 3 }], joinSkill: 'firebolt', recruitLine: '임프가 키득거리며 불씨 하나를 바친다.' },
  wisp:    { id: 'wisp',    name: '도깨비불',  maxHp: 30, atk: 9, def: 4, spd: 6,  xp: 10, gold: 5,  ai: 'attack', sprite: 'wisp', family: 'fiery', skills: [{ id: 'monshock', chance: 0.35, cd: 2 }], joinSkill: 'arcanebolt', recruitLine: '도깨비불이 네 곁을 맴돌기 시작한다.' },
  hornet:  { id: 'hornet', family: 'aerial',  name: '말벌떼',    maxHp: 16, atk: 8, def: 0, spd: 17, xp: 6,  gold: 3,  ai: 'attack', sprite: 'hornet', inflict: { status: 'poison', chance: 0.4, turns: 2 }, skills: [{ id: 'screech', chance: 0.3, cd: 3 }], joinSkill: 'venom_shot', recruitLine: '말벌떼가 윙윙거리며 네 주위를 호위한다.' },
  brood_mother: { id: 'brood_mother', family: 'beast', name: '독거미 여왕', maxHp: 42, atk: 13, def: 3, spd: 9, xp: 18, gold: 12, ai: 'attack', sprite: 'brood_mother', inflict: { status: 'poison', chance: 0.5, turns: 3 }, skills: [{ id: 'broodspawn', chance: 0.3, cd: 99, max: 1 }, { id: 'venomspit', chance: 0.4, cd: 2 }, { id: 'webshot', chance: 0.35, cd: 2 }], joinSkill: 'venom_shot', recruitLine: '독거미 여왕이 너를 둥지의 주인으로 받아들인다.' },
  bone_archer: { id: 'bone_archer', name: '해골 궁수', maxHp: 28, atk: 14, def: 2, spd: 11, xp: 14, gold: 8, ai: 'attack', sprite: 'bone_archer', family: 'undead', skills: [{ id: 'monslam', chance: 0.3, cd: 3 }], joinSkill: 'aimedshot', recruitLine: '해골 궁수가 부서진 활을 들어 너를 겨눈다 — 이제 네 편으로.' },
  powder_skeleton: { id: 'powder_skeleton', name: '분골 해골', maxHp: 24, atk: 12, def: 1, spd: 8, xp: 11, gold: 6, ai: 'attack', sprite: 'powder_skeleton', family: 'undead', joinSkill: 'crushblow', recruitLine: '분골 해골이 흩어진 뼈를 추슬러 일어선다.' },
  // Palette-swap variants of the crypt mobs (distinct tint/scale → new identity).
  // 거대 거미: a hulking 독거미 — bigger, tankier, hits the front with venom.
  giant_spider: { id: 'giant_spider', family: 'beast', name: '거대 거미', maxHp: 60, atk: 18, def: 4, spd: 11, xp: 17, gold: 11, ai: 'attack', sprite: 'spider', spriteScale: 1.55, tint: 0xff9d8a, inflict: { status: 'poison', chance: 0.5, turns: 3 }, skills: [{ id: 'venomspit', chance: 0.4, cd: 2 }], joinSkill: 'venom_shot', recruitLine: '거대 거미가 여덟 다리를 접으며 네 곁에 웅크린다.' },
  // 정예 흑마도사: a battle-mage acolyte — rallies the line (전열 고무) + shocks.
  dark_acolyte: { id: 'dark_acolyte', name: '정예 흑마도사', maxHp: 42, atk: 16, def: 5, spd: 12, xp: 18, gold: 14, ai: 'attack', sprite: 'necromancer', spriteScale: 1.1, tint: 0xc9a0ff, family: 'undead', skills: [{ id: 'warcry', chance: 0.4, cd: 3, max: 2 }, { id: 'monshock', chance: 0.3, cd: 2 }], joinSkill: 'darkmist', recruitLine: '정예 흑마도사가 후드를 내리고 너의 술법서가 되기로 한다.' },

  skeleton_king: {
    id: 'skeleton_king', name: '해골 왕', maxHp: 330, atk: 28, def: 10, spd: 6,
    xp: 80, gold: 100, ai: 'boss', sprite: 'boss_skeleton_king', boss: true, family: 'undead',
    // P1: a heavy bone-smash that cleaves armor. P2(격노): 광폭화 + 더 잦은 강타.
    skills: [{ id: 'monslam', chance: 0.35, cd: 2 }],
    // Phase 2 at 50% HP: enrage (stronger, faster, partial heal, heavies more often).
    phase2: {
      at: 0.5, atkMult: 1.5, spdBonus: 4, heal: 0.15, cry: '해골 왕이 분노한다! 뼈가 들끓는다!',
      skills: [{ id: 'frenzy', chance: 0.7, cd: 0, max: 1 }, { id: 'monslam', chance: 0.4, cd: 2 }],
    },
  },

  // --- Frost region (second area) ---
  frost_wisp:   { id: 'frost_wisp',   name: '서리 도깨비불', maxHp: 38, atk: 15, def: 5, spd: 8,  xp: 14, gold: 8,  ai: 'attack', sprite: 'frost_wisp', family: 'icy', inflict: { status: 'sleep', chance: 0.35, turns: 3 }, skills: [{ id: 'frostbreath', chance: 0.35, cd: 2 }], joinSkill: 'ice_lance', recruitLine: '서리 도깨비불이 차갑게 빛나며 너를 따른다.' },
  ice_golem:    { id: 'ice_golem',    name: '얼음 골렘',     maxHp: 58, atk: 19, def: 9, spd: 3,  xp: 22, gold: 14, ai: 'attack', sprite: 'ice_golem', family: 'icy', inflict: { status: 'freeze', chance: 0.45, turns: 2 }, skills: [{ id: 'frostbreath', chance: 0.35, cd: 2 }], joinSkill: 'ice_lance', recruitLine: '얼음 골렘이 묵직하게 몸을 일으켜 네 편에 선다.' },
  void_walker:  { id: 'void_walker',  name: '공허 보행자',   maxHp: 44, atk: 17, def: 4, spd: 7,  xp: 18, gold: 10, ai: 'attack', sprite: 'void_walker', family: 'undead', inflict: { status: 'weaken', chance: 0.4, turns: 3 }, joinSkill: 'crushblow', recruitLine: '공허 보행자가 텅 빈 눈으로 너를 향한다.' },
  chimera:      { id: 'chimera', family: 'aerial',      name: '키메라',        maxHp: 50, atk: 20, def: 5, spd: 9,  xp: 24, gold: 16, ai: 'attack', sprite: 'chimera', inflict: { status: 'poison', chance: 0.45, turns: 3 }, skills: [{ id: 'venomspit', chance: 0.4, cd: 2 }], joinSkill: 'venom_shot', recruitLine: '키메라가 세 머리를 조아리며 길들여진다.' },
  frost_crow:   { id: 'frost_crow',   name: '얼음 까마귀',   maxHp: 30, atk: 16, def: 3, spd: 20, xp: 13, gold: 7,  ai: 'attack', sprite: 'carrion_crow', family: 'icy', skills: [{ id: 'screech', chance: 0.3, cd: 3 }, { id: 'divebomb', chance: 0.35, cd: 2 }], joinSkill: 'aimedshot', recruitLine: '얼음 까마귀가 네 머리 위를 선회하며 따른다.' },
  yeti:         { id: 'yeti',         name: '예티',          maxHp: 82, atk: 25, def: 8, spd: 6,  xp: 30, gold: 18, ai: 'attack', sprite: 'yeti', family: 'icy', inflict: { status: 'freeze', chance: 0.4, turns: 2 }, skills: [{ id: 'monslam', chance: 0.4, cd: 2 }], joinSkill: 'ice_lance', recruitLine: '예티가 우렁차게 포효하더니 네 뒤를 따른다.' },
  // 서리 늑대: an icy 들개 palette-swap — a blistering-fast charger that outruns
  // the bruiser heroes (spd 22 > frost-region warrior) and freezes on the bite.
  frost_wolf:   { id: 'frost_wolf',   name: '서리 늑대', maxHp: 40, atk: 18, def: 3, spd: 22, xp: 16, gold: 9, ai: 'attack', sprite: 'wolf', tint: 0x9fd6ff, family: 'icy', inflict: { status: 'freeze', chance: 0.35, turns: 2 }, joinSkill: 'aimedshot', recruitLine: '서리 늑대가 입김을 내뿜으며 네 곁을 달린다.' },
  // 얼음 망령: a pale 공허 정찰자 recolour — a frost caster that chills the front.
  ice_wraith:   { id: 'ice_wraith',   name: '얼음 망령', maxHp: 44, atk: 16, def: 5, spd: 10, xp: 18, gold: 11, ai: 'attack', sprite: 'void_drifter', spriteScale: 1.05, tint: 0xbff0ff, family: 'icy', inflict: { status: 'freeze', chance: 0.45, turns: 2 }, skills: [{ id: 'frostbreath', chance: 0.4, cd: 2 }], joinSkill: 'ice_lance', recruitLine: '얼음 망령이 서릿발을 거두고 네게 깃든다.' },
  // Optional frost MINIBOSS (ai:'boss' but NOT boss:true → spareable; not
  // recruitable — too strong to fold into the party). Gated field encounter.
  frost_queen:  { id: 'frost_queen', name: '서리 여왕', maxHp: 520, atk: 40, def: 13, spd: 14, xp: 280, gold: 360, ai: 'boss', sprite: 'boss_ice_queen', spriteScale: 0.8, family: 'icy', recruitable: false, inflict: { status: 'freeze', chance: 0.45, turns: 2 },
    skills: [{ id: 'frostbreath', chance: 0.5, cd: 2 }, { id: 'curse', chance: 0.3, cd: 3 }],
    phase2: { at: 0.5, atkMult: 1.5, spdBonus: 5, heal: 0.15, cry: '서리 여왕이 분노한다! 폭설이 휘몰아친다!', skills: [{ id: 'frenzy', chance: 0.7, cd: 0, max: 1 }, { id: 'frostbreath', chance: 0.5, cd: 2 }] } },

  werewolf_king: {
    id: 'werewolf_king', family: 'beast', name: '늑대인간 왕', maxHp: 440, atk: 45, def: 13, spd: 11,
    xp: 220, gold: 320, ai: 'boss', sprite: 'boss_werewolf_king', boss: true,
    // P1: 갈퀴 강타(방어 관통). P2(격노): 광폭화로 빠른 연타 + 강타 유지.
    skills: [{ id: 'monslam', chance: 0.4, cd: 2 }],
    phase2: {
      at: 0.5, atkMult: 1.6, spdBonus: 6, heal: 0.18, cry: '늑대인간 왕이 광폭화한다! 달빛이 끓는다!',
      skills: [{ id: 'frenzy', chance: 0.7, cd: 0, max: 1 }, { id: 'monslam', chance: 0.4, cd: 1 }],
    },
  },

  // --- Toxic Swamp (third region) ---
  mud_crawler: { id: 'mud_crawler', family: 'beast', name: '진흙 포식자', maxHp: 72, atk: 23, def: 8, spd: 4, xp: 30, gold: 18, ai: 'attack', sprite: 'mud_crawler', inflict: { status: 'poison', chance: 0.45, turns: 4 }, skills: [{ id: 'venomspit', chance: 0.4, cd: 2 }], joinSkill: 'venom_shot', recruitLine: '진흙 포식자가 끈적이며 너의 뒤를 따른다.' },
  bog_brute:   { id: 'bog_brute', family: 'beast',   name: '늪지 괴인',   maxHp: 90, atk: 27, def: 11, spd: 5, xp: 38, gold: 24, ai: 'attack', sprite: 'brute', skills: [{ id: 'monslam', chance: 0.4, cd: 2 }], joinSkill: 'crushblow', recruitLine: '늪지 괴인이 굵은 팔을 늘어뜨리며 복종한다.' },
  swamp_runner:{ id: 'swamp_runner', family: 'beast',name: '늪 추적자',   maxHp: 54, atk: 22, def: 4, spd: 26, xp: 28, gold: 15, ai: 'attack', sprite: 'runner', skills: [{ id: 'flurry', chance: 0.4, cd: 2 }], joinSkill: 'aimedshot', recruitLine: '늪 추적자가 잽싸게 네 곁에 붙는다.' },
  giant_frog:  { id: 'giant_frog', family: 'beast',  name: '거대 두꺼비', maxHp: 66, atk: 20, def: 6, spd: 8, xp: 30, gold: 17, ai: 'attack', sprite: 'frog', inflict: { status: 'sleep', chance: 0.35, turns: 3 }, skills: [{ id: 'tonguelash', chance: 0.4, cd: 2 }], joinSkill: 'crushblow', recruitLine: '거대 두꺼비가 긴 혀를 날름이며 너를 따른다.' },
  medusa_head: { id: 'medusa_head', name: '메두사의 머리', maxHp: 60, atk: 25, def: 6, spd: 12, xp: 34, gold: 20, ai: 'attack', sprite: 'medusa_head', inflict: { status: 'sleep', chance: 0.4, turns: 2 }, skills: [{ id: 'venomspit', chance: 0.35, cd: 2 }, { id: 'petrify', chance: 0.4, cd: 3 }], joinSkill: 'venom_shot', recruitLine: '메두사의 머리가 너를 돌로 만들기를 멈추고 따른다.' },
  // 늪 좀비: a bloated 해골 병사 recolour — lumbering, but it can 자폭(kamikaze)
  // once per fight, trading itself for a line-wide blast. Recruit it before it pops.
  bog_zombie:  { id: 'bog_zombie',  name: '늪 좀비',   maxHp: 74, atk: 22, def: 7, spd: 5,  xp: 32, gold: 16, ai: 'attack', sprite: 'walker', spriteScale: 1.12, tint: 0x9fcf7a, family: 'undead', skills: [{ id: 'kamikaze', chance: 0.22, cd: 99, max: 1 }], joinSkill: 'crushblow', recruitLine: '늪 좀비가 터지기 직전 멈춰 서서 너를 새 주인으로 섬긴다.' },
  // 늪 거머리: a small dark 식인꽃 recolour — a nimble bloodsucker (영혼 흡수 drain).
  bog_leech:   { id: 'bog_leech', family: 'beast',   name: '늪 거머리', maxHp: 50, atk: 21, def: 4, spd: 14, xp: 30, gold: 15, ai: 'attack', sprite: 'carnivore_plant', spriteScale: 0.82, tint: 0x8a3b3b, inflict: { status: 'poison', chance: 0.4, turns: 3 }, skills: [{ id: 'lifedrain', chance: 0.4, cd: 2 }], joinSkill: 'venom_shot', recruitLine: '늪 거머리가 흡혈을 멈추고 네 피붙이가 된다.' },

  bog_witch: {
    id: 'bog_witch', name: '늪의 마녀', maxHp: 790, atk: 56, def: 16, spd: 13, // 660→790 (2026-07-14: L16 3인 magicScale 화력에 swampBOSS 100%/64%HP 무저항 — deaths 0.4-0.8 밴드 복원)
    xp: 520, gold: 720, ai: 'boss', sprite: 'boss_bog_witch', boss: true,
    inflict: { status: 'poison', chance: 0.5, turns: 4 },
    // P1: 독 + 저주 압박. P2(격노): 재생으로 장기전 + 저주/독 유지.
    skills: [{ id: 'venomspit', chance: 0.4, cd: 1 }, { id: 'curse', chance: 0.35, cd: 3 }],
    phase2: {
      at: 0.5, atkMult: 1.55, spdBonus: 6, heal: 0.2, cry: '늪의 마녀가 저주를 토해낸다! 독무가 차오른다!',
      skills: [{ id: 'monregen', chance: 0.4, cd: 4 }, { id: 'curse', chance: 0.4, cd: 3 }, { id: 'venomspit', chance: 0.4, cd: 1 }],
    },
  },

  // --- Fallen Empire (fourth region, post-swamp — the toughest area; the
  // throne of the 타락한 황제 is the new final boss). Theme = RESPECT axis:
  // these were the empire's soldiers, kept as people you can spare or crush. ---
  rusty_soldier: { id: 'rusty_soldier', name: '녹슨 병사', maxHp: 80, atk: 27, def: 9,  spd: 7,  xp: 38, gold: 22, ai: 'attack', sprite: 'rusty_soldier', family: 'undead', joinSkill: 'crushblow', recruitLine: '녹슨 병사가 삐걱이는 경례로 충성을 맹세한다.' },
  spirit_guard:  { id: 'spirit_guard',  name: '유령 위병', maxHp: 72, atk: 28, def: 6,  spd: 24, xp: 40, gold: 20, ai: 'attack', sprite: 'spirit_guard', family: 'undead', inflict: { status: 'weaken', chance: 0.4, turns: 3 }, skills: [{ id: 'monshock', chance: 0.35, cd: 2 }], joinSkill: 'aimedshot', recruitLine: '유령 위병이 창을 거두고 네 곁을 지킨다.' },
  stone_gargoyle:{ id: 'stone_gargoyle', family: 'rocky',name: '석상 가고일', maxHp: 100, atk: 26, def: 14, spd: 4,  xp: 46, gold: 28, ai: 'attack', sprite: 'stone_gargoyle', recruitable: false, skills: [{ id: 'monslam', chance: 0.4, cd: 2 }, { id: 'stoneskin', chance: 0.4, cd: 4, max: 2 }] },
  rune_guardian: { id: 'rune_guardian', family: 'rocky', name: '룬 수호상', maxHp: 124, atk: 26, def: 18, spd: 5, xp: 50, gold: 30, ai: 'attack', sprite: 'rune_guardian', skills: [{ id: 'monslam', chance: 0.4, cd: 2 }, { id: 'stoneskin', chance: 0.4, cd: 4, max: 2 }], joinSkill: 'crushblow', recruitLine: '룬 수호상이 새겨진 문양을 빛내며 새 주인을 맞는다.' },
  war_drummer:   { id: 'war_drummer',  name: '전쟁 고수', maxHp: 70, atk: 25, def: 8, spd: 11, xp: 42, gold: 24, ai: 'attack', sprite: 'war_drummer', family: 'undead', skills: [{ id: 'wardrum', chance: 0.5, cd: 3, max: 2 }], joinSkill: 'aimedshot', recruitLine: '전쟁 고수가 북을 울리며 너의 진군에 합류한다.' },
  // Empire palette-swap variants (same army, different rank → distinct tint/scale).
  // 제국 근위병: a gilded 녹슨 병사 elite — a captain that rallies the line (전열 고무).
  imperial_guard: { id: 'imperial_guard', name: '제국 근위병', maxHp: 120, atk: 30, def: 14, spd: 8, xp: 52, gold: 34, ai: 'attack', sprite: 'rusty_soldier', spriteScale: 1.18, tint: 0xd9c27a, family: 'undead', skills: [{ id: 'warcry', chance: 0.4, cd: 3, max: 2 }, { id: 'monslam', chance: 0.3, cd: 2 }], joinSkill: 'crushblow', recruitLine: '제국 근위병이 금빛 갑주를 울리며 새 황제에게 경례한다.' },
  // 원혼 위병: a spectral-violet 유령 위병 recolour — a fast curse-caster.
  wraith_sentinel: { id: 'wraith_sentinel', name: '원혼 위병', maxHp: 84, atk: 31, def: 7, spd: 26, xp: 48, gold: 26, ai: 'attack', sprite: 'spirit_guard', tint: 0xc4b8ff, family: 'undead', inflict: { status: 'weaken', chance: 0.45, turns: 3 }, skills: [{ id: 'curse', chance: 0.3, cd: 3 }, { id: 'monshock', chance: 0.35, cd: 2 }], joinSkill: 'aimedshot', recruitLine: '원혼 위병이 원한을 거두고 너의 곁을 지킨다.' },
  // Optional empire MINIBOSS (spareable, not recruitable). A blood count haunting
  // the ruins; lifedrain pressure. Gated field encounter (bloodCountDefeated).
  blood_count:   { id: 'blood_count', name: '핏빛 백작', maxHp: 580, atk: 44, def: 14, spd: 15, xp: 320, gold: 420, ai: 'boss', sprite: 'boss_vampire', spriteScale: 0.8, family: 'undead', recruitable: false, inflict: { status: 'weaken', chance: 0.4, turns: 3 },
    skills: [{ id: 'lifedrain', chance: 0.5, cd: 2 }, { id: 'curse', chance: 0.3, cd: 3 }],
    phase2: { at: 0.5, atkMult: 1.55, spdBonus: 6, heal: 0.2, cry: '핏빛 백작이 송곳니를 드러낸다! 피의 안개가 인다!', skills: [{ id: 'frenzy', chance: 0.7, cd: 0, max: 1 }, { id: 'lifedrain', chance: 0.5, cd: 2 }] } },

  // Optional empire MINIBOSS — the 다리 파수꾼 (bridge warden) chained to guard the
  // empire's last bridge over the chasm. NOT boss:true → stays SPAREABLE (자비
  // 셋피스: spare/free the chained guardian); recruitable too (joins as an ally).
  // Palette-swap of rune_guardian (bronze tint + upscaled) for a distinct
  // silhouette (field sprite mapped in fieldScene.getMapBossSprite). A slow
  // colossus that goes berserk at half HP (the bridge buckles under it).
  bridge_warden: { id: 'bridge_warden', family: 'rocky', name: '다리 파수꾼', maxHp: 300, atk: 34, def: 17, spd: 7, xp: 240, gold: 200, ai: 'boss', sprite: 'rune_guardian', tint: 0xc9a86a, spriteScale: 1.4, mercyThreshold: 0.35,
    skills: [{ id: 'monslam', chance: 0.45, cd: 2 }], joinSkill: 'crushblow', recruitLine: '다리 파수꾼이 사슬을 끊고 너의 뒤를 따른다 — 이제 그의 충성은 너의 것이다.',
    phase2: { at: 0.5, atkMult: 1.4, spdBonus: 4, cry: '다리가 무너진다! 파수꾼이 마지막 사슬을 끊고 광폭해진다!', skills: [{ id: 'monslam', chance: 0.7, cd: 0, max: 1 }] } },

  // ─── 별무덤 (3막 스토리 리전, L20 밴드 — 황제와 분화구 사이) ───
  // 별의 허물 — 떨어진 별의 껍데기에 부패가 깃든 것. revenant 잿빛 스왑.
  star_husk: { id: 'star_husk', name: '별의 허물', maxHp: 125, atk: 31, def: 12, spd: 7, xp: 78, gold: 44, ai: 'attack', sprite: 'revenant', tint: 0xbfc9d8, family: 'void', skills: [{ id: 'lifedrain', chance: 0.4, cd: 2 }], joinSkill: 'crushblow', recruitLine: '별의 허물이 희미하게 빛나며 너의 뒤를 떠돈다.' },
  // 별빛 나방 — 잔광에 꼬인 빠른 유격수 (interleaving: 브루저 히어로보다 먼저 친다).
  star_moth: { id: 'star_moth', name: '별빛 나방', maxHp: 78, atk: 30, def: 4, spd: 28, xp: 66, gold: 36, ai: 'attack', sprite: 'fire_bat', tint: 0x9fd8ff, family: 'void', skills: [{ id: 'screech', chance: 0.35, cd: 3 }], joinSkill: 'venom_shot', recruitLine: '별빛 나방이 네 어깨 위에 내려앉는다.' },
  // 떨어진 별 (별무덤 리전 보스) — 균열의 밤에 떨어져 부패에 붙들린 별의 잔해.
  // NOT boss:true → 자비로 '해방'(스페어)·영입 가능. frost_wisp 금빛 스왑 대형.
  fallen_star: {
    id: 'fallen_star', name: '떨어진 별', maxHp: 1050, atk: 100, def: 15, spd: 30,
    xp: 900, gold: 800, ai: 'boss', sprite: 'frost_wisp', tint: 0xffd77a, spriteScale: 1.7,
    family: 'void', mercyThreshold: 0.35,
    skills: [{ id: 'voidblast', chance: 0.35, cd: 2 }, { id: 'monshock', chance: 0.3, cd: 3 }],
    joinSkill: 'aimedshot', recruitLine: '떨어진 별이 부패를 털어내고 네 곁에서 다시 빛나기 시작한다.',
    phase2: { at: 0.5, atkMult: 1.25, spdBonus: 4, cry: '별의 잔해가 마지막 빛을 쥐어짠다 — 잿빛 들판이 대낮처럼 밝아진다!' },
  },

  // 봉인의 파수병 (2막 스토리 존 미니보스) — 황제의 의식장을 아직 지키는 위병의
  // 망령. NOT boss:true → 스페어/영입 가능. spirit_guard 팔레트 스왑(금빛 서약 +
  // 업스케일). swamp(L15) 이후 · 황제(L18) 전 밴드 기준 튜닝.
  seal_guardian: {
    id: 'seal_guardian', name: '봉인의 파수병', maxHp: 380, atk: 46, def: 14, spd: 22,
    xp: 260, gold: 220, ai: 'boss', sprite: 'spirit_guard', tint: 0xd8b84a, spriteScale: 1.45,
    family: 'undead', mercyThreshold: 0.35, skills: [{ id: 'monshock', chance: 0.4, cd: 2 }],
    joinSkill: 'crushblow', recruitLine: '파수병이 창을 내려놓는다 — "봉인은... 이제 그대가 맡으라."',
    phase2: { at: 0.5, atkMult: 1.35, spdBonus: 3, cry: '파수병의 서약 인장이 타오른다 — "의식장은... 넘길 수 없다!"' },
  },

  // 어둠숲의 감시자 (1막 스토리 존 미니보스) — 부패에 비틀린 옛 묘지기 사냥개.
  // NOT boss:true → 스페어/영입 가능(자비 셋피스). grave_hound 팔레트 스왑(보랏빛
  // 부패 + 업스케일). skeleton_king(320) 전 단계 — 1막 초 파티(~L2-3) 기준 튜닝.
  dark_warden: {
    id: 'dark_warden', name: '어둠숲의 감시자', maxHp: 170, atk: 16, def: 4, spd: 11,
    xp: 55, gold: 60, ai: 'boss', sprite: 'grave_hound', tint: 0x8a6bff, spriteScale: 1.35,
    mercyThreshold: 0.35, skills: [{ id: 'flurry', chance: 0.4, cd: 2 }],
    joinSkill: 'crushblow', recruitLine: '감시자가 으르렁거림을 거두고 네 발치에 엎드린다 — 숲의 후각이 너의 것이 된다.',
    phase2: { at: 0.5, atkMult: 1.3, spdBonus: 2, cry: '감시자의 눈이 보랏빛으로 타오른다 — 부패가 마지막 힘을 쥐어짠다!' },
  },

  // Miniboss — NOT a true `boss` (so it stays spareable: canMercy excludes
  // boss:true). ai:'boss' gives it heavy strikes; the higher mercyThreshold
  // opens a generous spare window (its spare-vs-slay opens the 정문/뒷문 gate
  // to the throne, via branchOutcome + endBattle branchFlag). Recruitable.
  fallen_knight: {
    id: 'fallen_knight', family: 'metal', name: '타락한 기사', maxHp: 150, atk: 28, def: 12, spd: 9,
    xp: 90, gold: 110, ai: 'boss', sprite: 'fallen_knight', mercyThreshold: 0.4, recruitable: true,
    joinSkill: 'crushblow', recruitLine: '타락한 기사가 검을 거두고 한쪽 무릎을 꿇는다 — 다시, 맹세를.',
  },

  // Final boss — the toughest in the game (> bog_witch). final:true lives on
  // the map boss OBJECT (empire_throne), not here; this just defines stats.
  fallen_emperor: {
    id: 'fallen_emperor', name: '타락한 황제', maxHp: 1400, atk: 97, def: 18, spd: 14, // 980→1400 (2026-07-14: 4인 파티 EMPEROR 100%/89%HP 3.7R 무저항 — atk는 frenzy×enrage 절벽이라 HP만; P2 체류 연장)
    xp: 900, gold: 1200, ai: 'boss', sprite: 'fallen_emperor', boss: true, family: 'undead',
    // P1: 제국의 위압(전체 약화 저주) + 제왕의 일격(관통). P2(격노): 광폭화 +
    // 영혼 흡수(자가 회복)로 처형 페이즈 — 최종전다운 2페이즈 압박.
    skills: [{ id: 'curse', chance: 0.35, cd: 3 }, { id: 'monslam', chance: 0.4, cd: 2 }],
    phase2: {
      at: 0.5, atkMult: 1.6, spdBonus: 8, heal: 0.18, cry: '타락한 황제가 옥좌에서 일어선다! 제국의 원한이 끓는다!',
      skills: [{ id: 'frenzy', chance: 0.7, cd: 0, max: 1 }, { id: 'lifedrain', chance: 0.45, cd: 2 }, { id: 'curse', chance: 0.4, cd: 3 }],
    },
  },

  // --- Volcanic Crater (불의 분화구) — POST-GAME optional region (warp-only,
  // unlocked after the emperor falls). Toughest non-final content; the magma
  // drake is an endgame SUPERBOSS (no final flag — the emperor stays the story
  // finale). Off the balance harness ladder (post-L16). ---
  // joinSkill: the signature spell a recruited monster brings to the party (a
  // spells.js id — recruited allies are menu-controlled, so it shows in their
  // command panel). recruitLine: bespoke flavor shown when it joins in battle.
  magma_golem: { id: 'magma_golem', name: '마그마 골렘', maxHp: 95, atk: 26, def: 16, spd: 4, xp: 60, gold: 40, ai: 'attack', sprite: 'magma_golem', family: 'fire', skills: [{ id: 'monslam', chance: 0.4, cd: 2 }, { id: 'eruption', chance: 0.4, cd: 3 }], joinSkill: 'crushblow', recruitLine: '마그마 골렘이 천천히 고개를 끄덕인다… 너의 길을 함께 부수겠다.' },
  fire_bat:    { id: 'fire_bat',    name: '화염 박쥐',  maxHp: 55, atk: 24, def: 6,  spd: 18, xp: 50, gold: 30, ai: 'attack', sprite: 'fire_bat', family: 'fire', inflict: { status: 'burn', chance: 0.45, turns: 3 }, skills: [{ id: 'firebreath', chance: 0.3, cd: 3 }, { id: 'divebomb', chance: 0.35, cd: 2 }], joinSkill: 'firebolt', recruitLine: '화염 박쥐가 어깨 위로 내려앉는다. 불씨가 함께한다.' },
  ember_hound: { id: 'ember_hound', name: '잿불 사냥개', maxHp: 62, atk: 27, def: 8,  spd: 14, xp: 55, gold: 32, ai: 'attack', sprite: 'ember_hound', family: 'fire', inflict: { status: 'burn', chance: 0.4, turns: 3 }, joinSkill: 'firebolt', recruitLine: '잿불 사냥개가 너를 새 주인으로 따른다.' },
  // 용암 민달팽이: a molten 마그마 골렘 recolour — a slow, armoured tank that
  // 자폭(kamikaze)s in a magma burst when pressed. Bright-orange palette.
  lava_slug:   { id: 'lava_slug',   name: '용암 민달팽이', maxHp: 86, atk: 24, def: 13, spd: 3, xp: 58, gold: 36, ai: 'attack', sprite: 'magma_golem', spriteScale: 0.82, tint: 0xffb060, family: 'fire', inflict: { status: 'burn', chance: 0.4, turns: 3 }, skills: [{ id: 'kamikaze', chance: 0.28, cd: 99, max: 1 }], joinSkill: 'crushblow', recruitLine: '용암 민달팽이가 끓는 몸을 식히고 너를 따른다.' },

  // Endgame superboss (NOT final — magma_drake map object has no `final` flag).
  magma_drake: {
    id: 'magma_drake', name: '마그마 드레이크', maxHp: 1320, atk: 69, def: 20, spd: 13,
    xp: 1500, gold: 2000, ai: 'boss', sprite: 'boss_magma_drake', spriteScale: 0.8, boss: true, family: 'fire',
    inflict: { status: 'burn', chance: 0.5, turns: 4 },
    // P1: 화염 브레스(파티 전체 화상). P2(격노): 광폭화로 화력 폭발 + 브레스 유지.
    skills: [{ id: 'firebreath', chance: 0.5, cd: 2 }],
    phase2: {
      at: 0.5, atkMult: 1.39, spdBonus: 6, heal: 0.2, cry: '마그마 드레이크가 포효한다! 분화구가 끓어오른다!',
      skills: [{ id: 'frenzy', chance: 0.7, cd: 0, max: 1 }, { id: 'firebreath', chance: 0.5, cd: 2 }, { id: 'eruption', chance: 0.25, cd: 4 }],
    },
  },

  // --- The Void Rift (공허의 균열) — DEEPEST post-game region (warp-only, opens
  // after the magma drake falls). Abyssal horrors; the void lord is the toughest
  // foe in the game. Off the harness ladder. Not final (emperor = story finale). ---
  reaper:      { id: 'reaper',      name: '사신',     maxHp: 70,  atk: 32, def: 8,  spd: 17, xp: 70, gold: 40, ai: 'attack', sprite: 'reaper', family: 'void', inflict: { status: 'weaken', chance: 0.45, turns: 3 }, skills: [{ id: 'lifedrain', chance: 0.45, cd: 2 }, { id: 'voidblast', chance: 0.3, cd: 3 }], joinSkill: 'venom_shot', recruitLine: '사신이 낫을 거두고 너의 그림자에 깃든다.' },
  revenant:    { id: 'revenant',    name: '망령',     maxHp: 110, atk: 30, def: 14, spd: 6,  xp: 75, gold: 45, ai: 'attack', sprite: 'revenant', family: 'void', skills: [{ id: 'lifedrain', chance: 0.4, cd: 2 }, { id: 'voidblast', chance: 0.3, cd: 3 }], joinSkill: 'crushblow', recruitLine: '망령이 안식 대신 너의 곁을 택했다.' },
  // 강령술사: 1차엔 영혼 흡수만. 사령 소환(summon)은 spoils/렌더러 invariant 묶어 2차.
  necromancer: { id: 'necromancer', name: '강령술사', maxHp: 80,  atk: 28, def: 10, spd: 11, xp: 80, gold: 50, ai: 'attack', sprite: 'necromancer', family: 'void', inflict: { status: 'poison', chance: 0.5, turns: 4 }, skills: [{ id: 'summon', chance: 0.35, cd: 99, max: 1 }, { id: 'lifedrain', chance: 0.4, cd: 2 }, { id: 'shadowbolt', chance: 0.4, cd: 2 }], joinSkill: 'darkmist', recruitLine: '강령술사가 어둠의 술법을 네게 빌려주기로 한다.' },

  // Optional VOID miniboss (망령 리치) — uses the new boss_idle sprite. ai:'boss'
  // (heavy strikes, NOT boss:true → spareable; recruitable:false, too strong to
  // fold in). A defensive caster: shields itself (룬 보호막), drains, and curses;
  // enrages into a frenzy execution phase. Placed in void_gate, gated post-game.
  wraith_lich: {
    id: 'wraith_lich', name: '망령 리치', maxHp: 560, atk: 64, def: 17, spd: 14,
    xp: 1100, gold: 1500, ai: 'boss', sprite: 'boss_idle', family: 'void', recruitable: false,
    inflict: { status: 'weaken', chance: 0.45, turns: 3 },
    // P1: 보호막으로 버티며 영혼 흡수 + 저주. P2(격노): 광폭화 처형 페이즈.
    skills: [{ id: 'barrier', chance: 0.35, cd: 4, max: 3 }, { id: 'lifedrain', chance: 0.4, cd: 2 }, { id: 'curse', chance: 0.3, cd: 3 }],
    phase2: {
      at: 0.5, atkMult: 1.55, spdBonus: 6, heal: 0.18, cry: '망령 리치가 망자의 군세를 부른다! 공허가 울부짖는다!',
      skills: [{ id: 'frenzy', chance: 0.7, cd: 0, max: 1 }, { id: 'lifedrain', chance: 0.45, cd: 2 }, { id: 'barrier', chance: 0.35, cd: 4, max: 2 }],
    },
  },

  // Deepest superboss — toughest in the game (NOT final; no map `final` flag).
  void_lord: {
    id: 'void_lord', name: '심연의 군주', maxHp: 1740, atk: 95, def: 24, spd: 16,
    xp: 2500, gold: 3000, ai: 'boss', sprite: 'boss_demon', spriteScale: 0.8, boss: true, family: 'void',
    inflict: { status: 'weaken', chance: 0.5, turns: 3 },
    // P1: 영혼 흡수(자가 회복) + 저주. P2(격노): 광폭화로 처형 페이즈.
    skills: [{ id: 'lifedrain', chance: 0.45, cd: 2 }, { id: 'curse', chance: 0.35, cd: 3 }],
    phase2: {
      at: 0.5, atkMult: 1.52, spdBonus: 7, heal: 0.22, cry: '심연의 군주가 차원을 찢는다! 별빛이 꺼진다!',
      skills: [{ id: 'frenzy', chance: 0.7, cd: 0, max: 1 }, { id: 'lifedrain', chance: 0.45, cd: 2 }, { id: 'curse', chance: 0.4, cd: 3 }, { id: 'voidblast', chance: 0.3, cd: 3 }],
    },
  },

  // ─── v3 신규 옵션 던전 미니보스 2종 (2026-07-15) — spareable 패턴 ───
  // 성채 집사 — 대성채(황제 전 밴드) 옵션 미니보스. 제국 근위 금빛 스왑 대형.
  // NOT boss:true → 자비 가능; 근위대 지휘관답게 감전·연속타 + 격노 시 가속.
  citadel_seneschal: {
    id: 'citadel_seneschal', name: '성채 집사', maxHp: 600, atk: 60, def: 16, spd: 20,
    xp: 340, gold: 320, ai: 'boss', sprite: 'rusty_soldier', tint: 0xe8d090, spriteScale: 1.5,
    family: 'undead', mercyThreshold: 0.35, skills: [{ id: 'flurry', chance: 0.4, cd: 2 }, { id: 'monshock', chance: 0.3, cd: 3 }],
    joinSkill: 'crushblow', recruitLine: '집사가 녹슨 열쇠 꾸러미를 내려놓는다 — "새 주인을... 모시겠습니다."',
    phase2: { at: 0.5, atkMult: 1.35, spdBonus: 3, cry: '집사의 금빛 갑주가 갈라진다 — "성채의 격식은... 지켜져야 한다!"' },
  },
  // 화염 파수장 — 용암 요새(포스트게임 밴드) 옵션 미니보스. 마그마 골렘 작열 스왑 대형.
  // 드레이크 아래 체급: 브레스 AoE + 석화 방벽 자기강화, 격노 시 분출 해금.
  flame_warden: {
    id: 'flame_warden', name: '화염 파수장', maxHp: 1250, atk: 90, def: 20, spd: 16,
    xp: 1300, gold: 1400, ai: 'boss', sprite: 'magma_golem', tint: 0xff8a3a, spriteScale: 1.6,
    family: 'fire', recruitable: false, mercyThreshold: 0.3,
    inflict: { status: 'burn', chance: 0.4, turns: 3 },
    skills: [{ id: 'firebreath', chance: 0.3, cd: 3 }, { id: 'stoneskin', chance: 0.3, cd: 5, max: 1 }],
    phase2: { at: 0.5, atkMult: 1.25, spdBonus: 3, cry: '파수장의 심장이 백열한다 — 요새 전체가 끓어오른다!',
      skills: [{ id: 'eruption', chance: 0.25, cd: 4 }, { id: 'firebreath', chance: 0.3, cd: 3 }] },
  },
};

export function getMonster(id) {
  return MONSTERS[id] || null;
}

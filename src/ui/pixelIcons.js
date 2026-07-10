// Code-generated pixel icons — ported from share/js/pixel.js + share/js/equip.js.
// A char-grid → nearest-neighbour canvas → PIXI.Texture (CanvasSource), matching
// renderer.js's pixel-art texture pattern. No new art assets: equipment slot
// icons and status chips are drawn from string grids. Textures are cached per
// (kind, scale).

import * as PIXI from 'pixi.js';

// --- Equipment / item icons (12×12) ---
const ICONS = {
  weapon: ['............', '......ss....', '.....sWs....', '....sWs.....', '...sWs..g...', '..sWs..gWg..', '.sWs..gg.g..', 'hWs...g.....', 'Hh..........', 'hH..........', '.h..........', '............'],
  armor: ['...mmmm.....', '..mMMMMm....', '.mMllllMm...', 'mMl....lMm..', 'mMl.cc.lMm..', 'mMl.cc.lMm..', 'mMl....lMm..', '.mMlllMm....', '..mMMMm.....', '...mmm......', '............', '............'],
  accessory: ['....yyyy....', '...y....y...', '..y..dd..y..', '.y..dWWd..y.', '.y..dWWd..y.', '..y..dd..y..', '...y....y...', '....yyyy....', '............', '............', '............', '............'],
  potion: ['....rr......', '....rr......', '...pppp.....', '..pPWWPp....', '..pPWWPp....', '..pPWWPp....', '..pppppp....', '...pppp.....', '............', '............', '............', '............'],
};
const IPAL = {
  weapon: { s: '#cfd8ec', W: '#fff0b8', g: '#c98b2c', h: '#7a5224', H: '#5a3c18' },
  armor: { m: '#5a6790', M: '#8a97c4', l: '#cfe0ff', c: '#ffd766' },
  accessory: { y: '#ffd766', d: '#c98b2c', W: '#fff0b8' },
  potion: { r: '#9aa3c8', p: '#6fae2e', P: '#9ad94f', W: '#eafbe8' },
};

// --- Status icons (10×10) ---
const STATUS = {
  poison: ['..xxxx....', '.xKKKKx...', '.xKbKbx...', '.xKKKKx...', '..xKKx....', '...dd.....', '..dggd....', '.dggggd...', '.dggggd...', '..dggd....'],
  sleep: ['zzzz......', '...z......', '..z.......', '.zzzz.....', '.....zz...', '....z.....', '...z......', '...zz.....', '..........', '..........'],
  weaken: ['..wwww....', '.wwwwww...', '.ww..ww...', '.wwwwww...', '..wwww....', '...ww.....', '.a.ww.a...', '.aa..aa...', '..aaaa....', '...aa.....'],
  // burn (화상): a flame — yellow core, red/orange tongues licking up.
  burn: ['....y.....', '...yry....', '..yrFry...', '..rFFFr...', '.rFyyFr...', '.rFyyFr...', '.oFFFFr...', '..oFFo....', '..ooooo...', '...ooo....'],
  // shock (감전): a lightning bolt — white-hot zigzag on a violet glow.
  shock: ['....pp....', '...pSp....', '..pSSp....', '..pSp.....', '.pSSSSp...', '...pSp....', '..pSp.....', '..pp......', '.pp.......', '.p........'],
  // freeze (동상): a snowflake — six-spoke ice crystal, pale blue on white.
  freeze: ['....i.....', '..i.i.i...', '...iWi....', '.i.iWi.i..', 'iiWWWWWii.', '.i.iWi.i..', '...iWi....', '..i.i.i...', '....i.....', '..........'],
  // atkdown (위협): a downward red sword/arrow — atk lowered by a war-cry.
  atkdown: ['...rr.....', '...rr.....', '...rr.....', '.r.rr.r...', '.rrrrrr...', '..rrrr....', '...rr.....', '....r.....', '..........', '..........'],
  // defdown (방어약화): a cracked grey shield — armor broken.
  defdown: ['.ssssss...', '.sWWWWs...', '.sW.cWs...', '.sWc.Ws...', '.sW.cWs...', '.ssWcss...', '..sWcs....', '...sc.....', '..........', '..........'],
  // slow (둔화): a downward blue chevron pair — sluggish, snared.
  slow: ['.b....b...', '.bb..bb...', '..bbbb....', '...bb.....', '.b....b...', '.bb..bb...', '..bbbb....', '...bb.....', '..........', '..........'],
  // petrify (석화): a cracked grey stone block — turned to rock, can't act.
  petrify: ['..GGGG....', '.GGGGGG...', '.GGccGG...', '.GGGGGG...', '.GGGGGG...', '.GcGGcG...', '.GGGGGG...', '..GGGG....', '..........', '..........'],
  // stun (기절): gold dizzy stars circling the head — briefly knocked silly.
  stun: ['...Y......', '.Y.Y.Y....', '..YYY.....', '.YYYYY.Y..', '..YYY.YYY.', '.Y.Y...Y..', '...Y......', '.......Y..', '......YYY.', '.......Y..'],
  // blind (실명): a dark eye struck through by a red slash — accuracy halved.
  blind: ['..........', '.wwwww....', 'wwEEEww.X.', 'wEEKEEwX..', 'wwEEEwwX..', '.wwwwwX...', '.....X....', '....X.....', '..........', '..........'],
  // bleed (출혈): a red blood droplet — physical DoT (쌍검사 signature).
  bleed: ['....R.....', '....R.....', '...RRR....', '...RhR....', '..RRRRR...', '..RhRRR...', '..RRRRR...', '...RRR....', '....R.....', '..........'],
};
const ST_PAL = {
  poison: { K: '#e8f7c0', b: '#1b2030', d: '#6fae2e', g: '#9ad94f', x: '#1b2030' },
  sleep: { z: '#b59cff' },
  weaken: { w: '#d98446', a: '#e25563' },
  burn: { y: '#fff0b8', r: '#e25563', F: '#f0c44c', o: '#7a1f0a' },
  shock: { p: '#b483f0', S: '#fff0b8' },
  freeze: { i: '#56a8e8', W: '#eaf6ff' },
  atkdown: { r: '#e25563' },
  defdown: { s: '#9aa3c8', W: '#cfd8ec', c: '#5a3c18' },
  slow: { b: '#56a8e8' },
  petrify: { G: '#9a957c', c: '#5a5444' },
  stun: { Y: '#ffd766' },
  blind: { w: '#cfd8ec', E: '#5a6478', K: '#1b2030', X: '#e25563' },
  bleed: { R: '#e25563', h: '#7a1f0a' },
};

// --- Combat-stat badge icons (10×10) — shown above an enemy in battle ---
// sword (검): a low-threat attacker; scythe (낫): a high-threat one (it "hurts");
// shield (방패): the defense value. Drawn from grids like the status chips.
const STAT = {
  // 검 — an upright steel sword (mild attacker). Neutral steel + gold guard.
  sword: ['....W.....', '....s.....', '....s.....', '....s.....', '....s.....', '..g.s.g...', '..ggsgg...', '....b.....', '....b.....', '..........'],
  // 낫 — a hooked red scythe blade on a dark snath (dangerous attacker).
  scythe: ['....RRRR..', '..RRrrrR..', '.Rr....r..', '.Rr...H...', '.r....H...', '......H...', '......H...', '.....HH...', '....HH....', '..........'],
  // 방패 — a steel-blue shield (defense).
  shield: ['.dddddd...', '.dWWWWd...', '.dWccWd...', '.dWccWd...', '.dWWWWd...', '..dWWd....', '..dWWd....', '...dd.....', '..........', '..........'],
  // 해골 — a white skull (shown above a target a pending hit would KILL).
  skull: ['..wwww....', '.wwwwww...', '.wKwwKw...', '.wwwwww...', '.wwwwww...', '.wKKKKw...', '..wwww....', '..w.w.w...', '..........', '..........'],
};
const STAT_PAL = {
  sword: { W: '#eaf6ff', s: '#cfd8ec', g: '#ffd766', b: '#7a5224' },
  scythe: { R: '#e25563', r: '#7a1f0a', H: '#5a3c18' },
  shield: { d: '#5a6790', W: '#8a97c4', c: '#cfe0ff' },
  skull: { w: '#eaf6ff', K: '#1b2030' },
};

// char grid → offscreen canvas ('.'/' ' = transparent)
function pixCanvas(rows, pal, scale = 3) {
  const h = rows.length;
  const w = rows[0].length;
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return cv;
}

const texCache = new Map();

function toTexture(rows, pal, scale) {
  const cv = pixCanvas(rows, pal, scale);
  return new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: cv, scaleMode: 'nearest' }) });
}

// PIXI.Texture for an equipment/item icon kind: weapon|armor|accessory|potion.
// `slot` names (armor/accessory) map directly; anything unknown → potion.
export function iconTexture(kind, scale = 3) {
  const key = `i:${kind}:${scale}`;
  if (texCache.has(key)) return texCache.get(key);
  const rows = ICONS[kind] || ICONS.potion;
  const pal = IPAL[kind] || IPAL.potion;
  const tex = toTexture(rows, pal, scale);
  texCache.set(key, tex);
  return tex;
}

// PIXI.Texture for a status chip icon: poison|sleep|weaken.
export function statusTexture(kind, scale = 2) {
  const key = `s:${kind}:${scale}`;
  if (texCache.has(key)) return texCache.get(key);
  const rows = STATUS[kind];
  if (!rows) return null;
  const tex = toTexture(rows, ST_PAL[kind], scale);
  texCache.set(key, tex);
  return tex;
}

// PIXI.Texture for a combat-stat badge icon: sword|scythe|shield.
export function statTexture(kind, scale = 2) {
  const key = `st:${kind}:${scale}`;
  if (texCache.has(key)) return texCache.get(key);
  const rows = STAT[kind];
  if (!rows) return null;
  const tex = toTexture(rows, STAT_PAL[kind], scale);
  texCache.set(key, tex);
  return tex;
}

// --- Skill hit effects (ported from share/js/pixel.js) ---
const FX = {
  slash: ['.........#', '........##', '.......##.', '......##W.', '.....##W..', '....##W...', '...##W....', '..##W.....', '.##W......', '##W.......'],
  fire: ['...oo...', '..oRRo..', '.oRYYRo.', 'oRYWYRo.', 'oRYYYRoo', '.oRYRRo.', '..oRRo..', '...oo...'],
  ice: ['...c....', '..ccc...', '.cWcWc..', 'cccWccc.', '.cWcWc..', '..ccc...', '...c....', '..c.c...'],
  spark: ['...g....', '..ggg...', '.gWWWg..', 'gWWWWWg.', '.gWWWg..', '..ggg...', '...g....', '.g.g.g..'],
};
const FX_PAL = {
  slash: { '#': '#fff0b8', W: '#ffd766' },
  fire: { o: '#7a1f0a', R: '#e25563', Y: '#f0c44c', W: '#fff0b8' },
  ice: { c: '#56a8e8', W: '#eaf6ff' },
  spark: { g: '#62c46a', W: '#eafbe8' },
};

// PIXI.Texture for a skill hit effect: slash|fire|ice|spark.
export function fxTexture(kind, scale = 5) {
  const key = `fx:${kind}:${scale}`;
  if (texCache.has(key)) return texCache.get(key);
  const rows = FX[kind];
  if (!rows) return null;
  const tex = toTexture(rows, FX_PAL[kind], scale);
  texCache.set(key, tex);
  return tex;
}

// Map an items.js `kind` to an icon kind.
export function iconKindForItem(kind) {
  if (kind === 'weapon') return 'weapon';
  if (kind === 'armor') return 'armor';
  if (kind === 'accessory') return 'accessory';
  return 'potion'; // consumable / unknown
}

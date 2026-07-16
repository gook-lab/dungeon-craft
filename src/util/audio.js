// Audio — ZzFX wrapper with a polyphony cap + per-sound throttle (ported from
// the Crypt Survivors pattern). Base SFX are procedurally synthesized. The
// AudioContext is unlocked lazily on the first key press (browser autoplay policy).
//
// ASSET LAYER (전투 사운드 이식, 2026-07-14): real tracks transcoded from the
// Unity sibling's packs (MagicArsenal element SFX + 25 RPG Game Tracks battle
// loop/victory + Resources/Bgm boss) live in public/audio/*.m4a. They ride the
// same shared zzfx AudioContext as WebAudio buffers. Every asset path FALLS
// BACK to the ZzFX layer (missing file / not yet decoded / disabled), so the
// game sounds identical to before until a buffer is ready. AAC pads ~45ms of
// encoder-delay silence — buffers are silence-trimmed on decode (loopStart/End
// + start offset) so impacts stay punchy and BGM loops don't hiccup.

import { zzfx, zzfxContext } from './zzfx.js';

// ZzFX synth parameter sets. [volume, randomness, frequency, attack, sustain,
// release, shape, shapeCurve, slide, ...].
const SOUNDS = {
  menu_cursor: [0.3, 0.02, 220, 0, 0.05, 0.1, 1, 1.2],
  menu_confirm: [0.5, 0.03, 440, 0.02, 0.12, 0.2, 0, 1.4],
  menu_cancel: [0.4, 0.02, 320, 0, 0.08, 0.15, 1, 0.8],
  attack_whoosh: [0.5, 0.04, 180, 0.01, 0.08, 0.2, 3, 1.2, -1],
  hit_physical: [0.6, 0.06, 280, 0.02, 0.05, 0.15, 2, 1.8],
  hit_magic: [0.55, 0.04, 520, 0.05, 0.15, 0.25, 0, 1.2, , , 200, 0.08],
  heal_chime: [0.5, 0.03, 660, 0.03, 0.2, 0.3, 0, 1, , , 120, 0.06],
  enemy_death: [0.7, 0.08, 120, 0.1, 0.3, 0.5, 3, 0.6, -2],
  player_hurt: [0.9, 0.06, 160, 0.02, 0.08, 0.2, 4, 1.4, -1],
  encounter_start: [0.8, 0.08, 200, 0.15, 0.4, 0.6, 2, 1.2, , , , , 0.2, 0.4],
  victory_fanfare: [1.0, 0.05, 400, 0.1, 0.8, 1.2, 0, 1.6, , , 600, 0.08],
  defeat_thud: [0.9, 0.12, 80, 0.2, 0.6, 1.0, 4, 0.4, -2],
  phase: [0.3, 0.02, 350, 0, 0.08, 0.15, 1, 1.0],
  levelup: [0.6, 0.05, 520, 0.02, 0.12, 0.2, 0, 1, , , 180, 0.05],
  buy: [0.5, 0.03, 500, 0.02, 0.1, 0.18, 0, 1.2, , , 240, 0.05],
  step: [0.18, 0.02, 140, 0, 0.03, 0.06, 1, 0.8],
};

const MAX_VOICES = 16;
const SAME_SOUND_GAP = 0.045; // s

export function createAudio() {
  let voices = 0;
  let enabled = true;
  // 음량 분리 (설정 화면 배선): master × bgm|sfx, muted는 전체 게이트. 0~1.
  let master = 0.8, bgmVol = 0.6, sfxVol = 0.9, muted = false;
  const sfxV = () => (muted ? 0 : master * sfxVol);
  const bgmV = () => (muted ? 0 : master * bgmVol);
  const lastAt = new Map();

  function play(name) {
    const v = sfxV();
    if (!enabled || v <= 0) return;
    const params = SOUNDS[name];
    if (!params) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    if (now - (lastAt.get(name) ?? -Infinity) < SAME_SOUND_GAP) return;
    if (voices >= MAX_VOICES) return;
    lastAt.set(name, now);
    const scaled = params.slice();
    scaled[0] = (params[0] ?? 1) * v;
    try {
      const src = zzfx(...scaled);
      if (src) { voices++; src.onended = () => { voices = Math.max(0, voices - 1); }; }
    } catch { /* audio unavailable */ }
  }

  function unlock() {
    try { const c = zzfxContext(); if (c.state === 'suspended') c.resume(); } catch { /* none */ }
    preload();
  }

  // --- Asset audio layer -------------------------------------------------
  // 리전 BGM (2차, 2026-07-14): `field_<region>` modes keyed by the map's
  // `mood || tileset` (the REGION_MOOD pattern — fieldScene.loadMap sets it).
  // Unknown/unmapped field modes fall back to the TRACKS.field chiptune.
  const ASSET_BGM = {
    battle: 'bgm_battle', boss: 'bgm_boss',
    field_town: 'bgm_town', field_wild: 'bgm_wild', field_dungeon: 'bgm_dungeon',
    field_darkforest: 'bgm_graveyard', // 어둠숲 — 옛 묘지기(감시자) 로어와 일치
    field_frost: 'bgm_frost', field_swamp: 'bgm_forest', field_empire: 'bgm_castle',
    field_ritual: 'bgm_ruins', field_starfall: 'bgm_ascent', field_lava: 'bgm_ascent',
    field_void: 'bgm_dungeon',
  };
  const JINGLES = { victory: 'jingle_victory' };
  // spells.js element → public/audio/sfx_{cast|impact}_<element>.m4a. 'heal' is a
  // pseudo-element the scene passes for heal/cure casts (MagicArsenal 'life' set).
  const SFX_ELEMENTS = ['fire', 'ice', 'thunder', 'holy', 'dark', 'earth', 'arcane', 'wind', 'poison', 'heal'];
  const BGM_ASSET_VOL = 0.35; // music sits under the SFX
  const buffers = new Map(); // name → {buf, trim:[s,e]} | 'loading' | 'failed'
  let bgmSrc = null;
  let bgmGain = null;
  let preloadedAssets = false;

  function ctx() { try { return zzfxContext(); } catch { return null; } }

  // Trim AAC encoder-delay silence: first/last sample above threshold, in seconds.
  function trimRange(buf) {
    const d = buf.getChannelData(0);
    const th = 0.002;
    let s = 0; let e = d.length - 1;
    while (s < e && Math.abs(d[s]) < th) s++;
    while (e > s && Math.abs(d[e]) < th) e--;
    return [s / buf.sampleRate, (e + 1) / buf.sampleRate];
  }

  function loadBuffer(name) {
    if (buffers.has(name)) return;
    const c = ctx();
    if (!c) return;
    buffers.set(name, 'loading');
    fetch(`/audio/${name}.m4a`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => c.decodeAudioData(ab))
      .then((buf) => {
        buffers.set(name, { buf, trim: trimRange(buf) });
        // If this track's BGM mode is already active on the chiptune fallback,
        // swap the real track in now (covers a battle that started pre-decode).
        if (enabled && ASSET_BGM[musicMode] === name && !bgmSrc) {
          if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
          startAssetBgm(musicMode);
        }
      })
      .catch(() => buffers.set(name, 'failed'));
  }

  function preload() {
    if (preloadedAssets) return;
    preloadedAssets = true;
    // 상시 트랙(전투/보스)만 프리로드 — 리전 BGM은 방문 시 lazy (디코드된 PCM이
    // 트랙당 수십 MB라 전부 상주시키면 메모리가 터진다; startAssetBgm이 evict).
    loadBuffer(ASSET_BGM.battle);
    loadBuffer(ASSET_BGM.boss);
    Object.values(JINGLES).forEach(loadBuffer);
    for (const el of SFX_ELEMENTS) { loadBuffer(`sfx_cast_${el}`); loadBuffer(`sfx_impact_${el}`); }
  }

  function stopAssetBgm() {
    if (bgmSrc) { try { bgmSrc.stop(); } catch { /* already stopped */ } }
    bgmSrc = null; bgmGain = null;
  }

  function startAssetBgm(mode) {
    const entry = buffers.get(ASSET_BGM[mode]);
    if (!entry || typeof entry === 'string') return false;
    const c = ctx();
    if (!c) return false;
    stopAssetBgm();
    const src = c.createBufferSource();
    src.buffer = entry.buf;
    src.loop = true;
    src.loopStart = entry.trim[0];
    src.loopEnd = entry.trim[1];
    const g = c.createGain();
    g.gain.value = BGM_ASSET_VOL * bgmV();
    src.connect(g); g.connect(c.destination);
    src.start(0, entry.trim[0]);
    bgmSrc = src; bgmGain = g;
    // 리전 BGM 버퍼 evict: 지금 트랙 + 상시 트랙(전투/보스)만 남긴다. 재방문은
    // HTTP 캐시 fetch + 재디코드(~수십 ms) — 디코드 PCM 상주 메모리와의 트레이드.
    for (const [k, v] of buffers) {
      if (k.startsWith('bgm_') && typeof v === 'object'
        && k !== ASSET_BGM[mode] && k !== ASSET_BGM.battle && k !== ASSET_BGM.boss) buffers.delete(k);
    }
    return true;
  }

  // One-shot asset playback. false → not ready/missing (caller keeps its ZzFX
  // fallback); kicks off the load so the NEXT play lands the real sample.
  function playBuffer(name, vol) {
    const v = sfxV();
    if (!enabled || v <= 0) return false;
    const entry = buffers.get(name);
    if (!entry || typeof entry === 'string') { loadBuffer(name); return false; }
    const c = ctx();
    if (!c) return false;
    const src = c.createBufferSource();
    src.buffer = entry.buf;
    const g = c.createGain();
    g.gain.value = (vol ?? 1) * v;
    src.connect(g); g.connect(c.destination);
    src.start(0, entry.trim[0]);
    return true;
  }

  // kind 'cast'|'impact' keyed by the spell's element ('heal' for heal/cure).
  function playElement(kind, element) {
    if (!element || !SFX_ELEMENTS.includes(element)) return false;
    return playBuffer(`sfx_${kind}_${element}`, kind === 'impact' ? 0.7 : 0.55);
  }

  function playJingle(name) {
    return !!JINGLES[name] && playBuffer(JINGLES[name], 0.8);
  }

  // --- BGM engine: simple looping note sequences (pentatonic so they never
  // clash). Each mode plays one note per beat on an interval, sitting quietly
  // under the SFX. Not a composed track — tasteful procedural ambience.
  const N = { C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, C5: 523.25 };
  const _ = null; // rest beat
  const TRACKS = {
    // gentle major-pentatonic melody with rests + a low bass note on phrase
    // starts — towns + field. Reads as a calm wandering tune.
    field: {
      beat: 360, vol: 0.3, shape: 0,
      notes: [N.G4, _, N.E4, N.C4, N.D4, N.E4, _, N.G4, N.A4, _, N.G4, N.E4, N.D4, _, N.C4, _,
        N.E4, _, N.G4, N.A4, N.C5, _, N.A4, N.G4, N.E4, _, N.D4, N.E4, N.C4, _, _, _],
      bass: [N.C3, _, _, _, _, _, _, _, N.G3, _, _, _, _, _, _, _,
        N.A3, _, _, _, _, _, _, _, N.F4 / 2, _, _, _, N.C3, _, _, _],
    },
    // tenser, faster — random battles
    battle: { beat: 230, vol: 0.32, shape: 1, notes: [N.A3, N.C4, N.E4, N.A4, _, N.G4, N.E4, N.C4, N.D4, _, N.E4, _] },
    // ominous low minor — boss
    boss: { beat: 300, vol: 0.4, shape: 1, notes: [N.A3, _, N.C4, N.E3, N.A3, _, N.F4, N.E4, N.C4, _, N.A3, _] },
  };
  let musicMode = 'off';
  let musicTimer = null;
  let beatIdx = 0;
  function playNote(track) {
    const v = bgmV();
    if (!enabled || v <= 0) return;
    const i = beatIdx % track.notes.length;
    const f = track.notes[i];
    const bass = track.bass ? track.bass[i % track.bass.length] : null;
    beatIdx++;
    // Array literal allows elided slots; spread passes undefined for the holes
    // (a direct zzfx(... , , ...) call is a syntax error). null = rest (skip).
    try {
      if (f) zzfx(...[track.vol * v, 0.02, f, 0.02, 0.16, 0.22, track.shape, 1, , , , , , , , , 0.05, 0.6]);
      if (bass) zzfx(...[track.vol * v * 0.7, 0.02, bass, 0.03, 0.3, 0.4, 0, 0.6, , , , , , , , , 0.1, 0.5]);
    } catch { /* not ready */ }
  }
  function setMusic(mode) {
    if (musicMode === mode) return;
    musicMode = mode;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    stopAssetBgm();
    beatIdx = 0;
    // Asset track for this mode (battle/boss)? Play the real loop; if it isn't
    // decoded yet, fall through to the chiptune and let loadBuffer swap it in.
    if (ASSET_BGM[mode]) {
      loadBuffer(ASSET_BGM[mode]);
      if (enabled && startAssetBgm(mode)) return;
    }
    // field_<region> without an asset (or pre-decode) → the field chiptune.
    const t = TRACKS[mode] || (String(mode).startsWith('field') ? TRACKS.field : null);
    if (!t) return;
    playNote(t);
    musicTimer = setInterval(() => playNote(t), t.beat);
  }

  return {
    play,
    unlock,
    setMusic,
    playElement,
    playJingle,
    setEnabled: (v) => {
      enabled = v;
      if (!v) {
        stopAssetBgm();
        if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
        musicMode = 'off';
      }
    },
    // 레거시: setVolume(v) = 전체 음량(master) 설정.
    setVolume: (v) => { setMaster(v); },
    setMaster, setBgm, setSfx, setMuted,
    getLevels: () => ({ master, bgm: bgmVol, sfx: sfxVol, muted }),
  };
  function refreshBgmGain() { if (bgmGain) bgmGain.gain.value = BGM_ASSET_VOL * bgmV(); }
  function setMaster(v) { master = Math.max(0, Math.min(1, v)); refreshBgmGain(); }
  function setBgm(v) { bgmVol = Math.max(0, Math.min(1, v)); refreshBgmGain(); }
  function setSfx(v) { sfxVol = Math.max(0, Math.min(1, v)); }
  function setMuted(m) { muted = !!m; refreshBgmGain(); }
}

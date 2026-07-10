// Audio — ZzFX wrapper with a polyphony cap + per-sound throttle (ported from
// the Crypt Survivors pattern). All SFX are procedurally synthesized (no asset
// files). Sound params tuned per the game-feel spec. The AudioContext is
// unlocked lazily on the first key press (browser autoplay policy).

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
  let volume = 0.8;
  const lastAt = new Map();

  function play(name) {
    if (!enabled || volume <= 0) return;
    const params = SOUNDS[name];
    if (!params) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    if (now - (lastAt.get(name) ?? -Infinity) < SAME_SOUND_GAP) return;
    if (voices >= MAX_VOICES) return;
    lastAt.set(name, now);
    const scaled = params.slice();
    scaled[0] = (params[0] ?? 1) * volume;
    try {
      const src = zzfx(...scaled);
      if (src) { voices++; src.onended = () => { voices = Math.max(0, voices - 1); }; }
    } catch { /* audio unavailable */ }
  }

  function unlock() {
    try { const c = zzfxContext(); if (c.state === 'suspended') c.resume(); } catch { /* none */ }
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
    if (!enabled || volume <= 0) return;
    const i = beatIdx % track.notes.length;
    const f = track.notes[i];
    const bass = track.bass ? track.bass[i % track.bass.length] : null;
    beatIdx++;
    // Array literal allows elided slots; spread passes undefined for the holes
    // (a direct zzfx(... , , ...) call is a syntax error). null = rest (skip).
    try {
      if (f) zzfx(...[track.vol * volume, 0.02, f, 0.02, 0.16, 0.22, track.shape, 1, , , , , , , , , 0.05, 0.6]);
      if (bass) zzfx(...[track.vol * volume * 0.7, 0.02, bass, 0.03, 0.3, 0.4, 0, 0.6, , , , , , , , , 0.1, 0.5]);
    } catch { /* not ready */ }
  }
  function setMusic(mode) {
    if (musicMode === mode) return;
    musicMode = mode;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    beatIdx = 0;
    const t = TRACKS[mode];
    if (!t) return;
    playNote(t);
    musicTimer = setInterval(() => playNote(t), t.beat);
  }

  return {
    play,
    unlock,
    setMusic,
    setEnabled: (v) => { enabled = v; if (!v && musicTimer) { clearInterval(musicTimer); musicTimer = null; musicMode = 'off'; } },
    setVolume: (v) => { volume = Math.max(0, Math.min(1, v)); },
  };
}

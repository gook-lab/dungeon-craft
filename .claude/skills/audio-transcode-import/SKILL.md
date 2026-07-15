---
name: audio-transcode-import
description: Import an audio track (SFX/BGM/jingle) from the Unity sibling (or any wav/mp3) into the game — afconvert to AAC m4a at the right bitrate, drop into public/audio/, and wire the basename into src/util/audio.js maps (ASSET_BGM / JINGLES / SFX). Use when the user asks to add/replace a sound, BGM, or jingle.
---

# Audio Transcode & Import

Wraps the pipeline shipped 2026-07-14 (commits c76a038, d80adb0). See CLAUDE.md §11
for the architecture (asset layer on shared zzfx AudioContext, ZzFX fallback, AAC
trim, lazy decode + eviction).

## Source locations

Unity sibling packs (the usual source):
- SFX: `../dragon-game-unity/Assets/MagicArsenal/Effects/Sound/{Cast,Impact}/`
- BGM: `../dragon-game-unity/Assets/25 Rpg Game Tracks/` and
  `../dragon-game-unity/Assets/Resources/Bgm/`

List candidates first: `find ../dragon-game-unity/Assets -iname '*.wav' | grep -i <keyword>`.
Some tracks are unused and available (e.g. meadow) — check `ls public/audio/` for
what's already imported.

## Naming convention (public/audio/<basename>.m4a)

| Kind | Basename pattern | Bitrate |
|---|---|---|
| Element SFX | `sfx_cast_<element>` / `sfx_impact_<element>` (always the PAIR) | 64k |
| Region BGM | `bgm_<name>` (town/wild/dungeon/graveyard/frost/forest/castle/ruins/ascent…) | 96k |
| Battle/boss BGM | `bgm_battle` / `bgm_boss` | 128k |
| Jingle | `jingle_<name>` (e.g. jingle_victory) | 128k |

## Steps

1. **Transcode** (afconvert is a macOS builtin — no ffmpeg needed):
   ```bash
   afconvert -f m4af -d aac -b <bitrate: 64000|96000|128000> \
     "<source>.wav" public/audio/<basename>.m4a
   ```
   Do NOT pre-trim silence — the runtime trims AAC encoder delay at decode
   (`trimRange` in audio.js). Loop points also come from trimRange, so loopable BGM
   just needs the source to be a clean loop.

2. **Wire into `src/util/audio.js`** (all maps are inside `createAudio()`):
   - Region BGM → add to `ASSET_BGM`: key `field_<region>` where `<region>` is
     `map.mood || map.tileset` (check the target map file). Several regions may share
     one track (e.g. lava+starfall → bgm_ascent).
   - Battle/boss/jingle → `ASSET_BGM.battle/.boss` or `JINGLES` (also add a
     `loadBuffer` line in `preload()` if it must be ready pre-battle — region BGMs
     stay lazy, battle/boss/jingles/SFX preload).
   - New SFX element → add the element string to `SFX_ELEMENTS` AND ship BOTH
     `sfx_cast_<el>` + `sfx_impact_<el>` files (playElement rejects unknown elements).

3. **Verify wiring** (headless): `npx vitest run` (audio is fallback-safe so tests
   won't catch a typo'd basename — instead grep that the basename in the map matches
   the file on disk exactly):
   ```bash
   node -e "const fs=require('fs');const src=fs.readFileSync('src/util/audio.js','utf8');
   for (const m of src.matchAll(/'((?:bgm|sfx|jingle)_[a-z_]+)'/g)) {
     const f='public/audio/'+m[1]+'.m4a';
     if(!fs.existsSync(f)) console.log('MISSING FILE:', f);
   } console.log('check done')"
   ```
   A missing file is SILENT at runtime (ZzFX fallback) — this grep is the only guard.

4. **Live check** (needs gstack `$B`): enter the region / trigger the spell and
   listen. BGM loop seam + SFX punch depend on the decode-time trim, which can't be
   verified headlessly.

## Gotchas

- Memory: decoded PCM ≈ 40MB/track. Region BGMs are lazy + evicted (`startAssetBgm`);
  never add a region BGM to `preload()`.
- License: Unity asset-store packs outside Unity = grey area — fine for this local
  toy, don't publish (TODOS.md records this).
- Korean/space filenames in Assets: quote paths.

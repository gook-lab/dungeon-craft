// 전역 설정 — 세이브와 별개로 localStorage에 지속(새 게임/로드와 무관).
// settingsScene가 편집, 각 시스템(audio/dialog/battle/main)이 getSettings()로 읽는다.
// ul/settings-export의 스키마(dq_settings_v1) 그대로.

const KEY = 'dq_settings_v1';

export const SETTINGS_DEFAULTS = {
  master: 80, bgm: 60, sfx: 90, mute: false,                 // 사운드 (0~100)
  textSpeed: '보통', battleSpeed: '보통',                     // 게임
  autosave: true, screenShake: true, colorblind: false,
};

// 텍스트 속도 → 글자당 초(0 = 즉시). 전투 속도 → 연출 타임스케일(배속).
export const TEXT_SPEED_SEC = { '느림': 0.045, '보통': 0.022, '빠름': 0.010, '즉시': 0 };
export const BATTLE_SPEED_MULT = { '보통': 1, '빠름': 1.6, '2배': 2.2 };

let S = null;

function storage() {
  try { return (typeof localStorage !== 'undefined') ? localStorage : null; } catch { return null; }
}

export function loadSettings() {
  if (S) return S;
  const st = storage();
  const raw = (() => {
    try { return st ? JSON.parse(st.getItem(KEY) || '{}') : {}; } catch { return {}; }
  })();
  S = { ...SETTINGS_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  // 값 검증 (라디오는 알려진 값만).
  if (!(S.textSpeed in TEXT_SPEED_SEC)) S.textSpeed = SETTINGS_DEFAULTS.textSpeed;
  if (!(S.battleSpeed in BATTLE_SPEED_MULT)) S.battleSpeed = SETTINGS_DEFAULTS.battleSpeed;
  for (const k of ['master', 'bgm', 'sfx']) S[k] = Math.max(0, Math.min(100, Math.round(S[k] ?? SETTINGS_DEFAULTS[k])));
  for (const k of ['mute', 'autosave', 'screenShake', 'colorblind']) S[k] = !!S[k];
  return S;
}

export function getSettings() { return S || loadSettings(); }

export function saveSettings(next) {
  S = { ...getSettings(), ...(next || {}) };
  const st = storage();
  try { if (st) st.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ }
  return S;
}

export function resetSettings() { S = { ...SETTINGS_DEFAULTS }; const st = storage(); try { if (st) st.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } return S; }

// 편의 파생값.
export function textSpeedSec() { return TEXT_SPEED_SEC[getSettings().textSpeed] ?? 0.022; }
export function battleSpeedMult() { return BATTLE_SPEED_MULT[getSettings().battleSpeed] ?? 1; }

// audio에 현재 음량을 밀어넣는다 (loadSettings 후 / 변경 시 호출).
export function applyAudioSettings(audio) {
  if (!audio) return;
  const s = getSettings();
  audio.setMaster?.(s.master / 100);
  audio.setBgm?.(s.bgm / 100);
  audio.setSfx?.(s.sfx / 100);
  audio.setMuted?.(s.mute);
}

// Bonds — the Fabula Ultima "emotional ties" model, ported to this turn-based
// CRPG. PURE (no Pixi, no globals) so it's unit-testable. A bond lives between
// two party members and carries up to 3 emotions, one per axis. Storage shape
// (save.bonds): { "knight|warrior": ["loyalty"], … }; pairKey is the two refIds
// sorted + joined with '|'.
//
// Each axis is one relationship with a POSITIVE and a NEGATIVE pole — the
// merciful path grows the positive poles, the ruthless path the negative ones:
//   admiration (존경) ↔ contempt (멸시)
//   loyalty    (충성) ↔ mistrust (불신)
//   affection  (애정) ↔ hatred   (증오)
// In-battle effects (battleScene.enter / Crisis / death):
//   loyalty   → +def        | mistrust → +atk%  (self-reliant aggression)
//   admiration→ +atk        | contempt → +atk   (larger; scorn fuels violence)
//   affection → Crisis surge | hatred  → death-rage surge (ally death → +atk%)
// POSITIVE bond strength also folds into max HP; negative bonds grant NO HP —
// the ruthless "glass cannon" tradeoff (more damage, no cushion).

export const POSITIVE_EMOTIONS = ['admiration', 'loyalty', 'affection'];
export const NEGATIVE_EMOTIONS = ['contempt', 'mistrust', 'hatred']; // 멸시 / 불신 / 증오
export const EMOTIONS = [...POSITIVE_EMOTIONS, ...NEGATIVE_EMOTIONS];
export const EMOTION_KR = {
  admiration: '존경', loyalty: '충성', affection: '애정',
  contempt: '멸시', mistrust: '불신', hatred: '증오',
};
// Pole pairs — you can't both respect and scorn the same ally. Gaining one pole
// flips out the other (the relationship sours / heals along that axis).
export const OPPOSITE = {
  admiration: 'contempt', contempt: 'admiration',
  loyalty: 'mistrust', mistrust: 'loyalty',
  affection: 'hatred', hatred: 'affection',
};
export const MAX_EMOTIONS_PER_PAIR = 3;

export function bondKey(a, b) {
  return [a, b].sort().join('|');
}

// Add an emotion to the a↔b bond (dedup, cap 3). Mutates `bonds`; returns true
// only when the bond actually changed. A new pole REPLACES its opposite on the
// same axis rather than stacking, so a flipping playstyle re-colours the bond.
export function addEmotion(bonds, a, b, emotion) {
  if (a === b || !EMOTIONS.includes(emotion)) return false;
  const key = bondKey(a, b);
  const list = bonds[key] || (bonds[key] = []);
  if (list.includes(emotion)) return false;
  const oi = list.indexOf(OPPOSITE[emotion]);
  if (oi >= 0) { list[oi] = emotion; return true; } // flip the axis
  if (list.length >= MAX_EMOTIONS_PER_PAIR) return false;
  list.push(emotion);
  return true;
}

// Every pair involving refId → [{ partner, emotions:[...] }].
export function pairsFor(bonds, refId) {
  const out = [];
  for (const [key, emotions] of Object.entries(bonds || {})) {
    const [a, b] = key.split('|');
    if (a === refId) out.push({ partner: b, emotions });
    else if (b === refId) out.push({ partner: a, emotions });
  }
  return out;
}

// Total POSITIVE emotion count across all of refId's bonds (drives the max-HP
// fold). Negative bonds are intentionally excluded — the ruthless "glass cannon"
// gets offense, not the HP cushion.
export function bondStrength(bonds, refId) {
  return pairsFor(bonds, refId).reduce(
    (n, p) => n + p.emotions.filter((e) => POSITIVE_EMOTIONS.includes(e)).length, 0);
}

// Count of a specific emotion across refId's bonds (e.g. admiration count → atk).
export function emotionCount(bonds, refId, emotion) {
  return pairsFor(bonds, refId).reduce((n, p) => n + (p.emotions.includes(emotion) ? 1 : 0), 0);
}

// Partners who share `emotion` with refId (used by the Crisis-partner surge).
export function partnersWithEmotion(bonds, refId, emotion) {
  return pairsFor(bonds, refId).filter((p) => p.emotions.includes(emotion)).map((p) => p.partner);
}

export function hasEmotion(bonds, a, b, emotion) {
  return !!(bonds[bondKey(a, b)] || []).includes(emotion);
}

import { describe, it, expect } from 'vitest';
import {
  bondKey, addEmotion, pairsFor, bondStrength, emotionCount, partnersWithEmotion, hasEmotion,
  POSITIVE_EMOTIONS, NEGATIVE_EMOTIONS, OPPOSITE,
} from './bonds.js';

describe('bonds model', () => {
  it('bondKey is order-independent', () => {
    expect(bondKey('warrior', 'knight')).toBe('knight|warrior');
    expect(bondKey('knight', 'warrior')).toBe('knight|warrior');
  });

  it('addEmotion adds, dedups, caps at 3, ignores self/invalid', () => {
    const b = {};
    expect(addEmotion(b, 'knight', 'warrior', 'loyalty')).toBe(true);
    expect(addEmotion(b, 'knight', 'warrior', 'loyalty')).toBe(false); // dup
    expect(addEmotion(b, 'warrior', 'knight', 'affection')).toBe(true); // order-independent same pair
    expect(b['knight|warrior']).toEqual(['loyalty', 'affection']);
    addEmotion(b, 'knight', 'warrior', 'admiration');
    expect(addEmotion(b, 'knight', 'warrior', 'loyalty')).toBe(false); // already 3 (and dup)
    expect(b['knight|warrior'].length).toBe(3);
    expect(addEmotion(b, 'knight', 'knight', 'loyalty')).toBe(false); // self
    expect(addEmotion(b, 'knight', 'huntress', 'rage')).toBe(false);  // invalid emotion
  });

  it('bondStrength + emotionCount + partnersWithEmotion aggregate across pairs', () => {
    const b = {};
    addEmotion(b, 'knight', 'warrior', 'loyalty');
    addEmotion(b, 'knight', 'warrior', 'affection');
    addEmotion(b, 'knight', 'huntress', 'admiration');
    expect(bondStrength(b, 'knight')).toBe(3);
    expect(bondStrength(b, 'warrior')).toBe(2);
    expect(emotionCount(b, 'knight', 'loyalty')).toBe(1);
    expect(partnersWithEmotion(b, 'knight', 'affection')).toEqual(['warrior']);
    expect(hasEmotion(b, 'knight', 'huntress', 'admiration')).toBe(true);
    expect(hasEmotion(b, 'knight', 'huntress', 'loyalty')).toBe(false);
  });

  it('pairsFor returns partner + emotions for each involving pair', () => {
    const b = { 'knight|warrior': ['loyalty'] };
    expect(pairsFor(b, 'warrior')).toEqual([{ partner: 'knight', emotions: ['loyalty'] }]);
    expect(pairsFor(b, 'huntress')).toEqual([]);
  });

  // --- ruthless (negative) poles ---
  it('negative emotions are valid and have positive opposites', () => {
    expect(NEGATIVE_EMOTIONS).toEqual(['contempt', 'mistrust', 'hatred']);
    for (const neg of NEGATIVE_EMOTIONS) {
      expect(POSITIVE_EMOTIONS).toContain(OPPOSITE[neg]);   // each negative pairs to a positive
      expect(OPPOSITE[OPPOSITE[neg]]).toBe(neg);            // involution
    }
    const b = {};
    expect(addEmotion(b, 'knight', 'warrior', 'hatred')).toBe(true); // accepted (valid emotion)
  });

  it('addEmotion flips the opposite pole instead of stacking it', () => {
    const b = {};
    addEmotion(b, 'knight', 'warrior', 'loyalty');
    expect(addEmotion(b, 'knight', 'warrior', 'mistrust')).toBe(true); // mistrust replaces loyalty
    expect(b['knight|warrior']).toEqual(['mistrust']); // flipped in place, not appended
    addEmotion(b, 'knight', 'warrior', 'loyalty');     // flip back
    expect(b['knight|warrior']).toEqual(['loyalty']);
    expect(b['knight|warrior'].length).toBe(1);         // never accumulates both poles
  });

  it('bondStrength counts POSITIVE poles only (negatives grant no HP)', () => {
    const b = {};
    addEmotion(b, 'knight', 'warrior', 'admiration');  // positive
    addEmotion(b, 'knight', 'huntress', 'contempt');   // negative
    addEmotion(b, 'knight', 'warrior', 'hatred');      // negative (2nd emotion on that pair)
    expect(bondStrength(b, 'knight')).toBe(1);          // only admiration counts
    expect(emotionCount(b, 'knight', 'contempt')).toBe(1);
    expect(emotionCount(b, 'knight', 'hatred')).toBe(1);
    expect(partnersWithEmotion(b, 'knight', 'hatred')).toEqual(['warrior']);
  });
});

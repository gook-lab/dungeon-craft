import { expect, it, describe } from 'vitest';
import { ALLY_EPILOGUES, allyEpilogueFor } from './allyEpilogues.js';
import { bondStrength } from '../systems/bonds.js';

describe('allyEpilogues', () => {
  it('has epilogue data for recruitable allies', () => {
    expect(ALLY_EPILOGUES.dark_warden).toBeDefined();
    expect(ALLY_EPILOGUES.seal_guardian).toBeDefined();
    expect(ALLY_EPILOGUES.fallen_star).toBeDefined();
    expect(ALLY_EPILOGUES.bog_witch).toBeDefined();
    expect(ALLY_EPILOGUES.bridge_warden).toBeDefined();
    expect(ALLY_EPILOGUES.ember_hound).toBeDefined();
  });

  it('each ally has epilogues for all tones', () => {
    const tones = ['merciful', 'ruthless', 'mixed', 'true'];
    for (const [allyId, toneData] of Object.entries(ALLY_EPILOGUES)) {
      for (const tone of tones) {
        expect(toneData[tone]).toBeDefined(`${allyId} missing tone: ${tone}`);
      }
    }
  });

  it('each tone has high/medium/low bond levels', () => {
    const tones = ['merciful', 'ruthless', 'mixed', 'true'];
    const levels = ['high', 'medium', 'low'];
    for (const [allyId, toneData] of Object.entries(ALLY_EPILOGUES)) {
      for (const tone of tones) {
        for (const level of levels) {
          expect(toneData[tone][level]).toBeDefined(
            `${allyId}/${tone}/${level} missing`
          );
        }
      }
    }
  });

  it('each level has positive and negative variants', () => {
    const tones = ['merciful', 'ruthless', 'mixed', 'true'];
    const levels = ['high', 'medium', 'low'];
    for (const [allyId, toneData] of Object.entries(ALLY_EPILOGUES)) {
      for (const tone of tones) {
        for (const level of levels) {
          const levelData = toneData[tone][level];
          expect(levelData.positive).toBeDefined(`${allyId}/${tone}/${level}/positive missing`);
          expect(typeof levelData.positive).toBe('string');
          expect(levelData.negative).toBeDefined(`${allyId}/${tone}/${level}/negative missing`);
          expect(typeof levelData.negative).toBe('string');
        }
      }
    }
  });

  describe('allyEpilogueFor', () => {
    it('returns null for non-existent ally', () => {
      expect(allyEpilogueFor('nonexistent', 'merciful', {})).toBeNull();
    });

    it('returns null for non-existent tone', () => {
      expect(allyEpilogueFor('dark_warden', 'invalid', {})).toBeNull();
    });

    it('selects positive variant when bonds has positive emotions', () => {
      const bonds = { 'dark_warden|knight': ['loyalty'] };
      const result = allyEpilogueFor('dark_warden', 'merciful', bonds);
      expect(result).toBe(ALLY_EPILOGUES.dark_warden.merciful.medium.positive);
    });

    it('selects negative variant when bonds has only negative emotions', () => {
      const bonds = { 'dark_warden|knight': ['mistrust'] };
      const result = allyEpilogueFor('dark_warden', 'merciful', bonds);
      // bondStrength는 positive emotions만 세므로, mistrust만 있으면 strength=0 → low
      expect(result).toBe(ALLY_EPILOGUES.dark_warden.merciful.low.negative);
    });

    it('uses high bond level when bondStrength >= 3', () => {
      const bonds = { 'dark_warden|knight': ['loyalty', 'admiration', 'affection'] };
      const result = allyEpilogueFor('dark_warden', 'merciful', bonds);
      expect(result).toBe(ALLY_EPILOGUES.dark_warden.merciful.high.positive);
    });

    it('uses medium bond level when bondStrength 1-2', () => {
      const bonds = { 'dark_warden|knight': ['loyalty'] };
      const result = allyEpilogueFor('dark_warden', 'merciful', bonds);
      expect(result).toBe(ALLY_EPILOGUES.dark_warden.merciful.medium.positive);
    });

    it('uses low bond level when bondStrength == 0', () => {
      const bonds = {};
      const result = allyEpilogueFor('dark_warden', 'merciful', bonds);
      expect(result).toBe(ALLY_EPILOGUES.dark_warden.merciful.low.negative);
    });

    it('works with all tones', () => {
      const bonds = { 'dark_warden|knight': ['loyalty'] };
      for (const tone of ['merciful', 'ruthless', 'mixed', 'true']) {
        const result = allyEpilogueFor('dark_warden', tone, bonds);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      }
    });

    it('returns a string', () => {
      const result = allyEpilogueFor('dark_warden', 'merciful', {});
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

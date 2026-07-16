// V1 tone-surfacing helpers — pure, no Pixi/save. Guards the mid-run mercy
// feedback (toneBand for the 성향 panel, toneCrossNote for the one-time note).
import { describe, it, expect } from 'vitest';
import { toneFromFlags, toneBand, toneCrossNote, TONE_CROSS_MSG } from './dialog.js';

describe('toneBand', () => {
  it('is unformed before 4 resolved enemies (raw ratio stays implicit)', () => {
    const b = toneBand({ mercied: 2, slain: 1 });
    expect(b.formed).toBe(false);
    expect(b.tone).toBe('mixed');
    expect(b.lean).toBe(0);
  });
  it('labels a committed merciful run with a positive lean', () => {
    const b = toneBand({ mercied: 8, slain: 1 }); // 89% mercy
    expect(b.formed).toBe(true);
    expect(b.tone).toBe('merciful');
    expect(b.lean).toBeGreaterThan(0);
    expect(b.mercied).toBe(8);
    expect(b.slain).toBe(1);
  });
  it('labels a committed ruthless run with a negative lean', () => {
    const b = toneBand({ mercied: 1, slain: 9 }); // 10% mercy
    expect(b.tone).toBe('ruthless');
    expect(b.lean).toBeLessThan(0);
  });
});

describe('toneCrossNote', () => {
  it('seeds the baseline silently on first observation (no note)', () => {
    const r = toneCrossNote(undefined, { mercied: 8, slain: 1 });
    expect(r.tone).toBe('merciful');
    expect(r.msg).toBeNull();
  });
  it('emits a note when crossing INTO a committed tone', () => {
    const flags = { mercied: 8, slain: 1 };
    const r = toneCrossNote('mixed', flags);
    expect(r.tone).toBe('merciful');
    expect(r.msg).toBe(TONE_CROSS_MSG.merciful);
  });
  it('is silent when the tone is unchanged', () => {
    const r = toneCrossNote('merciful', { mercied: 9, slain: 1 });
    expect(r.tone).toBe('merciful');
    expect(r.msg).toBeNull();
  });
  it('notes a flip between committed tones', () => {
    const r = toneCrossNote('merciful', { mercied: 1, slain: 9 });
    expect(r.tone).toBe('ruthless');
    expect(r.msg).toBe(TONE_CROSS_MSG.ruthless);
  });
  it('does not note a still-forming mixed baseline going to mixed', () => {
    // prev committed → drifting back to mixed IS noted; but forming→forming is not.
    const r = toneCrossNote('mixed', { mercied: 3, slain: 3 }); // 50% but <4? total=6 formed, mixed
    expect(r.tone).toBe('mixed');
    expect(r.msg).toBeNull(); // mixed→mixed
  });
  it('notes a committed→mixed drift back toward the center', () => {
    const r = toneCrossNote('merciful', { mercied: 5, slain: 5 }); // now mixed
    expect(r.tone).toBe('mixed');
    expect(r.msg).toBe(TONE_CROSS_MSG.mixed);
  });
  it('agrees with toneFromFlags on the returned tone', () => {
    const flags = { mercied: 10, slain: 2 };
    expect(toneCrossNote('mixed', flags).tone).toBe(toneFromFlags(flags));
  });
});

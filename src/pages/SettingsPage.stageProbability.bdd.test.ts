import { describe, it, expect } from 'vitest';

// Mirrors SettingsPage.updateStageProbability: blank -> null, else clamp 0..100.
const normalise = (raw: string) => {
  const n = raw.trim() === '' ? null : Number(raw);
  return n === null || Number.isNaN(n) ? null : Math.min(100, Math.max(0, n));
};

describe('stage probability input (BDD)', () => {
  it.each([
    ['', null], ['abc', null], ['0', 0], ['42.5', 42.5], ['150', 100], ['-5', 0],
  ])('Given "%s", When normalised, Then %s', (raw, want) => {
    expect(normalise(raw)).toBe(want);
  });
});

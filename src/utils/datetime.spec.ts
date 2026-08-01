import { describe, it, expect } from 'vitest';
import { parseUtcDate } from './datetime';

describe('parseUtcDate', () => {
  describe('Given a timezone-less ISO timestamp (T separator)', () => {
    it('When parsed, Then it is treated as UTC', () => {
      const result = parseUtcDate('2026-06-03T14:54:00');
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
    });
  });

  describe('Given a timezone-less timestamp with a space separator', () => {
    it('When parsed, Then it yields the same UTC instant as the T form', () => {
      const result = parseUtcDate('2026-06-03 14:54:00');
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
    });
  });

  describe('Given a timestamp already carrying a trailing Z', () => {
    it('When parsed, Then it is left unchanged (no double Z)', () => {
      const result = parseUtcDate('2026-06-03T14:54:00Z');
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 14, 54, 0));
    });
  });

  describe('Given a timestamp already carrying a +05:30 offset', () => {
    it('When parsed, Then the offset is honored and no Z is appended', () => {
      const result = parseUtcDate('2026-06-03T14:54:00+05:30');
      // 14:54 +05:30 == 09:24 UTC
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 9, 24, 0));
      expect(Number.isNaN(result.getTime())).toBe(false);
    });
  });

  describe('Given an existing Date object', () => {
    it('When parsed, Then the same Date instance is returned as-is', () => {
      const input = new Date('2026-06-03T14:54:00Z');
      const result = parseUtcDate(input);
      expect(result).toBe(input);
    });
  });

  describe('Given a date-only string', () => {
    it('When parsed, Then it resolves to UTC midnight', () => {
      const result = parseUtcDate('2026-06-03');
      expect(result.getTime()).toBe(Date.UTC(2026, 5, 3, 0, 0, 0));
    });
  });
});

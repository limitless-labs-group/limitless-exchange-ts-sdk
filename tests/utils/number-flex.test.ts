import { describe, expect, it } from 'vitest';
import { toFiniteInteger, toFiniteNumber } from '../../src/utils/number-flex';

describe('number-flex utils', () => {
  describe('toFiniteNumber', () => {
    it('returns numbers as-is when finite', () => {
      expect(toFiniteNumber(42)).toBe(42);
      expect(toFiniteNumber(0.25)).toBe(0.25);
    });

    it('parses numeric strings', () => {
      expect(toFiniteNumber('42')).toBe(42);
      expect(toFiniteNumber('0.25')).toBe(0.25);
      expect(toFiniteNumber('  100  ')).toBe(100);
    });

    it('returns undefined for non-numeric values', () => {
      expect(toFiniteNumber('abc')).toBeUndefined();
      expect(toFiniteNumber('')).toBeUndefined();
      expect(toFiniteNumber(null)).toBeUndefined();
      expect(toFiniteNumber(undefined)).toBeUndefined();
      expect(toFiniteNumber(Number.NaN)).toBeUndefined();
      expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
    });
  });

  describe('toFiniteInteger', () => {
    it('returns integer numbers', () => {
      expect(toFiniteInteger(42)).toBe(42);
      expect(toFiniteInteger('42')).toBe(42);
      expect(toFiniteInteger(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
      expect(toFiniteInteger(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('returns undefined for non-integer values', () => {
      expect(toFiniteInteger(1.5)).toBeUndefined();
      expect(toFiniteInteger('1.5')).toBeUndefined();
      expect(toFiniteInteger('abc')).toBeUndefined();
    });

    it('returns undefined for unsafe integers', () => {
      const aboveSafe = Number.MAX_SAFE_INTEGER + 1;
      expect(toFiniteInteger(aboveSafe)).toBeUndefined();
      expect(toFiniteInteger('9007199254740993')).toBeUndefined();
    });
  });
});

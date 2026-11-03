import { describe, it, expect } from 'vitest';
import { fitBand, FIT_BAND_LABELS, parseIcpCriteria } from './icpFit';

describe('Feature: ICP fit helpers', () => {
  describe('Given a score When banded', () => {
    it.each([
      [100, 'excellent'], [95, 'excellent'], [80, 'excellent'], [79.99, 'good'], [79, 'good'], [60, 'good'],
      [59.99, 'fair'], [59, 'fair'], [40, 'fair'], [39.99, 'not_a_fit'], [39, 'not_a_fit'], [1, 'not_a_fit'], [0, 'not_a_fit'],
    ])('When score is %s / Then band is %s', (s, b) => { expect(fitBand(s as number)).toBe(b); });

    it('When score is above 100 / Then still excellent', () => { expect(fitBand(250)).toBe('excellent'); });
    it('When score is negative / Then not_a_fit', () => { expect(fitBand(-10)).toBe('not_a_fit'); });
    it('When score is NaN / Then not_a_fit (all comparisons false)', () => { expect(fitBand(NaN)).toBe('not_a_fit'); });
  });

  describe('Given FIT_BAND_LABELS', () => {
    it('When read / Then each band has its human label', () => {
      expect(FIT_BAND_LABELS).toEqual({ excellent: 'Excellent fit', good: 'Good fit', fair: 'Fair fit', not_a_fit: 'Not a fit' });
    });
  });

  describe('Given criteria as a {field: points} map', () => {
    it('When a positive value / Then met with humanised label and key', () => {
      expect(parseIcpCriteria({ job_title: 30 })).toEqual([{ key: 'job_title', label: 'Job Title', state: 'met' }]);
    });
    it('When zero / Then missed', () => { expect(parseIcpCriteria({ a: 0 })[0].state).toBe('missed'); });
    it('When negative / Then missed', () => { expect(parseIcpCriteria({ a: -5 })[0].state).toBe('missed'); });
    it('When NaN / Then missed (number but not > 0)', () => { expect(parseIcpCriteria({ a: NaN })[0].state).toBe('missed'); });
    it('When fractional positive / Then met', () => { expect(parseIcpCriteria({ a: 0.5 })[0].state).toBe('met'); });
    it.each([['numeric string', '30'], ['null', null], ['undefined', undefined], ['boolean', true], ['object', { x: 1 }], ['array', [1]]])(
      'When value is a %s / Then unknown', (_n, v) => { expect(parseIcpCriteria({ a: v })[0].state).toBe('unknown'); });
    it('When empty map / Then empty list', () => { expect(parseIcpCriteria({})).toEqual([]); });
    it('When several keys / Then order is preserved', () => {
      expect(parseIcpCriteria({ z: 1, a: 0, m: 2 }).map((c) => c.key)).toEqual(['z', 'a', 'm']);
    });
    it('When map entries / Then found is never set', () => { expect(parseIcpCriteria({ a: 1 })[0].found).toBeUndefined(); });
    it.each([
      ['company_size', 'Company Size'], ['company-size', 'Company Size'], ['a__b--c', 'A B C'], ['industry', 'Industry'], ['already Title', 'Already Title'],
    ])('When key is %s / Then label is %s', (k, l) => { expect(parseIcpCriteria({ [k]: 1 })[0].label).toBe(l); });
  });

  describe('Given criteria as an array', () => {
    it('When matched true / Then met', () => { expect(parseIcpCriteria([{ label: 'A', matched: true }])[0].state).toBe('met'); });
    it('When matched false / Then missed', () => { expect(parseIcpCriteria([{ label: 'A', matched: false }])[0].state).toBe('missed'); });
    it('When matched undefined / Then unknown', () => { expect(parseIcpCriteria([{ label: 'A' }])[0].state).toBe('unknown'); });
    it('When matched is non-boolean and no points / Then unknown', () => { expect(parseIcpCriteria([{ label: 'A', matched: 'true' }])[0].state).toBe('unknown'); });
    it('When only positive points / Then met', () => { expect(parseIcpCriteria([{ label: 'A', points: 5 }])[0].state).toBe('met'); });
    it('When only zero or negative points / Then missed', () => {
      expect(parseIcpCriteria([{ label: 'A', points: 0 }, { label: 'B', points: -1 }]).map((c) => c.state)).toEqual(['missed', 'missed']);
    });
    it('When points is a string / Then unknown', () => { expect(parseIcpCriteria([{ label: 'A', points: '5' }])[0].state).toBe('unknown'); });
    it('When matched and points disagree / Then matched wins', () => {
      expect(parseIcpCriteria([{ label: 'A', matched: false, points: 9 }])[0].state).toBe('missed');
    });
    it('When label given / Then label is used verbatim and key is label-index', () => {
      expect(parseIcpCriteria([{ label: 'job_title', matched: true }])[0]).toMatchObject({ key: 'job_title-0', label: 'job_title' });
    });
    it('When only field given / Then field is humanised', () => {
      expect(parseIcpCriteria([{ field: 'job_title' }])[0]).toMatchObject({ key: 'job_title-0', label: 'Job Title' });
    });
    it('When label and field given / Then label wins', () => {
      expect(parseIcpCriteria([{ label: 'L', field: 'f' }])[0].label).toBe('L');
    });
    it('When neither label nor field / Then fallback "Criterion N" (1-based)', () => {
      expect(parseIcpCriteria([{ matched: true }, {}]).map((c) => c.label)).toEqual(['Criterion 1', 'Criterion 2']);
    });
    it('When items are null or primitives / Then fallback label and unknown', () => {
      const out = parseIcpCriteria([null, 'x', 7] as any);
      expect(out.map((c) => c.state)).toEqual(['unknown', 'unknown', 'unknown']);
      expect(out.map((c) => c.label)).toEqual(['Criterion 1', 'Criterion 2', 'Criterion 3']);
    });
    it('When found has a value / Then found is stringified', () => {
      expect(parseIcpCriteria([{ label: 'A', found: 'Berlin' }])[0].found).toBe('Berlin');
      expect(parseIcpCriteria([{ label: 'A', found: 42 }])[0].found).toBe('42');
      expect(parseIcpCriteria([{ label: 'A', found: 0 }])[0].found).toBe('0');
    });
    it('When found is null, undefined or empty string / Then found is undefined', () => {
      expect(parseIcpCriteria([{ label: 'A', found: null }, { label: 'B', found: undefined }, { label: 'C', found: '' }]).map((c) => c.found))
        .toEqual([undefined, undefined, undefined]);
    });
    it('When duplicate labels / Then keys stay unique via index', () => {
      const keys = parseIcpCriteria([{ label: 'A' }, { label: 'A' }]).map((c) => c.key);
      expect(new Set(keys).size).toBe(2);
    });
    it('When empty array / Then empty list', () => { expect(parseIcpCriteria([])).toEqual([]); });
  });

  describe('Given malformed criteria', () => {
    it.each([['string', 'industry'], ['null', null], ['undefined', undefined], ['number', 5], ['boolean', true], ['empty string', '']])(
      'When raw is %s / Then empty list', (_n, v) => { expect(parseIcpCriteria(v)).toEqual([]); });
    it('When nested object values / Then each is unknown, not recursed', () => {
      expect(parseIcpCriteria({ geo: { country: 5 } })).toEqual([{ key: 'geo', label: 'Geo', state: 'unknown' }]);
    });
  });
});

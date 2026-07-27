import { boundedInteger, booleanFlag, csvList } from '../config/parse.js';

describe('boundedInteger', () => {
  const options = { fallback: 2, min: 0, max: 10 };

  test('accepts a valid integer', () => {
    expect(boundedInteger('4', options)).toBe(4);
  });

  test('accepts zero', () => {
    expect(boundedInteger('0', options)).toBe(0);
  });

  test('falls back for a negative value below the minimum', () => {
    expect(boundedInteger('-1', options)).toBe(0);
  });

  test('falls back for a decimal', () => {
    expect(boundedInteger('1.5', options)).toBe(2);
  });

  test('falls back for non-numeric input', () => {
    expect(boundedInteger('abc', options)).toBe(2);
  });

  test('falls back for an empty string', () => {
    expect(boundedInteger('', options)).toBe(2);
    expect(boundedInteger('   ', options)).toBe(2);
  });

  test('falls back for null and undefined', () => {
    expect(boundedInteger(null, options)).toBe(2);
    expect(boundedInteger(undefined, options)).toBe(2);
  });

  test('clamps an excessively large value to the maximum', () => {
    expect(boundedInteger('999999', options)).toBe(10);
  });

  test('falls back for values beyond the safe integer range', () => {
    expect(boundedInteger('99999999999999999999', options)).toBe(2);
  });

  test('never returns NaN for any hostile input', () => {
    const hostile = ['NaN', 'Infinity', '-Infinity', '0x10', '1e3', '١٢٣', '+', '-', '1,2', ' 3 ', null, undefined, {}, []];
    for (const raw of hostile) {
      const result = boundedInteger(raw, options);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(10);
    }
  });

  test('clamps an out-of-range fallback into the bounds', () => {
    expect(boundedInteger('nope', { fallback: 50, min: 0, max: 10 })).toBe(10);
  });
});

describe('booleanFlag', () => {
  test('accepts documented true spellings', () => {
    for (const raw of ['1', 'true', 'TRUE', 'yes', 'on', ' On ']) expect(booleanFlag(raw, false)).toBe(true);
  });

  test('accepts documented false spellings', () => {
    for (const raw of ['0', 'false', 'NO', 'off']) expect(booleanFlag(raw, true)).toBe(false);
  });

  test('does not treat an arbitrary string as truthy', () => {
    expect(booleanFlag('maybe', false)).toBe(false);
    expect(booleanFlag('enabled', false)).toBe(false);
  });

  test('uses the fallback when unset', () => {
    expect(booleanFlag(undefined, true)).toBe(true);
    expect(booleanFlag(null, false)).toBe(false);
  });
});

describe('csvList', () => {
  test('splits, trims, and drops empty entries', () => {
    expect(csvList('a, b ,,c')).toEqual(['a', 'b', 'c']);
  });

  test('de-duplicates', () => {
    expect(csvList('a,a,b')).toEqual(['a', 'b']);
  });

  test('returns an empty list when unset', () => {
    expect(csvList(undefined)).toEqual([]);
    expect(csvList('')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { dataKalendarzowa } from '../index';

describe('dataKalendarzowa', () => {
  it('przyjmuje istniejącą datę RRRR-MM-DD', () => {
    expect(dataKalendarzowa('2024-02-29')).toBe('2024-02-29');
  });

  it.each([
    '2024-02-30',
    '2023-02-29',
    '2024-13-01',
    '16.03.2024',
    '2024-3-16',
    '0999-01-01',
    '0000-01-01',
  ])('odrzuca %s', (zla) => {
    expect(() => dataKalendarzowa(zla)).toThrow(RangeError);
  });
});

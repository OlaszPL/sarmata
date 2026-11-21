import { describe, expect, it } from 'vitest';
import { dataKalendarzowa, dodajMiesiace } from '../index';

describe('dodajMiesiace (art. 112 Kc, zasady liczenia terminów KPRM)', () => {
  it.each([
    ['2024-03-16', 24, '2026-03-16'],
    ['2024-01-31', 13, '2025-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2016-04-04', 24, '2018-04-04'],
    ['2025-11-30', 3, '2026-02-28'],
    ['2025-12-15', 1, '2026-01-15'],
    ['2025-02-28', 1, '2025-03-28'],
    ['2024-02-29', 12, '2025-02-28'],
    ['2024-03-16', 0, '2024-03-16'],
  ])('%s + %i mies. = %s', (od, miesiace, oczekiwana) => {
    expect(dodajMiesiace(dataKalendarzowa(od), miesiace)).toBe(oczekiwana);
  });

  it('odrzuca ujemną albo ułamkową liczbę miesięcy', () => {
    const od = dataKalendarzowa('2024-03-16');
    expect(() => dodajMiesiace(od, -1)).toThrow(RangeError);
    expect(() => dodajMiesiace(od, 1.5)).toThrow(RangeError);
  });

  it('rzuca RangeError, gdy wynik wychodzi poza zakres lat', () => {
    expect(() => dodajMiesiace(dataKalendarzowa('9999-12-01'), 1)).toThrow(RangeError);
    expect(() => dodajMiesiace(dataKalendarzowa('2024-03-16'), Number.MAX_SAFE_INTEGER)).toThrow(
      RangeError,
    );
  });
});

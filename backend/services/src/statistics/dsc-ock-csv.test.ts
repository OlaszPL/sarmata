import { describe, expect, it } from 'vitest';
import { dscOckCsv } from './dsc-ock-csv';

describe('dscOckCsv', () => {
  it('csv starts with BOM and uses semicolons', () => {
    const csv = dscOckCsv([{ question: 4, label: 'Pracownicy', value: 12 }]);
    expect(csv.startsWith('﻿pytanie;opis;wartosc')).toBe(true);
    expect(csv).toContain('4;Pracownicy;12');
  });

  it('csv quotes semicolons and doubles quotes', () => {
    const csv = dscOckCsv([
      { question: 6, label: 'a;b', value: 1 },
      { question: 7, label: 'powyżej "oczekiwań"', value: 2 },
    ]);
    expect(csv).toContain('6;"a;b";1');
    expect(csv).toContain('7;"powyżej ""oczekiwań""";2');
  });

  it('csv uses CRLF and empty cell for null', () => {
    const csv = dscOckCsv([{ question: 14, label: 'Odwołania', value: null }]);
    expect(csv).toBe('﻿pytanie;opis;wartosc\r\n14;Odwołania;\r\n');
  });
});

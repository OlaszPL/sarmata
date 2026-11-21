import { describe, expect, it } from 'vitest';
import { sensitiveDataWarnings } from './sensitive-data';

describe('sensitiveDataWarnings', () => {
  it.each([
    ['Był na zwolnieniu lekarskim', 'health'],
    ['Ma depresję', 'diagnosis'],
    ['Rozwodzi się z żoną', 'family'],
    ['Chodzi do kościoła', 'religion'],
    ['CHOROBA', 'health'],
  ])('flags "%s" as %s', (text, category) => {
    expect(sensitiveDataWarnings(text).map((w) => w.category)).toContain(category);
  });

  it('returns nothing for a work-related note', () => {
    expect(sensitiveDataWarnings('Terminowo przygotował raport z kontroli 12.03')).toEqual([]);
  });

  it('returns one warning per category found', () => {
    const categories = sensitiveDataWarnings('Po chorobie wrócił, rozwodzi się z żoną').map(
      (w) => w.category,
    );
    expect(categories.sort()).toEqual(['family', 'health']);
  });

  it('quotes the matching fragment', () => {
    expect(sensitiveDataWarnings('Był na zwolnieniu lekarskim')[0]?.fragment).toBe('zwolnieniu');
  });
});

import { describe, expect, it } from 'vitest';
import { calendarDate } from '../deadlines/calendar-date';
import { digestMessage } from './digest-message';

const link = 'https://sarmata.example/powiadomienia';
const nearest = calendarDate('2026-11-24');

describe('digestMessage', () => {
  it.each([
    [1, 'zadanie'],
    [2, 'zadania'],
    [5, 'zadań'],
    [12, 'zadań'],
    [22, 'zadania'],
  ])('digest message for %i uses the form %s', (count, noun) => {
    const message = digestMessage({ count, nearestDueOn: nearest, link });
    expect(message.subject).toBe('Sarmata: zadania do wykonania');
    expect(message.text).toBe(`Masz ${count} ${noun}, najbliższy termin 24.11.\n\n${link}`);
  });

  it('formats date as day and month', () => {
    const message = digestMessage({ count: 3, nearestDueOn: calendarDate('2026-01-05'), link });
    expect(message.text).toContain('najbliższy termin 05.01.');
  });

  it('all overdue wording', () => {
    const message = digestMessage({ count: 2, nearestDueOn: null, link });
    expect(message.text).toBe(`Masz 2 zadania, wszystkie po terminie.\n\n${link}`);
  });

  it('link is escaped in html', () => {
    const message = digestMessage({
      count: 1,
      nearestDueOn: nearest,
      link: 'https://x.test/?a=1&b="2"',
    });
    expect(message.html).toContain('href="https://x.test/?a=1&amp;b=&quot;2&quot;"');
    expect(message.html).toContain('Masz 1 zadanie, najbliższy termin 24.11.');
    expect(message.html).not.toContain('b="2"');
  });
});

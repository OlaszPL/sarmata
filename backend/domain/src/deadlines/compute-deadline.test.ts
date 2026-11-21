import { describe, expect, it } from 'vitest';
import { type DeadlineResult, type DeadlineRule, calendarDate, computeDeadline } from '../index';

const months = (count: number, extend: boolean, shift = true): DeadlineRule => ({
  strategy: 'monthsFromEvent',
  event: 'cycleStart',
  months: count,
  extendByAbsencesLongerThanMonth: extend,
  shiftToWorkingDay: shift,
  basis: 'test',
});

const days = (count: number, shift = true): DeadlineRule => ({
  strategy: 'daysFromEvent',
  event: 'acquaintance',
  days: count,
  shiftToWorkingDay: shift,
  basis: 'test',
});

function compute(
  rule: DeadlineRule,
  eventDate: string,
  absences: [string, string | null][] = [],
): DeadlineResult {
  return computeDeadline(rule, {
    eventDate: calendarDate(eventDate),
    absences: absences.map(([from, to]) => ({
      from: calendarDate(from),
      to: to === null ? null : calendarDate(to),
    })),
  });
}

const dayBefore = (iso: string): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

describe('months from the event (art. 112 Kc)', () => {
  it.each([
    ['2024-03-16', 24, '2026-03-16', 'KPRM example'],
    ['2024-01-31', 13, '2025-02-28', 'KPRM example, no 31st in February'],
    ['2024-01-31', 1, '2024-02-29', 'KPRM example, leap year'],
    ['2016-04-04', 24, '2018-04-04', 'DSC FAQ 10'],
  ])('%s + %i months is due %s (%s)', (event, count, expected) => {
    expect(compute(months(count, false), event)).toMatchObject({ kind: 'due', due: expected });
  });

  it('moves an end on Saturday to Monday', () => {
    expect(compute(months(24, false), '2024-03-14')).toEqual({
      kind: 'due',
      windowStart: null,
      nominalDue: '2026-03-14',
      due: '2026-03-16',
      extendedByDays: 0,
    });
  });

  it('keeps an end on Saturday when the slot does not shift', () => {
    expect(compute(months(24, false, false), '2024-03-14')).toMatchObject({ due: '2026-03-14' });
  });
});

describe('days from the event (art. 111 § 2 Kc, the event day is not counted)', () => {
  it.each([
    ['2026-11-16', 7, '2026-11-23', '2026-11-23'],
    ['2026-11-13', 7, '2026-11-20', '2026-11-20'],
    ['2026-11-14', 7, '2026-11-21', '2026-11-23'],
    ['2026-12-10', 14, '2026-12-24', '2026-12-28'],
    ['2026-10-02', 30, '2026-11-01', '2026-11-02'],
  ])('%s + %i days ends %s and is due %s', (event, count, nominal, expected) => {
    expect(compute(days(count), event)).toMatchObject({ nominalDue: nominal, due: expected });
  });
});

describe('an end of term on a day off moves to the next working day (art. 115 Kc)', () => {
  it.each([
    ['2026-03-14', '2026-03-16', 'Saturday'],
    ['2026-08-15', '2026-08-17', 'Assumption on a Saturday'],
    ['2026-11-11', '2026-11-12', 'Independence Day'],
    ['2026-04-06', '2026-04-07', 'Easter Monday'],
    ['2027-03-28', '2027-03-30', 'Easter Sunday and Monday'],
    ['2026-06-04', '2026-06-05', 'Corpus Christi'],
    ['2026-05-01', '2026-05-04', 'Labour Day, a Saturday and 3 May on a Sunday'],
    ['2027-01-01', '2027-01-04', 'New Year and a weekend'],
    ['2027-01-06', '2027-01-07', 'Epiphany'],
    ['2025-12-24', '2025-12-29', 'Christmas Eve is a day off since 2025'],
    ['2024-12-24', '2024-12-24', 'Christmas Eve was a working day before 2025'],
    ['2010-01-06', '2010-01-06', 'Epiphany was a working day before 2011'],
    ['2026-12-31', '2026-12-31', 'an ordinary Thursday'],
  ])('a term ending %s is due %s (%s)', (end, expected) => {
    expect(compute(days(1), dayBefore(end))).toMatchObject({ nominalDue: end, due: expected });
  });
});

describe('window around the event (§ 9 ust. 2)', () => {
  it('opens 7 days before a position change and closes 30 days after it', () => {
    const rule: DeadlineRule = {
      strategy: 'windowAroundEvent',
      event: 'positionChange',
      daysBefore: 7,
      daysAfter: 30,
      shiftToWorkingDay: true,
      basis: 'test',
    };
    expect(compute(rule, '2026-11-20')).toEqual({
      kind: 'due',
      windowStart: '2026-11-13',
      nominalDue: '2026-12-20',
      due: '2026-12-21',
      extendedByDays: 0,
    });
  });
});

describe('extension by a justified absence longer than a month (art. 81 ust. 7)', () => {
  const cycle = months(24, true);
  const start = '2025-06-02';

  it('is due 24 months after the start without absences', () => {
    expect(compute(cycle, start)).toMatchObject({ due: '2027-06-02', extendedByDays: 0 });
  });

  it('joins sick leave and holiday separated by a weekend (KPRM example, 33 days)', () => {
    const result = compute(cycle, start, [
      ['2026-10-05', '2026-10-16'],
      ['2026-10-19', '2026-11-06'],
    ]);
    expect(result).toMatchObject({
      nominalDue: '2027-07-05',
      due: '2027-07-05',
      extendedByDays: 33,
    });
  });

  it('does not join absences separated by a working day', () => {
    const result = compute(cycle, start, [
      ['2026-10-05', '2026-10-15'],
      ['2026-10-19', '2026-11-06'],
    ]);
    expect(result).toMatchObject({ due: '2027-06-02', extendedByDays: 0 });
  });

  it('does not extend for an absence of exactly one month', () => {
    expect(compute(cycle, start, [['2026-10-05', '2026-11-04']])).toMatchObject({
      extendedByDays: 0,
    });
  });

  it('extends for an absence one day longer than a month, then shifts from Sunday', () => {
    expect(compute(cycle, start, [['2026-10-05', '2026-11-05']])).toMatchObject({
      nominalDue: '2027-07-04',
      due: '2027-07-05',
      extendedByDays: 32,
    });
  });

  it('joins absences across a public holiday and a weekend', () => {
    const result = compute(cycle, start, [
      ['2026-12-01', '2026-12-31'],
      ['2027-01-04', '2027-01-15'],
    ]);
    expect(result).toMatchObject({
      nominalDue: '2027-07-18',
      due: '2027-07-19',
      extendedByDays: 46,
    });
  });

  it('merges overlapping absences', () => {
    const result = compute(cycle, start, [
      ['2026-10-05', '2026-10-20'],
      ['2026-10-15', '2026-11-10'],
    ]);
    expect(result).toMatchObject({ due: '2027-07-09', extendedByDays: 37 });
  });

  it('counts an absence that starts before the extended deadline', () => {
    const result = compute(cycle, start, [
      ['2026-10-05', '2026-11-06'],
      ['2027-06-14', '2027-07-31'],
    ]);
    expect(result).toMatchObject({
      nominalDue: '2027-08-22',
      due: '2027-08-23',
      extendedByDays: 81,
    });
  });

  it('ignores absences after the deadline and before the event', () => {
    const result = compute(cycle, start, [
      ['2025-01-01', '2025-03-31'],
      ['2027-06-10', '2027-08-10'],
    ]);
    expect(result).toMatchObject({ due: '2027-06-02', extendedByDays: 0 });
  });

  it('suspends the deadline while an absence has no end date', () => {
    expect(compute(cycle, start, [['2026-10-05', null]])).toEqual({
      kind: 'suspended',
      since: '2026-10-05',
    });
  });

  it('ignores absences when the slot is not extended (art. 81 ust. 9, DSC FAQ 19)', () => {
    const result = compute(months(6, false, false), '2026-11-16', [['2026-12-01', '2027-02-26']]);
    expect(result).toMatchObject({ due: '2027-05-16', extendedByDays: 0 });
  });

  it('rejects an absence that ends before it starts', () => {
    expect(() => compute(cycle, start, [['2026-10-05', '2026-10-01']])).toThrow(RangeError);
  });
});

import { type DeadlineSlot, calendarDate, computeDeadline } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from '../src/index';

// The worked examples (KPRM term counting, DSC FAQ 10 and 19) live in `cases.json` and run in
// `src/regulation-cases.test.ts`. Only edge cases that are not examples stay here.
const version = officialRegulations.find((candidate) => candidate.id === 'regulation-2016');

function deadline(slot: DeadlineSlot, eventDate: string, absences: [string, string][] = []) {
  const rule = version?.deadlines[slot];
  if (!rule) throw new Error(`regulation-2016 has no ${slot} slot`);
  return computeDeadline(rule, {
    eventDate: calendarDate(eventDate),
    absences: absences.map(([from, to]) => ({ from: calendarDate(from), to: calendarDate(to) })),
  });
}

describe('regulation-2016 deadline edge cases', () => {
  it('an absence shorter than a month does not extend the evaluation', () => {
    const result = deadline('evaluationDeadline', '2025-06-02', [['2026-10-05', '2026-10-16']]);
    expect(result).toMatchObject({ extendedByDays: 0 });
  });
});

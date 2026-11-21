import { type DeadlineSlot, calendarDate, computeDeadline } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from '../src/index';

const version = officialRegulations.find((candidate) => candidate.id === 'regulation-2016');

function deadline(slot: DeadlineSlot, eventDate: string, absences: [string, string][] = []) {
  const rule = version?.deadlines[slot];
  if (!rule) throw new Error(`regulation-2016 has no ${slot} slot`);
  return computeDeadline(rule, {
    eventDate: calendarDate(eventDate),
    absences: absences.map(([from, to]) => ({ from: calendarDate(from), to: calendarDate(to) })),
  });
}

describe('regulation-2016 deadlines (KPRM term counting, docs/analiza 1.5)', () => {
  it('evaluation 24 months after the cycle start (KPRM example)', () => {
    expect(deadline('evaluationDeadline', '2024-03-16')).toMatchObject({ due: '2026-03-16' });
  });

  it('evaluation 24 months after the previous one (DSC FAQ 10)', () => {
    expect(deadline('evaluationDeadline', '2016-04-04')).toMatchObject({ due: '2018-04-04' });
  });

  it('evaluation extended by the KPRM absence example', () => {
    const result = deadline('evaluationDeadline', '2025-06-02', [
      ['2026-10-05', '2026-10-16'],
      ['2026-10-19', '2026-11-06'],
    ]);
    expect(result).toMatchObject({ due: '2027-07-05', extendedByDays: 33 });
  });

  it.each([
    ['startingInterview', '2026-10-02', '2026-11-02'],
    ['startingInterviewAfterNegative', '2026-11-13', '2026-11-20'],
    ['reevaluationAfterNegative', '2026-11-16', '2027-05-16'],
    ['criteriaResetAfterPositionChange', '2027-02-01', '2027-03-03'],
    ['objection', '2026-11-14', '2026-11-23'],
    ['objectionDecision', '2026-12-10', '2026-12-28'],
    ['labourCourtAppeal', '2026-12-28', '2027-01-11'],
    ['gradeByLawGrant', '2026-11-16', '2026-12-16'],
  ] as const)('%s from %s is due %s', (slot, event, expected) => {
    expect(deadline(slot, event)).toMatchObject({ kind: 'due', due: expected });
  });

  it('reevaluation after a negative one is not extended by absences (DSC FAQ 19)', () => {
    const result = deadline('reevaluationAfterNegative', '2026-11-16', [
      ['2026-12-01', '2027-02-26'],
    ]);
    expect(result).toMatchObject({ due: '2027-05-16', extendedByDays: 0 });
  });

  it('evaluation on a position change has a window from 7 days before to 30 days after', () => {
    expect(deadline('evaluationOnPositionChange', '2026-11-20')).toMatchObject({
      windowStart: '2026-11-13',
      due: '2026-12-21',
    });
  });
});

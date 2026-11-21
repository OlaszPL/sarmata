import { calendarDate, latestAbsences, termChangeIssues } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');

describe('termChangeIssues', () => {
  it('term change after 4 months is too early', () => {
    expect(
      termChangeIssues(regulation, {
        cycleStart: calendarDate('2026-01-15'),
        changedOn: calendarDate('2026-05-15'),
        reason: 'evaluatorChange',
      }),
    ).toEqual(['term_change_too_early']);
  });

  it('term change after 6 months with a listed reason is fine', () => {
    expect(
      termChangeIssues(regulation, {
        cycleStart: calendarDate('2026-01-15'),
        changedOn: calendarDate('2026-07-15'),
        reason: 'requestOfEvaluated',
      }),
    ).toEqual([]);
  });

  it('unknown reason is reported', () => {
    expect(
      termChangeIssues(regulation, {
        cycleStart: calendarDate('2026-01-15'),
        changedOn: calendarDate('2026-08-15'),
        reason: 'whim',
      }),
    ).toEqual(['term_change_reason_unknown']);
  });
});

describe('latestAbsences', () => {
  it('keeps the last entry per absence id', () => {
    const entry = (absenceId: string, to: string | null) => ({
      kind: 'absence',
      payload: { absenceId, from: '2026-03-02', to },
    });
    expect(
      latestAbsences([entry('a', null), entry('b', '2026-03-05'), entry('a', '2026-04-10')]),
    ).toEqual([
      { from: '2026-03-02', to: '2026-04-10' },
      { from: '2026-03-02', to: '2026-03-05' },
    ]);
  });
});

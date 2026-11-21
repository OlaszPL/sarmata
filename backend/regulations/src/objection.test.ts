import {
  calendarDate,
  objectionFilingIssue,
  outcomeLowered,
  type SheetScore,
} from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');

const score = (levelCode: string, outcome: 'positive' | 'negative'): SheetScore => ({
  complete: true,
  mean: 5,
  levelCode,
  outcome,
});

describe('objectionFilingIssue', () => {
  it('objection filed on day 8 is late', () => {
    expect(objectionFilingIssue(calendarDate('2026-06-22'), calendarDate('2026-06-23'))).toBe(
      'objection_late',
    );
  });

  it('objection filed on the due day is on time', () => {
    expect(objectionFilingIssue(calendarDate('2026-06-22'), calendarDate('2026-06-22'))).toBeNull();
  });

  it('no deadline never blocks', () => {
    expect(objectionFilingIssue(null, calendarDate('2026-06-23'))).toBeNull();
  });
});

describe('outcomeLowered', () => {
  it('changed outcome from above to meets is lowered', () => {
    expect(outcomeLowered(regulation, score('above', 'positive'), score('meets', 'positive'))).toBe(
      true,
    );
  });

  it('same level is not lowered', () => {
    expect(outcomeLowered(regulation, score('meets', 'positive'), score('meets', 'positive'))).toBe(
      false,
    );
  });

  it('a higher level is not lowered', () => {
    expect(outcomeLowered(regulation, score('meets', 'positive'), score('above', 'positive'))).toBe(
      false,
    );
  });

  it('positive turned negative at the same level is lowered', () => {
    expect(outcomeLowered(regulation, score('meets', 'positive'), score('meets', 'negative'))).toBe(
      true,
    );
  });
});

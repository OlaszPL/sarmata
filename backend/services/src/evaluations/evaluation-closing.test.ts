import { calendarDate } from '@sarmata/domain';
import { type EvaluationClosingStore } from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { createEvaluationClosing } from './evaluation-closing';

describe('createEvaluationClosing', () => {
  it('returns the number of closed evaluations and no identifiers', async () => {
    const days: string[] = [];
    const store: EvaluationClosingStore = {
      closeUnobjected: (day) => {
        days.push(day);
        return Promise.resolve([
          { evaluationId: 'e1', officeId: 'o1' },
          { evaluationId: 'e2', officeId: 'o1' },
        ]);
      },
    };
    const result = await createEvaluationClosing(store).closeUnobjected(calendarDate('2026-12-01'));
    expect(result).toEqual({ closed: 2 });
    expect(days).toEqual(['2026-12-01']);
  });

  it('reports zero when nothing is due', async () => {
    const store: EvaluationClosingStore = { closeUnobjected: () => Promise.resolve([]) };
    expect(
      await createEvaluationClosing(store).closeUnobjected(calendarDate('2026-12-01')),
    ).toEqual({
      closed: 0,
    });
  });
});

import {
  type RetainedFactsInput,
  calendarDate,
  evaluationResult,
  retainedFacts,
  sheetCriteria,
} from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');

const criteriaC = sheetCriteria(regulation, 'C', []);
const lockedContent = (points: number, conclusions = '') => ({
  partOne: { additionalCriteria: [], dueOn: null },
  partTwo: {
    interviewOn: null,
    periodFrom: null,
    periodTo: null,
    ratings: Object.fromEntries(criteriaC.map((id) => [id, points])),
    justification: 'Imię Nazwisko wykonuje zadania',
    developmentConclusions: conclusions,
    gradeRequest: null,
  },
});

const input = (overrides: Partial<RetainedFactsInput> = {}): RetainedFactsInput => ({
  evaluationId: '11111111-1111-4111-8111-111111111111',
  status: 'closed',
  sheetId: 'C',
  lockedContent: lockedContent(5, 'szkolenie z Excela'),
  orgUnit: 'Wydział A',
  serviceStatus: 'employee',
  gradeGrantedOn: null,
  drafted: calendarDate('2026-03-01'),
  acquaintedOn: calendarDate('2026-03-05'),
  history: [],
  evaluatorAccountId: '22222222-2222-4222-8222-222222222222',
  ...overrides,
});

describe('retained facts', () => {
  it('retained facts hold no personal fields', () => {
    const facts = retainedFacts(regulation, input());
    expect(facts).not.toBeNull();
    expect(Object.keys(facts ?? {}).sort()).toEqual(
      [
        'evaluationId',
        'sheetId',
        'year',
        'orgUnit',
        'civilServant',
        'levelCode',
        'outcome',
        'mean',
        'secondConsecutiveNegative',
        'gradeByLawDueYear',
        'withConclusions',
        'gradeRequested',
        'ratings',
        'evaluatorAccountId',
      ].sort(),
    );
    const text = JSON.stringify(facts);
    expect(text).not.toContain('Imię');
    expect(text).not.toContain('Excela');
    expect(text).not.toContain('2026-03');
  });

  it('interrupted evaluation yields no facts', () => {
    expect(retainedFacts(regulation, input({ status: 'interrupted' }))).toBeNull();
  });

  it('evaluation without a locked sheet yields no facts', () => {
    expect(retainedFacts(regulation, input({ lockedContent: null, status: 'period' }))).toBeNull();
  });

  it('facts match evaluationResult level and outcome', () => {
    const source = input({ lockedContent: lockedContent(1) });
    const facts = retainedFacts(regulation, source);
    const result = evaluationResult(regulation, {
      sheetId: 'C',
      content: lockedContent(1),
      serviceStatus: 'employee',
      gradeGrantedOn: null,
      drafted: calendarDate('2026-03-01'),
      acquaintedOn: calendarDate('2026-03-05'),
      history: [],
    });
    expect(facts?.levelCode).toBe(result.levelCode);
    expect(facts?.outcome).toBe(result.outcome);
    expect(facts?.mean).toBe(result.mean);
    expect(facts?.year).toBe(2026);
  });

  it('conclusions and ratings are summarised without text', () => {
    const facts = retainedFacts(regulation, input());
    expect(facts?.withConclusions).toBe(true);
    expect(facts?.ratings).toHaveLength(criteriaC.length);
    expect(
      retainedFacts(regulation, input({ lockedContent: lockedContent(5) }))?.withConclusions,
    ).toBe(false);
  });
});

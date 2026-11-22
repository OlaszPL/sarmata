import { describe, expect, it } from 'vitest';
import { type EvaluationView, calendarDate } from '@sarmata/services';
import { appealCases, appealSchema, gradeGrantSchema } from './register';

const id = '3f1c2a64-5b1e-4d2a-9c55-0f6f4f0a1b11';
const other = '8a7d6c5b-4e3f-4a2b-9c1d-0e9f8a7b6c5d';

function view(
  evaluationId: string,
  events: { kind: string; occurredOn: string; payload?: Record<string, unknown> }[],
): EvaluationView {
  return {
    id: evaluationId,
    snapshot: { firstName: 'Olga', lastName: 'Oceniana' },
    events: events.map((e, i) => ({ id: String(i), payload: {}, ...e })),
  } as unknown as EvaluationView;
}

const rejected = {
  kind: 'objection_outcome',
  occurredOn: '2026-03-10',
  payload: { outcome: 'rejected' },
};

describe('appealCases', () => {
  it('lists a rejected objection with its appeal date', () => {
    const cases = appealCases([
      view(id, [rejected, { kind: 'labour_court_appeal', occurredOn: '2026-03-20' }]),
    ]);
    expect(cases).toEqual([
      {
        evaluationId: id,
        employeeName: 'Olga Oceniana',
        outcomeOn: calendarDate('2026-03-10'),
        appealedOn: calendarDate('2026-03-20'),
      },
    ]);
  });

  it('skips an evaluation whose latest outcome is not a rejection', () => {
    const changed = {
      kind: 'objection_outcome',
      occurredOn: '2026-03-12',
      payload: { outcome: 'upheld' },
    };
    expect(appealCases([view(id, [rejected, changed])])).toEqual([]);
    expect(appealCases([view(id, [])])).toEqual([]);
  });

  it('lets the latest outcome win', () => {
    const changed = {
      kind: 'objection_outcome',
      occurredOn: '2026-03-12',
      payload: { outcome: 'upheld' },
    };
    const again = {
      kind: 'objection_outcome',
      occurredOn: '2026-03-15',
      payload: { outcome: 'rejected' },
    };
    const [only] = appealCases([view(id, [rejected, changed, again])]);
    expect(only?.outcomeOn).toBe('2026-03-15');
  });

  it('puts open cases first', () => {
    const cases = appealCases([
      view(id, [rejected, { kind: 'labour_court_appeal', occurredOn: '2026-03-20' }]),
      view(other, [rejected]),
    ]);
    expect(cases.map((c) => c.evaluationId)).toEqual([other, id]);
  });
});

describe('appealSchema', () => {
  it('accepts an iso date and refuses other formats', () => {
    expect(appealSchema.safeParse({ evaluationId: id, filedOn: '2026-03-20' }).success).toBe(true);
    const bad = appealSchema.safeParse({ evaluationId: id, filedOn: '20.03.2026' });
    expect(bad.error?.issues[0]?.message).toBe('Podaj datę w formacie dd.mm.rrrr');
  });
});

describe('gradeGrantSchema', () => {
  const base = {
    employeeId: id,
    basis: 'on_request',
    evaluationId: '',
    grantedOn: '2026-03-20',
    newGrade: '5',
  };

  it('accepts a grant on request without an evaluation', () => {
    expect(gradeGrantSchema.safeParse(base).success).toBe(true);
  });

  it('needs an evaluation by law', () => {
    const result = gradeGrantSchema.safeParse({ ...base, basis: 'by_law' });
    const issue = result.error?.issues[0];
    expect(issue?.path).toEqual(['evaluationId']);
    expect(issue?.message).toBe('Wybierz ocenę, która daje stopień z mocy prawa');
  });

  it('checks employee and grade range', () => {
    const result = gradeGrantSchema.safeParse({ ...base, employeeId: '', newGrade: '10' });
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toContain('Wybierz pracownika');
    expect(messages).toContain('Podaj stopień od 1 do 9');
  });
});

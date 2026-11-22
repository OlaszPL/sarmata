import { type EvaluationView } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { caseStages, currentStageIndex } from './stages';

function view(status: string, events: [string, string][] = []): EvaluationView {
  return {
    status,
    events: events.map(([kind, occurredOn], index) => ({
      id: String(index),
      kind,
      occurredOn,
      payload: {},
      recordedBy: 'x',
      recordedAt: `${occurredOn}T10:00:00Z`,
    })),
    deadlines: [
      { slot: 'evaluationDeadline', windowStart: null, dueOn: '2026-12-04', suspendedSince: null },
    ],
  } as unknown as EvaluationView;
}

describe('caseStages', () => {
  it('marks the finished stages with the date that ended them', () => {
    const stages = caseStages(
      view('interview', [
        ['created', '2024-12-01'],
        ['part_one_approved', '2024-12-05'],
        ['part_one_signed', '2024-12-12'],
        ['evaluation_interview_held', '2026-11-18'],
      ]),
    );
    expect(stages.map((stage) => stage.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'next',
      'next',
      'next',
    ]);
    expect(stages[0]).toEqual({ label: 'Kryteria', date: '05.12.2024', state: 'done' });
    expect(stages[2]?.date).toBe('do 18.11.2026');
    expect(stages[3]).toEqual({ label: 'Część II', date: 'w trakcie', state: 'current' });
    expect(stages[4]?.date).toBe('Jeszcze niedostępne');
  });

  it('marks the period as current after the signature of part I', () => {
    const stages = caseStages(view('period', [['part_one_signed', '2024-12-12']]));
    expect(stages[1]).toEqual({ label: 'Podpis części I', date: '12.12.2024', state: 'done' });
    expect(stages[2]).toEqual({ label: 'Okres oceny', date: 'w trakcie', state: 'current' });
  });

  it('names the objection stage while hr decides', () => {
    const stages = caseStages(view('objection', [['objection_filed', '2026-12-10']]));
    expect(stages[5]).toMatchObject({ label: 'Sprzeciw', state: 'current' });
  });

  it('closes every stage of a closed evaluation', () => {
    const stages = caseStages(view('closed', [['closed', '2026-12-20']]));
    expect(stages.every((stage) => stage.state === 'done')).toBe(true);
    expect(stages[6]).toEqual({ label: 'Zamknięta', date: '20.12.2026', state: 'done' });
  });

  it('ends an interrupted evaluation on the interruption', () => {
    const stages = caseStages(view('interrupted', [['interrupted', '2025-03-01']]));
    expect(stages[6]).toEqual({ label: 'Przerwana', date: '01.03.2025', state: 'done' });
    expect(currentStageIndex(view('interrupted'))).toBe(6);
  });

  it('shows unreached stages of an interrupted case as not applicable', () => {
    const stages = caseStages(
      view('interrupted', [
        ['part_one_approved', '2024-12-05'],
        ['interrupted', '2025-03-01'],
      ]),
    );
    expect(stages.map((stage) => stage.state)).toEqual([
      'done',
      'next',
      'next',
      'next',
      'next',
      'next',
      'done',
    ]);
    expect(stages[0]).toEqual({ label: 'Kryteria', date: '05.12.2024', state: 'done' });
    expect(stages[1]).toEqual({ label: 'Podpis części I', date: 'Nie dotyczy', state: 'next' });
  });
});

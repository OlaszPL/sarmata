import { type SheetContent, calendarDate, emptySheetContent } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { type EvaluationDetail, type EvaluationEvent } from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { computeEvaluationDeadlines } from './deadlines';

const [regulation] = officialRegulations;
if (regulation === undefined) throw new Error('The official regulation catalog is empty');

function detail(cycleStart: string, content: SheetContent = emptySheetContent()): EvaluationDetail {
  return {
    id: 'e1',
    officeId: 'o1',
    employeeId: 'emp1',
    evaluatorAccountId: 'acc1',
    regulationId: regulation?.id ?? '',
    sheetId: 'C',
    status: 'criteria',
    cycleStart: calendarDate(cycleStart),
    afterNegative: false,
    previousEvaluationId: null,
    snapshot: {
      firstName: 'A',
      lastName: 'B',
      positionTitle: null,
      orgUnit: null,
      serviceStatus: 'employee',
      grade: null,
      appointmentYear: null,
      gradeGrantedOn: null,
    },
    createdAt: '2025-01-01T00:00:00Z',
    sheet: { version: 1, state: 'draft', content },
    events: [],
    deadlines: [],
  };
}

const event = (
  kind: EvaluationEvent['kind'],
  occurredOn: string,
  payload: Record<string, unknown>,
): EvaluationEvent => ({
  id: `${kind}-${occurredOn}`,
  kind,
  occurredOn: calendarDate(occurredOn),
  payload,
  recordedBy: 'u',
  recordedAt: '2025-01-01T00:00:00Z',
});

const withEvents = (d: EvaluationDetail, ...events: EvaluationEvent[]): EvaluationDetail => ({
  ...d,
  events,
});

const find = (deadlines: ReturnType<typeof computeEvaluationDeadlines>, slot: string) =>
  deadlines.find((deadline) => deadline.slot === slot);

describe('computeEvaluationDeadlines', () => {
  it('evaluationDeadline is 24 months from cycle start shifted to working day', () => {
    const deadlines = computeEvaluationDeadlines(detail('2023-08-23'), regulation);
    expect(find(deadlines, 'evaluationDeadline')?.dueOn).toBe('2025-08-25');
  });

  it('chosen earlier dueOn shortens deadline', () => {
    const content = emptySheetContent();
    content.partOne.dueOn = calendarDate('2025-03-03');
    const deadlines = computeEvaluationDeadlines(detail('2023-08-23', content), regulation);
    expect(find(deadlines, 'evaluationDeadline')?.dueOn).toBe('2025-03-03');
  });

  it('absence closed later moves the deadline', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const open = event('absence', '2024-02-01', { absenceId: id, from: '2024-02-01', to: null });
    const closed = event('absence', '2024-04-01', {
      absenceId: id,
      from: '2024-02-01',
      to: '2024-03-31',
    });
    const base = computeEvaluationDeadlines(detail('2023-08-23'), regulation);
    const suspended = computeEvaluationDeadlines(
      withEvents(detail('2023-08-23'), open),
      regulation,
    );
    expect(find(suspended, 'evaluationDeadline')?.suspendedSince).toBe('2024-02-01');
    expect(find(suspended, 'evaluationDeadline')?.dueOn).toBeNull();
    const moved = computeEvaluationDeadlines(
      withEvents(detail('2023-08-23'), open, closed),
      regulation,
    );
    const due = find(moved, 'evaluationDeadline')?.dueOn;
    expect(due).not.toBeNull();
    expect(due && due > (find(base, 'evaluationDeadline')?.dueOn ?? '')).toBe(true);
  });

  it('term change overrides evaluation deadline', () => {
    const deadlines = computeEvaluationDeadlines(
      withEvents(
        detail('2023-08-23'),
        event('term_changed', '2024-03-01', {
          newDueOn: '2025-01-15',
          reason: 'evaluatorChange',
          noticeOn: '2024-03-01',
        }),
      ),
      regulation,
    );
    expect(find(deadlines, 'evaluationDeadline')?.dueOn).toBe('2025-01-15');
  });

  const positionChange = (changedOn: string, significant: boolean) =>
    event('position_changed', changedOn, {
      changedOn,
      significant,
      justification: 'reorganisation',
      positionTitle: null,
      orgUnit: null,
    });

  it('significant position change after 7 months adds window slots', () => {
    const deadlines = computeEvaluationDeadlines(
      withEvents(detail('2023-08-23'), positionChange('2024-03-25', true)),
      regulation,
    );
    expect(find(deadlines, 'evaluationOnPositionChange')).toBeDefined();
    expect(find(deadlines, 'criteriaResetAfterPositionChange')).toBeDefined();
  });

  it('position change before 6 months adds none', () => {
    const deadlines = computeEvaluationDeadlines(
      withEvents(detail('2023-08-23'), positionChange('2023-12-01', true)),
      regulation,
    );
    expect(find(deadlines, 'evaluationOnPositionChange')).toBeUndefined();
    expect(find(deadlines, 'criteriaResetAfterPositionChange')).toBeUndefined();
  });

  it('objection status yields 14-day decision slot', () => {
    const deadlines = computeEvaluationDeadlines(
      withEvents(
        { ...detail('2023-08-23'), status: 'objection' },
        event('objection_filed', '2026-06-01', {}),
      ),
      regulation,
    );
    expect(find(deadlines, 'objectionDecision')?.dueOn).toBe('2026-06-15');
  });
});

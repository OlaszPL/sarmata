import { type SheetContent, calendarDate, emptySheetContent } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { type EvaluationDetail } from '@sarmata/repositories';
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
});

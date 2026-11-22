import type { CalendarDate, Employee, EvaluationView, ScheduleItem } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { feedsHrTasks, hrTasks } from './tasks';

const TODAY = '2026-11-22' as CalendarDate;

function employee(id: string, lastName: string, gradeGrantedOn: string | null = null): Employee {
  return { id, firstName: 'Jan', lastName, gradeGrantedOn } as Employee;
}

interface ViewInput {
  id: string;
  employeeId: string;
  status?: string;
  slots?: Record<string, string | null>;
  events?: { kind: string; occurredOn: string }[];
}

function view(input: ViewInput): EvaluationView {
  return {
    id: input.id,
    employeeId: input.employeeId,
    status: input.status ?? 'acquainted',
    snapshot: { firstName: 'Jan', lastName: 'Snapshot' },
    deadlines: Object.entries(input.slots ?? {}).map(([slot, dueOn]) => ({
      slot,
      dueOn,
      windowStart: null,
      suspendedSince: null,
    })),
    events: input.events ?? [],
  } as unknown as EvaluationView;
}

function scheduleItem(evaluationId: string, employeeId: string, overdue: boolean): ScheduleItem {
  return {
    evaluationId,
    employeeId,
    firstName: 'Jan',
    lastName: 'Harmonogram',
    evaluationDueOn: '2026-11-01',
    overdue,
  } as ScheduleItem;
}

const run = (input: {
  views?: EvaluationView[];
  schedule?: ScheduleItem[];
  employees?: Employee[];
}) => hrTasks({ views: [], schedule: [], employees: [], today: TODAY, ...input });

describe('hrTasks', () => {
  it('returns nothing for empty input', () => {
    expect(run({})).toEqual([]);
  });

  it('creates an objection decision task with the slot due date', () => {
    const tasks = run({
      views: [
        view({
          id: 'e1',
          employeeId: 'p1',
          status: 'objection',
          slots: { objectionDecision: '2026-12-01' },
        }),
      ],
      employees: [employee('p1', 'Kowalski')],
    });
    expect(tasks).toEqual([
      {
        kind: 'objection_decision',
        evaluationId: 'e1',
        employeeName: 'Jan Kowalski',
        dueOn: '2026-12-01',
        overdue: false,
      },
    ]);
  });

  it('shows grade by law when the employee has no later grant', () => {
    const tasks = run({
      views: [
        view({
          id: 'e2',
          employeeId: 'p2',
          slots: { gradeByLawGrant: '2026-12-10' },
          events: [{ kind: 'acquainted', occurredOn: '2026-11-10' }],
        }),
      ],
      employees: [employee('p2', 'Nowak', '2024-01-01')],
    });
    expect(tasks.map((t) => t.kind)).toEqual(['grade_by_law']);
  });

  it('hides grade by law once the grade was granted after the acquaintance', () => {
    const tasks = run({
      views: [
        view({
          id: 'e2',
          employeeId: 'p2',
          slots: { gradeByLawGrant: '2026-12-10' },
          events: [
            { kind: 'acquainted', occurredOn: '2026-11-10' },
            { kind: 'signature_refused', occurredOn: '2026-11-11' },
          ],
        }),
      ],
      employees: [employee('p2', 'Nowak', '2026-11-11')],
    });
    expect(tasks).toEqual([]);
  });

  it('keeps grade by law on a closed evaluation, the page loads closed views for it', () => {
    expect(feedsHrTasks({ status: 'closed' })).toBe(true);
    expect(feedsHrTasks({ status: 'interrupted' })).toBe(false);
    const tasks = run({
      views: [
        view({
          id: 'e2',
          employeeId: 'p2',
          status: 'closed',
          slots: { gradeByLawGrant: '2026-12-10' },
          events: [{ kind: 'acquainted', occurredOn: '2026-11-10' }],
        }),
      ],
      employees: [employee('p2', 'Nowak', '2024-01-01')],
    });
    expect(tasks.map((t) => t.kind)).toEqual(['grade_by_law']);
  });

  it('ignores grade by law on an interrupted evaluation', () => {
    const tasks = run({
      views: [
        view({
          id: 'e2',
          employeeId: 'p2',
          status: 'interrupted',
          slots: { gradeByLawGrant: '2026-12-10' },
        }),
      ],
      employees: [employee('p2', 'Nowak')],
    });
    expect(tasks).toEqual([]);
  });

  it('turns overdue schedule rows into tasks', () => {
    const tasks = run({
      schedule: [scheduleItem('e3', 'p3', true), scheduleItem('e4', 'p4', false)],
    });
    expect(tasks).toEqual([
      {
        kind: 'overdue',
        evaluationId: 'e3',
        employeeName: 'Jan Harmonogram',
        dueOn: '2026-11-01',
        overdue: true,
      },
    ]);
  });

  it('sorts overdue first, then by due date, nulls last, then by name', () => {
    const tasks = run({
      views: [
        view({
          id: 'a',
          employeeId: 'pa',
          status: 'objection',
          slots: { objectionDecision: '2026-12-05' },
        }),
        view({
          id: 'b',
          employeeId: 'pb',
          status: 'objection',
          slots: { objectionDecision: '2026-11-20' },
        }),
        view({
          id: 'c',
          employeeId: 'pc',
          status: 'objection',
          slots: { objectionDecision: null },
        }),
        view({
          id: 'd',
          employeeId: 'pd',
          status: 'objection',
          slots: { objectionDecision: null },
        }),
        view({
          id: 'e',
          employeeId: 'pe',
          status: 'objection',
          slots: { objectionDecision: '2026-11-25' },
        }),
      ],
      employees: [
        employee('pa', 'A'),
        employee('pb', 'B'),
        employee('pc', 'Zet'),
        employee('pd', 'Beta'),
        employee('pe', 'E'),
      ],
    });
    expect(tasks.map((t) => t.evaluationId)).toEqual(['b', 'e', 'a', 'd', 'c']);
    expect(tasks[0]?.overdue).toBe(true);
  });
});

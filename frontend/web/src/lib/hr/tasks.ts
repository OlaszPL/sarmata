import type { CalendarDate, Employee, EvaluationView, ScheduleItem } from '@sarmata/services';
import { routes } from '@/lib/routes';

export type HrTaskKind = 'objection_decision' | 'grade_by_law' | 'overdue';

export interface HrTask {
  kind: HrTaskKind;
  evaluationId: string;
  employeeName: string;
  dueOn: CalendarDate | null;
  overdue: boolean;
}

export const hrTaskLabels: Record<HrTaskKind, { title: string; action: string }> = {
  objection_decision: { title: 'Rozstrzygnij sprzeciw', action: 'Otwórz zdarzenia sprawy' },
  grade_by_law: { title: 'Przyznaj stopień z mocy prawa', action: 'Zapisz w rejestrze' },
  overdue: { title: 'Ocena po terminie', action: 'Otwórz sprawę' },
};

/** Where the action of a task leads. */
export function hrTaskHref(task: HrTask): string {
  switch (task.kind) {
    case 'objection_decision':
      return routes.evaluationEvents(task.evaluationId);
    case 'grade_by_law':
      return routes.hrRegisterGrade(task.evaluationId);
    case 'overdue':
      return routes.evaluation(task.evaluationId);
  }
}

/**
 * Evaluations whose views the task list reads. Closed ones stay: the backend keeps the grade by law
 * slot after closing and the legal deadline runs on. Only an interrupted case gives no task.
 */
export function feedsHrTasks(evaluation: { status: string }): boolean {
  return evaluation.status !== 'interrupted';
}

const slotDueOn = (view: EvaluationView, slot: string): CalendarDate | null | undefined =>
  view.deadlines.find((s) => s.slot === slot)?.dueOn;

/** Latest acquaintance or refusal to sign, the moment the grade by law clock started. */
function latestAcquaintance(view: EvaluationView): CalendarDate | null {
  const dates = view.events
    .filter((e) => e.kind === 'acquainted' || e.kind === 'signature_refused')
    .map((e) => e.occurredOn)
    .sort();
  return dates.at(-1) ?? null;
}

/**
 * HR tasks derived from evaluation data. Notification tasks exist only after the daily collector
 * ran, so the page computes the same facts on demand.
 */
export function hrTasks(input: {
  views: readonly EvaluationView[];
  schedule: readonly ScheduleItem[];
  employees: readonly Employee[];
  today: CalendarDate;
}): HrTask[] {
  const { views, schedule, employees, today } = input;
  const byId = new Map(employees.map((e) => [e.id, e]));
  const nameOf = (employeeId: string, fallback: string): string => {
    const e = byId.get(employeeId);
    return e ? `${e.firstName} ${e.lastName}` : fallback;
  };
  const make = (
    kind: HrTaskKind,
    evaluationId: string,
    employeeName: string,
    dueOn: CalendarDate | null,
  ): HrTask => ({
    kind,
    evaluationId,
    employeeName,
    dueOn,
    overdue: dueOn !== null && dueOn < today,
  });

  const tasks: HrTask[] = [];
  for (const view of views) {
    const name = nameOf(view.employeeId, `${view.snapshot.firstName} ${view.snapshot.lastName}`);
    if (view.status === 'objection') {
      tasks.push(
        make('objection_decision', view.id, name, slotDueOn(view, 'objectionDecision') ?? null),
      );
    }
    const gradeDue = slotDueOn(view, 'gradeByLawGrant');
    if (gradeDue !== undefined && view.status !== 'interrupted') {
      const grantedOn = byId.get(view.employeeId)?.gradeGrantedOn ?? null;
      const since = latestAcquaintance(view);
      const granted = grantedOn !== null && since !== null && grantedOn >= since;
      if (!granted) tasks.push(make('grade_by_law', view.id, name, gradeDue));
    }
  }
  for (const row of schedule) {
    if (!row.overdue) continue;
    tasks.push(
      make(
        'overdue',
        row.evaluationId,
        nameOf(row.employeeId, `${row.firstName} ${row.lastName}`),
        row.evaluationDueOn,
      ),
    );
  }

  return tasks.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      (a.dueOn === b.dueOn
        ? 0
        : a.dueOn === null
          ? 1
          : b.dueOn === null
            ? -1
            : a.dueOn < b.dueOn
              ? -1
              : 1) ||
      a.employeeName.localeCompare(b.employeeName, 'pl'),
  );
}

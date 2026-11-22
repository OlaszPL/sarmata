import { type Employee, type Evaluation, type EvaluationStatus } from '@sarmata/services';

/** Lowercase without Polish diacritics, for searching. */
export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface EmployeeRow {
  id: string;
  name: string;
  position: string | null;
  ended: boolean;
  current: { evaluationId: string; status: EvaluationStatus } | null;
}

interface ListInput {
  employees: readonly Employee[];
  evaluations: readonly Evaluation[];
  scope: 'mine' | 'all';
  me: { userId: string; employeeId: string | null };
  query: string;
}

const isOpen = (evaluation: Evaluation): boolean =>
  evaluation.status !== 'closed' && evaluation.status !== 'interrupted';

function newer(a: Evaluation, b: Evaluation): Evaluation {
  const byCycle = a.cycleStart.localeCompare(b.cycleStart);
  if (byCycle !== 0) return byCycle > 0 ? a : b;
  return a.createdAt.localeCompare(b.createdAt) >= 0 ? a : b;
}

/**
 * Rows of the employee list. "Moi" are the subordinates and the employees whose open evaluation
 * the account leads, never the account's own employee. Anonymized records are left out.
 */
export function employeeRows(input: ListInput): EmployeeRow[] {
  const { me } = input;
  const open = input.evaluations.filter(isOpen);
  const latestOpen = new Map<string, Evaluation>();
  for (const evaluation of open) {
    const known = latestOpen.get(evaluation.employeeId);
    latestOpen.set(evaluation.employeeId, known ? newer(known, evaluation) : evaluation);
  }
  const ledByMe = new Set(
    open
      .filter((evaluation) => evaluation.evaluatorAccountId === me.userId)
      .map((evaluation) => evaluation.employeeId),
  );
  const tokens = normalizeForSearch(input.query).split(/\s+/).filter(Boolean);

  return input.employees
    .filter((employee) => employee.anonymizedAt === null)
    .filter((employee) => {
      if (input.scope === 'all') return true;
      if (employee.id === me.employeeId) return false;
      return (
        (me.employeeId !== null && employee.supervisorEmployeeId === me.employeeId) ||
        ledByMe.has(employee.id)
      );
    })
    .filter((employee) => {
      if (tokens.length === 0) return true;
      const haystack = normalizeForSearch(
        [employee.firstName, employee.lastName, employee.positionTitle, employee.orgUnit]
          .filter(Boolean)
          .join(' '),
      );
      return tokens.every((token) => haystack.includes(token));
    })
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, 'pl') || a.firstName.localeCompare(b.firstName, 'pl'),
    )
    .map((employee) => {
      const current = latestOpen.get(employee.id);
      return {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        position: employee.positionTitle,
        ended: employee.employmentEndedOn !== null,
        current: current ? { evaluationId: current.id, status: current.status } : null,
      };
    });
}

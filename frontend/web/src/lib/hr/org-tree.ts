import type { Employee } from '@sarmata/services';

export interface OrgNode {
  employee: Employee;
  reports: OrgNode[];
}

const byName = (a: Employee, b: Employee) =>
  a.lastName.localeCompare(b.lastName, 'pl') || a.firstName.localeCompare(b.firstName, 'pl');

const isActive = (e: Employee) => e.employmentEndedOn === null && e.anonymizedAt === null;

/**
 * The supervisor forest of the active employees. Roots have no supervisor or one outside the list.
 * Siblings are sorted by last name.
 */
export function orgTree(employees: readonly Employee[]): OrgNode[] {
  const active = employees.filter(isActive);
  const ids = new Set(active.map((e) => e.id));
  const children = new Map<string, Employee[]>();
  const roots: Employee[] = [];
  for (const e of active) {
    const parent = e.supervisorEmployeeId;
    if (parent === null || !ids.has(parent) || parent === e.id) {
      roots.push(e);
    } else {
      children.set(parent, [...(children.get(parent) ?? []), e]);
    }
  }
  const seen = new Set<string>();
  const build = (e: Employee): OrgNode => {
    seen.add(e.id);
    const reports = (children.get(e.id) ?? [])
      .filter((r) => !seen.has(r.id))
      .sort(byName)
      .map(build);
    return { employee: e, reports };
  };
  return roots.sort(byName).map(build);
}

/** True when the employee would end up above themselves: the supervisor is the employee or one of their reports, at any depth. */
export function wouldCreateCycle(
  employees: readonly Employee[],
  employeeId: string,
  supervisorId: string | null,
): boolean {
  if (supervisorId === null) return false;
  const byId = new Map(employees.map((e) => [e.id, e]));
  const visited = new Set<string>();
  let current: string | null = supervisorId;
  while (current !== null && !visited.has(current)) {
    if (current === employeeId) return true;
    visited.add(current);
    current = byId.get(current)?.supervisorEmployeeId ?? null;
  }
  return false;
}

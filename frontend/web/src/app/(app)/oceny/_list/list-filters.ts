import { type EvaluationStatus } from '@sarmata/services';
import { evaluationStatuses } from '@/lib/evaluations/status-labels';
import { routes } from '@/lib/routes';

export interface ListFilters {
  status: EvaluationStatus | null;
  employeeId: string | null;
}

function first(value: string | string[] | undefined): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  return text === undefined || text === '' ? null : text;
}

/** Reads `?status=` and `?pracownik=`. Values that are not known come back as `null`. */
export function parseListFilters(
  searchParams: Record<string, string | string[] | undefined>,
  employeeIds: readonly string[],
): ListFilters {
  const status = first(searchParams.status);
  const employeeId = first(searchParams.pracownik);
  return {
    status: evaluationStatuses.find((s) => s === status) ?? null,
    employeeId: employeeId !== null && employeeIds.includes(employeeId) ? employeeId : null,
  };
}

export function filterHref(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.employeeId) params.set('pracownik', filters.employeeId);
  const query = params.toString();
  return query ? `${routes.evaluations}?${query}` : routes.evaluations;
}

import type { ScheduleItem } from '@sarmata/services';
import { routes } from '@/lib/routes';

export interface ScheduleFilters {
  horizon: 30 | 60 | 90;
  flag: 'overdue' | 'withoutInterview' | 'startingInterviewSoon' | null;
  orgUnit: string | null;
}

const HORIZONS = [30, 60, 90] as const;

const FLAG_PARAMS = {
  'po-terminie': 'overdue',
  'bez-rozmowy': 'withoutInterview',
  'rozmowa-wkrotce': 'startingInterviewSoon',
} as const;

function first(value: string | string[] | undefined): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  return text === undefined || text === '' ? null : text;
}

/** Reads `?horyzont=`, `?flaga=` and `?komorka=`. Values that are not known come back as defaults. */
export function parseScheduleFilters(
  params: Record<string, string | string[] | undefined>,
  units: readonly string[],
): ScheduleFilters {
  const horizon = HORIZONS.find((h) => String(h) === first(params.horyzont)) ?? 30;
  const flagParam = first(params.flaga);
  const flag =
    flagParam !== null && Object.hasOwn(FLAG_PARAMS, flagParam)
      ? FLAG_PARAMS[flagParam as keyof typeof FLAG_PARAMS]
      : null;
  const unit = first(params.komorka);
  return { horizon, flag, orgUnit: unit !== null && units.includes(unit) ? unit : null };
}

export function applyScheduleFilters(
  rows: readonly ScheduleItem[],
  filters: ScheduleFilters,
): ScheduleItem[] {
  return rows.filter(
    (row) =>
      (filters.flag === null || row[filters.flag]) &&
      (filters.orgUnit === null || row.orgUnit === filters.orgUnit),
  );
}

export function scheduleHref(filters: ScheduleFilters): string {
  const params = new URLSearchParams();
  if (filters.horizon !== 30) params.set('horyzont', String(filters.horizon));
  const flagParam = Object.entries(FLAG_PARAMS).find(([, flag]) => flag === filters.flag)?.[0];
  if (flagParam) params.set('flaga', flagParam);
  if (filters.orgUnit) params.set('komorka', filters.orgUnit);
  const query = params.toString();
  return query ? `${routes.hrSchedule}?${query}` : routes.hrSchedule;
}

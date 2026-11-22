import { describe, expect, it } from 'vitest';
import type { ScheduleItem } from '@sarmata/services';
import {
  applyScheduleFilters,
  parseScheduleFilters,
  scheduleHref,
  type ScheduleFilters,
} from './schedule-filters';

const units = ['Departament A', 'Departament B'];
const none: ScheduleFilters = { horizon: 30, flag: null, orgUnit: null };

function item(over: Partial<ScheduleItem>): ScheduleItem {
  return {
    evaluationId: 'e',
    employeeId: 'p',
    firstName: 'Jan',
    lastName: 'Kowalski',
    orgUnit: 'Departament A',
    evaluatorAccountId: 'a',
    evaluatorName: null,
    status: 'period',
    cycleStart: '2026-01-01',
    startingInterviewDueOn: null,
    evaluationDueOn: null,
    suspended: false,
    interviewHeld: false,
    overdue: false,
    withoutInterview: false,
    startingInterviewSoon: false,
    ...over,
  } as ScheduleItem;
}

describe('parseScheduleFilters', () => {
  it('reads known values', () => {
    expect(
      parseScheduleFilters(
        { horyzont: '60', flaga: 'bez-rozmowy', komorka: 'Departament B' },
        units,
      ),
    ).toEqual({ horizon: 60, flag: 'withoutInterview', orgUnit: 'Departament B' });
  });

  it('falls back to defaults for unknown values', () => {
    expect(
      parseScheduleFilters({ horyzont: '45', flaga: 'toString', komorka: 'Nieznana' }, units),
    ).toEqual(none);
    expect(parseScheduleFilters({}, units)).toEqual(none);
  });

  it('uses the first value of a repeated key', () => {
    expect(parseScheduleFilters({ horyzont: ['90', '30'] }, units).horizon).toBe(90);
  });
});

describe('applyScheduleFilters', () => {
  const rows = [
    item({ evaluationId: '1', overdue: true }),
    item({ evaluationId: '2', withoutInterview: true, orgUnit: 'Departament B' }),
    item({ evaluationId: '3', startingInterviewSoon: true }),
  ];
  const ids = (f: ScheduleFilters) => applyScheduleFilters(rows, f).map((r) => r.evaluationId);

  it('keeps everything without filters', () => {
    expect(ids(none)).toEqual(['1', '2', '3']);
  });
  it('filters overdue', () => {
    expect(ids({ ...none, flag: 'overdue' })).toEqual(['1']);
  });
  it('filters without interview', () => {
    expect(ids({ ...none, flag: 'withoutInterview' })).toEqual(['2']);
  });
  it('filters starting interview soon', () => {
    expect(ids({ ...none, flag: 'startingInterviewSoon' })).toEqual(['3']);
  });
  it('filters by unit', () => {
    expect(ids({ ...none, orgUnit: 'Departament B' })).toEqual(['2']);
  });
  it('combines flag and unit', () => {
    expect(ids({ ...none, flag: 'overdue', orgUnit: 'Departament B' })).toEqual([]);
  });
});

describe('scheduleHref', () => {
  it('is the bare path for defaults', () => {
    expect(scheduleHref(none)).toBe('/kadry/harmonogram');
  });

  it('round trips through parse', () => {
    const filters: ScheduleFilters = {
      horizon: 90,
      flag: 'startingInterviewSoon',
      orgUnit: 'Departament A',
    };
    const query = new URL(scheduleHref(filters), 'http://x').searchParams;
    const params = Object.fromEntries(query);
    expect(parseScheduleFilters(params, units)).toEqual(filters);
  });
});

import {
  type CalendarDate,
  type ObjectionOutcome,
  type SheetContent,
  type TermChangeReason,
  calendarDate,
} from '@sarmata/services';
import { z } from 'zod';
import type { FormValues } from '@/lib/form-action';

/** A native date field: an existing `rrrr-mm-dd` day, parsed to a calendar date. */
const dateField = z.string().transform((value, ctx): CalendarDate => {
  if (value === '') {
    ctx.issues.push({ code: 'custom', message: 'Wpisz datę', input: value });
    return z.NEVER;
  }
  try {
    return calendarDate(value);
  } catch {
    ctx.issues.push({ code: 'custom', message: 'Wpisz poprawną datę', input: value });
    return z.NEVER;
  }
});

/** A date that may stay empty, which reads as null. */
const optionalDateField = z.string().transform((value, ctx): CalendarDate | null => {
  if (value === '') return null;
  try {
    return calendarDate(value);
  } catch {
    ctx.issues.push({ code: 'custom', message: 'Wpisz poprawną datę', input: value });
    return z.NEVER;
  }
});

const required = (message: string) => z.string().trim().min(1, message);
const nullIfEmpty = z.string().transform((value) => (value.trim() === '' ? null : value.trim()));

const ORDER_MESSAGE = 'Data powrotu nie może być wcześniejsza niż początek nieobecności';

export const acquaintanceSchema = z.object({
  acquaintedOn: dateField,
  signature: z.enum(['signed', 'refused'], {
    error: 'Zaznacz, czy osoba oceniana podpisała zapoznanie',
  }),
  refusalNote: z.string().default(''),
  witnesses: z.string().default(''),
  place: z.string().default(''),
});

export const closingSchema = z.object({ closedOn: dateField });

export const objectionFilingSchema = z.object({ filedOn: dateField });

const outcomes = ['rejected', 'changed', 'redraft'] as const satisfies readonly ObjectionOutcome[];

export const objectionDecisionSchema = z.object({
  decidedOn: dateField,
  outcome: z.enum(outcomes, { error: 'Wybierz wynik rozpatrzenia sprzeciwu' }),
});

export const interruptionSchema = z.object({
  interruptedOn: dateField,
  reason: required('Wpisz powód przerwania oceny'),
  confirm: z.literal('yes', { error: 'Potwierdź, że rozumiesz skutki przerwania' }),
});

export const absenceSchema = z
  .object({ from: dateField, to: optionalDateField })
  .superRefine((data, ctx) => {
    if (data.to !== null && data.to < data.from) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: ORDER_MESSAGE });
    }
  });

export const returnSchema = z
  .object({ absenceId: z.uuid(), from: dateField, to: dateField })
  .superRefine((data, ctx) => {
    if (data.to < data.from) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: ORDER_MESSAGE });
    }
  });

const reasons = [
  'evaluatorChange',
  'expectedAbsenceOfEvaluated',
  'expectedAbsenceOfEvaluator',
  'requestOfEvaluated',
] as const satisfies readonly TermChangeReason[];

export const termChangeSchema = z.object({
  newDueOn: dateField,
  reason: z.enum(reasons, { error: 'Wybierz przyczynę zmiany terminu' }),
  noticeOn: dateField,
});

export const positionChangeSchema = z.object({
  changedOn: dateField,
  positionTitle: nullIfEmpty,
  orgUnit: nullIfEmpty,
  significant: z.enum(['yes', 'no'], {
    error: 'Zaznacz, czy zmieniły się istotnie obowiązki',
  }),
  justification: required('Wpisz uzasadnienie'),
});

export const evaluatorChangeSchema = z.object({
  accountId: z.uuid({ error: 'Wybierz nową osobę oceniającą' }),
  occurredOn: dateField,
  reason: required('Wpisz powód zmiany osoby oceniającej'),
});

export const correctionSchema = z.object({ reason: required('Wpisz powód korekty') });

/** One person per line, trimmed, without empty lines. */
export function witnessList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * The sheet with part II ratings, justification and development conclusions replaced by the form
 * values. Every criterion needs a numeric rating. The rest of the sheet stays as it was.
 */
export function sheetFromForm(
  values: FormValues,
  current: SheetContent,
  criteria: readonly string[],
): { content: SheetContent } | { fieldErrors: Record<string, string> } {
  const ratings: Record<string, number> = {};
  const fieldErrors: Record<string, string> = {};
  for (const id of criteria) {
    const key = `rating-${id}`;
    const raw = single(values[key]).trim();
    const rating = raw === '' ? Number.NaN : Number(raw);
    if (Number.isFinite(rating)) ratings[id] = rating;
    else fieldErrors[key] = 'Wybierz ocenę cząstkową';
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    content: {
      ...current,
      partTwo: {
        ...current.partTwo,
        ratings,
        justification: single(values.justification),
        developmentConclusions: single(values.developmentConclusions),
      },
    },
  };
}

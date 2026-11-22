import { type CalendarDate, type EvaluationView, calendarDate } from '@sarmata/services';
import { z } from 'zod';

export interface AppealCase {
  evaluationId: string;
  employeeName: string;
  outcomeOn: CalendarDate;
  appealedOn: CalendarDate | null;
}

/** Evaluations whose latest objection outcome is a rejection, the ones without an appeal first. */
export function appealCases(views: readonly EvaluationView[]): AppealCase[] {
  const cases: AppealCase[] = [];
  for (const view of views) {
    const outcome = view.events.filter((e) => e.kind === 'objection_outcome').at(-1);
    if (outcome?.payload.outcome !== 'rejected') continue;
    const appeal = view.events.find((e) => e.kind === 'labour_court_appeal');
    cases.push({
      evaluationId: view.id,
      employeeName: `${view.snapshot.firstName} ${view.snapshot.lastName}`,
      outcomeOn: outcome.occurredOn,
      appealedOn: appeal?.occurredOn ?? null,
    });
  }
  return cases.sort(
    (a, b) =>
      Number(a.appealedOn !== null) - Number(b.appealedOn !== null) ||
      a.employeeName.localeCompare(b.employeeName, 'pl'),
  );
}

const dateMessage = 'Podaj datę w formacie dd.mm.rrrr';
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, dateMessage)
  .refine((value) => {
    try {
      calendarDate(value);
      return true;
    } catch {
      return false;
    }
  }, dateMessage)
  .transform(calendarDate);

export const appealSchema = z.object({
  evaluationId: z.uuid(),
  filedOn: dateField,
});

export const gradeGrantSchema = z
  .object({
    employeeId: z.uuid('Wybierz pracownika'),
    basis: z.enum(['on_request', 'by_law'], 'Wybierz podstawę przyznania stopnia'),
    /** An empty string means no evaluation. */
    evaluationId: z.string(),
    grantedOn: dateField,
    newGrade: z.coerce
      .number('Podaj stopień od 1 do 9')
      .int('Podaj stopień od 1 do 9')
      .min(1, 'Podaj stopień od 1 do 9')
      .max(9, 'Podaj stopień od 1 do 9'),
  })
  .superRefine((input, ctx) => {
    if (input.basis === 'by_law' && input.evaluationId === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['evaluationId'],
        message: 'Wybierz ocenę, która daje stopień z mocy prawa',
      });
    }
  });

import {
  type CalendarDate,
  type EvaluationView,
  type RegulationDocument,
  type SheetContent,
  calendarDate,
  computeEvaluationDeadlines,
} from '@sarmata/services';
import { z } from 'zod';

const DATE_MESSAGE = 'Wpisz datę w formacie dd.mm.rrrr';

function isCalendarDate(value: string): boolean {
  try {
    calendarDate(value);
    return true;
  } catch {
    return false;
  }
}

/** An optional date of a native date field: empty, or an existing `rrrr-mm-dd` day. */
const optionalDate = z
  .string()
  .refine((value) => value === '' || isCalendarDate(value), { message: DATE_MESSAGE });

/**
 * The part I form: criteria and due date, plus the starting interview of the approval. `intent`
 * tells the "save" button from the "approve" one, only approval needs the interview date.
 */
export const partOneSchema = z
  .object({
    intent: z.enum(['save', 'approve']),
    additionalCriteria: z.array(z.string()),
    dueOn: optionalDate,
    startingInterviewOn: optionalDate,
    place: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.intent === 'approve' && data.startingInterviewOn === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['startingInterviewOn'],
        message: 'Wpisz datę rozmowy rozpoczynającej',
      });
    }
  });

export type PartOneInput = z.output<typeof partOneSchema>;

/** The sheet with part I replaced by the form values. An empty due date means the term by law. */
export function partOneContent(
  content: SheetContent,
  input: { additionalCriteria: string[]; dueOn: string },
): SheetContent {
  return {
    ...content,
    partOne: {
      additionalCriteria: [...input.additionalCriteria],
      dueOn: input.dueOn === '' ? null : calendarDate(input.dueOn),
    },
  };
}

/**
 * The latest due date part I may set: the evaluation deadline computed as if part I chose none, so
 * a shorter date already saved does not lower the limit. Null when the deadline is suspended.
 */
export function latestDueOn(
  view: EvaluationView,
  document: RegulationDocument,
): CalendarDate | null {
  const withoutChoice: EvaluationView = {
    ...view,
    sheet: {
      ...view.sheet,
      content: { ...view.sheet.content, partOne: { ...view.sheet.content.partOne, dueOn: null } },
    },
  };
  const deadline = computeEvaluationDeadlines(withoutChoice, document).find(
    (slot) => slot.slot === 'evaluationDeadline' || slot.slot === 'reevaluationAfterNegative',
  );
  return deadline?.dueOn ?? null;
}

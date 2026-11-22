import { type CalendarDate, type EvaluationView, type SheetContent } from '@sarmata/services';

export type PartTwoPatch = Omit<SheetContent['partTwo'], 'gradeRequest'>;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function date(formData: FormData, name: string): CalendarDate | null {
  const value = text(formData, name);
  return value === '' ? null : (value as CalendarDate);
}

/**
 * Saved content with the part II fields of a posted form. Empty date -> null, unknown or empty
 * `rating-<id>` -> left out, texts trimmed at the ends. Part I and gradeRequest stay as saved.
 */
export function sheetFromPartTwoForm(
  content: SheetContent,
  criteria: readonly string[],
  formData: FormData,
): SheetContent {
  const ratings: Record<string, number> = {};
  for (const id of criteria) {
    const raw = text(formData, `rating-${id}`);
    if (raw === '') continue;
    const points = Number(raw);
    if (Number.isFinite(points)) ratings[id] = points;
  }
  return {
    ...content,
    partTwo: {
      ...content.partTwo,
      interviewOn: date(formData, 'interviewOn'),
      periodFrom: date(formData, 'periodFrom'),
      periodTo: date(formData, 'periodTo'),
      ratings,
      justification: text(formData, 'justification'),
      developmentConclusions: text(formData, 'developmentConclusions'),
    },
  };
}

/**
 * Saved content with the part III form: `request` 'yes' | 'no', `gradeRequestMotivation`.
 * 'yes' sets { requestedGrade: grade + 1, motivation }, 'no' sets null. Errors keyed by control id:
 * missing choice -> gradeRequest, 'yes' with empty motivation -> gradeRequestMotivation.
 */
export function sheetFromGradeRequestForm(
  content: SheetContent,
  grade: number,
  formData: FormData,
): { content: SheetContent } | { fieldErrors: Record<string, string> } {
  const request = text(formData, 'request');
  if (request !== 'yes' && request !== 'no') {
    return { fieldErrors: { gradeRequest: 'Wybierz, czy składasz wniosek o stopień' } };
  }
  if (request === 'no') {
    return { content: { ...content, partTwo: { ...content.partTwo, gradeRequest: null } } };
  }
  const motivation = text(formData, 'gradeRequestMotivation');
  if (motivation === '') {
    return { fieldErrors: { gradeRequestMotivation: 'Napisz umotywowanie wniosku' } };
  }
  return {
    content: {
      ...content,
      partTwo: { ...content.partTwo, gradeRequest: { requestedGrade: grade + 1, motivation } },
    },
  };
}

/** Values the editor starts with: saved dates win, empty ones come from the cycle and the interview. */
export function partTwoDefaults(view: EvaluationView): PartTwoPatch {
  const { interviewOn, periodFrom, periodTo, ratings, justification, developmentConclusions } =
    view.sheet.content.partTwo;
  const held = view.events.filter((event) => event.kind === 'evaluation_interview_held').at(-1);
  const heldOn = held?.occurredOn ?? null;
  return {
    interviewOn: interviewOn ?? heldOn,
    periodFrom: periodFrom ?? view.cycleStart,
    periodTo: periodTo ?? heldOn,
    ratings,
    justification,
    developmentConclusions,
  };
}

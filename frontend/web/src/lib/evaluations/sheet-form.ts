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

/** Part III when the data of a civil servant have no grade, so no request can name the next one. */
export const NO_GRADE_MESSAGE =
  'W danych osoby ocenianej brakuje stopnia służbowego. Kadry uzupełniają go w karcie pracownika.';

/**
 * Saved content with the part III form: `request` 'yes' | 'no', `gradeRequestMotivation`.
 * 'yes' sets { requestedGrade: grade + 1, motivation }, 'no' sets null (also without a grade, so a
 * request can always be removed). Errors keyed by control id: missing choice or 'yes' without a
 * grade -> gradeRequest, 'yes' with empty motivation -> gradeRequestMotivation.
 */
export function sheetFromGradeRequestForm(
  content: SheetContent,
  grade: number | null,
  formData: FormData,
): { content: SheetContent } | { fieldErrors: Record<string, string> } {
  const request = text(formData, 'request');
  if (request !== 'yes' && request !== 'no') {
    return { fieldErrors: { gradeRequest: 'Wybierz, czy składasz wniosek o stopień' } };
  }
  if (request === 'no') {
    return { content: { ...content, partTwo: { ...content.partTwo, gradeRequest: null } } };
  }
  if (grade === null) return { fieldErrors: { gradeRequest: NO_GRADE_MESSAGE } };
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

/** Controls of part II whose values differ from what the editor state holds, see `partTwoDrift`. */
export interface PartTwoDrift {
  /** The ratings the tiles show, when they differ. */
  ratings?: Record<string, number>;
  justification?: string;
  developmentConclusions?: string;
  /** A date input differs from its default. Dates are uncontrolled, so only a save is due. */
  dates: boolean;
}

/**
 * What a user put into the part II controls before React hydrated them. React may never see such a
 * change, so the controlled state would keep the server values (and put them back on the next
 * render). Compares the posted form with `expected`, texts as typed, and answers `null` when every
 * control matches.
 */
export function partTwoDrift(
  formData: FormData,
  criteria: readonly string[],
  expected: PartTwoPatch,
): PartTwoDrift | null {
  const raw = (name: string): string => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };
  const ratings: Record<string, number> = {};
  for (const id of criteria) {
    const value = raw(`rating-${id}`);
    const points = Number(value);
    if (value !== '' && Number.isFinite(points)) ratings[id] = points;
  }
  const ratingsDiffer = criteria.some((id) => ratings[id] !== expected.ratings[id]);
  const dates = (['interviewOn', 'periodFrom', 'periodTo'] as const).some(
    (name) => raw(name) !== (expected[name] ?? ''),
  );
  const drift: PartTwoDrift = { dates };
  if (ratingsDiffer) drift.ratings = { ...expected.ratings, ...ratings };
  if (raw('justification') !== expected.justification) drift.justification = raw('justification');
  if (raw('developmentConclusions') !== expected.developmentConclusions) {
    drift.developmentConclusions = raw('developmentConclusions');
  }
  const changed =
    dates ||
    drift.ratings !== undefined ||
    drift.justification !== undefined ||
    drift.developmentConclusions !== undefined;
  return changed ? drift : null;
}

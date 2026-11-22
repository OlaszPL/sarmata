import { type CalendarDate, type DeadlineSlot, type EvaluationView } from '@sarmata/services';

export type StepOwner = 'evaluator' | 'hr' | 'nobody';

export interface NextStep {
  readonly stage: string;
  readonly action: string;
  readonly owner: StepOwner;
  readonly dueOn: CalendarDate | null;
  /**
   * Fields of part II the evaluator still has to fill in: a partial rating per criterion and the
   * conclusions for the development plan. Null outside the `interview` status.
   */
  readonly missingFields: number | null;
}

/** Slots that bind until the evaluation is drawn up, in order of priority. */
const EVALUATION_SLOTS: readonly DeadlineSlot[] = [
  'evaluationOnPositionChange',
  'reevaluationAfterNegative',
  'evaluationDeadline',
];

/** The first of the given slots that has a date, in the order given. */
function firstDue(view: EvaluationView, slots: readonly DeadlineSlot[]): CalendarDate | null {
  for (const slot of slots) {
    const dueOn = view.deadlines.find((deadline) => deadline.slot === slot)?.dueOn;
    if (dueOn) return dueOn;
  }
  return null;
}

/**
 * The deadline for drawing up the evaluation, whatever the status: a change of position first, then
 * a re-evaluation after a negative one, then the regular deadline. Null when no slot has a date.
 */
export function evaluationDueOn(view: EvaluationView): CalendarDate | null {
  return firstDue(view, EVALUATION_SLOTS);
}

function interviewStep(view: EvaluationView): Pick<NextStep, 'action' | 'missingFields'> {
  const { ratings, developmentConclusions } = view.sheet.content.partTwo;
  const missingRatings = view.criteria.filter((criterion) => ratings[criterion] === undefined);
  const missingConclusions = developmentConclusions.trim() === '';
  const missingFields = missingRatings.length + Number(missingConclusions);
  if (missingRatings.length > 0) {
    return { action: 'Uzupełnij oceny cząstkowe w części II', missingFields };
  }
  if (missingConclusions) {
    return { action: 'Wpisz wnioski do IPRZ i zatwierdź ocenę', missingFields };
  }
  return { action: 'Sprawdź i zatwierdź ocenę', missingFields };
}

/** What the case needs next and who has to do it. Null once nothing is left to do. */
export function nextStep(view: EvaluationView): NextStep | null {
  switch (view.status) {
    case 'criteria':
      return {
        stage: 'Kryteria',
        action: 'Ustal kryteria na rozmowie rozpoczynającej',
        owner: 'evaluator',
        dueOn: firstDue(view, ['startingInterviewAfterNegative', 'startingInterview']),
        missingFields: null,
      };
    case 'criteria_awaiting_signature':
      return {
        stage: 'Podpis części I',
        action: 'Odnotuj podpis części I przez osobę ocenianą',
        owner: 'evaluator',
        dueOn: null,
        missingFields: null,
      };
    case 'period':
      return {
        stage: 'Okres oceny',
        action: 'Odnotuj rozmowę oceniającą',
        owner: 'evaluator',
        dueOn: firstDue(view, EVALUATION_SLOTS),
        missingFields: null,
      };
    case 'interview':
      return {
        stage: 'Część II',
        ...interviewStep(view),
        owner: 'evaluator',
        // The evaluation is not drawn up yet, so the deadlines of the period still bind.
        dueOn: firstDue(view, EVALUATION_SLOTS),
      };
    case 'drafted':
      return {
        stage: 'Zapoznanie',
        action: 'Odnotuj zapoznanie z oceną albo odmowę podpisu',
        owner: 'evaluator',
        dueOn: null,
        missingFields: null,
      };
    case 'delivered':
      return {
        stage: 'Czas na sprzeciw',
        action: 'Czas na sprzeciw, potem ocena zamknie się sama',
        owner: 'nobody',
        dueOn: firstDue(view, ['objection']),
        missingFields: null,
      };
    case 'objection':
      return {
        stage: 'Sprzeciw',
        action: 'Kadry rozpatrują sprzeciw',
        owner: 'hr',
        dueOn: firstDue(view, ['objectionDecision']),
        missingFields: null,
      };
    case 'closed':
    case 'interrupted':
      return null;
  }
}

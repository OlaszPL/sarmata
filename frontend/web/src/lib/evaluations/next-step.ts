import { type CalendarDate, type DeadlineSlot, type EvaluationView } from '@sarmata/services';

export type StepOwner = 'evaluator' | 'hr' | 'nobody';

export interface NextStep {
  readonly stage: string;
  readonly action: string;
  readonly owner: StepOwner;
  readonly dueOn: CalendarDate | null;
}

/** The first of the given slots that has a date, in the order given. */
function firstDue(view: EvaluationView, slots: readonly DeadlineSlot[]): CalendarDate | null {
  for (const slot of slots) {
    const dueOn = view.deadlines.find((deadline) => deadline.slot === slot)?.dueOn;
    if (dueOn) return dueOn;
  }
  return null;
}

function interviewAction(view: EvaluationView): string {
  const { ratings, developmentConclusions } = view.sheet.content.partTwo;
  if (view.criteria.some((criterion) => ratings[criterion] === undefined)) {
    return 'Uzupełnij oceny cząstkowe w części II';
  }
  if (developmentConclusions.trim() === '') return 'Wpisz wnioski do IPRZ i zatwierdź ocenę';
  return 'Sprawdź i zatwierdź ocenę';
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
      };
    case 'criteria_awaiting_signature':
      return {
        stage: 'Podpis części I',
        action: 'Odnotuj podpis części I przez ocenianego',
        owner: 'evaluator',
        dueOn: null,
      };
    case 'period':
      return {
        stage: 'Okres oceny',
        action: 'Odnotuj rozmowę oceniającą',
        owner: 'evaluator',
        dueOn: firstDue(view, [
          'evaluationOnPositionChange',
          'reevaluationAfterNegative',
          'evaluationDeadline',
        ]),
      };
    case 'interview':
      return {
        stage: 'Część II',
        action: interviewAction(view),
        owner: 'evaluator',
        dueOn: null,
      };
    case 'drafted':
      return {
        stage: 'Zapoznanie',
        action: 'Odnotuj zapoznanie z oceną albo odmowę podpisu',
        owner: 'evaluator',
        dueOn: null,
      };
    case 'delivered':
      return {
        stage: 'Czas na sprzeciw',
        action: 'Czas na sprzeciw, potem ocena zamknie się sama',
        owner: 'nobody',
        dueOn: firstDue(view, ['objection']),
      };
    case 'objection':
      return {
        stage: 'Sprzeciw',
        action: 'Kadry rozpatrują sprzeciw',
        owner: 'hr',
        dueOn: firstDue(view, ['objectionDecision']),
      };
    case 'closed':
    case 'interrupted':
      return null;
  }
}

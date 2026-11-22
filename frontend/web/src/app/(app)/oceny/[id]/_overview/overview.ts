import { type CalendarDate, type EvaluationView, type EvaluationWarning } from '@sarmata/services';
import { type NextStep } from '@/lib/evaluations/next-step';
import { daysUntil, formatDate, relativeDays } from '@/lib/format';
import { routes } from '@/lib/routes';

export interface StepCard {
  stage: string;
  action: string;
  who: string;
  due: string | null;
  link: { href: string; label: string; primary: boolean } | null;
}

interface StepCardInput {
  view: EvaluationView;
  step: NextStep | null;
  canWrite: boolean;
  isHr: boolean;
  today: CalendarDate;
}

function stepLink(view: EvaluationView): { href: string; label: string } | null {
  switch (view.status) {
    case 'criteria':
    case 'criteria_awaiting_signature':
      return { href: routes.evaluationPart1(view.id), label: 'Przejdź do części I' };
    case 'period':
    case 'interview':
      return { href: routes.evaluationPart2(view.id), label: 'Przejdź do części II' };
    case 'drafted':
    case 'delivered':
    case 'objection':
      return { href: routes.evaluationEvents(view.id), label: 'Przejdź do zdarzeń' };
    default:
      return null;
  }
}

function whoOf(step: NextStep, canWrite: boolean): string {
  switch (step.owner) {
    case 'evaluator':
      return canWrite ? 'Ty' : 'Osoba oceniająca';
    case 'hr':
      return 'Kadry';
    case 'nobody':
      return 'Nikt, wystarczy poczekać';
  }
}

/** The "Następny krok" block of the overview. Null when nothing is left to do. */
export function stepCard({ view, step, canWrite, isHr, today }: StepCardInput): StepCard | null {
  if (step === null) return null;
  const link = stepLink(view);
  const primary = (canWrite && step.owner === 'evaluator') || (isHr && step.owner === 'hr');
  return {
    stage: step.stage,
    action: step.action,
    who: whoOf(step, canWrite),
    due: step.dueOn
      ? `${formatDate(step.dueOn)}, ${relativeDays(daysUntil(today, step.dueOn))}`
      : null,
    link: link ? { ...link, primary } : null,
  };
}

/** The tab with the fields the next approval checks, null when no approval is next. */
export function issueTab(view: EvaluationView): string | null {
  if (view.status === 'criteria') return routes.evaluationPart1(view.id);
  if (view.status === 'interview') return routes.evaluationPart2(view.id);
  return null;
}

export function warningText(warning: EvaluationWarning): string {
  switch (warning.code) {
    case 'grade_due_by_law':
      return `Stopień przysługuje z mocy prawa od ${formatDate(warning.dueOn)} (art. 89 ust. 2 ustawy), więc wniosek o stopień w części III jest zbędny.`;
    case 'second_consecutive_negative':
      return 'To druga z rzędu ocena negatywna. Według art. 71 ustawy oznacza rozwiązanie stosunku pracy.';
  }
}

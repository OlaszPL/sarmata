import {
  type CalendarDate,
  type EvaluationEventKind,
  type EvaluationStatus,
  type EvaluationView,
} from '@sarmata/services';
import { formatDate } from '@/lib/format';

export type CaseStageState = 'done' | 'current' | 'next';

export interface CaseStage {
  label: string;
  date: string;
  state: CaseStageState;
}

interface StageRule {
  label: string;
  /** Statuses in which this stage is the current one. */
  statuses: readonly EvaluationStatus[];
  /** Event that ends the stage, its date goes under a finished stage. */
  endedBy: readonly EvaluationEventKind[];
  /** Under a finished period the date reads "do dd.mm.rrrr". */
  until?: boolean;
}

const RULES: readonly StageRule[] = [
  { label: 'Kryteria', statuses: ['criteria'], endedBy: ['part_one_approved'] },
  {
    label: 'Podpis części I',
    statuses: ['criteria_awaiting_signature'],
    endedBy: ['part_one_signed'],
  },
  {
    label: 'Okres oceny',
    statuses: ['period'],
    endedBy: ['evaluation_interview_held'],
    until: true,
  },
  { label: 'Część II', statuses: ['interview'], endedBy: ['sheet_approved'] },
  { label: 'Zapoznanie', statuses: ['drafted'], endedBy: ['acquainted', 'signature_refused'] },
  {
    label: 'Czas na sprzeciw',
    statuses: ['delivered', 'objection'],
    endedBy: ['closed', 'objection_outcome'],
  },
  { label: 'Zamknięta', statuses: ['closed'], endedBy: ['closed'] },
];

const LAST = RULES.length - 1;

/** Index of the current stage, the last one for a closed or interrupted evaluation. */
export function currentStageIndex(view: EvaluationView): number {
  if (view.status === 'interrupted') return LAST;
  return Math.max(
    0,
    RULES.findIndex((rule) => rule.statuses.includes(view.status)),
  );
}

function lastDate(
  view: EvaluationView,
  kinds: readonly EvaluationEventKind[],
): CalendarDate | null {
  return view.events.filter((event) => kinds.includes(event.kind)).at(-1)?.occurredOn ?? null;
}

/**
 * The seven stages of the strip above a case: finished ones with the date that ended them, the
 * current one "w trakcie" (the hero shows its due date), the rest "Jeszcze niedostępne". An
 * interrupted case marks finished only the stages it ended, the rest "Nie dotyczy", the last tile
 * "Przerwana".
 */
export function caseStages(view: EvaluationView): CaseStage[] {
  const current = currentStageIndex(view);
  const finished = view.status === 'closed' || view.status === 'interrupted';

  return RULES.map((rule, index) => {
    if (view.status === 'interrupted') {
      if (index === LAST) {
        const on = lastDate(view, ['interrupted']);
        return { label: 'Przerwana', date: on ? formatDate(on) : '', state: 'done' };
      }
      // Only a stage whose ending event happened was finished, the case never reached the rest.
      const on = lastDate(view, rule.endedBy);
      if (on === null) return { label: rule.label, date: 'Nie dotyczy', state: 'next' };
      return {
        label: rule.label,
        date: rule.until ? `do ${formatDate(on)}` : formatDate(on),
        state: 'done',
      };
    }
    if (index < current || (finished && index === current)) {
      const on = lastDate(view, rule.endedBy);
      const date = on ? (rule.until ? `do ${formatDate(on)}` : formatDate(on)) : 'Zakończono';
      return { label: rule.label, date, state: 'done' };
    }
    if (index === current) {
      const label = view.status === 'objection' ? 'Sprzeciw' : rule.label;
      return { label, date: 'w trakcie', state: 'current' };
    }
    return { label: rule.label, date: 'Jeszcze niedostępne', state: 'next' };
  });
}

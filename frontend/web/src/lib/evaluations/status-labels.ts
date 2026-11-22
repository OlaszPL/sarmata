import { type EvaluationStatus } from '@sarmata/services';
import { type TagTone } from '@sarmata/ui';

const TAGS: Record<EvaluationStatus, { label: string; tone: TagTone }> = {
  criteria: { label: 'Kryteria', tone: 'todo' },
  criteria_awaiting_signature: { label: 'Podpis części I', tone: 'todo' },
  period: { label: 'Okres oceny', tone: 'progress' },
  interview: { label: 'Część II', tone: 'progress' },
  drafted: { label: 'Zapoznanie', tone: 'progress' },
  delivered: { label: 'Czas na sprzeciw', tone: 'waiting' },
  objection: { label: 'Sprzeciw', tone: 'attention' },
  closed: { label: 'Zamknięta', tone: 'done' },
  interrupted: { label: 'Przerwana', tone: 'neutral' },
};

/** Statuses in the order of the process. */
export const evaluationStatuses = Object.keys(TAGS) as EvaluationStatus[];

export function statusTag(status: EvaluationStatus): { label: string; tone: TagTone } {
  return TAGS[status];
}

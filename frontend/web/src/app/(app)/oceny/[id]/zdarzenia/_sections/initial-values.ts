import type { EvaluationView } from '@sarmata/services';
import type { FormValues } from '@/lib/form-action';

/** Part II of the saved sheet as form values: `rating-<id>` as text, justification and conclusions. */
export function sheetValues(view: EvaluationView): FormValues {
  const { ratings, justification, developmentConclusions } = view.sheet.content.partTwo;
  const values: FormValues = { justification, developmentConclusions };
  for (const [id, points] of Object.entries(ratings)) values[`rating-${id}`] = String(points);
  return values;
}

/** Last event of any of the kinds, null when none happened. */
export function lastEventOf(view: EvaluationView, kinds: readonly string[]) {
  return view.events.filter((event) => kinds.includes(event.kind)).at(-1) ?? null;
}

export function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

import 'server-only';
import { cache } from 'react';
import { type CalendarDate, type EvaluationView, servicesFor } from '@sarmata/services';
import { createSupabase } from '@/lib/supabase';
import { type CaseRegulation, caseRegulationOf } from './case-regulation';

export {
  type CaseBand,
  type CaseCriterion,
  type CaseRegulation,
  type CaseScaleLevel,
  caseRegulationOf,
  criterionName,
  levelName,
} from './case-regulation';

/** One regulation lookup per date and request. */
const inForceOn = cache(async (on: CalendarDate) =>
  servicesFor(await createSupabase()).regulations.inForceOn(on),
);

/**
 * The regulation of an evaluation, cut to what its screens need: the case criteria with names and
 * indicators, the partial scale, the catalog and the overall bands. Read through
 * `services.regulations.inForceOn(view.cycleStart)`.
 */
export async function regulationForEvaluation(view: EvaluationView): Promise<CaseRegulation> {
  const document = await inForceOn(view.cycleStart);
  if (document.id !== view.regulationId) {
    // The evaluation keeps its pinned version, a newer one in force on the same day is unexpected.
    console.warn(
      `regulation: evaluation ${view.id} is pinned to ${view.regulationId}, ${document.id} is in force on ${view.cycleStart}`,
    );
  }
  return caseRegulationOf(document, view);
}

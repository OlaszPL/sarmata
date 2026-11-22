import 'server-only';
import { cache } from 'react';
import { type EvaluationView, servicesFor } from '@sarmata/services';
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

/** One regulation lookup per evaluation and request. */
const pinnedRegulation = cache(async (evaluationId: string) =>
  servicesFor(await createSupabase()).regulations.forEvaluation(evaluationId),
);

/**
 * The regulation version the evaluation is pinned to, cut to what its screens need: the case
 * criteria with names and indicators, the partial scale, the catalog and the overall bands. Read
 * through `services.regulations.forEvaluation(view.id)`, which throws `not_found` for an evaluation
 * the account cannot see.
 */
export async function regulationForEvaluation(view: EvaluationView): Promise<CaseRegulation> {
  return caseRegulationOf(await pinnedRegulation(view.id), view);
}

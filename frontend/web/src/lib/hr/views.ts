import 'server-only';
import { servicesFor } from '@sarmata/services';
import type { Evaluation, EvaluationView } from '@sarmata/services';
import { createSupabase } from '@/lib/supabase';

/** Full views of the evaluations that pass `keep`, loaded in parallel. */
export async function loadViews(
  keep: (evaluation: Evaluation) => boolean,
): Promise<EvaluationView[]> {
  const services = servicesFor(await createSupabase());
  const kept = (await services.evaluations.list()).filter(keep);
  const views = await Promise.all(kept.map((e) => services.evaluations.get(e.id)));
  return views.filter((view): view is EvaluationView => view !== null);
}

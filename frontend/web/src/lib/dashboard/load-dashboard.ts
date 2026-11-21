import 'server-only';
import {
  type AiRun,
  type AiRunKind,
  type EvaluationView,
  type MemberAccount,
  servicesFor,
} from '@sarmata/services';
import { todayInWarsaw } from '@/lib/format';
import { createSupabase } from '@/lib/supabase';
import { type DashboardData, composeDashboard } from './compose-dashboard';

/**
 * Fetches what the dashboard needs. Every decision lives in `composeDashboard`. Only the list of
 * evaluations may fail the page, every other source degrades to an empty state.
 */
export async function loadDashboard(account: MemberAccount): Promise<DashboardData> {
  const services = servicesFor(await createSupabase());

  const aiRuns = async (kind: AiRunKind): Promise<AiRun[] | null> => {
    try {
      return await services.ai.list({ kind });
    } catch {
      return null;
    }
  };

  const aiEnabledInOffice = async (): Promise<boolean> => {
    try {
      return (await services.officeSettings.get()).aiEnabled;
    } catch {
      return false;
    }
  };

  const [evaluations, aiEnabled] = await Promise.all([
    services.evaluations.list({ evaluatorAccountId: account.userId }),
    aiEnabledInOffice(),
  ]);

  const closedCount = evaluations.filter((evaluation) => evaluation.status === 'closed').length;
  const open = evaluations.filter(
    (evaluation) => evaluation.status !== 'closed' && evaluation.status !== 'interrupted',
  );

  const [settled, hrRuns, appreciationRuns, draftRuns] = await Promise.all([
    Promise.allSettled(open.map((evaluation) => services.evaluations.get(evaluation.id))),
    aiEnabled ? aiRuns('hr_signals') : null,
    aiEnabled ? aiRuns('appreciation_moments') : null,
    aiEnabled ? aiRuns('sheet_draft') : null,
  ]);

  // One broken case (unknown regulation, bad event payload) must not blank the landing page.
  const views = settled.flatMap((result): EvaluationView[] =>
    result.status === 'fulfilled' && result.value !== null ? [result.value] : [],
  );
  const skipped = open.length - views.length;
  if (skipped > 0) console.warn(`dashboard: skipped ${skipped} evaluation(s) that failed to load`);

  return composeDashboard(
    { views, closedCount, aiEnabled, hrRuns, appreciationRuns, draftRuns },
    todayInWarsaw(),
    new Date(),
  );
}

import 'server-only';
import { type AiRun, type AiRunKind, type MemberAccount, servicesFor } from '@sarmata/services';
import { officeEmployees } from '@/lib/account';
import { todayInWarsaw } from '@/lib/format';
import { createSupabase } from '@/lib/supabase';
import { type DashboardData, composeDashboard } from './compose-dashboard';

/** Fetches what the dashboard needs. Every decision lives in `composeDashboard`. */
export async function loadDashboard(account: MemberAccount): Promise<DashboardData> {
  const services = servicesFor(await createSupabase());

  const aiRuns = async (kind: AiRunKind): Promise<AiRun[] | null> => {
    try {
      return await services.ai.list({ kind });
    } catch {
      return null;
    }
  };

  const [evaluations, employees, settings] = await Promise.all([
    services.evaluations.list({ evaluatorAccountId: account.userId }),
    officeEmployees(),
    services.officeSettings.get(),
  ]);

  const closedCount = evaluations.filter((evaluation) => evaluation.status === 'closed').length;
  const open = evaluations.filter(
    (evaluation) => evaluation.status !== 'closed' && evaluation.status !== 'interrupted',
  );

  const [views, hrRuns, appreciationRuns, draftRuns] = await Promise.all([
    Promise.all(open.map((evaluation) => services.evaluations.get(evaluation.id))),
    settings.aiEnabled ? aiRuns('hr_signals') : null,
    settings.aiEnabled ? aiRuns('appreciation_moments') : null,
    settings.aiEnabled ? aiRuns('sheet_draft') : null,
  ]);

  return composeDashboard(
    {
      views: views.filter((view) => view !== null),
      closedCount,
      employees,
      aiEnabled: settings.aiEnabled,
      hrRuns,
      appreciationRuns,
      draftRuns,
    },
    todayInWarsaw(),
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/account';
import { loadDashboard } from '@/lib/dashboard/load-dashboard';
import { todayInWarsaw } from '@/lib/format';
import { loadHrTasks } from '@/lib/hr/load-tasks';
import { routes } from '@/lib/routes';
import { AiDraftPanel } from './_dashboard/ai-draft-panel';
import { AppreciationPanel } from './_dashboard/appreciation-panel';
import { Hero } from './_dashboard/hero';
import { HrSignalPanel } from './_dashboard/hr-signal-panel';
import { type HrTaskCount, HrTasksPanel } from './_dashboard/hr-tasks-panel';
import { InProgressTable } from './_dashboard/in-progress-table';
import { TodoList } from './_dashboard/todo-list';

export const metadata: Metadata = { title: 'Pulpit' };

/** The hr block of the dashboard. A failure hides the block, the hr panel still has the list. */
async function hrTaskCount(): Promise<HrTaskCount | null> {
  try {
    const tasks = await loadHrTasks(todayInWarsaw());
    return { total: tasks.length, overdue: tasks.filter((task) => task.overdue).length };
  } catch (error) {
    console.error('dashboard: hr tasks failed', error);
    return null;
  }
}

/**
 * Pulpit of the evaluator, and of hr with its task count on top of the side band. The admin leads no
 * evaluations, so the office settings are the admin landing page.
 */
export default async function DashboardPage() {
  const account = await requireMember();
  if (account.role === 'admin') redirect(routes.settings);
  const [data, hrCount] = await Promise.all([
    loadDashboard(account),
    account.role === 'hr' ? hrTaskCount() : null,
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <Hero data={data} />
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1">
          <TodoList rows={data.todo} today={data.today} />
          <InProgressTable rows={data.others} />
        </div>
        <aside
          aria-label="Podpowiedzi"
          className="bg-band border-rule border-t lg:w-[26.25rem] lg:shrink-0 lg:border-t-0 lg:border-l"
        >
          <HrTasksPanel count={hrCount} />
          <HrSignalPanel signal={data.hrSignal} aiEnabled={data.aiEnabled} />
          <AiDraftPanel drafts={data.runningDrafts} />
          <AppreciationPanel appreciation={data.appreciation} />
        </aside>
      </div>
    </div>
  );
}

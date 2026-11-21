import type { Metadata } from 'next';
import { requireMember } from '@/lib/account';
import { loadDashboard } from '@/lib/dashboard/load-dashboard';
import { AiDraftPanel } from './_dashboard/ai-draft-panel';
import { AppreciationPanel } from './_dashboard/appreciation-panel';
import { Hero } from './_dashboard/hero';
import { HrSignalPanel } from './_dashboard/hr-signal-panel';
import { InProgressTable } from './_dashboard/in-progress-table';
import { TodoList } from './_dashboard/todo-list';

export const metadata: Metadata = { title: 'Pulpit' };

export default async function DashboardPage() {
  const account = await requireMember();
  const data = await loadDashboard(account);

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
          <HrSignalPanel signal={data.hrSignal} aiEnabled={data.aiEnabled} />
          <AiDraftPanel drafts={data.runningDrafts} />
          <AppreciationPanel appreciation={data.appreciation} />
        </aside>
      </div>
    </div>
  );
}

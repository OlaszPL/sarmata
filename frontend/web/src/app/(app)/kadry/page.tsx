import type { Metadata } from 'next';
import Link from 'next/link';
import { servicesFor } from '@sarmata/services';
import { DataTable, EmptyState, Tag } from '@sarmata/ui';
import { HrPage } from '@/components/hr/hr-page';
import { requireMember } from '@/lib/account';
import { formatDate, todayInWarsaw } from '@/lib/format';
import { hrAccess } from '@/lib/hr/access';
import { loadHrTasks } from '@/lib/hr/load-tasks';
import { hrTaskHref, hrTaskLabels } from '@/lib/hr/tasks';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Kadry' };

export default async function HrTasksPage() {
  const account = await requireMember();
  if (hrAccess(account.role, 'tasks') === 'none') {
    return <HrPage root title="Kadry" denied="panel kadr" />;
  }

  const services = servicesFor(await createSupabase());
  const today = todayInWarsaw();
  const [tasks, unread] = await Promise.all([
    loadHrTasks(today),
    services.notifications.unreadCount(),
  ]);
  const overdue = tasks.filter((task) => task.overdue).length;

  return (
    <HrPage
      root
      title="Kadry"
      meta="Zadania kadr wynikające z terminów i etapów ocen."
      stats={[
        { label: 'Do zrobienia', value: String(tasks.length) },
        { label: 'Po terminie', value: String(overdue) },
        { label: 'Powiadomienia', value: String(unread), hint: 'Nieprzeczytane' },
      ]}
    >
      <DataTable
        caption="Zadania kadr"
        rows={tasks}
        rowKey={(task) => `${task.kind}-${task.evaluationId}`}
        empty={
          <EmptyState title="Nie masz zadań">
            Gdy ocena będzie wymagać decyzji kadr, zadanie pojawi się tutaj.
          </EmptyState>
        }
        columns={[
          {
            key: 'task',
            header: 'Zadanie',
            rowHeader: true,
            cell: (task) => (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{hrTaskLabels[task.kind].title}</span>
                {task.overdue ? <Tag tone="attention">Po terminie</Tag> : null}
              </span>
            ),
          },
          { key: 'employee', header: 'Pracownik', cell: (task) => task.employeeName },
          {
            key: 'dueOn',
            header: 'Termin',
            className: 'whitespace-nowrap',
            cell: (task) => (task.dueOn === null ? 'Brak terminu' : formatDate(task.dueOn)),
          },
          {
            key: 'action',
            header: 'Co zrobić',
            cell: (task) => (
              <Link href={hrTaskHref(task)} className="text-link font-semibold underline">
                {hrTaskLabels[task.kind].action}
              </Link>
            ),
          },
        ]}
      />
      <p className="mt-6">
        <Link href={routes.notifications} className="font-heading text-link font-medium underline">
          Zobacz wszystkie powiadomienia
        </Link>
      </p>
    </HrPage>
  );
}

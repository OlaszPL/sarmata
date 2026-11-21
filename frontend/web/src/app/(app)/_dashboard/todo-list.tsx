import Link from 'next/link';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { type DashboardRow } from '@/lib/dashboard/compose-dashboard';
import { formatDate, formatShortDate, relativeDays } from '@/lib/format';
import { routes } from '@/lib/routes';

/** Visible date column. Hidden from assistive technology, `dueText` says the same in the link. */
function DueCell({ row }: { row: DashboardRow }) {
  const { dueOn } = row.step;
  if (!dueOn || row.daysLeft === null) {
    return <p className="font-heading text-ink-muted text-lg font-semibold">Brak terminu</p>;
  }
  const overdue = row.daysLeft < 0;
  return (
    <p className={overdue ? 'text-error flex flex-col' : 'flex flex-col'}>
      <span className="font-heading text-[1.75rem] leading-tight font-semibold">
        {formatShortDate(dueOn)}
      </span>
      <span className={`flex items-center gap-1 text-sm ${overdue ? '' : 'text-ink-muted'}`}>
        {overdue ? <TriangleAlert className="size-4 shrink-0" /> : null}
        {relativeDays(row.daysLeft)}
      </span>
    </p>
  );
}

function dueText(row: DashboardRow): string {
  const { dueOn } = row.step;
  if (!dueOn || row.daysLeft === null) return 'Brak terminu.';
  return `Termin ${formatDate(dueOn)}, ${relativeDays(row.daysLeft)}.`;
}

function TodoRow({ row, first }: { row: DashboardRow; first: boolean }) {
  return (
    <li className="border-rule border-t">
      <Link
        href={routes.evaluation(row.evaluationId)}
        className="hover:bg-band flex items-stretch no-underline"
      >
        <div className="w-32 shrink-0 py-6 pl-6 sm:w-[8.75rem] sm:pl-10" aria-hidden>
          <DueCell row={row} />
        </div>
        <div className="min-w-0 flex-1 py-6 pr-4">
          <p className="font-heading text-navy text-[1.375rem] leading-tight font-semibold underline">
            {row.employeeName}
          </p>
          <p className="text-ink mt-1 text-[1.0625rem] font-semibold">{row.step.action}</p>
          <p className="text-ink-muted mt-1 text-sm">
            Arkusz {row.sheetId}, {row.step.stage}
          </p>
          <p className="sr-only">{dueText(row)}</p>
        </div>
        <div
          className={`border-rule flex w-14 shrink-0 items-center justify-center border-l sm:w-[5.5rem] ${
            first ? 'bg-navy text-white' : 'text-navy'
          }`}
        >
          <ArrowRight className="size-7" aria-hidden />
        </div>
      </Link>
    </li>
  );
}

/** "Zrób teraz": the evaluator's next steps, nearest deadline first. Each row is one link. */
export function TodoList({ rows }: { rows: readonly DashboardRow[] }) {
  return (
    <section aria-labelledby="todo-heading">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 px-6 py-8 sm:px-10">
        <h2 id="todo-heading" className="text-[1.875rem] font-semibold">
          Zrób teraz
        </h2>
        {rows.length > 0 ? <p className="text-ink-muted">Od najbliższego terminu</p> : null}
      </div>
      {rows.length > 0 ? (
        <ul className="border-rule border-b">
          {rows.map((row, index) => (
            <TodoRow key={row.evaluationId} row={row} first={index === 0} />
          ))}
        </ul>
      ) : (
        <p className="border-rule border-t border-b px-6 py-8 sm:px-10">
          Nie masz nic do zrobienia. Nowe zadania pojawią się, gdy zbliży się termin.
        </p>
      )}
    </section>
  );
}

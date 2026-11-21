import Link from 'next/link';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { type CalendarDate } from '@sarmata/services';
import { type DashboardRow, todoMeta } from '@/lib/dashboard/compose-dashboard';
import { formatDate, formatShortDate, relativeDays } from '@/lib/format';
import { routes } from '@/lib/routes';

/** From this many days left the date turns red, as the deadline is close. */
const URGENT_DAYS = 7;

interface DateColumn {
  readonly today: CalendarDate;
  /** Some date of the list is in another year, so the column is wider to fit `dd.mm.rrrr`. */
  readonly withYear: boolean;
}

/** Visible date column. Hidden from assistive technology, `dueText` says the same in the link. */
function DueCell({ row, column }: { row: DashboardRow; column: DateColumn }) {
  const { dueOn } = row.step;
  if (!dueOn || row.daysLeft === null) {
    return (
      <p className="font-heading text-ink-muted text-lg leading-[normal] font-semibold">
        Brak terminu
      </p>
    );
  }
  // Red is never the only cue: the relative text says how close or late it is, late adds an icon.
  const urgent = row.daysLeft <= URGENT_DAYS;
  const overdue = row.daysLeft < 0;
  return (
    <p className={`flex flex-col gap-0.5 ${urgent ? 'text-error' : ''}`}>
      <span
        className={`font-heading leading-[normal] font-semibold tracking-[-0.0179em] whitespace-nowrap ${
          column.withYear ? 'text-lg sm:text-[1.75rem]' : 'text-[1.75rem]'
        }`}
      >
        {formatShortDate(dueOn, column.today)}
      </span>
      <span
        className={`flex items-center gap-1 text-sm leading-[normal] font-semibold ${
          urgent ? '' : 'text-ink-muted'
        }`}
      >
        {overdue ? <TriangleAlert className="size-4 shrink-0" aria-hidden /> : null}
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

function TodoRow({
  row,
  first,
  column,
}: {
  row: DashboardRow;
  first: boolean;
  column: DateColumn;
}) {
  return (
    <li className="border-rule border-t">
      <Link
        href={routes.evaluation(row.evaluationId)}
        className="hover:bg-band flex min-h-[8.1875rem] items-stretch no-underline"
      >
        <div
          className={`w-32 shrink-0 self-center py-[1.375rem] pr-3 pl-6 sm:pl-10 ${
            column.withYear ? 'sm:w-[12.5rem]' : 'sm:w-[8.75rem]'
          }`}
          aria-hidden
        >
          <DueCell row={row} column={column} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 self-center py-[1.375rem] pr-4 sm:px-6">
          <p className="font-heading text-navy text-[1.375rem] leading-[normal] font-semibold tracking-[-0.0091em] underline">
            {row.employeeName}
          </p>
          <p className="text-ink text-[1.0625rem] leading-[normal] font-semibold">
            {row.step.action}
          </p>
          <p className="text-ink-muted text-sm leading-[normal]">{todoMeta(row)}</p>
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
export function TodoList({ rows, today }: { rows: readonly DashboardRow[]; today: CalendarDate }) {
  const year = today.slice(0, 4);
  const column: DateColumn = {
    today,
    withYear: rows.some((row) => row.step.dueOn !== null && row.step.dueOn.slice(0, 4) !== year),
  };

  return (
    <section aria-labelledby="todo-heading">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 px-6 pt-7 pb-[1.1875rem] sm:px-10">
        <h2
          id="todo-heading"
          className="text-[1.875rem] leading-[normal] font-semibold tracking-[-0.0133em]"
        >
          Zrób teraz
        </h2>
        {rows.length > 0 ? (
          <p className="text-ink-muted text-[0.9375rem] leading-[normal]">
            Od najbliższego terminu
          </p>
        ) : null}
      </div>
      {rows.length > 0 ? (
        <ul className="border-rule border-b">
          {rows.map((row, index) => (
            <TodoRow key={row.evaluationId} row={row} first={index === 0} column={column} />
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

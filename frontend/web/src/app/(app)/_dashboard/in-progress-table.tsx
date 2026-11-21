import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { type DashboardRow } from '@/lib/dashboard/compose-dashboard';
import { formatDate, relativeDays } from '@/lib/format';
import { routes } from '@/lib/routes';

/** Due date. A late step of the evaluator carries color, icon and text, as in "Zrób teraz". */
function DueText({ row }: { row: DashboardRow }) {
  const { dueOn } = row.step;
  if (!dueOn) return 'Brak terminu';
  const { daysLeft } = row;
  if (row.step.owner !== 'evaluator' || daysLeft === null || daysLeft >= 0) {
    return formatDate(dueOn);
  }
  return (
    <span className="text-error inline-flex items-center gap-1">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      {formatDate(dueOn)}, {relativeDays(daysLeft)}
    </span>
  );
}

/** Cases in progress that are not on the "Zrób teraz" list. Hidden when there are none. */
export function InProgressTable({ rows }: { rows: readonly DashboardRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="in-progress-heading" className="px-6 pt-7 pb-8 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="in-progress-heading" className="text-[1.375rem] leading-[normal] font-semibold">
          Wszystkie oceny w toku
        </h2>
        <Link
          href={routes.evaluations}
          className="font-heading text-link leading-[normal] font-medium underline"
        >
          Otwórz listę ocen
        </Link>
      </div>
      {/* Side padding keeps the focus ring of the first column inside the scrolling box. */}
      <div className="-mx-2 mt-4 overflow-x-auto px-2">
        <table className="w-full border-collapse text-left text-[0.9375rem] leading-[normal]">
          <caption className="sr-only">Wszystkie oceny w toku</caption>
          <thead>
            <tr className="border-rule font-heading border-t-2 border-b">
              <th scope="col" className="w-[14.75rem] py-2.5 pr-4 font-semibold">
                Pracownik
              </th>
              <th scope="col" className="w-[5.375rem] py-2.5 pr-4 font-semibold">
                Arkusz
              </th>
              <th scope="col" className="py-2.5 pr-4 font-semibold">
                Etap
              </th>
              <th scope="col" className="w-[8.125rem] py-2.5 font-semibold">
                Termin
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.evaluationId} className="border-rule border-b">
                <td className="py-2.5 pr-4">
                  <Link
                    href={routes.evaluation(row.evaluationId)}
                    className="text-link font-semibold underline"
                  >
                    {row.employeeName}
                  </Link>
                </td>
                <td className="py-2.5 pr-4">{row.sheetId}</td>
                <td className="py-2.5 pr-4">
                  {row.step.stage}. {row.step.action}
                </td>
                <td className="py-2.5 whitespace-nowrap">
                  <DueText row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

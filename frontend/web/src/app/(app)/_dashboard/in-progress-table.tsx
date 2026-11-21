import Link from 'next/link';
import { type DashboardRow } from '@/lib/dashboard/compose-dashboard';
import { formatDate } from '@/lib/format';
import { routes } from '@/lib/routes';

/** Cases in progress that are not on the "Zrób teraz" list. Hidden when there are none. */
export function InProgressTable({ rows }: { rows: readonly DashboardRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="in-progress-heading" className="px-6 py-8 sm:px-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="in-progress-heading" className="text-[1.375rem] font-semibold">
          Wszystkie oceny w toku
        </h2>
        <Link href={routes.evaluations} className="font-heading text-link font-medium underline">
          Otwórz listę ocen
        </Link>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Wszystkie oceny w toku</caption>
          <thead>
            <tr className="border-rule font-heading border-t-2 border-b">
              <th scope="col" className="py-3 pr-4 font-semibold">
                Pracownik
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                Arkusz
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                Etap
              </th>
              <th scope="col" className="py-3 font-semibold">
                Termin
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.evaluationId} className="border-rule border-b">
                <td className="py-3 pr-4">
                  <Link href={routes.evaluation(row.evaluationId)} className="text-link underline">
                    {row.employeeName}
                  </Link>
                </td>
                <td className="py-3 pr-4">{row.sheetId}</td>
                <td className="py-3 pr-4">
                  {row.step.stage}. {row.step.action}
                </td>
                <td className="py-3 whitespace-nowrap">
                  {row.step.dueOn ? formatDate(row.step.dueOn) : 'Brak terminu'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

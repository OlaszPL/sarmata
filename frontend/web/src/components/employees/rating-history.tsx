import Link from 'next/link';
import { DataTable, EmptyState, Section } from '@sarmata/ui';
import { type HistoryRow } from '@/lib/employees/history';
import { formatScore } from '@/lib/format';
import { routes } from '@/lib/routes';

/** Top of the partial scale, the bar of a mean fills `mean / SCALE_MAX` of the track. */
const SCALE_MAX = 9;

const linkClasses =
  'font-heading text-link text-[0.9375rem] leading-[normal] font-medium underline';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function RowResult({ row }: { row: HistoryRow }) {
  if (row.open) {
    return (
      <>
        <div className="border-rule flex h-9 items-center border border-dashed bg-white px-3">
          <span className="text-ink-muted text-sm leading-[normal]">Okres oceny trwa</span>
        </div>
        {row.evaluationId ? (
          <Link href={routes.evaluation(row.evaluationId)} className={`${linkClasses} self-start`}>
            Przejdź do oceny<span className="sr-only"> {row.period}</span>
          </Link>
        ) : null}
      </>
    );
  }
  const level = row.levelName ? capitalize(row.levelName) : null;
  if (row.mean === null) {
    return (
      <p className="font-heading text-ink text-[0.9375rem] leading-[normal] font-semibold">
        {level ?? 'Brak wyniku'}
      </p>
    );
  }
  const share = Math.min(Math.max(row.mean / SCALE_MAX, 0), 1);
  return (
    <>
      <div className="bg-band flex h-9">
        <div
          className="bg-navy flex h-9 min-w-[4.5rem] items-center justify-end px-3"
          style={{ width: `${(share * 100).toFixed(2)}%` }}
        >
          <span className="font-heading text-lg leading-[normal] font-semibold whitespace-nowrap text-white">
            {formatScore(row.mean)}
          </span>
        </div>
      </div>
      {level ? (
        <p className="font-heading text-ink text-[0.9375rem] leading-[normal] font-semibold">
          {level}
        </p>
      ) : null}
    </>
  );
}

function HistoryTable({ rows, className }: { rows: readonly HistoryRow[]; className: string }) {
  return (
    <DataTable
      className={className}
      caption="Przebieg ocen"
      rows={rows}
      rowKey={(row) => row.key}
      columns={[
        { key: 'period', header: 'Okres', rowHeader: true, cell: (row) => row.period },
        { key: 'source', header: 'Źródło', cell: (row) => row.source },
        {
          key: 'mean',
          header: 'Średnia',
          className: 'w-[6rem]',
          cell: (row) => (row.mean === null ? 'Brak' : formatScore(row.mean)),
        },
        {
          key: 'level',
          header: 'Poziom',
          cell: (row) =>
            row.open ? 'Ocena w toku' : row.levelName ? capitalize(row.levelName) : 'Brak',
        },
      ]}
    />
  );
}

/**
 * Evaluation record of the person from the mockup: one row per evaluation with the period, its
 * source and a bar of the mean on the 1 to 9 scale, the same data as a table on demand.
 */
export function RatingHistory({ rows }: { rows: readonly HistoryRow[] }) {
  return (
    <Section title="Przebieg ocen">
      <p className="text-ink-muted -mt-4 max-w-[70ch] pb-[1.125rem] text-[0.9375rem] leading-[normal]">
        Średnia ocen cząstkowych na skali od 1 do 9, od najstarszej do bieżącej.
      </p>
      {rows.length === 0 ? (
        <div className="border-rule -mx-6 border-t sm:-mx-8">
          <EmptyState title="Brak ocen">
            <p className="max-w-[70ch]">
              Pierwsza ocena pojawi się tu po zatwierdzeniu arkusza. Kadry mogą wpisać ocenę
              archiwalną.
            </p>
          </EmptyState>
        </div>
      ) : (
        <>
          <ol className="border-rule -mx-6 border-t sm:-mx-8">
            {rows.map((row) => (
              <li
                key={row.key}
                className="border-rule flex flex-col border-b sm:min-h-24 sm:flex-row"
              >
                <div className="border-rule flex flex-col justify-center gap-0.5 px-6 pt-4 pb-3 sm:w-[13.25rem] sm:shrink-0 sm:border-r sm:px-8 sm:py-4">
                  <h3 className="font-heading text-ink text-lg leading-[normal] font-semibold">
                    {row.period}
                  </h3>
                  <p className="text-ink-muted text-sm leading-[normal]">{row.source}</p>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-6 pb-4 sm:px-8 sm:pt-4">
                  <RowResult row={row} />
                </div>
              </li>
            ))}
          </ol>
          <details className="group pt-5">
            <summary className={`${linkClasses} w-fit cursor-pointer`}>
              <span className="group-open:hidden">Pokaż jako tabelę</span>
              <span className="hidden group-open:inline">Ukryj tabelę</span>
            </summary>
            <HistoryTable rows={rows} className="pt-4" />
          </details>
        </>
      )}
    </Section>
  );
}

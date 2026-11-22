import type { Metadata } from 'next';
import { servicesFor, type EvaluatorFlag } from '@sarmata/services';
import { Button, DataTable, EmptyState, Field, Section, Select, Tag } from '@sarmata/ui';
import { BarChart } from '@/components/hr/bar-chart';
import { HrPage } from '@/components/hr/hr-page';
import { RoleNotice } from '@/components/hr/role-notice';
import { requireMember } from '@/lib/account';
import { todayInWarsaw, formatScore } from '@/lib/format';
import { hrAccess } from '@/lib/hr/access';
import { hrPaths } from '@/lib/hr/paths';
import {
  evaluatorFlagLabels,
  formatPoints,
  formatShare,
  parseYear,
  yearOptions,
} from '@/lib/hr/statistics-view';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Statystyki ocen' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const NONE = 'Brak';

export default async function StatisticsPage({ searchParams }: { searchParams: SearchParams }) {
  const account = await requireMember();
  if (hrAccess(account.role, 'statistics') === 'none') {
    return <HrPage title="Statystyki ocen" denied="statystyk ocen" />;
  }

  const currentYear = Number(todayInWarsaw().slice(0, 4));
  const year = parseYear((await searchParams).rok, currentYear);
  const services = servicesFor(await createSupabase());
  const canSeeEvaluators = hrAccess(account.role, 'evaluatorReport') !== 'none';
  const [report, evaluators] = await Promise.all([
    services.statistics.officeReport(year),
    canSeeEvaluators ? services.statistics.evaluatorReport(year) : Promise.resolve(null),
  ]);

  const hasNational = report.levels.some((level) => level.nationalShare !== null);
  const maxShare = Math.max(
    0,
    ...report.levels.flatMap((level) => [level.share, level.nationalShare ?? 0]),
  );

  return (
    <HrPage title="Statystyki ocen" meta={`Rok ${year}`}>
      <form
        action={routes.hrStatistics}
        method="get"
        className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4"
      >
        <Field id="rok" label="Rok" className="max-w-full">
          <Select name="rok" defaultValue={String(year)} className="w-40 max-w-full">
            {yearOptions(currentYear).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          Pokaż rok
        </Button>
      </form>

      {report.total === 0 ? (
        <EmptyState title={`Brak ocen w ${year} r.`}>
          Statystyki pojawią się, gdy w tym roku zamkniesz pierwsze oceny. Wybierz inny rok.
        </EmptyState>
      ) : (
        <>
          <Section title="Rozkład ocen na tle kraju">
            <p className="font-heading mb-1 text-[1.125rem] font-semibold">
              Ocen w roku: {report.total}
            </p>
            <p className="mb-6 max-w-[70ch]">
              Ocen negatywnych: {report.negative.count} ({formatShare(report.negative.share)}). W
              kraju: {formatShare(report.negative.nationalShare)}. Różnica względem kraju{' '}
              {formatPoints((report.negative.share - report.negative.nationalShare) * 100)}
            </p>
            <BarChart
              caption="Udział ocen według poziomu"
              max={maxShare}
              bars={report.levels.map((level) => ({
                label: level.name,
                value: level.share,
                display: `${formatShare(level.share)} (${level.count})`,
                ...(level.nationalShare !== null
                  ? {
                      compare: {
                        value: level.nationalShare,
                        display: formatShare(level.nationalShare),
                      },
                    }
                  : {}),
              }))}
            />
            {hasNational ? (
              <p className="mt-4 max-w-[70ch]">
                Dane krajowe: sprawozdanie Szefa Służby Cywilnej za 2025 r.
              </p>
            ) : null}
          </Section>

          <Section title="Rozkład w komórkach">
            <div
              role="region"
              aria-label="Tabela rozkładu ocen w komórkach, przewijana w poziomie"
              tabIndex={0}
              className="focus-inset overflow-x-auto"
            >
              <DataTable
                caption="Oceny w komórkach organizacyjnych"
                className="overflow-visible"
                rows={report.byUnit}
                rowKey={(unit) => unit.orgUnit ?? 'none'}
                columns={[
                  {
                    key: 'unit',
                    header: 'Komórka',
                    rowHeader: true,
                    cell: (unit) => unit.orgUnit ?? 'Bez komórki',
                  },
                  { key: 'total', header: 'Ocen', cell: (unit) => unit.total },
                  ...report.levels.map((level) => ({
                    key: level.code,
                    header: level.name,
                    cell: (unit: (typeof report.byUnit)[number]) => unit.levels[level.code] ?? 0,
                  })),
                ]}
              />
            </div>
          </Section>

          <Section title="Potrzeby rozwojowe">
            <p className="mb-6 max-w-[70ch]">
              Oceny z wnioskami rozwojowymi: {formatShare(report.developmentConclusionsShare)}.
            </p>
            <DataTable
              caption="Kryteria, w których oceniający widzą potrzebę rozwoju"
              rows={report.developmentNeeds}
              rowKey={(need) => need.criterionId}
              empty={<p>Brak danych o kryteriach w tym roku.</p>}
              columns={[
                { key: 'name', header: 'Kryterium', rowHeader: true, cell: (n) => n.name },
                { key: 'ratings', header: 'Ocen', cell: (n) => n.ratings },
                {
                  key: 'below',
                  header: 'Poniżej oczekiwań',
                  cell: (n) => n.belowExpectations,
                },
                { key: 'share', header: 'Udział', cell: (n) => formatShare(n.share) },
              ]}
            />
          </Section>

          <Section title="Raport oceniających">
            {evaluators === null ? (
              <RoleNotice area="raport oceniających" />
            ) : (
              <>
                <p className="mb-6 max-w-[70ch]">
                  Średnia ocen w urzędzie:{' '}
                  {evaluators.officeMean === null ? NONE : formatScore(evaluators.officeMean)}.
                </p>
                <DataTable
                  caption="Oceniający i ich oceny"
                  rows={evaluators.evaluators}
                  rowKey={(e) => e.evaluatorAccountId}
                  empty={<p>Brak ocen oceniających w tym roku.</p>}
                  columns={[
                    {
                      key: 'name',
                      header: 'Oceniający',
                      rowHeader: true,
                      cell: (e) => e.evaluatorName ?? 'Konto spoza listy pracowników',
                    },
                    { key: 'count', header: 'Ocen', cell: (e) => e.evaluations },
                    {
                      key: 'mean',
                      header: 'Średnia',
                      cell: (e) => (e.mean === null ? NONE : formatScore(e.mean)),
                    },
                    {
                      key: 'central',
                      header: 'Udział ocen środkowych',
                      cell: (e) => formatShare(e.centralShare),
                    },
                    {
                      key: 'leniency',
                      header: 'Odchylenie',
                      cell: (e) => (e.leniency === null ? NONE : formatScore(e.leniency)),
                    },
                    {
                      key: 'flags',
                      header: 'Flagi',
                      cell: (e) =>
                        e.flags.length === 0 ? (
                          NONE
                        ) : (
                          <span className="flex flex-wrap gap-2">
                            {e.flags.map((flag: EvaluatorFlag) => (
                              <Tag key={flag} tone="attention">
                                {evaluatorFlagLabels[flag]}
                              </Tag>
                            ))}
                          </span>
                        ),
                    },
                  ]}
                />
              </>
            )}
          </Section>
        </>
      )}

      <Section title="Sprawozdanie DSC-OCK" className="border-b-0">
        <DataTable
          caption="Odpowiedzi do sprawozdania DSC-OCK"
          rows={report.dscOck}
          rowKey={(answer) => `${String(answer.question)} ${answer.label}`}
          columns={[
            { key: 'question', header: 'Pytanie', rowHeader: true, cell: (a) => a.question },
            { key: 'label', header: 'Opis', cell: (a) => a.label },
            {
              key: 'value',
              header: 'Wartość',
              cell: (a) => a.value ?? NONE,
            },
          ]}
        />
        <p className="mt-6">
          <a
            href={hrPaths.dscOckCsv(year)}
            download
            className="font-heading text-link font-medium underline"
          >
            Pobierz CSV do sprawozdania DSC-OCK
          </a>
        </p>
      </Section>
    </HrPage>
  );
}

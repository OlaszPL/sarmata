import type { Metadata } from 'next';
import Link from 'next/link';
import { servicesFor, type CalendarDate, type ScheduleItem } from '@sarmata/services';
import { Button, DataTable, EmptyState, Field, Select, Tag, type TagTone } from '@sarmata/ui';
import { requireMember } from '@/lib/account';
import { statusTag } from '@/lib/evaluations/status-labels';
import { formatDate, pluralPl, todayInWarsaw } from '@/lib/format';
import { hrAccess } from '@/lib/hr/access';
import { applyScheduleFilters, parseScheduleFilters } from '@/lib/hr/schedule-filters';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';
import { HrPage } from '@/components/hr/hr-page';

export const metadata: Metadata = { title: 'Harmonogram ocen' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DAYS = [30, 60, 90] as const;

const FLAG_OPTIONS = {
  overdue: { value: 'po-terminie', label: 'Po terminie' },
  withoutInterview: { value: 'bez-rozmowy', label: 'Bez rozmowy' },
  startingInterviewSoon: { value: 'rozmowa-wkrotce', label: 'Rozmowa wkrótce' },
} as const;

function situationTags(row: ScheduleItem): { label: string; tone: TagTone }[] {
  const tags: { label: string; tone: TagTone }[] = [];
  if (row.overdue) tags.push({ label: 'Po terminie', tone: 'attention' });
  if (row.withoutInterview) tags.push({ label: 'Bez rozmowy', tone: 'waiting' });
  if (row.startingInterviewSoon) tags.push({ label: 'Rozmowa wkrótce', tone: 'progress' });
  if (row.suspended) tags.push({ label: 'Zawieszona', tone: 'neutral' });
  return tags.length > 0 ? tags : [{ label: 'W terminie', tone: 'done' }];
}

const dateCell = (value: CalendarDate | null) => (value === null ? 'Brak' : formatDate(value));

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const account = await requireMember();
  if (hrAccess(account.role, 'schedule') === 'none') {
    return <HrPage title="Harmonogram ocen" denied="harmonogram ocen" />;
  }

  const params = await searchParams;
  // The unit list needs the whole report, so the horizon is read first and the unit after.
  const horizon = parseScheduleFilters(params, []).horizon;
  const services = servicesFor(await createSupabase());
  const report = await services.statistics.schedule({
    today: todayInWarsaw(),
    horizonDays: horizon,
  });

  const units = [
    ...new Set(report.rows.flatMap((row) => (row.orgUnit === null ? [] : [row.orgUnit]))),
  ].sort((a, b) => a.localeCompare(b, 'pl'));
  const filters = parseScheduleFilters(params, units);
  const active = filters.flag !== null || filters.orgUnit !== null || filters.horizon !== 30;
  const rows = applyScheduleFilters(report.rows, filters);

  return (
    <HrPage
      title="Harmonogram ocen"
      meta="Terminy rozmów i ocen w toku oraz sytuacje, które wymagają działania kadr."
      stats={[
        { label: 'W toku', value: String(report.summary.inProgress) },
        { label: 'Po terminie', value: String(report.summary.overdue) },
        { label: 'Bez rozmowy', value: String(report.summary.withoutInterview) },
        { label: 'Rozmowy wkrótce', value: String(report.summary.startingInterviews) },
      ]}
    >
      {report.rows.length === 0 ? (
        <EmptyState title="Nie ma ocen w toku">
          Gdy oceniający rozpocznie ocenę, jej terminy pojawią się w harmonogramie.
        </EmptyState>
      ) : (
        <>
          <form
            action={routes.hrSchedule}
            method="get"
            className="flex flex-wrap items-end gap-x-6 gap-y-4"
          >
            <Field id="horyzont" label="Horyzont" className="max-w-full">
              <Select
                name="horyzont"
                defaultValue={String(filters.horizon)}
                className="w-40 max-w-full"
              >
                {DAYS.map((days) => (
                  <option key={days} value={days}>
                    {days} dni
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="flaga" label="Sytuacja" className="max-w-full">
              <Select
                name="flaga"
                defaultValue={filters.flag === null ? '' : FLAG_OPTIONS[filters.flag].value}
                className="w-64 max-w-full"
              >
                <option value="">Wszystkie</option>
                {Object.values(FLAG_OPTIONS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="komorka" label="Komórka" className="max-w-full">
              <Select
                name="komorka"
                defaultValue={filters.orgUnit ?? ''}
                className="w-72 max-w-full"
              >
                <option value="">Wszystkie</option>
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              Pokaż harmonogram
            </Button>
            {active ? (
              <Link
                href={routes.hrSchedule}
                className="font-heading text-link py-3 font-medium underline"
              >
                Wyczyść filtry
              </Link>
            ) : null}
          </form>

          <p className="font-heading mt-6 mb-2 text-[1.125rem] font-semibold" role="status">
            {rows.length} {pluralPl(rows.length, 'ocena', 'oceny', 'ocen')}
          </p>
          <DataTable
            caption="Harmonogram ocen"
            rows={rows}
            rowKey={(row) => row.evaluationId}
            empty={
              <EmptyState
                title="Żadna ocena nie pasuje do filtrów"
                action={
                  <Link
                    href={routes.hrSchedule}
                    className="font-heading text-link font-medium underline"
                  >
                    Wyczyść filtry
                  </Link>
                }
              >
                Zmień horyzont, sytuację lub komórkę albo wyczyść filtry, by zobaczyć cały
                harmonogram.
              </EmptyState>
            }
            columns={[
              {
                key: 'employee',
                header: 'Pracownik',
                rowHeader: true,
                cell: (row) => (
                  <Link
                    href={routes.evaluation(row.evaluationId)}
                    className="text-link font-semibold underline"
                  >
                    {row.firstName} {row.lastName}
                  </Link>
                ),
              },
              { key: 'unit', header: 'Komórka', cell: (row) => row.orgUnit ?? 'Brak' },
              {
                key: 'evaluator',
                header: 'Prowadzi ocenę',
                cell: (row) => row.evaluatorName ?? 'Konto spoza listy pracowników',
              },
              {
                key: 'status',
                header: 'Etap',
                cell: (row) => {
                  const tag = statusTag(row.status);
                  return <Tag tone={tag.tone}>{tag.label}</Tag>;
                },
              },
              {
                key: 'interviewDue',
                header: 'Rozmowa do',
                className: 'whitespace-nowrap',
                cell: (row) => dateCell(row.startingInterviewDueOn),
              },
              {
                key: 'evaluationDue',
                header: 'Termin oceny',
                className: 'whitespace-nowrap',
                cell: (row) => dateCell(row.evaluationDueOn),
              },
              {
                key: 'situation',
                header: 'Sytuacja',
                cell: (row) => (
                  <span className="flex flex-wrap gap-2">
                    {situationTags(row).map((tag) => (
                      <Tag key={tag.label} tone={tag.tone}>
                        {tag.label}
                      </Tag>
                    ))}
                  </span>
                ),
              },
            ]}
          />
        </>
      )}
    </HrPage>
  );
}

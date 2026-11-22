import type { Metadata } from 'next';
import Link from 'next/link';
import { servicesFor } from '@sarmata/services';
import { Button, DataTable, EmptyState, Field, PageHero, Select, Tag } from '@sarmata/ui';
import { officeEmployees, requireMember } from '@/lib/account';
import { evaluationStatuses, statusTag } from '@/lib/evaluations/status-labels';
import { formatDate, pluralPl } from '@/lib/format';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';
import { filterHref, parseListFilters } from './_list/list-filters';

export const metadata: Metadata = { title: 'Oceny' };

const CLOSED = new Set(['closed', 'interrupted']);
const NO_EVALUATOR = 'Konto spoza listy pracowników';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EvaluationsPage({ searchParams }: { searchParams: SearchParams }) {
  const account = await requireMember();
  const services = servicesFor(await createSupabase());
  const [all, employees, params] = await Promise.all([
    services.evaluations.list(),
    officeEmployees(),
    searchParams,
  ]);

  const employeeOptions = [
    ...new Map(
      all.map((e) => [
        e.employeeId,
        {
          id: e.employeeId,
          name: `${e.snapshot.firstName} ${e.snapshot.lastName}`,
          last: e.snapshot.lastName,
        },
      ]),
    ).values(),
  ].sort((a, b) => a.last.localeCompare(b.last, 'pl'));

  const filters = parseListFilters(
    params,
    employeeOptions.map((o) => o.id),
  );
  const active = filters.status !== null || filters.employeeId !== null;

  const rows = all
    .filter(
      (e) =>
        (filters.status === null || e.status === filters.status) &&
        (filters.employeeId === null || e.employeeId === filters.employeeId),
    )
    .sort(
      (a, b) =>
        Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status)) ||
        a.snapshot.lastName.localeCompare(b.snapshot.lastName, 'pl') ||
        a.snapshot.firstName.localeCompare(b.snapshot.firstName, 'pl'),
    );

  const evaluatorNames = new Map(
    employees.flatMap((e) =>
      e.userId ? [[e.userId, `${e.firstName} ${e.lastName}`] as const] : [],
    ),
  );

  const canStart = account.role === 'evaluator' || account.role === 'hr';
  // On the navy hero the white block stands out, a navy primary block would vanish into it.
  const startLink = (variant: 'primary' | 'secondary') =>
    canStart ? (
      <Button asChild variant={variant}>
        <Link href={routes.newEvaluation}>Rozpocznij nową ocenę</Link>
      </Button>
    ) : null;

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Oceny"
        meta="Wszystkie oceny okresowe, które widzisz w urzędzie."
        actions={startLink('secondary')}
        linkAs={Link}
      />
      <div className="px-6 py-7 sm:px-10">
        {all.length === 0 ? (
          <EmptyState title="Nie ma jeszcze ocen" action={startLink('primary')}>
            {canStart
              ? 'Rozpocznij ocenę wybranego pracownika. Gdy ją utworzysz, pojawi się tutaj.'
              : 'Oceny pojawią się tutaj, gdy oceniający je rozpocznie.'}
          </EmptyState>
        ) : (
          <>
            <form
              action={routes.evaluations}
              method="get"
              className="flex flex-wrap items-end gap-x-6 gap-y-4"
            >
              <Field id="status" label="Etap" className="max-w-full">
                <Select
                  name="status"
                  defaultValue={filters.status ?? ''}
                  className="w-64 max-w-full"
                >
                  <option value="">Wszystkie</option>
                  {evaluationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusTag(status).label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="pracownik" label="Pracownik" className="max-w-full">
                <Select
                  name="pracownik"
                  defaultValue={filters.employeeId ?? ''}
                  className="w-72 max-w-full"
                >
                  <option value="">Wszyscy</option>
                  {employeeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="secondary">
                Pokaż oceny
              </Button>
              {active ? (
                <Link
                  href={routes.evaluations}
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
              caption="Oceny okresowe"
              rows={rows}
              rowKey={(e) => e.id}
              empty={
                <EmptyState
                  title="Żadna ocena nie pasuje do filtrów"
                  action={
                    <Link
                      href={filterHref({ status: null, employeeId: null })}
                      className="font-heading text-link font-medium underline"
                    >
                      Wyczyść filtry
                    </Link>
                  }
                >
                  Zmień etap lub pracownika albo wyczyść filtry, by zobaczyć wszystkie oceny.
                </EmptyState>
              }
              columns={[
                {
                  key: 'employee',
                  header: 'Pracownik',
                  rowHeader: true,
                  cell: (e) => (
                    <Link
                      href={routes.evaluation(e.id)}
                      className="text-link font-semibold underline"
                    >
                      {e.snapshot.firstName} {e.snapshot.lastName}
                    </Link>
                  ),
                },
                {
                  key: 'position',
                  header: 'Stanowisko',
                  cell: (e) => e.snapshot.positionTitle ?? 'Brak',
                },
                { key: 'sheet', header: 'Arkusz', cell: (e) => e.sheetId },
                {
                  key: 'status',
                  header: 'Etap',
                  cell: (e) => {
                    const tag = statusTag(e.status);
                    return <Tag tone={tag.tone}>{tag.label}</Tag>;
                  },
                },
                {
                  key: 'cycleStart',
                  header: 'Początek okresu',
                  className: 'whitespace-nowrap',
                  cell: (e) => formatDate(e.cycleStart),
                },
                {
                  key: 'evaluator',
                  header: 'Prowadzi ocenę',
                  cell: (e) => evaluatorNames.get(e.evaluatorAccountId) ?? NO_EVALUATOR,
                },
              ]}
            />
          </>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { servicesFor } from '@sarmata/services';
import { DataTable, type DataTableColumn, EmptyState, PageHero, Tag } from '@sarmata/ui';
import { AiLogFilters } from '@/components/ai-log/ai-log-filters';
import { RunDecisions } from '@/components/ai-log/run-decisions';
import { officeEmployees, requireMember } from '@/lib/account';
import {
  type AiLogRow,
  aiLogRows,
  filterUsageLog,
  type LogRunDetail,
  parseAiLogFilter,
  runDetail,
  usageLogDetail,
  usageLogRows,
} from '@/lib/ai-log/ai-log';
import { todayInWarsaw } from '@/lib/format';
import { routes } from '@/lib/routes';
import { type SearchParams, single } from '@/lib/search-params';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Dziennik użycia AI' };

const RUN_ANCHOR = 'przebieg';

function emptyText(isAdmin: boolean, filtered: boolean): string {
  if (filtered) return 'Żaden przebieg nie pasuje do filtrów.';
  if (isAdmin) return 'Nie ma jeszcze przebiegów AI w urzędzie.';
  return 'Nie ma jeszcze przebiegów AI. Pojawią się po pierwszym użyciu sugestii AI w ocenie, notatce albo karcie pracownika.';
}

/** AI usage log (`/dziennik-ai`): every run and the human decision about each fragment. */
export default async function AiLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const account = await requireMember();
  const params = await searchParams;
  const filter = parseAiLogFilter(params);
  const selectedId = single(params[RUN_ANCHOR]);

  const services = servicesFor(await createSupabase());
  const isAdmin = account.role === 'admin';
  const [source, employees] = await Promise.all([
    isAdmin ? services.ai.usageLog() : services.ai.list(filter),
    officeEmployees(),
  ]);

  const people = new Map<string, string>();
  for (const employee of employees) {
    if (employee.anonymizedAt !== null) continue;
    const name = `${employee.firstName} ${employee.lastName}`;
    people.set(employee.id, name);
    if (employee.userId !== null) people.set(employee.userId, name);
  }
  const options = employees
    .filter((employee) => employee.anonymizedAt === null)
    .map((employee) => ({ id: employee.id, name: `${employee.firstName} ${employee.lastName}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  const criterionNames = new Map<string, string>();
  if (selectedId !== '') {
    try {
      const document = await services.regulations.inForceOn(todayInWarsaw());
      for (const criterion of document.criteria.catalog) {
        criterionNames.set(criterion.id, criterion.name);
      }
    } catch {
      // Without the regulation the log shows the criterion ids.
    }
  }
  const criterionName = (id: string) => criterionNames.get(id) ?? id;

  let rows: AiLogRow[];
  let selected: LogRunDetail | null;
  if (isAdmin) {
    const entries = filterUsageLog(
      source as Awaited<ReturnType<typeof services.ai.usageLog>>,
      filter,
    );
    rows = usageLogRows(entries, people);
    const entry = entries.find((item) => item.id === selectedId);
    selected = entry ? usageLogDetail(entry) : null;
  } else {
    const runs = source as Awaited<ReturnType<typeof services.ai.list>>;
    rows = aiLogRows(runs, people);
    const run = runs.find((item) => item.id === selectedId);
    selected = run ? runDetail(run) : null;
  }
  const filtered = filter.employeeId !== undefined || filter.kind !== undefined;

  const columns: DataTableColumn<AiLogRow>[] = [
    { key: 'when', header: 'Kiedy', className: 'w-[11rem]', cell: (row) => row.requestedAt },
    { key: 'kind', header: 'Rodzaj', rowHeader: true, cell: (row) => row.kind },
    {
      key: 'employee',
      header: 'Pracownik',
      cell: (row) => row.employee ?? <span className="text-ink-muted">Bez pracownika</span>,
    },
    { key: 'by', header: 'Zlecił', cell: (row) => row.requestedBy },
    {
      key: 'status',
      header: 'Stan',
      cell: (row) => <Tag tone={row.status.tone}>{row.status.label}</Tag>,
    },
    { key: 'decisions', header: 'Decyzje', cell: (row) => row.decisions },
    {
      key: 'details',
      header: 'Szczegóły',
      cell: (row) => (
        <Link
          href={`${routes.aiLog}?${new URLSearchParams({
            ...(filter.employeeId ? { pracownik: filter.employeeId } : {}),
            ...(filter.kind ? { rodzaj: filter.kind } : {}),
            [RUN_ANCHOR]: row.id,
          }).toString()}#${RUN_ANCHOR}`}
          aria-label={`Pokaż decyzje, ${row.kind}, ${row.requestedAt}`}
          className="font-heading text-link font-medium underline"
        >
          Pokaż
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Dziennik użycia AI"
        meta={
          isAdmin
            ? 'Każde użycie AI w urzędzie i decyzja człowieka o każdym fragmencie, bez treści. Najnowsze 100 przebiegów.'
            : 'Każde użycie AI i decyzja człowieka o każdym fragmencie. Najnowsze 50 przebiegów.'
        }
      />
      <div className="flex flex-col gap-6 px-6 py-8 sm:px-10">
        <AiLogFilters employees={options} employeeId={filter.employeeId} kind={filter.kind} />
        {rows.length > 0 ? (
          <DataTable
            caption="Przebiegi AI"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
        ) : (
          <EmptyState title="Brak przebiegów do pokazania" className="px-0 sm:px-0">
            <p className="max-w-[70ch]">{emptyText(isAdmin, filtered)}</p>
          </EmptyState>
        )}
        {selected ? (
          <section id={RUN_ANCHOR} aria-labelledby={`${RUN_ANCHOR}-heading`} className="mt-4">
            <h2
              id={`${RUN_ANCHOR}-heading`}
              className="font-heading text-ink mb-6 text-[1.875rem] leading-[normal] font-semibold tracking-[-0.0133em]"
            >
              Decyzje o fragmentach
            </h2>
            <RunDecisions
              run={selected}
              people={people}
              criterionName={criterionName}
              withContent={!isAdmin}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

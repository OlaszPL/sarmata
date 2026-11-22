import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { type MemberAccount, servicesFor } from '@sarmata/services';
import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  PageHero,
  Tag,
  TextInput,
} from '@sarmata/ui';
import { officeEmployees, requireMember } from '@/lib/account';
import { type EmployeeRow, employeeRows } from '@/lib/employees/employee-list';
import { evaluationStatusLabels } from '@/lib/employees/labels';
import { pluralPl } from '@/lib/format';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

type Scope = 'mine' | 'all';
type SearchParams = Record<string, string | string[] | undefined>;

const ALL_PARAM = 'wszyscy';

function listTitle(account: MemberAccount): string {
  return account.role === 'evaluator' ? 'Moi pracownicy' : 'Pracownicy urzędu';
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: listTitle(await requireMember()) };
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/** Link to the list with the given scope and search, the scope param only for "all" of an evaluator. */
function listHref(scope: Scope, query: string): string {
  const params = new URLSearchParams();
  if (scope === 'all') params.set('zakres', ALL_PARAM);
  if (query) params.set('q', query);
  const search = params.toString();
  return search ? `${routes.employees}?${search}` : routes.employees;
}

const linkClasses = 'font-heading text-link font-medium underline';

function CurrentEvaluation({ row }: { row: EmployeeRow }) {
  if (!row.ended && !row.current) return <span className="text-ink-muted">Brak oceny w toku</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {row.ended ? <Tag tone="neutral">Zatrudnienie ustało</Tag> : null}
      {row.current ? (
        <>
          <Tag tone="progress">{evaluationStatusLabels[row.current.status]}</Tag>
          <Link href={routes.evaluation(row.current.evaluationId)} className={linkClasses}>
            Otwórz ocenę<span className="sr-only">, {row.name}</span>
          </Link>
        </>
      ) : null}
    </div>
  );
}

/** Scope switch of an evaluator: own people or everybody in the office. */
function ScopeSwitch({ scope, query }: { scope: Scope; query: string }) {
  const items: { scope: Scope; label: string }[] = [
    { scope: 'mine', label: 'Moi pracownicy' },
    { scope: 'all', label: 'Wszyscy w urzędzie' },
  ];
  return (
    <nav aria-label="Zakres listy">
      <ul className="border-rule flex w-fit flex-wrap border">
        {items.map((item) => {
          const current = item.scope === scope;
          return (
            <li key={item.scope} className="border-rule border-l first:border-l-0">
              <Link
                href={listHref(item.scope, query)}
                aria-current={current ? 'page' : undefined}
                className={
                  current
                    ? 'bg-navy font-heading flex min-h-11 items-center px-5 leading-[normal] font-semibold text-white no-underline'
                    : 'font-heading text-link flex min-h-11 items-center px-5 leading-[normal] font-medium underline'
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Employee list (`/pracownicy`): own people of an evaluator or the whole office, with search. */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const account = await requireMember();
  const params = await searchParams;
  const isEvaluator = account.role === 'evaluator';
  const scope: Scope = !isEvaluator || single(params.zakres) === ALL_PARAM ? 'all' : 'mine';
  const query = single(params.q);

  const services = servicesFor(await createSupabase());
  const [employees, evaluations] = await Promise.all([
    officeEmployees(),
    services.evaluations.list(),
  ]);
  const me = {
    userId: account.userId,
    employeeId: employees.find((employee) => employee.userId === account.userId)?.id ?? null,
  };
  const rows = employeeRows({ employees, evaluations, scope, me, query });
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const visible = new Set(
    employees.filter((employee) => employee.anonymizedAt === null).map((employee) => employee.id),
  );
  const similar =
    rows.length === 0 && query
      ? (await services.employees.findSimilar(query)).filter((person) => visible.has(person.id))
      : [];
  const canAdd = account.role === 'evaluator' || account.role === 'hr';

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: 'name',
      header: 'Imię i nazwisko',
      rowHeader: true,
      className: 'w-[16rem]',
      cell: (row) => (
        <Link href={routes.employee(row.id)} className="text-link font-semibold underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'position',
      header: 'Stanowisko i komórka',
      cell: (row) =>
        [row.position, byId.get(row.id)?.orgUnit].filter(Boolean).join(', ') || (
          <span className="text-ink-muted">Nie podano</span>
        ),
    },
    {
      key: 'evaluation',
      header: 'Bieżąca ocena',
      className: 'w-[22rem]',
      cell: (row) => <CurrentEvaluation row={row} />,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title={listTitle(account)}
        meta={`${rows.length} ${pluralPl(rows.length, 'osoba', 'osoby', 'osób')}`}
        actions={
          canAdd ? (
            <Button asChild variant="secondary">
              <Link href={routes.newEmployee}>
                <Plus aria-hidden />
                Dodaj pracownika
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-6 px-6 py-8 sm:px-10">
        {isEvaluator ? <ScopeSwitch scope={scope} query={query} /> : null}
        <form
          role="search"
          method="get"
          action={routes.employees}
          className="flex flex-wrap items-end gap-3"
        >
          {scope === 'all' && isEvaluator ? (
            <input type="hidden" name="zakres" value={ALL_PARAM} />
          ) : null}
          <Field
            id="q"
            label="Szukaj po imieniu, nazwisku, stanowisku"
            className="min-w-[16rem] flex-1 sm:max-w-[32rem]"
          >
            <TextInput name="q" type="search" defaultValue={query} />
          </Field>
          <Button type="submit" variant="secondary" className="h-12">
            Szukaj
          </Button>
          {query ? (
            <Link
              href={listHref(scope, '')}
              className={`${linkClasses} flex min-h-12 items-center`}
            >
              Wyczyść wyszukiwanie
            </Link>
          ) : null}
        </form>
        {rows.length > 0 ? (
          <DataTable
            caption="Lista pracowników"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
        ) : query ? (
          <EmptyState title="Nikogo nie znaleziono" className="px-0 sm:px-0">
            <p className="max-w-[70ch]">
              Sprawdź pisownię albo wpisz mniej słów.
              {scope === 'mine' ? (
                <>
                  {' '}
                  Możesz też{' '}
                  <Link href={listHref('all', query)} className={linkClasses}>
                    szukać wśród wszystkich w urzędzie
                  </Link>
                  .
                </>
              ) : null}
            </p>
            {similar.length > 0 ? (
              <>
                <p className="font-heading mt-4 font-semibold">Czy chodzi o:</p>
                <ul className="mt-2 grid gap-2">
                  {similar.map((person) => (
                    <li key={person.id}>
                      <Link
                        href={routes.employee(person.id)}
                        className="text-link font-semibold underline"
                      >
                        {person.firstName} {person.lastName}
                      </Link>
                      {person.positionTitle ? <span>, {person.positionTitle}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </EmptyState>
        ) : (
          <EmptyState title="Nie masz jeszcze pracowników" className="px-0 sm:px-0">
            <p className="max-w-[70ch]">{emptyHint(account, scope)}</p>
            {scope === 'mine' ? (
              <p className="mt-2">
                <Link href={listHref('all', '')} className={linkClasses}>
                  Pokaż wszystkich w urzędzie
                </Link>
              </p>
            ) : null}
          </EmptyState>
        )}
      </div>
    </div>
  );
}

function emptyHint(account: MemberAccount, scope: Scope): string {
  if (scope === 'mine') {
    return 'Tu widzisz osoby, którymi kierujesz, i osoby, których ocenę prowadzisz. Dodaj pracownika albo pokaż wszystkich w urzędzie.';
  }
  if (account.role === 'admin') {
    return 'W urzędzie nie ma jeszcze żadnej osoby. Pracowników dodają oceniający i kadry.';
  }
  return 'W urzędzie nie ma jeszcze żadnej osoby. Dodaj pierwszą osobę przyciskiem Dodaj pracownika.';
}

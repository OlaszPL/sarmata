import type { Metadata } from 'next';
import Link from 'next/link';
import { type Employee, type Evaluation, servicesFor } from '@sarmata/services';
import {
  Button,
  EmptyState,
  ErrorSummary,
  Field,
  Notice,
  PageHero,
  RadioGroup,
  Section,
  SummaryList,
  TextInput,
} from '@sarmata/ui';
import { officeEmployees, requireMember } from '@/lib/account';
import { runService } from '@/lib/form-action';
import { pluralPl, todayInWarsaw } from '@/lib/format';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';
import { StartForm } from './start-form';
import { eligibilityNote, searchEmployees, sheetOptions } from './start-options';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** "Dalej" without a choice reloads step 1 with an error, so the title gets the "Błąd: " prefix. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const missingChoice = param(params.krok) === '2' && param(params.pracownik) === '';
  return { title: missingChoice ? 'Błąd: Nowa ocena' : 'Nowa ocena' };
}

const FINISHED = new Set<Evaluation['status']>(['closed', 'interrupted']);

const serviceStatusLabels: Record<Employee['serviceStatus'], string> = {
  civil_servant: 'Urzędnik służby cywilnej',
  employee: 'Pracownik służby cywilnej',
};

const linkClasses = 'font-heading text-link font-medium underline';

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function fullName(employee: Pick<Employee, 'firstName' | 'lastName'>): string {
  return `${employee.firstName} ${employee.lastName}`;
}

/** Step 1 with the search kept, the target of "Zmień" and of "Pokaż wszystkich pracowników". */
function stepOneHref(search: string): string {
  return search
    ? `${routes.newEvaluation}?${new URLSearchParams({ szukaj: search }).toString()}`
    : routes.newEvaluation;
}

/**
 * Start of a new evaluation in two GET steps and one action: pick the employee (search tolerant to
 * typos), then check the person, pick the sheet and start. Only evaluators and HR may start.
 */
export default async function NewEvaluationPage({ searchParams }: { searchParams: SearchParams }) {
  const account = await requireMember();
  const params = await searchParams;
  const crumbs = [{ href: routes.evaluations, label: 'Oceny' }, { label: 'Nowa ocena' }];

  if (account.role !== 'evaluator' && account.role !== 'hr') {
    return (
      <div className="flex flex-1 flex-col">
        <PageHero linkAs={Link} crumbs={crumbs} title="Rozpocznij nową ocenę" />
        <div className="grid max-w-[46rem] gap-4 px-6 py-7 sm:px-10">
          <Notice tone="info">
            <p className="max-w-[70ch]">
              Ocenę rozpoczyna osoba oceniająca albo kadry. Twoja rola pozwala ją tylko przeglądać.
            </p>
          </Notice>
          <Link href={routes.evaluations} className={`${linkClasses} self-start`}>
            Przejdź do listy ocen
          </Link>
        </div>
      </div>
    );
  }

  const search = param(params.szukaj);
  const employees = (await officeEmployees()).filter((employee) => employee.anonymizedAt === null);
  const chosen = employees.find((employee) => employee.id === param(params.pracownik));

  if (chosen) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHero
          linkAs={Link}
          crumbs={crumbs}
          title="Rozpocznij nową ocenę"
          meta="Krok 2 z 2, wybór arkusza"
        />
        <StepTwo employee={chosen} search={search} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        linkAs={Link}
        crumbs={crumbs}
        title="Rozpocznij nową ocenę"
        meta="Krok 1 z 2, wybór pracownika"
      />
      <StepOne employees={employees} search={search} submitted={param(params.krok) === '2'} />
    </div>
  );
}

async function StepOne({
  employees,
  search,
  submitted,
}: {
  employees: readonly Employee[];
  search: string;
  submitted: boolean;
}) {
  const services = servicesFor(await createSupabase());
  const [similar, evaluations] = await Promise.all([
    search ? services.employees.findSimilar(search) : Promise.resolve(null),
    services.evaluations.list(),
  ]);

  const candidates = similar
    ? searchEmployees(
        employees,
        similar.map((match) => match.id),
        search,
      )
    : employees;
  const open = new Map(
    evaluations
      .filter((evaluation) => !FINISHED.has(evaluation.status))
      .map((evaluation) => [evaluation.employeeId, evaluation]),
  );

  const choiceError = submitted ? 'Wybierz pracownika' : undefined;

  return (
    <Section title="Wybierz pracownika">
      <div className="grid gap-8">
        {choiceError ? (
          <ErrorSummary
            title="Nie można przejść dalej"
            errors={[{ fieldId: 'pracownik', message: choiceError }]}
          />
        ) : null}
        <form
          action={routes.newEvaluation}
          method="get"
          role="search"
          className="flex flex-wrap items-end gap-x-6 gap-y-4"
        >
          <Field
            id="szukaj"
            label="Szukaj pracownika"
            hint="Imię albo nazwisko, literówki nie przeszkadzają."
            className="w-full max-w-[28rem]"
          >
            <TextInput name="szukaj" defaultValue={search} autoComplete="off" />
          </Field>
          <Button type="submit" variant="secondary">
            Szukaj
          </Button>
        </form>

        {search ? (
          <p className="font-heading text-[1.125rem] font-semibold" role="status">
            Znaleziono {candidates.length} {pluralPl(candidates.length, 'osobę', 'osoby', 'osób')}
          </p>
        ) : null}

        {candidates.length === 0 ? (
          search ? (
            <EmptyState
              title="Nie znaleziono pracownika"
              className="px-0 sm:px-0"
              action={
                <Link href={routes.newEvaluation} className={linkClasses}>
                  Pokaż wszystkich pracowników
                </Link>
              }
            >
              <p className="max-w-[70ch]">
                Sprawdź imię i nazwisko albo przejrzyj całą listę pracowników urzędu.
              </p>
            </EmptyState>
          ) : (
            <EmptyState title="Brak pracowników" className="px-0 sm:px-0">
              <p className="max-w-[70ch]">
                Urząd nie ma jeszcze pracowników w ewidencji. Kadry dodają ich na liście
                pracowników.
              </p>
            </EmptyState>
          )
        ) : (
          <form action={routes.newEvaluation} method="get" noValidate className="grid gap-8">
            {search ? <input type="hidden" name="szukaj" value={search} /> : null}
            <input type="hidden" name="krok" value="2" />
            <RadioGroup
              name="pracownik"
              legend="Kogo oceniasz?"
              error={choiceError}
              options={candidates.map((employee) => {
                const place = [employee.positionTitle, employee.orgUnit].filter(Boolean).join(', ');
                const note = eligibilityNote(employee, open.get(employee.id) ?? null);
                return {
                  value: employee.id,
                  label: fullName(employee),
                  hint:
                    place || note ? (
                      <>
                        {place ? <span className="block">{place}</span> : null}
                        {note ? (
                          <span className="font-heading text-ink block font-medium">{note}</span>
                        ) : null}
                      </>
                    ) : undefined,
                };
              })}
            />
            <div>
              <Button type="submit">Dalej</Button>
            </div>
          </form>
        )}
      </div>
    </Section>
  );
}

async function StepTwo({ employee, search }: { employee: Employee; search: string }) {
  const services = servicesFor(await createSupabase());
  const regulation = await runService(() => services.regulations.inForceOn(todayInWarsaw()));

  return (
    <>
      <Section title="Pracownik">
        <SummaryList
          linkAs={Link}
          rows={[
            { key: 'Pracownik', value: fullName(employee), changeHref: stepOneHref(search) },
            { key: 'Stanowisko', value: employee.positionTitle ?? 'Brak' },
            { key: 'Komórka', value: employee.orgUnit ?? 'Brak' },
            { key: 'Status w służbie', value: serviceStatusLabels[employee.serviceStatus] },
          ]}
        />
      </Section>
      <Section title="Wybierz arkusz">
        {regulation.ok ? (
          <div className="grid gap-6">
            <p className="max-w-[70ch]">
              Arkusz zależy od stanowiska. Po rozpoczęciu przejdziesz do części I, gdzie ustalisz
              kryteria i termin oceny.
            </p>
            <StartForm
              employeeId={employee.id}
              options={sheetOptions(regulation.value, employee.positionKind)}
            />
          </div>
        ) : (
          <Notice tone="error" title="Nie można rozpocząć oceny" className="max-w-[46rem]">
            <p className="max-w-[70ch]">{regulation.state.formError}</p>
          </Notice>
        )}
      </Section>
    </>
  );
}

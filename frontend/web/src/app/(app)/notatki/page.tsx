import type { Metadata } from 'next';
import Link from 'next/link';
import { NOTE_CHECK_TIMEOUT_MS, type Note, type NoteVersion, servicesFor } from '@sarmata/services';
import { Button, EmptyState, Field, Notice, PageHero, Section, Select } from '@sarmata/ui';
import { NoteForm } from '@/components/notes/note-form';
import { NoteHistory } from '@/components/notes/note-history';
import { NoteList } from '@/components/notes/note-list';
import { NoteSavedNotice } from '@/components/notes/note-saved-notice';
import { officeEmployees, requireMember } from '@/lib/account';
import { employeeRows } from '@/lib/employees/employee-list';
import { todayInWarsaw } from '@/lib/format';
import { routes } from '@/lib/routes';
import { type SearchParams, single } from '@/lib/search-params';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Notatki' };

const linkClasses = 'font-heading text-link leading-[normal] font-medium underline';
const FORM_ANCHOR = 'formularz-notatki';

/** Notes page link that keeps the employee filter. */
function notesHref(filter: string, extra: Record<string, string> = {}, hash = ''): string {
  const params = new URLSearchParams(extra);
  if (filter) params.set('pracownik', filter);
  const search = params.toString();
  return `${routes.notes}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
}

/** Own notes of an evaluator or hr (`/notatki`): a new note, the list, editing and the history. */
export default async function NotesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const account = await requireMember();
  const params = await searchParams;
  const hero = (
    <PageHero title="Notatki" meta="Twoje notatki o pracownikach, od najnowszego zdarzenia." />
  );

  if (account.role === 'admin') {
    return (
      <div className="flex flex-1 flex-col">
        {hero}
        <div className="px-6 py-8 sm:px-10">
          <Notice tone="info">
            <p>Notatki piszą oceniający i kadry.</p>
          </Notice>
        </div>
      </div>
    );
  }

  const services = servicesFor(await createSupabase());
  const today = todayInWarsaw();
  const criteriaCatalog = async (): Promise<{ id: string; name: string }[]> => {
    try {
      const document = await services.regulations.inForceOn(today);
      return document.criteria.catalog.map((criterion) => ({
        id: criterion.id,
        name: criterion.name,
      }));
    } catch {
      return [];
    }
  };
  const [notes, employees, evaluations, settings, catalog] = await Promise.all([
    services.notes.listMine(),
    officeEmployees(),
    account.role === 'evaluator' ? services.evaluations.list() : Promise.resolve([]),
    services.officeSettings.get(),
    criteriaCatalog(),
  ]);

  const names = new Map(
    employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`]),
  );
  const criteria = new Map(catalog.map((criterion) => [criterion.id, criterion.name]));
  const me = {
    userId: account.userId,
    employeeId: employees.find((employee) => employee.userId === account.userId)?.id ?? null,
  };
  const choices = employeeRows({
    employees,
    evaluations,
    scope: account.role === 'evaluator' ? 'mine' : 'all',
    me,
    query: '',
  })
    .filter((row) => !row.ended)
    .map((row) => ({ id: row.id, name: row.name }));

  const filter = single(params.pracownik);
  const shown = filter ? notes.filter((note) => note.employeeId === filter) : notes;
  const filterOptions = [...new Set(notes.map((note) => note.employeeId))]
    .map((id) => ({ id, name: names.get(id) ?? 'Osoba bez nazwiska' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  const editId = single(params.notatka);
  const edited: Note | undefined =
    editId && editId !== 'nowa' ? notes.find((note) => note.id === editId) : undefined;
  const editMissing = Boolean(editId && editId !== 'nowa' && !edited);

  const formEmployees = edited
    ? [{ id: edited.employeeId, name: names.get(edited.employeeId) ?? 'Osoba bez nazwiska' }]
    : choices;

  const historyId = single(params.historia);
  let history: NoteVersion[] | null = null;
  if (historyId && notes.some((note) => note.id === historyId)) {
    try {
      history = await services.notes.history(historyId);
    } catch {
      history = null;
    }
  }
  const historyMissing = Boolean(historyId && history === null);

  return (
    <div className="flex flex-1 flex-col">
      {hero}
      <div className="flex flex-col gap-6 px-6 pt-8 sm:px-10">
        <NoteSavedNotice searchParams={params} />
        {editMissing ? (
          <Notice tone="warning" role="status">
            <p>Nie znaleziono tej notatki wśród Twoich. Możesz dodać nową.</p>
          </Notice>
        ) : null}
      </div>

      <Section id={FORM_ANCHOR} title={edited ? 'Zmiana notatki' : 'Nowa notatka'} className="mt-2">
        {formEmployees.length === 0 ? (
          <Notice tone="info">
            <p className="max-w-[70ch]">
              {account.role === 'evaluator'
                ? 'Notatki piszesz o osobach, którymi kierujesz, i o osobach, których ocenę prowadzisz. Na liście nie ma teraz nikogo takiego.'
                : 'W urzędzie nie ma jeszcze osób, o których można pisać notatki.'}
            </p>
            <p className="mt-2">
              <Link href={routes.employees} className={linkClasses}>
                Przejdź do listy pracowników
              </Link>
            </p>
          </Notice>
        ) : (
          <>
            {formEmployees.length === 1 && formEmployees[0] ? (
              <p className="mb-6 max-w-[70ch]">
                Pracownik:{' '}
                <Link
                  href={routes.employee(formEmployees[0].id)}
                  className="font-heading text-link font-semibold underline"
                >
                  {formEmployees[0].name}
                </Link>
              </p>
            ) : null}
            <NoteForm
              // A save redirects with a new `zapis`, so the next note starts from an empty form.
              key={edited?.id ?? `nowa-${single(params.zapis)}`}
              employees={formEmployees}
              criteria={catalog}
              {...(edited ? { note: edited } : {})}
              returnTo={routes.notes}
              today={today}
              aiEnabled={settings.aiEnabled}
              visibility={settings.evaluationVisibility}
              retentionMonths={settings.notesRetentionMonths}
              checkTimeoutMs={NOTE_CHECK_TIMEOUT_MS}
              whoSeesHeadingLevel={3}
            />
          </>
        )}
      </Section>

      {history ? (
        <NoteHistory versions={history} criteria={criteria} closeHref={notesHref(filter)} />
      ) : null}

      <Section title="Twoje notatki">
        <div className="grid gap-6">
          {historyMissing ? (
            <Notice tone="warning" role="status">
              <p>Nie udało się wczytać historii zmian tej notatki.</p>
            </Notice>
          ) : null}
          {account.role === 'hr' ? (
            <p className="max-w-[70ch]">
              Kadry czytają wszystkie notatki na kartach pracowników. Tu są tylko Twoje.
            </p>
          ) : null}
          {filterOptions.length > 1 ? (
            <form
              key={filter}
              method="get"
              action={routes.notes}
              className="flex flex-wrap items-end gap-3"
            >
              <Field id="pracownik" label="Pokaż notatki o osobie" className="min-w-[16rem]">
                <Select name="pracownik" defaultValue={filter}>
                  <option value="">Wszystkie osoby</option>
                  {filterOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="secondary" className="h-12">
                Pokaż notatki
              </Button>
              {filter ? (
                <Link href={routes.notes} className={`${linkClasses} flex min-h-12 items-center`}>
                  Pokaż wszystkie notatki
                </Link>
              ) : null}
            </form>
          ) : null}
          <NoteList
            notes={shown}
            criteria={criteria}
            employeeNames={names}
            myUserId={account.userId}
            editHref={(note) => notesHref(filter, { notatka: note.id }, FORM_ANCHOR)}
            historyHref={(note) => notesHref(filter, { historia: note.id }, 'historia')}
            empty={
              filter ? (
                <EmptyState title="Brak notatek o tej osobie" className="px-0 sm:px-0">
                  <p className="max-w-[70ch]">
                    <Link href={routes.notes} className={linkClasses}>
                      Pokaż wszystkie notatki
                    </Link>
                  </p>
                </EmptyState>
              ) : (
                <EmptyState title="Nie masz jeszcze notatek" className="px-0 sm:px-0">
                  <p className="max-w-[70ch]">
                    Zapisuj obserwacje na bieżąco, z datą i przykładem.
                  </p>
                </EmptyState>
              )
            }
          />
        </div>
      </Section>
    </div>
  );
}

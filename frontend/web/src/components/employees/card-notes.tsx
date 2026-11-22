import Link from 'next/link';
import {
  NOTE_CHECK_TIMEOUT_MS,
  type Note,
  type NoteKind,
  type NoteSign,
  type NoteVersion,
} from '@sarmata/services';
import { Button, EmptyState, Field, Notice, Section, Select } from '@sarmata/ui';
import { NoteForm } from '@/components/notes/note-form';
import { NoteHistory } from '@/components/notes/note-history';
import { NoteList } from '@/components/notes/note-list';
import { type CardData } from '@/lib/employees/load-card';
import { noteKindLabels, noteSignLabels } from '@/lib/employees/labels';
import { routes } from '@/lib/routes';
import { type SearchParams, single } from '@/lib/search-params';

const linkClasses = 'font-heading text-link leading-[normal] font-medium underline';
export const NOTE_FORM_ANCHOR = 'notatka-formularz';
const ALL = 'wszystkie';

export interface CardNoteFilter {
  kind: NoteKind | null;
  sign: NoteSign | null;
}

/** `rodzaj` and `znak` of the card URL, unknown values read as "all". */
export function cardNoteFilter(params: SearchParams): CardNoteFilter {
  const kind = single(params.rodzaj);
  const sign = single(params.znak);
  return {
    kind: Object.hasOwn(noteKindLabels, kind) ? (kind as NoteKind) : null,
    sign: Object.hasOwn(noteSignLabels, sign) ? (sign as NoteSign) : null,
  };
}

/** Card link that keeps the note filter. */
function cardHref(
  employeeId: string,
  filter: CardNoteFilter,
  extra: Record<string, string> = {},
  hash = '',
): string {
  const params = new URLSearchParams(extra);
  if (filter.kind) params.set('rodzaj', filter.kind);
  if (filter.sign) params.set('znak', filter.sign);
  const search = params.toString();
  return `${routes.employee(employeeId)}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
}

interface CardNotesProps {
  data: CardData;
  filter: CardNoteFilter;
  /** `?notatka=`: `nowa` or the id of an own note to edit, empty without the form. */
  formParam: string;
  /** Versions of the note of `?historia=`, null without it. */
  history: NoteVersion[] | null;
  historyFailed: boolean;
}

/** Notes about the person: a filter, the list, the note form and the history of one note. */
export function CardNotes({ data, filter, formParam, history, historyFailed }: CardNotesProps) {
  const { employee, account, notes } = data;
  const name = `${employee.firstName} ${employee.lastName}`;

  if (notes === null) {
    return (
      <Section id="notatki" title="Notatki">
        <p className="max-w-[70ch]">
          Notatki o tej osobie czytają autor, kadry i osoba prowadząca jej otwartą ocenę.
        </p>
      </Section>
    );
  }

  const canWrite = account.role !== 'admin';
  const edited: Note | undefined =
    formParam && formParam !== 'nowa'
      ? notes.find((note) => note.id === formParam && note.authorAccountId === account.userId)
      : undefined;
  const editMissing = canWrite && Boolean(formParam && formParam !== 'nowa' && !edited);
  const showForm = canWrite && (formParam === 'nowa' || edited !== undefined);
  const filtered = filter.kind !== null || filter.sign !== null;
  const shown = notes.filter(
    (note) =>
      (filter.kind === null || note.kind === filter.kind) &&
      (filter.sign === null || note.sign === filter.sign),
  );
  const unfilteredHref = `${routes.employee(employee.id)}#notatki`;

  return (
    <>
      <Section id="notatki" title="Notatki">
        <div className="grid gap-6">
          {editMissing ? (
            <Notice tone="warning" role="status">
              <p className="max-w-[70ch]">
                Nie znaleziono tej notatki wśród Twoich. Możesz dodać nową.
              </p>
            </Notice>
          ) : null}
          {historyFailed ? (
            <Notice tone="warning" role="status">
              <p>Nie udało się wczytać historii zmian tej notatki.</p>
            </Notice>
          ) : null}

          {showForm ? (
            <div id={NOTE_FORM_ANCHOR} className="border-rule grid gap-6 border-b pb-8">
              <h3 className="text-ink text-[1.375rem] leading-[normal] font-semibold">
                {edited ? 'Zmiana notatki' : 'Nowa notatka'}
              </h3>
              <NoteForm
                key={edited?.id ?? 'nowa'}
                employees={[{ id: employee.id, name }]}
                criteria={data.criteria}
                {...(edited ? { note: edited } : {})}
                returnTo={routes.employee(employee.id)}
                today={data.today}
                aiEnabled={data.ai.enabled}
                visibility={data.settings.visibility}
                retentionMonths={data.settings.retentionMonths}
                checkTimeoutMs={NOTE_CHECK_TIMEOUT_MS}
                whoSeesHeadingLevel={4}
              />
            </div>
          ) : null}

          {notes.length > 0 ? (
            <form
              key={`${filter.kind ?? ''}|${filter.sign ?? ''}`}
              method="get"
              action={routes.employee(employee.id)}
              className="flex flex-wrap items-end gap-3"
            >
              <Field id="rodzaj" label="Rodzaj notatki" className="min-w-[14rem]">
                <Select name="rodzaj" defaultValue={filter.kind ?? ALL}>
                  <option value={ALL}>Wszystkie rodzaje</option>
                  {Object.entries(noteKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="znak" label="Wydźwięk" className="min-w-[10rem]">
                <Select name="znak" defaultValue={filter.sign ?? ALL}>
                  <option value={ALL}>Wszystkie</option>
                  {Object.entries(noteSignLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="secondary" className="h-12">
                Pokaż
              </Button>
              {filtered ? (
                <Link href={unfilteredHref} className={`${linkClasses} flex min-h-12 items-center`}>
                  Pokaż wszystkie notatki
                </Link>
              ) : null}
            </form>
          ) : null}

          <NoteList
            notes={shown}
            criteria={data.criteriaNames}
            myUserId={account.userId}
            editHref={(note) =>
              cardHref(employee.id, filter, { notatka: note.id }, NOTE_FORM_ANCHOR)
            }
            historyHref={(note) => cardHref(employee.id, filter, { historia: note.id }, 'historia')}
            empty={
              filtered ? (
                <EmptyState title="Brak notatek dla tych filtrów" className="px-0 sm:px-0">
                  <p className="max-w-[70ch]">
                    <Link href={unfilteredHref} className={linkClasses}>
                      Pokaż wszystkie notatki
                    </Link>
                  </p>
                </EmptyState>
              ) : (
                <EmptyState title="Brak notatek" className="px-0 sm:px-0">
                  <p className="max-w-[70ch]">
                    {canWrite
                      ? 'Zapisuj obserwacje na bieżąco, z datą i przykładem.'
                      : 'Notatki piszą oceniający i kadry.'}
                  </p>
                </EmptyState>
              )
            }
          />
        </div>
      </Section>
      {history ? (
        <NoteHistory
          versions={history}
          criteria={data.criteriaNames}
          closeHref={cardHref(employee.id, filter, {}, 'notatki')}
        />
      ) : null}
    </>
  );
}

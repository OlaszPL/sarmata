'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import type { CalendarDate, Note, SensitiveDataWarning } from '@sarmata/services';
import {
  AiSuggestion,
  Button,
  Checkbox,
  DateInput,
  ErrorSummary,
  Field,
  Notice,
  PixelLoader,
  RadioGroup,
  Select,
  SubmitButton,
  Textarea,
} from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { noteKindLabels, noteSignLabels } from '@/lib/employees/labels';
import type { NoteGuardState } from '@/lib/employees/note-guard';
import { pluralPl } from '@/lib/format';
import { routes } from '@/lib/routes';
import { type NoteFormState, saveNote } from './note-actions';
import { useNoteGuard } from './use-note-guard';

const BODY_MAX = 5000;

export const sensitiveCategoryLabels: Record<SensitiveDataWarning['category'], string> = {
  health: 'zdrowie',
  family: 'rodzina',
  religion: 'wyznanie',
  diagnosis: 'diagnoza',
};

/** What the save tells about a check without the AI model. */
const aiNoteTexts: Partial<Record<string, string>> = {
  dictionary_only: 'Sprawdzono tylko słownikiem, bo model AI nie odpowiedział.',
  ai_disabled: 'AI jest wyłączone w ustawieniach urzędu. Sprawdzono tylko słownikiem.',
};

const kindOptions = Object.entries<string>(noteKindLabels).map(([value, label]) => ({
  value,
  label,
}));
const signOptions = Object.entries<string>(noteSignLabels).map(([value, label]) => ({
  value,
  label,
}));

/** Order of the controls on the page, so the error summary lists them top to bottom. */
const FIELD_ORDER = [
  'employeeId',
  'kind',
  'occurredOn',
  'criterionId',
  'sign',
  'communicated',
  'body',
  'confirmRisk',
];

const initialState: NoteFormState = { values: {}, fieldErrors: {} };

function text(state: NoteFormState, name: string, fallback: string): string {
  const value = state.values[name];
  return typeof value === 'string' ? value : fallback;
}

function summaryItems(state: NoteFormState): { fieldId: string; message: string }[] {
  const known = new Set(FIELD_ORDER);
  const keys = [...FIELD_ORDER, ...Object.keys(state.fieldErrors).filter((key) => !known.has(key))];
  return keys.flatMap((key) => {
    const message = state.fieldErrors[key];
    return message ? [{ fieldId: key, message }] : [];
  });
}

function aiNoteOf(state: NoteGuardState): string {
  return state.phase === 'clear' || state.phase === 'review' ? state.aiNote : '';
}

function WarningList({ warnings }: { warnings: readonly SensitiveDataWarning[] }) {
  return (
    <ul className="mt-2 grid gap-1">
      {warnings.map((warning) => (
        <li key={`${warning.category}-${warning.fragment}`}>
          <span className="font-heading font-semibold">
            {sensitiveCategoryLabels[warning.category]}
          </span>
          : „{warning.fragment}”
        </li>
      ))}
    </ul>
  );
}

/** Who reads the note, from the office settings. */
function WhoSees({
  visibility,
  retentionMonths,
}: {
  visibility: 'office' | 'tree';
  retentionMonths: number;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-rule grid gap-2 border-t pt-6">
      <h3 id={headingId} className="text-ink text-xl leading-[normal] font-semibold">
        Kto to zobaczy
      </h3>
      <p className="max-w-[70ch]">
        Ty, kadry i osoba, która prowadzi otwartą ocenę tej osoby.
        {visibility === 'tree' ? ' Także przełożeni w strukturze urzędu.' : null}
      </p>
      <p className="max-w-[70ch]">
        Osoba oceniana nie ma wglądu w aplikacji. Notatka zniknie po {retentionMonths}{' '}
        {pluralPl(retentionMonths, 'miesiącu', 'miesiącach', 'miesiącach')}, tak ustawił urząd.
      </p>
    </section>
  );
}

export interface NoteFormProps {
  /** One entry on the employee card (hidden field), many on `/notatki` (select "Pracownik"). */
  employees: readonly { id: string; name: string }[];
  /** Criteria catalog of the regulation version in force. */
  criteria: readonly { id: string; name: string }[];
  /** The note to edit, absent for a new one. */
  note?: Note;
  /** `/pracownicy/<id>` or `/notatki`, the action accepts nothing else. */
  returnTo: string;
  today: CalendarDate;
  aiEnabled: boolean;
  visibility: 'office' | 'tree';
  retentionMonths: number;
}

/**
 * Form of a note with the sensitive data guard: "Zapisz notatkę" checks the text first (dictionary
 * at once, the AI model by polling), saves on its own when nothing was found and asks for an
 * explicit confirmation otherwise. The typed text stays through every step.
 */
export function NoteForm({
  employees,
  criteria,
  note,
  returnTo,
  today,
  aiEnabled,
  visibility,
  retentionMonths,
}: NoteFormProps) {
  const [state, formAction, isPending] = useActionState(saveNote, initialState);
  // Each answer of the action remounts the form, so the default values show what was sent.
  const [shownState, setShownState] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shownState) {
    setShownState(state);
    setVersion((current) => current + 1);
  }

  const fixedEmployee = note?.employeeId ?? (employees.length === 1 ? employees[0]?.id : null);
  const [employeeId, setEmployeeId] = useState(fixedEmployee ?? '');
  const [kind, setKind] = useState<string>(note?.kind ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  /** Bumped when the text is put in by a button, so the counter of the textarea starts over. */
  const [bodyVersion, setBodyVersion] = useState(0);
  const [editedProposal, setEditedProposal] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [inserted, setInserted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const guard = useNoteGuard(employeeId);
  const guardState = guard.state;

  // Nothing found: the form saves on its own.
  useEffect(() => {
    if (guardState.phase === 'clear') formRef.current?.requestSubmit();
  }, [guardState]);

  useEffect(() => {
    if (bodyVersion > 0) document.getElementById('body')?.focus();
  }, [bodyVersion]);

  const errors = summaryItems(state);
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const { fieldErrors } = state;
  const submitted = Object.keys(state.values).length > 0;

  const reviewWarnings =
    guardState.phase === 'review'
      ? guardState.warnings
      : guardState.phase === 'clear' && state.warnings && state.warnings.length > 0
        ? state.warnings
        : null;
  const rewrite = guardState.phase === 'review' ? guardState.rewrite : null;
  const aiNote = aiNoteOf(guardState);
  const checking = guard.starting || guardState.phase === 'checking';

  function changeBody(value: string) {
    setBody(value);
    setInserted(false);
    guard.bodyChanged();
  }

  function insertBody(value: string) {
    setBody(value);
    setBodyVersion((current) => current + 1);
    setInserted(true);
    guard.bodyChanged();
  }

  function save() {
    const trimmed = body.trim();
    // Without an employee or a valid body only the form check can answer, so send it as it is.
    if (
      guardState.phase === 'clear' ||
      employeeId === '' ||
      trimmed === '' ||
      trimmed.length > BODY_MAX
    ) {
      formRef.current?.requestSubmit();
      return;
    }
    guard.start(body);
  }

  async function decide(decision: 'accepted' | 'edited' | 'rejected', finalText?: string) {
    if (deciding || rewrite === null) return;
    setDeciding(true);
    await guard.settleRewrite(decision, finalText);
    setDeciding(false);
    if (decision === 'accepted') insertBody(rewrite.text);
    if (decision === 'edited' && finalText !== undefined) insertBody(finalText);
    setEditedProposal(null);
  }

  return (
    <div className="grid gap-8">
      {hasErrors ? (
        <ErrorSummary title="Popraw notatkę" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form
        ref={formRef}
        key={version}
        action={formAction}
        noValidate
        className="grid max-w-[40rem] gap-8"
      >
        {note ? <input type="hidden" name="noteId" value={note.id} /> : null}
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="aiNote" value={aiNote} />
        {fixedEmployee ? (
          <input type="hidden" name="employeeId" value={fixedEmployee} />
        ) : (
          <Field id="employeeId" label="Pracownik" error={fieldErrors.employeeId}>
            <Select
              name="employeeId"
              defaultValue={employeeId}
              onChange={(event) => {
                setEmployeeId(event.target.value);
                guard.bodyChanged();
              }}
            >
              <option value="">Wybierz pracownika</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <RadioGroup
          name="kind"
          legend="Rodzaj notatki"
          options={kindOptions}
          inline
          defaultValue={kind}
          onChange={(value) => {
            setKind(value);
          }}
          error={fieldErrors.kind}
        />
        <Field id="occurredOn" label="Data zdarzenia" error={fieldErrors.occurredOn}>
          <DateInput
            name="occurredOn"
            max={today}
            defaultValue={text(state, 'occurredOn', note?.occurredOn ?? today)}
          />
        </Field>
        <Field id="criterionId" label="Kryterium" optional error={fieldErrors.criterionId}>
          <Select
            name="criterionId"
            defaultValue={text(state, 'criterionId', note?.criterionId ?? '')}
          >
            <option value="">Bez kryterium</option>
            {criteria.map((criterion) => (
              <option key={criterion.id} value={criterion.id}>
                {criterion.name}
              </option>
            ))}
          </Select>
        </Field>
        {kind === 'workload_fact' ? null : (
          <RadioGroup
            name="sign"
            legend="Wydźwięk"
            options={signOptions}
            inline
            defaultValue={text(state, 'sign', note?.sign ?? '')}
            error={fieldErrors.sign}
          />
        )}
        <Checkbox
          id="communicated"
          name="communicated"
          value="1"
          label="Przekazano pracownikowi"
          defaultChecked={
            submitted ? state.values.communicated === '1' : (note?.communicated ?? false)
          }
          error={fieldErrors.communicated}
        />
        <Field
          id="body"
          label="Treść notatki"
          hint="Opisz zachowanie i sytuację z datą. Nie wpisuj danych o zdrowiu, rodzinie ani wyznaniu."
          error={fieldErrors.body}
        >
          <Textarea
            key={bodyVersion}
            name="body"
            rows={6}
            maxLength={BODY_MAX}
            showCount
            value={body}
            onChange={(event) => {
              changeBody(event.target.value);
            }}
          />
        </Field>
        {inserted ? (
          <p role="status" className="max-w-[70ch]">
            Wstawiono propozycję do treści notatki. Przeczytaj ją i zapisz notatkę.
          </p>
        ) : null}

        <WhoSees visibility={visibility} retentionMonths={retentionMonths} />

        {checking ? (
          <div className="grid gap-4">
            <PixelLoader label="Sprawdzam treść pod kątem danych wrażliwych" />
            {guardState.phase === 'checking' && guardState.keywordWarnings.length > 0 ? (
              <Notice tone="warning" title="Notatka może zawierać dane wrażliwe">
                <WarningList warnings={guardState.keywordWarnings} />
              </Notice>
            ) : null}
            {guardState.phase === 'checking' ? (
              <div>
                <Button variant="secondary" onClick={guard.skipAi}>
                  Zapisz bez czekania na AI
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!checking && reviewWarnings ? (
          <div className="grid gap-6">
            <Notice tone="warning" title="Notatka może zawierać dane wrażliwe" role="status">
              <p className="max-w-[70ch]">
                Usuń z treści dane o zdrowiu, rodzinie albo wyznaniu. Jeśli fragment nie jest daną
                wrażliwą, potwierdź zapis bez zmian.
              </p>
              <WarningList warnings={reviewWarnings} />
              {aiNoteTexts[aiNote] ? (
                <p className="text-ink-muted mt-2">{aiNoteTexts[aiNote]}</p>
              ) : null}
            </Notice>
            {rewrite ? (
              <AiSuggestion
                title="Propozycja treści bez danych wrażliwych"
                actions={
                  editedProposal === null ? (
                    <>
                      <Button
                        variant="secondary"
                        aria-disabled={deciding || undefined}
                        onClick={() => void decide('accepted')}
                      >
                        Wstaw propozycję
                      </Button>
                      <Button
                        variant="secondary"
                        aria-disabled={deciding || undefined}
                        onClick={() => {
                          setEditedProposal(rewrite.text);
                        }}
                      >
                        Popraw propozycję
                      </Button>
                      <Button
                        variant="secondary"
                        aria-disabled={deciding || undefined}
                        onClick={() => void decide('rejected')}
                      >
                        Odrzuć propozycję
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        aria-disabled={deciding || undefined}
                        onClick={() => {
                          const finalText = editedProposal.trim();
                          if (finalText !== '') void decide('edited', finalText);
                        }}
                      >
                        Wstaw poprawioną wersję
                      </Button>
                      <Button
                        variant="link"
                        onClick={() => {
                          setEditedProposal(null);
                        }}
                      >
                        Wróć do propozycji
                      </Button>
                    </>
                  )
                }
              >
                {editedProposal === null ? (
                  <p className="max-w-[70ch] whitespace-pre-line">{rewrite.text}</p>
                ) : (
                  <Field id="editedProposal" label="Poprawiona propozycja">
                    <Textarea
                      rows={6}
                      maxLength={BODY_MAX}
                      showCount
                      value={editedProposal}
                      onChange={(event) => {
                        setEditedProposal(event.target.value);
                      }}
                    />
                  </Field>
                )}
              </AiSuggestion>
            ) : null}
            <Checkbox
              id="confirmRisk"
              name="confirmRisk"
              value="1"
              label="Rozumiem ryzyko, zapisz notatkę bez zmian"
              error={fieldErrors.confirmRisk}
            />
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {!checking && reviewWarnings ? (
              <SubmitButton pendingLabel="Zapisuję notatkę" name="acceptWarnings" value="1">
                Zapisz mimo ostrzeżeń
              </SubmitButton>
            ) : !checking ? (
              <Button
                aria-disabled={isPending || undefined}
                onClick={() => {
                  if (!isPending) save();
                }}
              >
                {isPending
                  ? 'Zapisuję notatkę'
                  : note
                    ? 'Zapisz zmiany w notatce'
                    : 'Zapisz notatkę'}
              </Button>
            ) : null}
            {note || returnTo !== routes.notes ? (
              <Link
                href={returnTo}
                className="font-heading text-link leading-[normal] font-medium underline"
              >
                Wróć bez zapisywania
              </Link>
            ) : null}
          </div>
          {aiEnabled ? null : (
            <p className="text-ink-muted max-w-[70ch] text-[0.9375rem]">
              AI jest wyłączone w ustawieniach urzędu. Treść sprawdzi tylko słownik.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

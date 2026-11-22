'use client';

import { useActionState, useState } from 'react';
import {
  Checkbox,
  DateInput,
  ErrorSummary,
  Field,
  Notice,
  RadioGroup,
  Section,
  Select,
  SubmitButton,
  TextInput,
} from '@sarmata/ui';
import {
  type EndEmploymentState,
  addArchivedEvaluation,
  endEmployment,
} from '@/app/(app)/pracownicy/[id]/actions';
import { useErrorTitle } from '@/components/use-error-title';
import { pluralPl } from '@/lib/format';
import { type FormState } from '@/lib/form-action';
import { routes } from '@/lib/routes';

export interface HrActionsProps {
  employeeId: string;
  /** Today in Warsaw (`rrrr-mm-dd`), the latest date the pickers allow. */
  today: string;
  levels: readonly { code: string; name: string }[];
  scale: readonly { points: number; name: string }[];
  /** Mandatory criteria of the sheet of this person, for the optional partial ratings. */
  criteria: readonly { id: string; name: string }[];
  /** `dd.mm.rrrr` of the end of the employment, null while the person works here. */
  employmentEndedOn: string | null;
}

const OUTCOMES = [
  { value: 'positive', label: 'Pozytywna' },
  { value: 'negative', label: 'Negatywna' },
] as const;

const subheading = 'text-ink text-[1.375rem] leading-[normal] font-semibold';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function text(state: FormState, name: string): string {
  const value = state.values[name];
  return typeof value === 'string' ? value : '';
}

/** Errors in the order of the controls, the error summary lists them top to bottom. */
function summaryItems(
  state: FormState,
  order: readonly string[],
): { fieldId: string; message: string }[] {
  const known = new Set(order);
  const keys = [...order, ...Object.keys(state.fieldErrors).filter((key) => !known.has(key))];
  return keys.flatMap((key) => {
    const message = state.fieldErrors[key];
    return message ? [{ fieldId: key, message }] : [];
  });
}

/** A new key on every answer of the action, so the form shows the values that came back. */
function useFormVersion(state: unknown): number {
  const [shown, setShown] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shown) {
    setShown(state);
    setVersion((current) => current + 1);
  }
  return version;
}

const initialArchived: FormState = { values: {}, fieldErrors: {} };

function ArchivedEvaluationForm({ employeeId, today, levels, scale, criteria }: HrActionsProps) {
  const [state, formAction] = useActionState(addArchivedEvaluation, initialArchived);
  const version = useFormVersion(state);
  const order = [
    'draftedOn',
    'acquaintedOn',
    'levelCode',
    'outcome',
    ...criteria.map((criterion) => `rating-${criterion.id}`),
  ];
  const errors = summaryItems(state, order);
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const { fieldErrors } = state;

  return (
    <div className="grid gap-6">
      <h3 className={subheading}>Wpisz ocenę archiwalną</h3>
      {hasErrors ? (
        <ErrorSummary title="Popraw ocenę archiwalną" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      {state.ok ? (
        <Notice tone="success" role="status">
          <p>Zapisano ocenę archiwalną.</p>
        </Notice>
      ) : null}
      {levels.length === 0 ? (
        <Notice tone="warning">
          <p>Nie udało się wczytać skali ocen. Odśwież stronę później.</p>
        </Notice>
      ) : (
        <form key={version} action={formAction} noValidate className="grid max-w-[40rem] gap-6">
          <input type="hidden" name="employeeId" value={employeeId} />
          <Field id="draftedOn" label="Data sporządzenia" error={fieldErrors.draftedOn}>
            <DateInput name="draftedOn" max={today} defaultValue={text(state, 'draftedOn')} />
          </Field>
          <Field
            id="acquaintedOn"
            label="Data zapoznania"
            optional
            error={fieldErrors.acquaintedOn}
          >
            <DateInput name="acquaintedOn" max={today} defaultValue={text(state, 'acquaintedOn')} />
          </Field>
          <Field id="levelCode" label="Poziom oceny" error={fieldErrors.levelCode}>
            <Select
              name="levelCode"
              className="max-w-[24rem]"
              defaultValue={text(state, 'levelCode')}
            >
              <option value="">Nie wybrano</option>
              {levels.map((level) => (
                <option key={level.code} value={level.code}>
                  {capitalize(level.name)}
                </option>
              ))}
            </Select>
          </Field>
          <RadioGroup
            name="outcome"
            legend="Wynik"
            options={OUTCOMES}
            inline
            defaultValue={text(state, 'outcome') || null}
            error={fieldErrors.outcome}
          />
          {criteria.length > 0 ? (
            <fieldset className="grid gap-6">
              <legend className="font-heading text-ink mb-2 text-lg leading-[normal] font-semibold">
                Oceny cząstkowe <span className="font-normal">(opcjonalnie)</span>
              </legend>
              {criteria.map((criterion) => {
                const id = `rating-${criterion.id}`;
                return (
                  <Field key={id} id={id} label={criterion.name} error={fieldErrors[id]}>
                    <Select name={id} className="max-w-[24rem]" defaultValue={text(state, id)}>
                      <option value="">Bez oceny</option>
                      {scale.map((level) => (
                        <option key={level.points} value={String(level.points)}>
                          {level.points}, {level.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                );
              })}
            </fieldset>
          ) : null}
          <div>
            <SubmitButton pendingLabel="Zapisuję ocenę archiwalną" variant="secondary">
              Zapisz ocenę archiwalną
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

const initialEnd: EndEmploymentState = { values: {}, fieldErrors: {} };
const END_ORDER = ['endedOn', 'reason', 'confirm'];

function evaluations(n: number): string {
  return `${n} ${pluralPl(n, 'otwartą ocenę', 'otwarte oceny', 'otwartych ocen')}`;
}

function EndEmploymentResultNotice({
  result,
}: {
  result: NonNullable<EndEmploymentState['result']>;
}) {
  const interrupted = result.interruptedEvaluationIds.length;
  const led = result.openAsEvaluator;
  return (
    <Notice tone="success" title="Zakończono zatrudnienie" role="status">
      <p className="max-w-[70ch]">
        {interrupted > 0
          ? `Przerwano ${evaluations(interrupted)} tej osoby.`
          : 'Ta osoba nie miała otwartych ocen.'}
      </p>
      {led > 0 ? (
        <p className="mt-2 max-w-[70ch]">
          Ta osoba prowadzi {evaluations(led)}. Zmień oceniającego w{' '}
          {led === 1 ? 'tej sprawie' : 'tych sprawach'}.
        </p>
      ) : null}
    </Notice>
  );
}

function EndEmploymentForm({ employeeId, today, employmentEndedOn }: HrActionsProps) {
  const [state, formAction] = useActionState(endEmployment, initialEnd);
  const version = useFormVersion(state);
  const errors = summaryItems(state, END_ORDER);
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const { fieldErrors } = state;

  return (
    <div className="grid gap-6">
      <h3 className={subheading}>Ustanie zatrudnienia</h3>
      {state.result ? <EndEmploymentResultNotice result={state.result} /> : null}
      {employmentEndedOn !== null ? (
        <div className="grid gap-2">
          <p className="leading-6">Zatrudnienie ustało {employmentEndedOn}.</p>
          <p>
            <a
              href={routes.employeeArchive(employeeId)}
              aria-describedby="employee-archive-hint"
              className="font-heading text-link leading-[normal] font-medium underline"
            >
              Pobierz archiwum teczek (ZIP)
            </a>
          </p>
          <p id="employee-archive-hint" className="text-ink-muted text-[0.9375rem] leading-[1.4]">
            Archiwum zawiera teczki wszystkich ocen tej osoby.
          </p>
        </div>
      ) : state.result ? null : (
        <>
          {hasErrors ? (
            <ErrorSummary title="Popraw dane ustania zatrudnienia" errors={errors}>
              {state.formError}
            </ErrorSummary>
          ) : null}
          <form key={version} action={formAction} noValidate className="grid max-w-[40rem] gap-6">
            <input type="hidden" name="employeeId" value={employeeId} />
            <Field id="endedOn" label="Data ustania zatrudnienia" error={fieldErrors.endedOn}>
              <DateInput name="endedOn" max={today} defaultValue={text(state, 'endedOn')} />
            </Field>
            <Field id="reason" label="Przyczyna" error={fieldErrors.reason}>
              <TextInput name="reason" autoComplete="off" defaultValue={text(state, 'reason')} />
            </Field>
            <Checkbox
              id="confirm"
              name="confirm"
              value="1"
              defaultChecked={text(state, 'confirm') === '1'}
              label="Rozumiem, że otwarte oceny tej osoby zostaną przerwane, a konto straci dostęp."
              error={fieldErrors.confirm}
            />
            <div>
              <SubmitButton pendingLabel="Kończę zatrudnienie" variant="danger">
                Zakończ zatrudnienie
              </SubmitButton>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

/** Sprawy kadrowe: hr enters an archived evaluation and marks the end of the employment. */
export function HrActions(props: HrActionsProps) {
  return (
    <Section title="Sprawy kadrowe">
      <div className="grid gap-10">
        <ArchivedEvaluationForm {...props} />
        <div className="border-rule border-t pt-8">
          <EndEmploymentForm {...props} />
        </div>
      </div>
    </Section>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Checkbox,
  DateInput,
  ErrorSummary,
  Field,
  Notice,
  RadioGroup,
  type RadioOption,
  Select,
  SubmitButton,
  TextInput,
} from '@sarmata/ui';
import { createEmployee, type NewEmployeeState } from '@/app/(app)/pracownicy/nowy/actions';
import { useErrorTitle } from '@/components/use-error-title';
import { routes } from '@/lib/routes';
import { useFormRound } from '@/lib/use-form-round';

export interface NewEmployeeChoices {
  positionKind: readonly RadioOption[];
  serviceStatus: readonly RadioOption[];
  employmentBasis: readonly RadioOption[];
  grades: readonly { value: string; label: string }[];
  /** Employees of the office to pick the supervisor from, `null` when the role cannot set one. */
  supervisors: readonly { value: string; label: string }[] | null;
}

/** Order of the controls on the page, so the error summary lists them top to bottom. */
const FIELD_ORDER = [
  'firstName',
  'lastName',
  'email',
  'positionTitle',
  'orgUnit',
  'positionKind',
  'serviceStatus',
  'employmentBasis',
  'employmentStart',
  'appointmentYear',
  'grade',
  'gradeGrantedOn',
  'supervisorEmployeeId',
  'confirmDistinct',
];

const initialState: NewEmployeeState = { values: {}, fieldErrors: {} };

function text(state: NewEmployeeState, name: string, fallback = ''): string {
  const value = state.values[name];
  return typeof value === 'string' ? value : fallback;
}

/** Errors in page order, one summary line per message (the civil servant rule hits three fields). */
function summaryItems(state: NewEmployeeState): { fieldId: string; message: string }[] {
  const seen = new Set<string>();
  const known = new Set(FIELD_ORDER);
  const keys = [...FIELD_ORDER, ...Object.keys(state.fieldErrors).filter((key) => !known.has(key))];
  const items: { fieldId: string; message: string }[] = [];
  for (const key of keys) {
    const message = state.fieldErrors[key];
    if (!message || seen.has(message)) continue;
    seen.add(message);
    items.push({ fieldId: key, message });
  }
  return items;
}

/** Form of a new employee record (`/pracownicy/nowy`). Typed values stay after every error. */
export function NewEmployeeForm({ choices }: { choices: NewEmployeeChoices }) {
  // Each answer of the action remounts the form (`key={state.round}`), so the defaults show what was sent.
  const [state, formAction] = useFormRound(createEmployee, initialState);

  const errors = summaryItems(state);
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const { fieldErrors } = state;
  const similar = state.similar ?? [];

  // The remount drops the focused submit button. Without an error summary to take the focus, the
  // similar person warning takes it, so the question is read out and focus stays in the form.
  const similarRef = useRef<HTMLDivElement>(null);
  const askSimilar = similar.length > 0 && !hasErrors;
  useEffect(() => {
    if (askSimilar) similarRef.current?.focus();
  }, [askSimilar, state]);

  return (
    <div className="grid gap-8">
      {hasErrors ? (
        <ErrorSummary title="Popraw dane pracownika" errors={errors} focusKey={state}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form key={state.round} action={formAction} noValidate className="grid max-w-[40rem] gap-8">
        <Field id="firstName" label="Imię" error={fieldErrors.firstName}>
          <TextInput name="firstName" autoComplete="off" defaultValue={text(state, 'firstName')} />
        </Field>
        <Field id="lastName" label="Nazwisko" error={fieldErrors.lastName}>
          <TextInput name="lastName" autoComplete="off" defaultValue={text(state, 'lastName')} />
        </Field>
        <Field id="email" label="Adres e-mail" optional error={fieldErrors.email}>
          <TextInput
            name="email"
            type="email"
            autoComplete="off"
            spellCheck={false}
            defaultValue={text(state, 'email')}
          />
        </Field>
        <Field id="positionTitle" label="Stanowisko" optional error={fieldErrors.positionTitle}>
          <TextInput name="positionTitle" defaultValue={text(state, 'positionTitle')} />
        </Field>
        <Field id="orgUnit" label="Komórka organizacyjna" optional error={fieldErrors.orgUnit}>
          <TextInput name="orgUnit" defaultValue={text(state, 'orgUnit')} />
        </Field>
        <RadioGroup
          name="positionKind"
          legend="Rodzaj stanowiska"
          hint="Od niego zależy arkusz oceny okresowej."
          options={choices.positionKind}
          defaultValue={text(state, 'positionKind', 'other')}
          error={fieldErrors.positionKind}
        />
        <RadioGroup
          name="serviceStatus"
          legend="Status w służbie cywilnej"
          options={choices.serviceStatus}
          defaultValue={text(state, 'serviceStatus', 'employee')}
          error={fieldErrors.serviceStatus}
        />
        <RadioGroup
          name="employmentBasis"
          legend="Podstawa zatrudnienia"
          options={choices.employmentBasis}
          defaultValue={text(state, 'employmentBasis', 'indefinite')}
          error={fieldErrors.employmentBasis}
        />
        <Field
          id="employmentStart"
          label="Data rozpoczęcia pracy w urzędzie"
          optional
          error={fieldErrors.employmentStart}
        >
          <DateInput name="employmentStart" defaultValue={text(state, 'employmentStart')} />
        </Field>
        <fieldset className="border-rule grid gap-6 border-t pt-6">
          <legend className="font-heading text-ink pr-3 text-[1.375rem] leading-[normal] font-semibold">
            Tylko dla urzędnika służby cywilnej
          </legend>
          <Field
            id="appointmentYear"
            label="Rok mianowania"
            optional
            error={fieldErrors.appointmentYear}
          >
            <TextInput
              name="appointmentYear"
              inputMode="numeric"
              autoComplete="off"
              className="max-w-[8rem]"
              defaultValue={text(state, 'appointmentYear')}
            />
          </Field>
          <Field id="grade" label="Stopień służbowy" optional error={fieldErrors.grade}>
            <Select name="grade" className="max-w-[15rem]" defaultValue={text(state, 'grade')}>
              <option value="">Nie wybrano</option>
              {choices.grades.map((grade) => (
                <option key={grade.value} value={grade.value}>
                  {grade.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="gradeGrantedOn"
            label="Data nadania stopnia"
            optional
            error={fieldErrors.gradeGrantedOn}
          >
            <DateInput name="gradeGrantedOn" defaultValue={text(state, 'gradeGrantedOn')} />
          </Field>
        </fieldset>
        {choices.supervisors ? (
          <Field
            id="supervisorEmployeeId"
            label="Osoba przełożona"
            hint="Osoba przełożona z kontem w Sarmacie domyślnie prowadzi ocenę okresową."
            optional
            error={fieldErrors.supervisorEmployeeId}
          >
            <Select name="supervisorEmployeeId" defaultValue={text(state, 'supervisorEmployeeId')}>
              <option value="">Brak osoby przełożonej</option>
              {choices.supervisors.map((supervisor) => (
                <option key={supervisor.value} value={supervisor.value}>
                  {supervisor.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {similar.length > 0 ? (
          <div ref={similarRef} tabIndex={-1} className="outline-none">
            <Notice tone="warning" title="Czy to ta osoba?" role="status">
              <p className="max-w-[70ch]">
                W aktach jest już ktoś o podobnym imieniu i nazwisku. Otwórz kartę, żeby sprawdzić,
                czy nie dodajesz tej samej osoby drugi raz.
              </p>
              <ul className="mt-3 grid gap-2">
                {similar.map((person) => (
                  <li key={person.id}>
                    <Link
                      href={routes.employee(person.id)}
                      className="font-heading text-link font-semibold underline"
                    >
                      {person.name}
                    </Link>
                    {person.position ? <span>, {person.position}</span> : null}
                  </li>
                ))}
              </ul>
              <Checkbox
                id="confirmDistinct"
                name="confirmDistinct"
                value="1"
                label="To inna osoba, dodaj nowy rekord"
                defaultChecked={state.values.confirmDistinct === '1'}
                error={fieldErrors.confirmDistinct}
                className="mt-4"
              />
            </Notice>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <SubmitButton pendingLabel="Dodaję pracownika">Dodaj pracownika</SubmitButton>
          <Link
            href={routes.employees}
            className="font-heading text-link leading-[normal] font-medium underline"
          >
            Wróć do listy pracowników
          </Link>
        </div>
      </form>
    </div>
  );
}

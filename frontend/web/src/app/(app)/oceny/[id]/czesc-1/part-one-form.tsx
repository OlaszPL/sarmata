'use client';

import { useActionState } from 'react';
import {
  Checkbox,
  DateInput,
  ErrorSummary,
  Field,
  FieldError,
  FieldHint,
  Notice,
  SubmitButton,
  TextInput,
  describedBy,
} from '@sarmata/ui';
import { ErrorTitle } from '@/components/evaluations/error-title';
import { type FormState, type FormValues } from '@/lib/form-action';

type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;

interface Item {
  fieldId: string;
  message: string;
}

/** One posted value as text, the first one of a repeated name. */
export function textValue(values: FormValues, key: string): string {
  const value = values[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function listValue(values: FormValues, key: string): string[] {
  const value = values[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Fields of the form top to bottom, so the error summary lists them in reading order. */
const FIELD_ORDER = ['additionalCriteria', 'dueOn', 'startingInterviewOn', 'place', 'signedOn'];

const rank = (fieldId: string): number => {
  const index = FIELD_ORDER.indexOf(fieldId);
  return index === -1 ? FIELD_ORDER.length : index;
};

/** Error summary items of a form state, in the order of the fields on the page. */
export function errorItems(state: FormState): Item[] {
  return Object.entries(state.fieldErrors)
    .flatMap(([fieldId, message]) => (message ? [{ fieldId, message }] : []))
    .sort((a, b) => rank(a.fieldId) - rank(b.fieldId));
}

interface PartOneFormProps {
  action: FormAction;
  initial: FormState;
  mandatory: readonly { id: string; name: string }[];
  /** Catalog criteria that may be chosen as additional ones. */
  options: readonly { id: string; name: string }[];
  additionalMin: number;
  additionalMax: number;
  /** Latest due date as `rrrr-mm-dd` for the date field and as `dd.mm.rrrr` for the hint. */
  latestDueOn: string | null;
  latestDueOnText: string | null;
  /** Last day of the starting interview as `dd.mm.rrrr`. */
  startingInterviewDueText: string | null;
  /** Gates of the saved part I, shown until the form is sent. */
  pendingIssues: readonly Item[];
}

/** Part I of the sheet: additional criteria, due date and the approval with the starting interview. */
export function PartOneForm({
  action,
  initial,
  mandatory,
  options,
  additionalMin,
  additionalMax,
  latestDueOn,
  latestDueOnText,
  startingInterviewDueText,
  pendingIssues,
}: PartOneFormProps) {
  const [state, formAction] = useActionState(action, initial);
  const items = errorItems(state);
  const hasErrors = items.length > 0 || state.formError !== undefined;
  const chosen = new Set(listValue(state.values, 'additionalCriteria'));
  const criteriaError = state.fieldErrors.additionalCriteria;
  const criteriaHint = `Wybierz od ${additionalMin} do ${additionalMax} z katalogu.`;
  const saved = state.ok === true && textValue(state.values, 'intent') === 'save';

  return (
    <div className="flex flex-col gap-8">
      <ErrorTitle active={hasErrors} />
      {hasErrors ? (
        <ErrorSummary title="Popraw część I" errors={items}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      {saved ? (
        <Notice tone="success" role="status">
          Zapisano część I.
        </Notice>
      ) : null}
      {!hasErrors && pendingIssues.length > 0 ? (
        <Notice tone="warning" title="Przed zatwierdzeniem popraw część I">
          <ul className="flex flex-col gap-1">
            {pendingIssues.map((issue) => (
              <li key={`${issue.fieldId}:${issue.message}`}>
                <a href={`#${issue.fieldId}`} className="text-link underline">
                  {issue.message}
                </a>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <form action={formAction} noValidate className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-ink text-base leading-[normal] font-semibold">
            Kryteria obowiązkowe
          </h3>
          <p className="text-ink-muted max-w-[70ch] text-[0.9375rem] leading-[1.4]">
            Wynikają z arkusza i nie można ich zmienić.
          </p>
          <ul className="border-rule border-t">
            {mandatory.map((criterion) => (
              <li key={criterion.id} className="border-rule border-b py-2.5 leading-[1.5]">
                {criterion.name}
              </li>
            ))}
          </ul>
        </div>

        <fieldset
          className={`grid gap-2 ${criteriaError ? 'border-error border-l-[0.3125rem] pl-4' : ''}`}
          aria-describedby={describedBy('additionalCriteria', {
            hint: criteriaHint,
            error: criteriaError,
          })}
        >
          <legend className="font-heading text-ink mb-2 text-base leading-[normal] font-semibold">
            Kryteria dodatkowe
          </legend>
          <FieldHint id="additionalCriteria">{criteriaHint}</FieldHint>
          {criteriaError ? <FieldError id="additionalCriteria">{criteriaError}</FieldError> : null}
          <div className="grid gap-3 md:grid-cols-2 md:gap-x-8">
            {options.map((criterion, index) => (
              <Checkbox
                key={criterion.id}
                id={index === 0 ? 'additionalCriteria' : `additionalCriteria-${criterion.id}`}
                name="additionalCriteria"
                value={criterion.id}
                label={criterion.name}
                defaultChecked={chosen.has(criterion.id)}
                aria-invalid={criteriaError ? true : undefined}
              />
            ))}
          </div>
        </fieldset>

        <Field
          id="dueOn"
          label="Termin oceny"
          optional
          hint={
            latestDueOnText
              ? `Najpóźniej ${latestDueOnText}. Możesz go tylko skrócić. Puste pole oznacza termin z przepisów.`
              : 'Możesz go tylko skrócić. Puste pole oznacza termin z przepisów.'
          }
          error={state.fieldErrors.dueOn}
        >
          <DateInput
            name="dueOn"
            defaultValue={textValue(state.values, 'dueOn')}
            max={latestDueOn ?? undefined}
          />
        </Field>

        <Field
          id="startingInterviewOn"
          label="Data rozmowy rozpoczynającej"
          hint={
            startingInterviewDueText ? `Przeprowadź ją do ${startingInterviewDueText}.` : undefined
          }
          error={state.fieldErrors.startingInterviewOn}
        >
          <DateInput
            name="startingInterviewOn"
            defaultValue={textValue(state.values, 'startingInterviewOn')}
          />
        </Field>

        <Field id="place" label="Miejscowość" optional error={state.fieldErrors.place}>
          <TextInput
            name="place"
            autoComplete="address-level2"
            defaultValue={textValue(state.values, 'place')}
            className="max-w-[25rem]"
          />
        </Field>

        <div className="flex flex-wrap gap-4">
          <SubmitButton name="intent" value="approve" pendingLabel="Trwa zatwierdzanie">
            Zatwierdź część I
          </SubmitButton>
          <SubmitButton
            name="intent"
            value="save"
            variant="secondary"
            pendingLabel="Trwa zapisywanie"
          >
            Zapisz bez zatwierdzania
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

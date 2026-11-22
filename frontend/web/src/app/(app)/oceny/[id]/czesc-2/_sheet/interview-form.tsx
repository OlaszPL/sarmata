'use client';

import { useActionState } from 'react';
import { DateInput, ErrorSummary, Field, Section, SubmitButton } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { recordInterview } from '../actions';

/** Records the date of the evaluation interview, which opens the sheet for the interview stage. */
export function InterviewForm({ id, today }: { id: string; today: string }) {
  const initial: FormState = { values: {}, fieldErrors: {} };
  const [state, action] = useActionState(recordInterview.bind(null, id), initial);
  const errors = Object.entries(state.fieldErrors).flatMap(([fieldId, message]) =>
    message === undefined ? [] : [{ fieldId, message }],
  );
  const hasErrors = errors.length > 0 || state.formError !== undefined;
  useErrorTitle(hasErrors);
  const heldOn = state.values.heldOn;

  return (
    <Section title="Rozmowa oceniająca" titleLevel={3} tone="band" id="interview">
      <form action={action} noValidate className="flex flex-col gap-4">
        {hasErrors ? (
          <ErrorSummary title="Nie udało się odnotować rozmowy" errors={errors}>
            {state.formError}
          </ErrorSummary>
        ) : null}
        <p className="max-w-[70ch]">Odnotuj datę rozmowy, żeby wypełnić i zatwierdzić część II.</p>
        <Field id="heldOn" label="Data rozmowy oceniającej" error={state.fieldErrors.heldOn}>
          <DateInput name="heldOn" defaultValue={typeof heldOn === 'string' ? heldOn : today} />
        </Field>
        <div>
          <SubmitButton pendingLabel="Zapisuję">Odnotuj rozmowę oceniającą</SubmitButton>
        </div>
      </form>
    </Section>
  );
}

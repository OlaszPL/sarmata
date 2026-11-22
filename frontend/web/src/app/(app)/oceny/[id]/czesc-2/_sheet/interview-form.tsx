'use client';

import { useActionState } from 'react';
import { DateInput, ErrorSummary, Field, Section } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { recordInterview } from '../actions';
import { PendingSubmit, useSubmitAfterFlush } from './sheet-save-context';

/** Records the date of the evaluation interview, which opens the sheet for the interview stage. */
export function InterviewForm({ id, today }: { id: string; today: string }) {
  const initial: FormState = { values: {}, fieldErrors: {} };
  const [state, action, actionPending] = useActionState(recordInterview.bind(null, id), initial);
  // A sheet change typed just before this click is saved first, then the interview is recorded.
  const { onSubmit, pending } = useSubmitAfterFlush(action, actionPending);
  const errors = Object.entries(state.fieldErrors).flatMap(([fieldId, message]) =>
    message === undefined ? [] : [{ fieldId, message }],
  );
  const hasErrors = errors.length > 0 || state.formError !== undefined;
  useErrorTitle(hasErrors);
  const heldOn = state.values.heldOn;

  return (
    <Section title="Rozmowa oceniająca" titleLevel={3} tone="band" id="interview">
      <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
          <PendingSubmit pending={pending} pendingLabel="Zapisuję">
            Odnotuj rozmowę oceniającą
          </PendingSubmit>
        </div>
      </form>
    </Section>
  );
}

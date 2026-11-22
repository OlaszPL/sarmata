'use client';

import { useActionState } from 'react';
import { DateInput, ErrorSummary, Field, Notice, SubmitButton } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { recordAppeal } from './actions';

/** Appeal forms of several cases share a page, so the date control id carries the evaluation. */
export function AppealForm({
  evaluationId,
  employeeName,
}: {
  evaluationId: string;
  employeeName: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(recordAppeal, {
    values: {},
    fieldErrors: {},
  });
  const dateId = `filedOn-${evaluationId}`;
  const dateError = state.fieldErrors.filedOn;
  const otherErrors = Object.entries(state.fieldErrors).flatMap(([key, message]) =>
    message && key !== 'filedOn' ? [message] : [],
  );
  const formErrors = [...(state.formError ? [state.formError] : []), ...otherErrors];
  const errors = dateError ? [{ fieldId: dateId, message: dateError }] : [];
  const failed = errors.length > 0 || formErrors.length > 0;
  useErrorTitle(failed);

  const filedOn = state.ok
    ? ''
    : typeof state.values.filedOn === 'string'
      ? state.values.filedOn
      : '';

  return (
    <form action={formAction} noValidate className="grid max-w-[46rem] gap-5">
      <h3 className="font-heading text-xl font-semibold">Zapisz odwołanie: {employeeName}</h3>
      {state.ok ? (
        <Notice tone="success" role="status">
          Zapisano wpis w rejestrze.
        </Notice>
      ) : null}
      {failed ? (
        <ErrorSummary title="Nie udało się zapisać odwołania" errors={errors}>
          {formErrors.length > 0 ? (
            <div className="grid max-w-[70ch] gap-1">
              {formErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}
        </ErrorSummary>
      ) : null}
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <Field id={dateId} label="Data wniesienia odwołania" error={dateError}>
        <DateInput name="filedOn" defaultValue={filedOn} />
      </Field>
      <div>
        <SubmitButton variant="secondary" pendingLabel="Trwa zapisywanie">
          Zapisz odwołanie
        </SubmitButton>
      </div>
    </form>
  );
}

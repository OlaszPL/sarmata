'use client';

import { useActionState } from 'react';
import { ErrorSummary, SubmitButton } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { saveGradeRequest } from '../actions';

/**
 * Removes a saved grade request that the evaluation no longer allows (e.g. the outcome turned
 * negative), which would otherwise block the approval. The button has the id `gradeRequest`, the
 * target of the gate link on the check page.
 */
export function RemoveGradeRequestForm({ id }: { id: string }) {
  const initial: FormState = { values: {}, fieldErrors: {} };
  const [state, action] = useActionState(saveGradeRequest.bind(null, id), initial);
  const errors = Object.entries(state.fieldErrors).flatMap(([fieldId, message]) =>
    message === undefined ? [] : [{ fieldId, message }],
  );
  const hasErrors = errors.length > 0 || state.formError !== undefined;
  useErrorTitle(hasErrors);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {hasErrors ? (
        <ErrorSummary title="Nie udało się usunąć wniosku" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <p className="max-w-[70ch]">
        W arkuszu jest zapisany wniosek o stopień. Usuń go, żeby zatwierdzić ocenę.
      </p>
      <input type="hidden" name="request" value="no" />
      <div id="gradeRequest" tabIndex={-1} className="outline-offset-4">
        <SubmitButton variant="secondary" pendingLabel="Usuwam">
          Usuń wniosek o stopień
        </SubmitButton>
      </div>
    </form>
  );
}

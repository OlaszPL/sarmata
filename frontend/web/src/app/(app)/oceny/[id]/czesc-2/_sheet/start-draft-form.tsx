'use client';

import { useActionState } from 'react';
import { Notice, SubmitButton } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { startSheetDraft } from '../actions';

/** Button that starts a draft run. A failed start shows its message and the button stays. */
export function StartDraftForm({ id, label }: { id: string; label: string }) {
  const [state, action] = useActionState<FormState, FormData>(startSheetDraft.bind(null, id), {
    values: {},
    fieldErrors: {},
  });
  useErrorTitle(state.formError !== undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.formError ? (
        <Notice tone="error" role="alert">
          <p>{state.formError}</p>
        </Notice>
      ) : null}
      <div>
        <SubmitButton variant="secondary" pendingLabel="Uruchamiam AI">
          {label}
        </SubmitButton>
      </div>
    </form>
  );
}

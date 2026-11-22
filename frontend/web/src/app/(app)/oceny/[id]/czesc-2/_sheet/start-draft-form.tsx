'use client';

import { useActionState } from 'react';
import { Notice } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { startSheetDraft } from '../actions';
import { PendingSubmit, useSubmitAfterFlush } from './sheet-save-context';

/** Button that starts a draft run. A failed start shows its message and the button stays. */
export function StartDraftForm({ id, label }: { id: string; label: string }) {
  const [state, action, actionPending] = useActionState<FormState, FormData>(
    startSheetDraft.bind(null, id),
    { values: {}, fieldErrors: {} },
  );
  const { onSubmit, pending } = useSubmitAfterFlush(action, actionPending);
  useErrorTitle(state.formError !== undefined);
  return (
    <form action={action} onSubmit={onSubmit} className="flex flex-col gap-3">
      {state.formError ? (
        <Notice tone="error" role="alert">
          <p>{state.formError}</p>
        </Notice>
      ) : null}
      <div>
        <PendingSubmit pending={pending} variant="secondary" pendingLabel="Uruchamiam AI">
          {label}
        </PendingSubmit>
      </div>
    </form>
  );
}

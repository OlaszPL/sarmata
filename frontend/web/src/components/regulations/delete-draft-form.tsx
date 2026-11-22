'use client';

import { useActionState, useState } from 'react';
import { Checkbox, ErrorSummary, SubmitButton } from '@sarmata/ui';
import { type RegulationFormState, deleteDraft } from '@/app/(app)/ustawienia/przepisy/actions';
import { useErrorTitle } from '@/components/use-error-title';

const initialState: RegulationFormState = { values: {}, fieldErrors: {} };

/** Deletes a draft for good, after an explicit confirmation. */
export function DeleteDraftForm({ versionId }: { versionId: string }) {
  const [state, formAction] = useActionState(deleteDraft, initialState);
  // Each answer of the action remounts the form, so the default values show what was sent.
  const [shownState, setShownState] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shownState) {
    setShownState(state);
    setVersion((current) => current + 1);
  }

  const message = state.fieldErrors.confirmDelete;
  const errors = message ? [{ fieldId: 'confirmDelete', message }] : [];
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);

  return (
    <div className="grid gap-8">
      {hasErrors ? (
        <ErrorSummary title="Nie udało się usunąć szkicu" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form key={version} action={formAction} noValidate className="grid max-w-[40rem] gap-6">
        <input type="hidden" name="versionId" value={versionId} />
        <p className="max-w-[70ch]">
          Usunięcie kasuje szkic razem z jego parametrami. Opublikowane wersje zostają bez zmian.
        </p>
        <Checkbox
          id="confirmDelete"
          name="confirmDelete"
          value="1"
          label="Rozumiem, że usunięcia szkicu nie da się cofnąć"
          defaultChecked={state.values.confirmDelete === '1'}
          error={message}
        />
        <div>
          <SubmitButton variant="danger" pendingLabel="Usuwanie">
            Usuń szkic
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

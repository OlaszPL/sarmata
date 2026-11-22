'use client';

import { useActionState, useState } from 'react';
import { Checkbox, DateInput, ErrorSummary, Field, SubmitButton } from '@sarmata/ui';
import { type RegulationFormState, publishVersion } from '@/app/(app)/ustawienia/przepisy/actions';
import { useErrorTitle } from '@/components/use-error-title';

const FIELD_ORDER = ['effectiveFrom', 'acceptFailingCases', 'confirmPublish'];

const initialState: RegulationFormState = { values: {}, fieldErrors: {} };

/** Publication of a draft from a date. Failing worked examples need the acceptance checkbox. */
export function PublishForm({ versionId }: { versionId: string }) {
  const [state, formAction] = useActionState(publishVersion, initialState);
  // Each answer of the action remounts the form, so the default values show what was sent.
  const [shownState, setShownState] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shownState) {
    setShownState(state);
    setVersion((current) => current + 1);
  }

  const errors = FIELD_ORDER.flatMap((fieldId) => {
    const message = state.fieldErrors[fieldId];
    return message ? [{ fieldId, message }] : [];
  });
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const effectiveFrom = state.values.effectiveFrom;

  return (
    <div className="grid gap-8">
      {hasErrors ? (
        <ErrorSummary title="Nie udało się opublikować wersji" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form key={version} action={formAction} noValidate className="grid max-w-[40rem] gap-6">
        <input type="hidden" name="versionId" value={versionId} />
        <Field
          id="effectiveFrom"
          label="Data wejścia w życie"
          hint="Wersja obejmie oceny rozpoczęte od tego dnia. Oceny w toku zostają przy swojej wersji. Data nie może być w przeszłości."
          error={state.fieldErrors.effectiveFrom}
        >
          <DateInput
            name="effectiveFrom"
            defaultValue={typeof effectiveFrom === 'string' ? effectiveFrom : ''}
          />
        </Field>
        <Checkbox
          id="acceptFailingCases"
          name="acceptFailingCases"
          value="1"
          label="Publikuję mimo niezgodnych przypadków testowych"
          hint="Zaznacz tylko wtedy, gdy różnica jest zamierzona. Niezgodne przypadki zostaną zapisane przy wersji."
          defaultChecked={state.values.acceptFailingCases === '1'}
          error={state.fieldErrors.acceptFailingCases}
        />
        <Checkbox
          id="confirmPublish"
          name="confirmPublish"
          value="1"
          label="Rozumiem, że opublikowanej wersji nie można już zmienić ani usunąć"
          defaultChecked={state.values.confirmPublish === '1'}
          error={state.fieldErrors.confirmPublish}
        />
        <div>
          <SubmitButton variant="secondary" pendingLabel="Publikowanie">
            Opublikuj wersję
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

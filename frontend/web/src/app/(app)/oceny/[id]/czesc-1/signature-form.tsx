'use client';

import { useActionState } from 'react';
import { DateInput, ErrorSummary, Field, SubmitButton } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { errorItems, textValue } from './part-one-form';

interface SignatureFormProps {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  initial: FormState;
}

/** Records the day the evaluated person signed the approved part I. */
export function SignatureForm({ action, initial }: SignatureFormProps) {
  const [state, formAction] = useActionState(action, initial);
  const items = errorItems(state);
  const hasErrors = items.length > 0 || state.formError !== undefined;
  useErrorTitle(hasErrors);

  return (
    <div className="flex flex-col gap-8">
      {hasErrors ? (
        <ErrorSummary title="Popraw część I" errors={items}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form action={formAction} noValidate className="flex flex-col gap-8">
        <Field
          id="signedOn"
          label="Data podpisu części I przez osobę ocenianą"
          error={state.fieldErrors.signedOn}
        >
          <DateInput name="signedOn" defaultValue={textValue(state.values, 'signedOn')} />
        </Field>
        <div>
          <SubmitButton pendingLabel="Trwa zapisywanie">Odnotuj podpis części I</SubmitButton>
        </div>
      </form>
    </div>
  );
}

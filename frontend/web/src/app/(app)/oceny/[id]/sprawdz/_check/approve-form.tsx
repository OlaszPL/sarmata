'use client';

import { useActionState } from 'react';
import { DateInput, Field, Notice, SubmitButton, TextInput } from '@sarmata/ui';
import { LinkedErrorSummary } from '@/components/sheet/linked-error-summary';
import { useErrorTitle } from '@/components/use-error-title';
import { fieldErrorLinks } from '@/lib/evaluations/sheet-gates';
import { type FormState } from '@/lib/form-action';
import { approveSheet } from '../actions';

interface ApproveFormProps {
  id: string;
  today: string;
  defaultPlace: string;
}

/** Approval of the sheet: date and place of the evaluation, then the step that cannot be undone. */
export function ApproveForm({ id, today, defaultPlace }: ApproveFormProps) {
  const initial: FormState = { values: {}, fieldErrors: {} };
  const [state, action] = useActionState(approveSheet.bind(null, id), initial);
  const links = fieldErrorLinks(id, state.fieldErrors);
  const hasErrors = links.length > 0 || state.formError !== undefined;
  useErrorTitle(hasErrors);
  const typedDate = state.values.draftedOn;
  const typedPlace = state.values.place;

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {hasErrors ? (
        <LinkedErrorSummary title="Nie udało się zatwierdzić arkusza" items={links} autoFocus>
          {state.formError}
        </LinkedErrorSummary>
      ) : null}
      <Notice tone="warning">
        <p>
          Po zatwierdzeniu nie zmienisz arkusza. Zmiana będzie możliwa tylko przez korektę albo po
          sprzeciwie.
        </p>
      </Notice>
      <Field id="draftedOn" label="Data sporządzenia oceny" error={state.fieldErrors.draftedOn}>
        <DateInput
          name="draftedOn"
          defaultValue={typeof typedDate === 'string' ? typedDate : today}
        />
      </Field>
      <Field id="place" label="Miejscowość" optional error={state.fieldErrors.place}>
        <TextInput
          name="place"
          defaultValue={typeof typedPlace === 'string' ? typedPlace : defaultPlace}
        />
      </Field>
      <div>
        <SubmitButton size="lg" pendingLabel="Zatwierdzam">
          Zatwierdź i przekaż do zapoznania
        </SubmitButton>
      </div>
    </form>
  );
}

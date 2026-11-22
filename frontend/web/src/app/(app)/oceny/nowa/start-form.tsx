'use client';

import { useActionState } from 'react';
import { ErrorSummary, RadioGroup, SubmitButton } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { startEvaluation } from './actions';
import { type SheetOption } from './start-options';

/** Controls of this form an error summary can link to. The employee is a hidden field. */
const LINKED_FIELDS = ['sheetId'];

/** Step 2 of a new evaluation: the sheet and the start, for the employee chosen in step 1. */
export function StartForm({
  employeeId,
  options,
}: {
  employeeId: string;
  options: readonly SheetOption[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(startEvaluation, {
    values: {},
    fieldErrors: {},
  });

  const errors = LINKED_FIELDS.flatMap((fieldId) => {
    const message = state.fieldErrors[fieldId];
    return message ? [{ fieldId, message }] : [];
  });
  const otherErrors = Object.entries(state.fieldErrors).flatMap(([fieldId, message]) =>
    message && !LINKED_FIELDS.includes(fieldId) ? [message] : [],
  );
  const formErrors = [...(state.formError ? [state.formError] : []), ...otherErrors];
  const failed = errors.length > 0 || formErrors.length > 0;
  useErrorTitle(failed);

  const proposed = options.find((option) => option.proposed)?.id ?? null;
  const chosen = typeof state.values.sheetId === 'string' ? state.values.sheetId : proposed;

  return (
    <form action={formAction} noValidate className="grid max-w-[46rem] gap-8">
      {failed ? (
        <ErrorSummary title="Nie udało się rozpocząć oceny" errors={errors}>
          {formErrors.length > 0 ? (
            <div className="grid max-w-[70ch] gap-1">
              {formErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}
        </ErrorSummary>
      ) : null}
      <input type="hidden" name="employeeId" value={employeeId} />
      <RadioGroup
        key={chosen ?? ''}
        name="sheetId"
        id="sheetId"
        legend="Arkusz oceny"
        defaultValue={chosen}
        error={state.fieldErrors.sheetId}
        options={options.map((option) => ({
          value: option.id,
          label: option.label,
          hint: option.proposed ? (
            <>
              <span className="block">{option.hint}</span>
              <span className="font-heading text-ink block font-medium">
                Proponowany dla tego stanowiska
              </span>
            </>
          ) : (
            option.hint
          ),
        }))}
      />
      <div>
        <SubmitButton pendingLabel="Trwa zakładanie oceny">Rozpocznij ocenę</SubmitButton>
      </div>
    </form>
  );
}

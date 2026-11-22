'use client';

import type { ReactNode } from 'react';
import { ErrorSummary } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import type { FormState, FormValues } from '@/lib/form-action';
import { useFormRound } from '@/lib/use-form-round';
import { summaryItems } from './summary-items';

export type CaseAction = (previous: FormState, formData: FormData) => Promise<FormState>;

/** True when the state carries a field error or a form error. */
export function stateHasErrors(state: FormState): boolean {
  return (
    state.formError !== undefined || Object.values(state.fieldErrors).some((message) => !!message)
  );
}

/**
 * The action state of a case form with the flag that tells whether it shows errors. `round` counts
 * the answers: a form with a `<select>` takes `key={round}` so the select shows the sent value again.
 */
export function useCaseForm(
  action: CaseAction,
  initial: FormState,
): {
  state: FormState;
  formAction: (formData: FormData) => void;
  hasErrors: boolean;
  round: number;
} {
  const [state, formAction] = useFormRound(action, initial);
  return { state, formAction, hasErrors: stateHasErrors(state), round: state.round };
}

/** One posted value as text, the first one of a repeated name. */
export function textValue(values: FormValues, key: string): string {
  const value = values[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

interface FormErrorsProps {
  title: string;
  state: FormState;
  /** Field ids top to bottom. */
  fields: readonly string[];
  /** Form key, control ids are `${prefix}-${name}`. */
  prefix: string;
}

/** Page title prefix and error summary of a form. Errors without a control and the form error are listed as text. */
export function FormErrors({ title, state, fields, prefix }: FormErrorsProps): ReactNode {
  const hasErrors = stateHasErrors(state);
  const { linked, unlinked } = summaryItems(state.fieldErrors, fields, prefix);
  useErrorTitle(hasErrors);
  return (
    <>
      {hasErrors ? (
        <ErrorSummary title={title} errors={linked} focusKey={state}>
          {state.formError ? <p>{state.formError}</p> : null}
          {unlinked.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </ErrorSummary>
      ) : null}
    </>
  );
}

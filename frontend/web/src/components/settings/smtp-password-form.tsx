'use client';

import { useActionState } from 'react';
import { ErrorSummary, Field, SubmitButton, TextInput } from '@sarmata/ui';
import { saveSmtpPassword } from '@/app/(app)/ustawienia/actions';
import { FormGroup } from '@/components/settings/form-group';
import { useErrorTitle } from '@/components/use-error-title';
import type { FormState } from '@/lib/form-action';

const initialState: FormState = { values: {}, fieldErrors: {} };

/** Separate form for the SMTP password: it goes to Vault and never comes back to the page. */
export function SmtpPasswordForm({ passwordSet }: { passwordSet: boolean }) {
  const [state, formAction] = useActionState(saveSmtpPassword, initialState);
  const message = state.fieldErrors.smtpPassword;
  const hasErrors = Boolean(message) || Boolean(state.formError);
  useErrorTitle(hasErrors);

  return (
    <FormGroup title="Hasło SMTP">
      <div className="grid grid-cols-1 max-w-[40rem] gap-6">
        {hasErrors ? (
          <ErrorSummary
            title="Popraw hasło SMTP"
            errors={message ? [{ fieldId: 'smtpPassword', message }] : []}
          >
            {state.formError}
          </ErrorSummary>
        ) : null}
        <form action={formAction} noValidate className="grid grid-cols-1 gap-6">
          <p>
            {passwordSet
              ? 'Hasło jest ustawione. Wpisz nowe tylko wtedy, gdy chcesz je zmienić.'
              : 'Hasło nie jest ustawione. Bez niego poczta działa tylko na serwerze bez logowania.'}
          </p>
          <Field
            id="smtpPassword"
            label="Nowe hasło SMTP"
            hint="Hasło trafia do bezpiecznego magazynu i nie wraca na ekran."
            error={message}
          >
            <TextInput name="smtpPassword" type="password" autoComplete="new-password" />
          </Field>
          <div>
            <SubmitButton variant="secondary" pendingLabel="Zapisywanie">
              Zapisz hasło SMTP
            </SubmitButton>
          </div>
        </form>
      </div>
    </FormGroup>
  );
}

'use client';

import { useActionState, useState } from 'react';
import {
  ErrorSummary,
  Field,
  RadioGroup,
  type RadioOption,
  SubmitButton,
  TextInput,
} from '@sarmata/ui';
import { inviteAccount } from '@/app/(app)/ustawienia/konta/actions';
import { useErrorTitle } from '@/components/use-error-title';
import type { FormState } from '@/lib/form-action';

/** The three roles with a short hint of what each can do, shared by the invite and role forms. */
export const roleOptions: readonly RadioOption[] = [
  {
    value: 'evaluator',
    label: 'Oceniający',
    hint: 'Prowadzi oceny swoich pracowników i pisze notatki.',
  },
  {
    value: 'hr',
    label: 'Kadry',
    hint: 'Widzi oceny całego urzędu, zmienia oceniających i prowadzi dokumenty.',
  },
  {
    value: 'admin',
    label: 'Administrator',
    hint: 'Zarządza kontami, ustawieniami urzędu i wersjami przepisów.',
  },
];

/** Order of the controls on the page, so the error summary lists them top to bottom. */
const FIELD_ORDER = ['firstName', 'lastName', 'email', 'role'];

const initialState: FormState = { values: {}, fieldErrors: {} };

/** Invitation form (`/ustawienia/konta`). A good request redirects to the status panel. */
export function InviteForm() {
  const [state, formAction] = useActionState(inviteAccount, initialState);
  // Each answer of the action remounts the form, so the default values show what was sent.
  const [shownState, setShownState] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shownState) {
    setShownState(state);
    setVersion((current) => current + 1);
  }

  const errors = FIELD_ORDER.flatMap((key) => {
    const message = state.fieldErrors[key];
    return message ? [{ fieldId: key, message }] : [];
  });
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const text = (name: string): string => {
    const value = state.values[name];
    return typeof value === 'string' ? value : '';
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {hasErrors ? (
        <ErrorSummary title="Popraw dane zaproszenia" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form
        key={version}
        action={formAction}
        noValidate
        className="grid grid-cols-1 max-w-[40rem] gap-6"
      >
        <Field id="firstName" label="Imię" error={state.fieldErrors.firstName}>
          <TextInput name="firstName" autoComplete="off" defaultValue={text('firstName')} />
        </Field>
        <Field id="lastName" label="Nazwisko" error={state.fieldErrors.lastName}>
          <TextInput name="lastName" autoComplete="off" defaultValue={text('lastName')} />
        </Field>
        <Field
          id="email"
          label="Adres e-mail"
          hint="Na ten adres trafi zaproszenie. Jeśli ta osoba jest już w ewidencji pracowników, konto połączy się z jej kartą."
          error={state.fieldErrors.email}
        >
          <TextInput
            name="email"
            type="email"
            autoComplete="off"
            spellCheck={false}
            defaultValue={text('email')}
          />
        </Field>
        <RadioGroup
          name="role"
          legend="Rola w urzędzie"
          options={roleOptions}
          defaultValue={text('role') || null}
          error={state.fieldErrors.role}
        />
        <div>
          <SubmitButton pendingLabel="Wysyłanie zaproszenia">Wyślij zaproszenie</SubmitButton>
        </div>
      </form>
    </div>
  );
}

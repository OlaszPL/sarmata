'use client';

import { useActionState } from 'react';
import { FormAlert, SubmitButton, TextField } from '@sarmata/ui';
import { signIn, type SignInState } from '@/lib/auth-actions';

const initialState: SignInState = { values: { email: '' }, fieldErrors: {} };

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);
  const fieldErrors = Object.entries(state.fieldErrors).filter((entry): entry is [string, string] =>
    Boolean(entry[1]),
  );

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {state.formError ? (
        <FormAlert title="Nie udało się zalogować">{state.formError}</FormAlert>
      ) : null}
      {fieldErrors.length > 0 ? (
        <FormAlert title="Popraw dane w formularzu">
          <ul className="list-disc pl-5">
            {fieldErrors.map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`}>{message}</a>
              </li>
            ))}
          </ul>
        </FormAlert>
      ) : null}
      <TextField
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        label="Adres e-mail"
        defaultValue={state.values.email}
        error={state.fieldErrors.email}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        label="Hasło"
        error={state.fieldErrors.password}
      />
      <SubmitButton pendingLabel="Trwa logowanie">Zaloguj się</SubmitButton>
    </form>
  );
}

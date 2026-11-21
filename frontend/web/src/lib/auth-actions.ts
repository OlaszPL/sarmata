'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

export interface SignInState {
  values: { email: string };
  fieldErrors: { email?: string | undefined; password?: string | undefined };
  formError?: string;
}

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Wpisz adres e-mail.')
    .pipe(z.email('Wpisz adres e-mail w poprawnym formacie, np. jan.kowalski@urzad.gov.pl.')),
  password: z.string().min(1, 'Wpisz hasło.'),
});

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** Signs in with e-mail and password. On success the session cookies are set and the user goes home. */
export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const input = {
    email: textField(formData, 'email'),
    password: textField(formData, 'password'),
  };

  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      values: { email: input.email },
      fieldErrors: { email: fieldErrors.email?.[0], password: fieldErrors.password?.[0] },
    };
  }

  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code !== 'invalid_credentials') console.error('Sign-in failed', error);
    return {
      values: { email: input.email },
      fieldErrors: {},
      formError:
        error.code === 'invalid_credentials'
          ? 'Nieprawidłowy adres e-mail lub hasło. Sprawdź dane i spróbuj ponownie.'
          : 'Nie udało się połączyć z usługą logowania. Spróbuj ponownie za chwilę.',
    };
  }

  redirect(routes.home);
}

/** Ends the session in this browser only, so other sessions of the same account stay valid. */
export async function signOut(): Promise<void> {
  const supabase = await createSupabase();
  await supabase.auth.signOut({ scope: 'local' });
  redirect(routes.signIn);
}

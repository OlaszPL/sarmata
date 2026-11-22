'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { servicesFor } from '@sarmata/services';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { adminOnlyState } from '@/lib/settings/admin-guard';
import { createSupabase } from '@/lib/supabase';

const roleSchema = z.enum(['evaluator', 'hr', 'admin'], 'Wybierz rolę');

const inviteSchema = z.object({
  firstName: z.string().trim().min(1, 'Wpisz imię'),
  lastName: z.string().trim().min(1, 'Wpisz nazwisko'),
  email: z.string().trim().pipe(z.email('Wpisz poprawny adres e-mail')),
  role: roleSchema,
});

/** Asks for an invitation. The worker sends it, the status panel follows the result. */
export async function inviteAccount(_previous: FormState, formData: FormData): Promise<FormState> {
  const denied = await adminOnlyState(formData);
  if (denied) return denied;

  const parsed = parseForm(inviteSchema, formData);
  if ('state' in parsed) return parsed.state;
  const services = servicesFor(await createSupabase());

  const result = await runService(
    () => services.accounts.invite(parsed.data),
    undefined,
    formValues(formData),
  );
  if (!result.ok) return result.state;
  redirect(`${routes.settingsAccounts}?zaproszenie=${result.value}`);
}

export interface TakePasswordState {
  /** The password once taken, `null` when it was taken before. Lives in client state only. */
  password?: string | null;
  formError?: string;
}

/** Takes the temporary password of an invitation. The service removes it on the way. */
export async function takePassword(
  _previous: TakePasswordState,
  formData: FormData,
): Promise<TakePasswordState> {
  const denied = await adminOnlyState(formData);
  if (denied) return { formError: denied.formError ?? serviceErrorMessage('forbidden') };

  const id = formData.get('invitationId');
  if (typeof id !== 'string' || id === '') return { formError: serviceErrorMessage('not_found') };
  const services = servicesFor(await createSupabase());

  const result = await runService(() => services.accounts.takeInvitationPassword(id));
  if (!result.ok) return { formError: result.state.formError ?? serviceErrorMessage('unknown') };
  return { password: result.value };
}

const changeRoleSchema = z.object({
  accountId: z.string().min(1),
  role: roleSchema,
});

/** Changes the role of an account, it works from the next session refresh of that person. */
export async function changeRole(_previous: FormState, formData: FormData): Promise<FormState> {
  const denied = await adminOnlyState(formData);
  if (denied) return denied;

  const parsed = parseForm(changeRoleSchema, formData);
  if ('state' in parsed) return parsed.state;
  const services = servicesFor(await createSupabase());

  const result = await runService(
    () => services.accounts.changeRole(parsed.data.accountId, parsed.data.role),
    undefined,
    formValues(formData),
  );
  if (!result.ok) return result.state;
  redirect(`${routes.settingsAccounts}?zapisano=rola`);
}

const endMembershipSchema = z.object({
  accountId: z.string().min(1),
  confirmEnd: z.string().refine((value) => value === '1', 'Potwierdź zakończenie dostępu'),
});

/** Ends the access of an account from today. Needs the confirmation checkbox. */
export async function endMembership(_previous: FormState, formData: FormData): Promise<FormState> {
  const denied = await adminOnlyState(formData);
  if (denied) return denied;

  const parsed = parseForm(endMembershipSchema, formData);
  if ('state' in parsed) return parsed.state;
  const services = servicesFor(await createSupabase());

  const result = await runService(
    () => services.accounts.endMembership(parsed.data.accountId),
    undefined,
    formValues(formData),
  );
  if (!result.ok) return result.state;
  redirect(`${routes.settingsAccounts}?zapisano=dostep&otwarte=${result.value.openAsEvaluator}`);
}

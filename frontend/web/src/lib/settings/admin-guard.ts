import 'server-only';
import { requireMember } from '@/lib/account';
import { type FormState, formValues } from '@/lib/form-action';
import { serviceErrorMessage } from '@/lib/service-errors';

/**
 * First line of every settings action: `const denied = await adminOnlyState(fd); if (denied) return denied;`.
 * Anybody but the office admin gets a form error (the database refuses the write as well), the admin gets `null`.
 */
export async function adminOnlyState(formData: FormData): Promise<FormState | null> {
  const account = await requireMember();
  if (account.role === 'admin') return null;
  return {
    values: formValues(formData),
    fieldErrors: {},
    formError: serviceErrorMessage('forbidden'),
  };
}

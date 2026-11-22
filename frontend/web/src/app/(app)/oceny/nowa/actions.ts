'use server';

import { redirect } from 'next/navigation';
import { servicesFor } from '@sarmata/services';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { todayInWarsaw } from '@/lib/format';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';
import { startSchema } from './start-options';

/**
 * Starts an evaluation of the chosen employee on the chosen sheet and opens its part I. A refusal
 * of the services (`not_eligible` with its reason, `forbidden`) comes back as the form error.
 */
export async function startEvaluation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(startSchema, formData);
  if ('state' in parsed) return parsed.state;

  const services = servicesFor(await createSupabase());
  const result = await runService(
    () => services.evaluations.start({ ...parsed.data, today: todayInWarsaw() }),
    undefined,
    formValues(formData),
  );
  if (!result.ok) return result.state;

  redirect(routes.evaluationPart1(result.value.id));
}

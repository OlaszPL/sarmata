'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { servicesFor } from '@sarmata/services';
import { type FormState, formValues, parseForm } from '@/lib/form-action';
import { appealSchema, gradeGrantSchema } from '@/lib/hr/register';
import { runRegisterService } from '@/lib/hr/register-errors';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

const saved: FormState = { values: {}, fieldErrors: {}, ok: true };

/**
 * Records the labour court appeal of a rejected objection. Rule refusals come back as the form error.
 * A save drops the case from the open ones and unmounts its form, so the page confirms it instead.
 */
export async function recordAppeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(appealSchema, formData);
  if ('state' in parsed) return parsed.state;

  const services = servicesFor(await createSupabase());
  const result = await runRegisterService(
    () => services.hrRegister.recordLabourCourtAppeal(parsed.data),
    formValues(formData),
  );
  if (!result.ok) return result.state;

  revalidatePath(routes.hrRegister);
  redirect(routes.hrRegisterAppealSaved);
}

/** Records a grade grant, on request or by law. An empty evaluation means none. */
export async function recordGradeGrant(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(gradeGrantSchema, formData);
  if ('state' in parsed) return parsed.state;

  const services = servicesFor(await createSupabase());
  const { evaluationId, ...rest } = parsed.data;
  const result = await runRegisterService(
    () => services.hrRegister.recordGradeGrant({ ...rest, evaluationId: evaluationId || null }),
    formValues(formData),
  );
  if (!result.ok) return result.state;

  revalidatePath(routes.hrRegister);
  return saved;
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { calendarDate, servicesFor } from '@sarmata/services';
import { z } from 'zod';
import { criterionName } from '@/lib/case-regulation';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';
import { loadCase } from '../loader';

const approveSchema = z.object({
  draftedOn: z
    .string()
    .min(1, 'Wpisz datę sporządzenia oceny')
    .refine((value) => {
      try {
        calendarDate(value);
        return true;
      } catch {
        return false;
      }
    }, 'Wpisz datę sporządzenia oceny w poprawnym formacie'),
  place: z.string().trim(),
});

/**
 * Approves the sheet. Gate errors of the backend come back as field errors keyed by the control id
 * of their tab, so the summary can link to them. The typed date and place stay in the state.
 */
export async function approveSheet(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(approveSchema, formData);
  if ('state' in parsed) return parsed.state;
  const values = formValues(formData);
  const { regulation } = await loadCase(id);
  const { draftedOn, place } = parsed.data;
  const done = await runService(
    async () =>
      servicesFor(await createSupabase()).evaluations.transition(id, {
        type: 'approve_sheet',
        draftedOn: calendarDate(draftedOn),
        ...(place === '' ? {} : { place }),
      }),
    undefined,
    values,
    (criterionId) => criterionName(regulation, criterionId),
  );
  if (!done.ok) return done.state;
  revalidatePath(routes.evaluation(id), 'layout');
  redirect(`${routes.evaluationCheck(id)}?zatwierdzono=1`);
}

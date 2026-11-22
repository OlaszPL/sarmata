'use server';

import { revalidatePath } from 'next/cache';
import { servicesFor } from '@sarmata/services';
import { type FormState, formValues, runService } from '@/lib/form-action';
import { sheetFromGradeRequestForm } from '@/lib/evaluations/sheet-form';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';
import { loadCase } from '../loader';

/**
 * Saves the grade request of part III into the draft. A missing choice or an empty motivation comes
 * back as a field error, backend failures as the form error. Typed values stay in the state.
 */
export async function saveGradeRequest(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const { view } = await loadCase(id);
  const { grade } = view.snapshot;
  if (grade === null)
    return { values, fieldErrors: {}, formError: serviceErrorMessage('forbidden') };
  const parsed = sheetFromGradeRequestForm(view.sheet.content, grade, formData);
  if ('fieldErrors' in parsed) return { values, fieldErrors: parsed.fieldErrors };
  const saved = await runService(
    async () => servicesFor(await createSupabase()).evaluations.saveDraft(id, parsed.content),
    undefined,
    values,
  );
  if (!saved.ok) return saved.state;
  revalidatePath(routes.evaluation(id), 'layout');
  return { values, fieldErrors: {}, ok: true };
}

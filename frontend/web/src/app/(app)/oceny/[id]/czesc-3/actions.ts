'use server';

import { revalidatePath } from 'next/cache';
import { servicesFor } from '@sarmata/services';
import { type FormState, formValues, runService } from '@/lib/form-action';
import { sheetFromGradeRequestForm } from '@/lib/evaluations/sheet-form';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';
import { loadCase } from '../loader';

/**
 * Saves the grade request of part III into the draft, or removes it (`request=no`). A missing choice,
 * an empty motivation or a request without a grade in the data comes back as a field error, backend
 * failures as the form error. Typed values stay in the state.
 */
export async function saveGradeRequest(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const { view } = await loadCase(id);
  const parsed = sheetFromGradeRequestForm(view.sheet.content, view.snapshot.grade, formData);
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

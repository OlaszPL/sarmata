'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ServiceError, calendarDate, servicesFor } from '@sarmata/services';
import { z } from 'zod';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { sheetFromPartTwoForm } from '@/lib/evaluations/sheet-form';
import { type GateLink, gateLinks } from '@/lib/evaluations/sheet-gates';
import { criterionName } from '@/lib/case-regulation';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';
import { approvalPreview, loadCase } from '../loader';

export interface SaveResult {
  ok: boolean;
  /** Time of the save in Warsaw, e.g. "14:32". */
  savedAt?: string;
  /** Gates of the next approval on the sheet as saved, for the banner. */
  issues: GateLink[];
  formError?: string;
}

const warsawTime = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Autosave of part II: writes the posted fields into the saved sheet and answers with the time and
 * the gates that are still open. Expected service failures come back as `formError`, so the editor
 * keeps what was typed and offers a retry.
 */
export async function saveSheet(id: string, formData: FormData): Promise<SaveResult> {
  try {
    const { view, regulation } = await loadCase(id);
    const content = sheetFromPartTwoForm(view.sheet.content, view.criteria, formData);
    await servicesFor(await createSupabase()).evaluations.saveDraft(id, content);
    const approval = await approvalPreview(id);
    return {
      ok: true,
      savedAt: warsawTime.format(new Date()),
      issues: gateLinks(id, approval.issues, (criterionId) =>
        criterionName(regulation, criterionId),
      ),
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { ok: false, issues: [], formError: serviceErrorMessage(error.code, error.details) };
    }
    throw error;
  }
}

/**
 * The button under the sheet. In the interview it saves and goes to the check page. In the period
 * it only saves the draft and stays.
 */
export async function saveSheetAndCheck(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const { view, regulation } = await loadCase(id);
  const saved = await runService(
    async () => {
      const content = sheetFromPartTwoForm(view.sheet.content, view.criteria, formData);
      return servicesFor(await createSupabase()).evaluations.saveDraft(id, content);
    },
    undefined,
    values,
    (criterionId) => criterionName(regulation, criterionId),
  );
  if (!saved.ok) return saved.state;
  revalidatePath(routes.evaluation(id), 'layout');
  if (view.status === 'interview') redirect(routes.evaluationCheck(id));
  return { values, fieldErrors: {}, ok: true };
}

const interviewSchema = z.object({
  heldOn: z
    .string()
    .min(1, 'Wpisz datę rozmowy oceniającej')
    .refine((value) => {
      try {
        calendarDate(value);
        return true;
      } catch {
        return false;
      }
    }, 'Wpisz datę rozmowy oceniającej w poprawnym formacie'),
});

/** Records the evaluation interview. The date also fills the interview date of the sheet when empty. */
export async function recordInterview(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(interviewSchema, formData);
  if ('state' in parsed) return parsed.state;
  const values = formValues(formData);
  const heldOn = calendarDate(parsed.data.heldOn);
  const done = await runService(
    async () => {
      const evaluations = servicesFor(await createSupabase()).evaluations;
      const view = await evaluations.transition(id, {
        type: 'record_evaluation_interview',
        heldOn,
      });
      const { partTwo } = view.sheet.content;
      if (partTwo.interviewOn === null) {
        await evaluations.saveDraft(id, {
          ...view.sheet.content,
          partTwo: { ...partTwo, interviewOn: heldOn },
        });
      }
    },
    undefined,
    values,
  );
  if (!done.ok) return done.state;
  revalidatePath(routes.evaluation(id), 'layout');
  return { values, fieldErrors: {}, ok: true };
}

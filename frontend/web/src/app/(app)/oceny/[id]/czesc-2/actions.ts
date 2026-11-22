'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { ServiceError, calendarDate, servicesFor } from '@sarmata/services';
import { z } from 'zod';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { warsawTime } from '@/lib/evaluations/sheet-autosave';
import { sheetFromPartTwoForm } from '@/lib/evaluations/sheet-form';
import { type GateLink, gateLinks } from '@/lib/evaluations/sheet-gates';
import { criterionName, regulationForEvaluation } from '@/lib/regulation';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';
import { loadCase } from '../loader';

export interface SaveResult {
  ok: boolean;
  /** Time of the save in Warsaw, e.g. "14:32". */
  savedAt?: string;
  /** Gates of the next approval on the sheet as saved, for the banner. */
  issues: GateLink[];
  formError?: string;
}

/**
 * Autosave of part II: writes the posted fields into the saved sheet and answers with the time and
 * the gates that are still open. It runs on every pause in typing, so it reads only the evaluation
 * and its regulation (not the whole case frame) and asks for the gates once, after the save.
 * Expected service failures come back as `formError`, so the editor keeps what was typed and offers
 * a retry.
 */
export async function saveSheet(id: string, formData: FormData): Promise<SaveResult> {
  try {
    const services = servicesFor(await createSupabase());
    const view = await services.evaluations.get(id);
    if (view === null) notFound();
    const content = sheetFromPartTwoForm(view.sheet.content, view.criteria, formData);
    await services.evaluations.saveDraft(id, content);
    const [approval, regulation] = await Promise.all([
      services.evaluations.approvalIssues(id),
      regulationForEvaluation(view),
    ]);
    return {
      ok: true,
      savedAt: warsawTime(new Date()),
      issues: gateLinks(
        id,
        approval.issues,
        (criterionId) => criterionName(regulation, criterionId),
        'czesc-2',
      ),
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { ok: false, issues: [], formError: serviceErrorMessage(error.code, error.details) };
    }
    throw error;
  }
}

/** State of the sheet form: `savedAt` (Warsaw time) after a draft saved by the button. */
export interface SheetFormState extends FormState {
  savedAt?: string;
}

/**
 * The button under the sheet. In the interview it saves and goes to the check page. In the period
 * it only saves the draft and stays.
 */
export async function saveSheetAndCheck(
  id: string,
  _previous: SheetFormState,
  formData: FormData,
): Promise<SheetFormState> {
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
  return { values, fieldErrors: {}, ok: true, savedAt: warsawTime(new Date()) };
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

/** Starts a sheet draft run of the AI. Failures such as `ai_disabled` come back as the form error. */
export async function startSheetDraft(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const started = await runService(
    async () =>
      servicesFor(await createSupabase()).ai.start({ kind: 'sheet_draft', evaluationId: id }),
    undefined,
    values,
  );
  if (!started.ok) return started.state;
  revalidatePath(routes.evaluationPart2(id));
  return { values, fieldErrors: {}, ok: true };
}

/**
 * Records the decision about one fragment of the draft. Called from client code, so expected
 * failures come back as `formError` and nothing else changes.
 */
export async function decideFragment(
  id: string,
  runId: string,
  fragment: string,
  decision: 'accepted' | 'edited' | 'rejected',
  finalText?: string,
): Promise<{ ok: boolean; formError?: string }> {
  try {
    await servicesFor(await createSupabase()).ai.decide(runId, [
      { fragment, decision, ...(finalText === undefined ? {} : { finalText }) },
    ]);
  } catch (error) {
    if (error instanceof ServiceError) {
      return { ok: false, formError: serviceErrorMessage(error.code, error.details) };
    }
    // The service may bring its own zod instance, so the name counts too (as in `runService`).
    if (error instanceof z.ZodError || (error instanceof Error && error.name === 'ZodError')) {
      return { ok: false, formError: 'Wpisz tekst zdania, zanim je wstawisz.' };
    }
    throw error;
  }
  revalidatePath(routes.evaluationPart2(id));
  return { ok: true };
}

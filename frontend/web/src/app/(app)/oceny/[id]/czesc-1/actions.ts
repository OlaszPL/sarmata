'use server';

import { revalidatePath } from 'next/cache';
import { type AiRun, ServiceError, calendarDate, servicesFor } from '@sarmata/services';
import { z } from 'zod';
import { type CaseRegulation, criterionName } from '@/lib/case-regulation';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { regulationForEvaluation } from '@/lib/regulation';
import { routes } from '@/lib/routes';
import { approvalIssueItems, serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';
import { type AiPollResult, type AiStartResult } from '../czesc-2/_sheet/use-ai-run';
import { partOneContent, partOneSchema } from './part-one';

/**
 * Runs a part I call with the case regulation at hand, so gate messages name the criteria. The
 * regulation is read inside the call, a failure there becomes form state like any other.
 */
async function runWithNames(
  id: string,
  formData: FormData,
  fn: (
    services: ReturnType<typeof servicesFor>,
    keep: (r: CaseRegulation) => void,
  ) => Promise<void>,
): Promise<FormState> {
  const values = formValues(formData);
  let regulation: CaseRegulation | null = null;
  const services = servicesFor(await createSupabase());
  const result = await runService(
    () =>
      fn(services, (loaded) => {
        regulation = loaded;
      }),
    undefined,
    values,
    (criterionId) => (regulation ? criterionName(regulation, criterionId) : criterionId),
  );
  if (!result.ok) return result.state;
  revalidatePath(routes.evaluation(id), 'layout');
  return { values, fieldErrors: {}, ok: true };
}

function isIsoDate(value: string): boolean {
  try {
    calendarDate(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * A form that fails its own checks (no interview date) still gets the gate errors of what was
 * typed (too many criteria, a due date past the deadline), so the person fixes all at once. The
 * gates are a hint here, a failure to read them leaves the state as it was.
 */
async function withGateErrors(id: string, state: FormState): Promise<FormState> {
  if (state.values.intent !== 'approve') return state;
  const raw = state.values.additionalCriteria;
  const additionalCriteria = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const dueOn = typeof state.values.dueOn === 'string' ? state.values.dueOn : '';
  try {
    const services = servicesFor(await createSupabase());
    const view = await services.evaluations.get(id);
    if (view === null) return state;
    const [regulation, preview] = await Promise.all([
      regulationForEvaluation(view),
      services.evaluations.approvalIssues(
        id,
        partOneContent(view.sheet.content, {
          additionalCriteria,
          dueOn: isIsoDate(dueOn) ? dueOn : '',
        }),
      ),
    ]);
    const fieldErrors = { ...state.fieldErrors };
    for (const item of approvalIssueItems(preview.issues, (criterionId) =>
      criterionName(regulation, criterionId),
    )) {
      fieldErrors[item.fieldId] ??= item.message;
    }
    return { ...state, fieldErrors };
  } catch (error) {
    console.warn(`part one: gate preview of ${id} failed`, error);
    return state;
  }
}

/**
 * Saves part I (criteria and due date) and, for `intent=approve`, approves it with the starting
 * interview. The approval checks the saved sheet, so the draft is saved first.
 */
export async function savePartOne(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(partOneSchema, formData);
  if ('state' in parsed) return withGateErrors(id, parsed.state);
  const data = parsed.data;

  return runWithNames(id, formData, async (services, keep) => {
    const view = await services.evaluations.get(id);
    if (view === null) throw new ServiceError('not_found', `Evaluation ${id} not found`);
    keep(await regulationForEvaluation(view));
    await services.evaluations.saveDraft(id, partOneContent(view.sheet.content, data));
    if (data.intent === 'approve') {
      const place = data.place.trim();
      await services.evaluations.transition(id, {
        type: 'approve_part_one',
        startingInterviewOn: calendarDate(data.startingInterviewOn),
        // An empty place is left out, the backend then takes the default place of the office.
        ...(place === '' ? {} : { place }),
      });
    }
  });
}

const signatureSchema = z.object({
  signedOn: z
    .string()
    .min(1, { message: 'Wpisz datę podpisu części I' })
    .refine(
      (value) => {
        try {
          calendarDate(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Wpisz datę w formacie dd.mm.rrrr' },
    ),
});

/** Records the date the evaluated person signed part I, which opens the evaluation period. */
export async function recordSignature(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(signatureSchema, formData);
  if ('state' in parsed) return parsed.state;
  const signedOn = calendarDate(parsed.data.signedOn);

  return runWithNames(id, formData, async (services) => {
    await services.evaluations.transition(id, { type: 'record_part_one_signature', signedOn });
  });
}

export type CriteriaProposalsRun = Extract<AiRun, { kind: 'criteria_proposals' }>;

const AI_FAILED = 'AI teraz nie odpowiada. Spróbuj ponownie za chwilę.';

/**
 * Starts the proposals of additional criteria and behavioural indicators from the duties of the
 * evaluated person. The client polls `pollCriteriaProposals`.
 */
export async function startCriteriaProposals(id: string, duties: string): Promise<AiStartResult> {
  try {
    const run = await servicesFor(await createSupabase()).ai.start({
      kind: 'criteria_proposals',
      evaluationId: id,
      duties,
    });
    return { runId: run.id };
  } catch (error) {
    if (error instanceof ServiceError) {
      return {
        error: serviceErrorMessage(error.code, error.details),
        ...(error.code === 'ai_disabled' ? { disabled: true } : {}),
      };
    }
    if (error instanceof z.ZodError || (error instanceof Error && error.name === 'ZodError')) {
      return { error: 'Opisz obowiązki, najwyżej 10 000 znaków.' };
    }
    throw error;
  }
}

/** One poll of a criteria proposals run. */
export async function pollCriteriaProposals(
  runId: string,
): Promise<AiPollResult<CriteriaProposalsRun>> {
  try {
    const run = await servicesFor(await createSupabase()).ai.get(runId);
    if (run.kind !== 'criteria_proposals') return { error: AI_FAILED };
    return { run };
  } catch (error) {
    if (error instanceof ServiceError) return { error: serviceErrorMessage(error.code) };
    return { error: AI_FAILED };
  }
}

/** Records the decision about one proposal (`criterion.<id>` or `expectations.<id>`). */
export async function decideCriteriaProposal(
  runId: string,
  fragment: string,
  decision: 'accepted' | 'edited' | 'rejected',
  finalText?: string,
): Promise<{ ok: boolean; formError?: string }> {
  try {
    await servicesFor(await createSupabase()).ai.decide(runId, [
      { fragment, decision, ...(finalText === undefined ? {} : { finalText }) },
    ]);
    return { ok: true };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { ok: false, formError: serviceErrorMessage(error.code, error.details) };
    }
    if (error instanceof z.ZodError || (error instanceof Error && error.name === 'ZodError')) {
      return { ok: false, formError: 'Wpisz poprawione wskaźniki, zanim je zapiszesz.' };
    }
    throw error;
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  type CalendarDate,
  type EndEmploymentResult,
  ServiceError,
  calendarDate,
  servicesFor,
} from '@sarmata/services';
import { requireMember } from '@/lib/account';
import { todayInWarsaw } from '@/lib/format';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';

/** Answer of the small AI forms of the side panel: an error to show, nothing on success. */
export interface PanelActionState {
  error?: string;
}

export type AiAnalysisKind = 'hr_signals' | 'appreciation_moments';

export type EndEmploymentState = FormState & { result?: EndEmploymentResult };

const FALLBACK_ERROR = 'Coś poszło nie tak. Spróbuj ponownie.';
const HR_ONLY = 'Oceny archiwalne i ustanie zatrudnienia wpisują kadry.';

const uuid = z.uuid();
const signalSchema = z.enum(['sentiment', 'overload', 'engagement_drop', 'burnout_risk']);

function panelError(error: unknown): PanelActionState {
  if (error instanceof ServiceError)
    return { error: serviceErrorMessage(error.code, error.details) };
  console.error('employee card: AI action failed', error);
  return { error: FALLBACK_ERROR };
}

/**
 * Starts the notes analysis (`hr_signals`) or the search for a moment of appreciation
 * (`appreciation_moments`, as of today in Warsaw). The panel form binds the employee and the kind and
 * uses it with `useActionState` (the state and form data it adds are not needed), `ai_disabled` and
 * `forbidden` come back as a message.
 */
export async function startAiAnalysis(
  employeeId: string,
  kind: AiAnalysisKind,
): Promise<PanelActionState> {
  const account = await requireMember();
  if (account.role === 'admin') return { error: serviceErrorMessage('forbidden') };
  if (!uuid.safeParse(employeeId).success) return { error: FALLBACK_ERROR };
  try {
    const ai = servicesFor(await createSupabase()).ai;
    if (kind === 'appreciation_moments') {
      await ai.start({ kind, employeeId, today: todayInWarsaw() });
    } else {
      await ai.start({ kind: 'hr_signals', employeeId });
    }
  } catch (error) {
    return panelError(error);
  }
  revalidatePath(routes.employee(employeeId));
  return {};
}

/** "Nie zgadzam się z sygnałem": logs the rejection of one signal as fragment `signal.<name>`. */
export async function rejectSignal(
  _previous: PanelActionState,
  formData: FormData,
): Promise<PanelActionState> {
  await requireMember();
  const runId = uuid.safeParse(formData.get('runId'));
  const employeeId = uuid.safeParse(formData.get('employeeId'));
  const signal = signalSchema.safeParse(formData.get('signal'));
  if (!runId.success || !employeeId.success || !signal.success) return { error: FALLBACK_ERROR };
  try {
    await servicesFor(await createSupabase()).ai.decide(runId.data, [
      { fragment: `signal.${signal.data}`, decision: 'rejected' },
    ]);
  } catch (error) {
    return panelError(error);
  }
  revalidatePath(routes.employee(employeeId.data));
  return {};
}

/** A `rrrr-mm-dd` date from the date picker that exists and is not later than today in Warsaw. */
const pastDate = (invalid: string, future: string) =>
  z
    .string()
    .trim()
    .transform((value, context): CalendarDate => {
      try {
        return calendarDate(value);
      } catch {
        context.addIssue({ code: 'custom', message: invalid });
        return z.NEVER;
      }
    })
    .refine((value) => value <= todayInWarsaw(), future);

/** The same, empty reads as `null`. */
const optionalPastDate = (invalid: string, future: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .pipe(pastDate(invalid, future).nullable());

const archivedSchema = z
  .object({
    employeeId: z.uuid(FALLBACK_ERROR),
    draftedOn: pastDate(
      'Wpisz datę sporządzenia oceny',
      'Data sporządzenia nie może być w przyszłości',
    ),
    acquaintedOn: optionalPastDate(
      'Wpisz poprawną datę zapoznania',
      'Data zapoznania nie może być w przyszłości',
    ),
    levelCode: z.string().trim().min(1, 'Wybierz poziom oceny'),
    outcome: z.enum(['positive', 'negative'], { error: 'Wybierz wynik oceny' }),
  })
  .superRefine((value, context) => {
    // Runs next to the field errors (zod 4 refines a partly invalid object), so check both dates.
    if (
      typeof value.draftedOn === 'string' &&
      typeof value.acquaintedOn === 'string' &&
      value.acquaintedOn < value.draftedOn
    ) {
      context.addIssue({
        code: 'custom',
        path: ['acquaintedOn'],
        message: 'Data zapoznania nie może być wcześniejsza niż data sporządzenia',
      });
    }
  });

const RATING_PREFIX = 'rating-';

/** Partial ratings posted as `rating-<criterionId>`, an empty choice means "Bez oceny". */
function ratingsOf(formData: FormData): {
  ratings: Record<string, number> | null;
  fieldErrors: Record<string, string>;
} {
  const ratings: Record<string, number> = {};
  const fieldErrors: Record<string, string> = {};
  for (const [key, entry] of formData.entries()) {
    if (!key.startsWith(RATING_PREFIX) || typeof entry !== 'string' || entry === '') continue;
    if (/^\d+$/.test(entry)) ratings[key.slice(RATING_PREFIX.length)] = Number(entry);
    else fieldErrors[key] = 'Wybierz ocenę z listy';
  }
  return { ratings: Object.keys(ratings).length > 0 ? ratings : null, fieldErrors };
}

/** Hr enters a past evaluation result by hand (Oceny historyczne). */
export async function addArchivedEvaluation(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const account = await requireMember();
  const values = formValues(formData);
  if (account.role !== 'hr') return { values, fieldErrors: {}, formError: HR_ONLY };

  const parsed = parseForm(archivedSchema, formData);
  const { ratings, fieldErrors: ratingErrors } = ratingsOf(formData);
  if ('state' in parsed || Object.keys(ratingErrors).length > 0) {
    const state = 'state' in parsed ? parsed.state : { values, fieldErrors: {} };
    return { ...state, fieldErrors: { ...state.fieldErrors, ...ratingErrors } };
  }

  const { employeeId, ...fields } = parsed.data;
  const services = servicesFor(await createSupabase());
  try {
    const saved = await runService(
      () => services.archivedEvaluations.create({ employeeId, ...fields, ratings }),
      undefined,
      values,
    );
    if (!saved.ok) return saved.state;
  } catch (error) {
    // The repository reports a refused insert as a plain error, not a service code.
    console.error('employee card: archived evaluation failed', error);
    return { values, fieldErrors: {}, formError: FALLBACK_ERROR };
  }
  revalidatePath(routes.employee(employeeId));
  return { values: {}, fieldErrors: {}, ok: true };
}

const endEmploymentSchema = z.object({
  employeeId: z.uuid(FALLBACK_ERROR),
  endedOn: pastDate(
    'Wpisz datę ustania zatrudnienia',
    'Data ustania zatrudnienia nie może być w przyszłości',
  ),
  reason: z.string().trim().min(1, 'Wpisz przyczynę ustania zatrudnienia'),
  confirm: z.literal('1', { error: 'Potwierdź ustanie zatrudnienia' }),
});

/**
 * Hr marks the end of the employment: open evaluations of the person are interrupted and the account
 * loses access. The result says how many evaluations stopped and how many the person still leads.
 */
export async function endEmployment(
  _previous: EndEmploymentState,
  formData: FormData,
): Promise<EndEmploymentState> {
  const account = await requireMember();
  const values = formValues(formData);
  if (account.role !== 'hr') return { values, fieldErrors: {}, formError: HR_ONLY };

  const parsed = parseForm(endEmploymentSchema, formData);
  if ('state' in parsed) return parsed.state;
  const { employeeId, endedOn, reason } = parsed.data;

  const services = servicesFor(await createSupabase());
  let result: EndEmploymentResult;
  try {
    const ended = await runService(
      () => services.employment.end({ employeeId, endedOn, reason }),
      undefined,
      values,
    );
    if (!ended.ok) return ended.state;
    result = ended.value;
  } catch (error) {
    // The repository reports a refused update as a plain error, not a service code.
    console.error('employee card: end of employment failed', error);
    return { values, fieldErrors: {}, formError: FALLBACK_ERROR };
  }
  revalidatePath(routes.employee(employeeId));
  return { values: {}, fieldErrors: {}, ok: true, result };
}

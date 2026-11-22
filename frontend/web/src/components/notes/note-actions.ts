'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  type NoteCheck,
  type NoteCheckAi,
  type SensitiveDataWarning,
  ServiceError,
  servicesFor,
} from '@sarmata/services';
import { requireMember } from '@/lib/account';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';

export type NoteFormState = FormState & { warnings?: readonly SensitiveDataWarning[] };

const FALLBACK_ERROR = 'Coś poszło nie tak. Spróbuj ponownie.';
const BODY_MAX = 5000;

function errorOf(error: unknown): { error: string } {
  if (error instanceof ServiceError)
    return { error: serviceErrorMessage(error.code, error.details) };
  return { error: FALLBACK_ERROR };
}

/** Dictionary warnings at once and an AI run to poll, before the note is saved. */
export async function checkNote(input: {
  employeeId: string;
  body: string;
}): Promise<NoteCheck | { error: string }> {
  await requireMember();
  try {
    return await servicesFor(await createSupabase()).notes.check(input);
  } catch (error) {
    return errorOf(error);
  }
}

/** One poll of the AI check started by `checkNote`. */
export async function pollNoteCheck(runId: string): Promise<NoteCheckAi | { error: string }> {
  await requireMember();
  try {
    return await servicesFor(await createSupabase()).notes.checkResult(runId);
  } catch (error) {
    return errorOf(error);
  }
}

/** The decision about the rewrite proposal of the AI check, logged as fragment `rewrite`. */
export async function decideRewrite(
  runId: string,
  decision: 'accepted' | 'edited' | 'rejected',
  finalText?: string,
): Promise<{ error?: string }> {
  await requireMember();
  try {
    await servicesFor(await createSupabase()).ai.decide(runId, [
      decision === 'edited' && finalText !== undefined
        ? { fragment: 'rewrite', decision, finalText }
        : { fragment: 'rewrite', decision },
    ]);
    return {};
  } catch (error) {
    return errorOf(error);
  }
}

/** Only the employee card and the notes page take the user back, anything else falls back to `/notatki`. */
function safeReturnTo(value: string): string {
  if (value === routes.notes) return value;
  return /^\/pracownicy\/[A-Za-z0-9-]+$/.test(value) ? value : routes.notes;
}

/** Query value that tells the success message how the note was checked. */
const checkedParam: Record<string, string> = {
  dictionary_only: 'slownik',
  ai_disabled: 'ai-wylaczone',
};

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value));

const noteFormSchema = z
  .object({
    noteId: optionalText.pipe(z.uuid().nullable()),
    employeeId: z.string().trim(),
    kind: z.enum(['observation', 'ongoing_conversation', 'appreciation', 'workload_fact'], {
      error: 'Wybierz rodzaj notatki',
    }),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Podaj datę zdarzenia'),
    criterionId: optionalText,
    sign: optionalText,
    communicated: z.string().transform((value) => value !== ''),
    body: z
      .string()
      .trim()
      .min(1, 'Wpisz treść notatki')
      .max(BODY_MAX, `Skróć treść notatki do ${BODY_MAX} znaków`),
    acceptWarnings: z.string(),
    confirmRisk: z.string(),
    returnTo: z.string(),
    aiNote: z.string(),
  })
  .superRefine((value, context) => {
    if (value.noteId === null && !z.uuid().safeParse(value.employeeId).success) {
      context.addIssue({ code: 'custom', path: ['employeeId'], message: 'Wybierz pracownika' });
    }
    if (value.kind !== 'workload_fact' && value.sign !== 'plus' && value.sign !== 'minus') {
      context.addIssue({ code: 'custom', path: ['sign'], message: 'Wybierz wydźwięk notatki' });
    }
    if (value.acceptWarnings === '1' && value.confirmRisk !== '1') {
      context.addIssue({
        code: 'custom',
        path: ['confirmRisk'],
        message: 'Zaznacz, że rozumiesz ryzyko, albo popraw treść notatki',
      });
    }
  });

/**
 * Saves a new note or a change of the author's own note. The sensitive data guard of the service
 * answers with the warnings, the form then asks for an explicit confirmation. On success it goes
 * back to the card or the notes page with the success message.
 */
export async function saveNote(
  _previous: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const account = await requireMember();
  const values = formValues(formData);
  if (account.role === 'admin') {
    return { values, fieldErrors: {}, formError: 'Notatki piszą oceniający i kadry.' };
  }

  const parsed = parseForm(noteFormSchema, formData);
  if ('state' in parsed) return parsed.state;
  const data = parsed.data;
  const fields = {
    kind: data.kind,
    occurredOn: data.occurredOn,
    criterionId: data.criterionId,
    sign: data.kind === 'workload_fact' ? null : data.sign === 'plus' ? 'plus' : 'minus',
    communicated: data.communicated,
    body: data.body,
  } as const;
  const options = { acceptWarnings: data.acceptWarnings === '1' };
  const notes = servicesFor(await createSupabase()).notes;

  let warnings: readonly SensitiveDataWarning[] | undefined;
  const saved = await runService(
    async () => {
      try {
        return data.noteId === null
          ? await notes.create({ ...fields, employeeId: data.employeeId }, options)
          : await notes.update(data.noteId, fields, options);
      } catch (error) {
        if (error instanceof ServiceError && error.code === 'sensitive_data') {
          warnings = error.details as readonly SensitiveDataWarning[];
        }
        throw error;
      }
    },
    undefined,
    values,
  );
  if (!saved.ok) return warnings ? { ...saved.state, warnings } : saved.state;

  const returnTo = safeReturnTo(data.returnTo);
  const checked = checkedParam[data.aiNote];
  revalidatePath(returnTo);
  redirect(`${returnTo}?zapisano=1${checked ? `&sprawdzono=${checked}` : ''}`);
}

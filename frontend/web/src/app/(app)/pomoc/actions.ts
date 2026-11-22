'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { servicesFor } from '@sarmata/services';
import { requireMember } from '@/lib/account';
import { todayInWarsaw } from '@/lib/format';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { evaluationIdOf, questionHref, questionSchema } from '@/lib/help/question';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';

const uuid = z.uuid();
const decisionSchema = z.enum(['accepted', 'rejected']);
const UNKNOWN_EVALUATION =
  'Nie rozpoznano oceny, której dotyczy pytanie. Wróć do sprawy i otwórz asystenta jeszcze raz.';

/**
 * Starts a `procedure_question` run and redirects to the answer, which shows progress by polling.
 * With `evaluationId` the assistant answers by the regulation version pinned to that evaluation.
 */
export async function askQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const account = await requireMember();
  const values = formValues(formData);
  if (account.role === 'admin') {
    return { values, fieldErrors: {}, formError: serviceErrorMessage('forbidden') };
  }
  const rawEvaluationId = formData.get('evaluationId');
  const evaluationId = evaluationIdOf(rawEvaluationId);
  if (evaluationId === null && typeof rawEvaluationId === 'string' && rawEvaluationId !== '') {
    return { values, fieldErrors: {}, formError: UNKNOWN_EVALUATION };
  }
  const parsed = parseForm(questionSchema, formData);
  if ('state' in parsed) return parsed.state;

  const { question } = parsed.data;
  const ai = servicesFor(await createSupabase()).ai;
  const result = await runService(
    () =>
      ai.start({
        kind: 'procedure_question',
        question,
        today: todayInWarsaw(),
        ...(evaluationId === null ? {} : { evaluationId }),
      }),
    { question: 'question' },
    values,
  );
  if (!result.ok) return result.state;
  redirect(questionHref(result.value.id, { ocena: evaluationId }));
}

/** "Odpowiedź pomogła" or "Nie pomogła": logs the decision about the fragment `answer` of the run. */
export async function decideAnswer(formData: FormData): Promise<void> {
  await requireMember();
  const runId = uuid.safeParse(formData.get('runId'));
  const decision = decisionSchema.safeParse(formData.get('decision'));
  const ocena = evaluationIdOf(formData.get('evaluationId'));
  if (!runId.success) redirect(routes.help);
  if (!decision.success) redirect(questionHref(runId.data, { blad: '1', ocena }));

  try {
    const ai = servicesFor(await createSupabase()).ai;
    await ai.decide(runId.data, [{ fragment: 'answer', decision: decision.data }]);
  } catch (error) {
    console.error('help: deciding about the answer failed', error);
    redirect(questionHref(runId.data, { blad: '1', ocena }));
  }
  redirect(questionHref(runId.data, { ocena }));
}

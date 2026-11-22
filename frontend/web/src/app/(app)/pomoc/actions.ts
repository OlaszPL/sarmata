'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { servicesFor } from '@sarmata/services';
import { requireMember } from '@/lib/account';
import { todayInWarsaw } from '@/lib/format';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { QUESTION_MAX, questionHref, questionSchema } from '@/lib/help/question';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';

const uuid = z.uuid();
const decisionSchema = z.enum(['accepted', 'rejected']);

/** Starts a `procedure_question` run and redirects to the answer, which shows progress by polling. */
export async function askQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const account = await requireMember();
  const values = formValues(formData);
  if (account.role === 'admin') {
    return { values, fieldErrors: {}, formError: serviceErrorMessage('forbidden') };
  }
  const parsed = parseForm(questionSchema, formData);
  if ('state' in parsed) return parsed.state;

  const { question } = parsed.data;
  const ai = servicesFor(await createSupabase()).ai;
  const result = await runService(
    () => ai.start({ kind: 'procedure_question', question, today: todayInWarsaw() }),
    { question: 'question' },
    values,
  );
  if (!result.ok) return result.state;
  redirect(questionHref(result.value.id, question));
}

/** "Odpowiedź pomogła" or "Nie pomogła": logs the decision about the fragment `answer` of the run. */
export async function decideAnswer(formData: FormData): Promise<void> {
  await requireMember();
  const runId = uuid.safeParse(formData.get('runId'));
  const decision = decisionSchema.safeParse(formData.get('decision'));
  const rawQuestion = formData.get('question');
  const question = typeof rawQuestion === 'string' ? rawQuestion.slice(0, QUESTION_MAX) : '';
  if (!runId.success) redirect(routes.help);
  if (!decision.success) redirect(questionHref(runId.data, question, { blad: '1' }));

  try {
    const ai = servicesFor(await createSupabase()).ai;
    await ai.decide(runId.data, [{ fragment: 'answer', decision: decision.data }]);
  } catch (error) {
    console.error('help: deciding about the answer failed', error);
    redirect(questionHref(runId.data, question, { blad: '1' }));
  }
  redirect(questionHref(runId.data, question));
}

'use server';

import { z } from 'zod';
import { ServiceError, servicesFor } from '@sarmata/services';
import { requireMember } from '@/lib/account';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';
import { type PrepRunSnapshot, prepSnapshot } from './conversation-prep';

/** Answer of the panel actions: the run as it is now, or a message to show. */
export interface PrepActionResult {
  run?: PrepRunSnapshot;
  error?: string;
}

const FALLBACK_ERROR = 'Coś poszło nie tak. Spróbuj ponownie.';

const startSchema = z.strictObject({
  employeeId: z.uuid(),
  conversation: z.enum(['starting', 'evaluation', 'ongoing']),
  evaluationId: z.uuid().optional(),
});

const decideSchema = z.strictObject({
  runId: z.uuid(),
  fragment: z.string().min(1).max(200),
  decision: z.enum(['accepted', 'edited', 'rejected']),
  finalText: z.string().trim().min(1).max(10_000).optional(),
});

function failure(error: unknown): PrepActionResult {
  if (error instanceof ServiceError) {
    return { error: serviceErrorMessage(error.code, error.details) };
  }
  console.error('conversation prep: AI action failed', error);
  return { error: FALLBACK_ERROR };
}

async function aiService() {
  const account = await requireMember();
  if (account.role === 'admin') return null;
  return servicesFor(await createSupabase()).ai;
}

/** Starts a conversation preparation for the evaluator or hr, `ai_disabled` comes back as a message. */
export async function startConversationPrep(
  input: z.input<typeof startSchema>,
): Promise<PrepActionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { error: FALLBACK_ERROR };
  const ai = await aiService();
  if (ai === null) return { error: serviceErrorMessage('forbidden') };
  try {
    const run = await ai.start({ kind: 'conversation_prep', ...parsed.data });
    if (run.kind !== 'conversation_prep') return { error: FALLBACK_ERROR };
    return { run: prepSnapshot(run) };
  } catch (error) {
    return failure(error);
  }
}

/** The run as it is now, for the panel that polls a queued or running preparation. */
export async function readConversationPrep(runId: string): Promise<PrepActionResult> {
  if (!z.uuid().safeParse(runId).success) return { error: FALLBACK_ERROR };
  const ai = await aiService();
  if (ai === null) return { error: serviceErrorMessage('forbidden') };
  try {
    const run = await ai.get(runId);
    if (run.kind !== 'conversation_prep') return { error: FALLBACK_ERROR };
    return { run: prepSnapshot(run) };
  } catch (error) {
    return failure(error);
  }
}

/** One decision about one fragment (accept, edit with the corrected text, reject). */
export async function decideConversationPrep(
  input: z.input<typeof decideSchema>,
): Promise<PrepActionResult> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { error: FALLBACK_ERROR };
  const { runId, fragment, decision, finalText } = parsed.data;
  if ((decision === 'edited') !== (finalText !== undefined)) return { error: FALLBACK_ERROR };
  const ai = await aiService();
  if (ai === null) return { error: serviceErrorMessage('forbidden') };
  try {
    const run = await ai.decide(runId, [
      { fragment, decision, ...(finalText === undefined ? {} : { finalText }) },
    ]);
    if (run.kind !== 'conversation_prep') return { error: FALLBACK_ERROR };
    return { run: prepSnapshot(run) };
  } catch (error) {
    return failure(error);
  }
}

import 'server-only';
import { servicesFor } from '@sarmata/services';
import { createSupabase } from '@/lib/supabase';
import { type PrepInitial, type PrepScope, pickPrepRun, prepSnapshot } from './conversation-prep';

async function orNull<T>(label: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.warn(`conversation prep: ${label} failed to load`, error);
    return null;
  }
}

/**
 * The newest conversation preparation of the employee in the scope and whether the office has AI on.
 * Settings closed to the evaluator count as AI on, `start` then answers with its own message.
 */
export async function loadConversationPrep(
  employeeId: string,
  scope: PrepScope,
): Promise<PrepInitial> {
  const services = servicesFor(await createSupabase());
  const [runs, aiEnabled] = await Promise.all([
    orNull('ai runs', () => services.ai.list({ employeeId, kind: 'conversation_prep' })),
    orNull('office settings', async () => (await services.officeSettings.get()).aiEnabled),
  ]);
  const run = pickPrepRun(runs ?? [], scope);
  return { aiEnabled: aiEnabled ?? true, run: run ? prepSnapshot(run) : null };
}

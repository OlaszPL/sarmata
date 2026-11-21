import { errorMessage } from '@sarmata/domain';
import { createServiceClient } from '@sarmata/repositories';
import { workerConfigFromEnv } from './config';

// Unread inbox entries for the demo evaluator Olga Oceniająca (pnpm db:seed:demo, after the demo
// evaluations). due_on and slot come from the stored deadline (evaluation_deadlines), lead_days is one
// of the configured leads (14 and 3) and created_on is the day the seed runs. The unique key of
// notifications (account, kind, evaluation, slot, due_on, lead_days) makes a later collector run skip them.

const OFFICE_ID = '11111111-1111-4111-8111-111111111111';
const EVALUATOR_ACCOUNT_ID = '22222222-2222-4222-8222-000000000003';
const SLOT = 'evaluationDeadline';

const config = workerConfigFromEnv(process.env);
const db = createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey });

// The day the seed runs (UTC), like the day the collector would have run.
const CREATED_ON = new Date().toISOString().slice(0, 10);

async function deadlineOf(email: string): Promise<{ evaluationId: string; dueOn: string }> {
  const { data: employee, error } = await db
    .from('employees')
    .select('id')
    .eq('email', email)
    .single();
  if (error) throw new Error(`Demo employee ${email} not found: ${error.message}`);
  const { data: evaluation, error: evaluationError } = await db
    .from('evaluations')
    .select('id')
    .eq('employee_id', employee.id)
    .eq('evaluator_account_id', EVALUATOR_ACCOUNT_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (evaluationError) throw new Error(`No evaluation of ${email}: ${evaluationError.message}`);
  const { data, error: deadlineError } = await db
    .from('evaluation_deadlines')
    .select('due_on')
    .eq('evaluation_id', evaluation.id)
    .eq('slot', SLOT)
    .not('due_on', 'is', null)
    .is('suspended_since', null)
    .single();
  if (deadlineError) throw new Error(`No ${SLOT} of ${email}: ${deadlineError.message}`);
  return { evaluationId: evaluation.id, dueOn: data.due_on };
}

async function main(): Promise<void> {
  const existing = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', EVALUATOR_ACCOUNT_ID);
  if (existing.error) throw new Error(existing.error.message);
  if ((existing.count ?? 0) > 0) {
    console.log('demo notifications already exist, skipping');
    return;
  }
  const ewa = await deadlineOf('ewa.ewidencyjna@kropka.test');
  const marek = await deadlineOf('marek.merytoryczny@kropka.test');
  const reminder = (deadline: { evaluationId: string; dueOn: string }, leadDays: number) => ({
    office_id: OFFICE_ID,
    account_id: EVALUATOR_ACCOUNT_ID,
    kind: 'deadline_reminder' as const,
    evaluation_id: deadline.evaluationId,
    slot: SLOT,
    due_on: deadline.dueOn,
    lead_days: leadDays,
    created_on: CREATED_ON,
    status: 'open',
  });
  // Marek has both reminders, the earlier one (lead 14) sorts first in the inbox like the collector's.
  const { error } = await db
    .from('notifications')
    .insert([reminder(ewa, 14), reminder(marek, 14), reminder(marek, 3)]);
  if (error) throw new Error(error.message);
  console.log('demo notifications seeded: three unread reminders for Olga Oceniająca');
}

try {
  await main();
} catch (error) {
  console.error(errorMessage(error));
  process.exit(1);
}

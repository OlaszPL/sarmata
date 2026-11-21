import { errorMessage } from '@sarmata/domain';
import { createServiceClient } from '@sarmata/repositories';
import { workerConfigFromEnv } from './config';

// Three unread inbox entries for the demo evaluator Olga Oceniająca (pnpm db:seed:demo, after the demo
// evaluations). They have the shape `public.collect_notifications` writes: the real collector derives
// them from stored deadlines relative to the real day, so the demo day 2026-11-22 is written directly.

const OFFICE_ID = '11111111-1111-4111-8111-111111111111';
const EVALUATOR_ACCOUNT_ID = '22222222-2222-4222-8222-000000000003';
const DEMO_DAY = '2026-11-22';

const config = workerConfigFromEnv(process.env);
const db = createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey });

async function evaluationOf(email: string): Promise<string> {
  const { data: employee, error } = await db
    .from('employees')
    .select('id')
    .eq('email', email)
    .single();
  if (error) throw new Error(`Demo employee ${email} not found: ${error.message}`);
  const { data, error: evaluationError } = await db
    .from('evaluations')
    .select('id')
    .eq('employee_id', employee.id)
    .eq('evaluator_account_id', EVALUATOR_ACCOUNT_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (evaluationError) throw new Error(`No evaluation of ${email}: ${evaluationError.message}`);
  return data.id;
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
  const ewa = await evaluationOf('ewa.ewidencyjna@kropka.test');
  const marek = await evaluationOf('marek.merytoryczny@kropka.test');
  const common = {
    office_id: OFFICE_ID,
    account_id: EVALUATOR_ACCOUNT_ID,
    created_on: DEMO_DAY,
    status: 'open',
  };
  const { error } = await db.from('notifications').insert([
    // 14 days before the evaluation deadline of Ewa (the lead is the nearest configured one).
    {
      ...common,
      kind: 'deadline_reminder',
      evaluation_id: ewa,
      slot: 'evaluationDeadline',
      due_on: '2026-12-06',
      lead_days: 14,
    },
    // 3 days before the deadline of Marek.
    {
      ...common,
      kind: 'deadline_reminder',
      evaluation_id: marek,
      slot: 'evaluationDeadline',
      due_on: '2026-11-25',
      lead_days: 3,
    },
    // Overdue starting interview of Marek: a task without lead time.
    {
      ...common,
      kind: 'deadline_overdue',
      evaluation_id: marek,
      slot: 'startingInterview',
      due_on: '2026-11-18',
      lead_days: null,
    },
  ]);
  if (error) throw new Error(error.message);
  console.log('demo notifications seeded: three unread entries for Olga Oceniająca');
}

try {
  await main();
} catch (error) {
  console.error(errorMessage(error));
  process.exit(1);
}

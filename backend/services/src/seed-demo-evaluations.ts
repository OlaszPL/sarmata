import { calendarDate, errorMessage, parseEnv, sheetContentSchema } from '@sarmata/domain';
import { type Database, type Db } from '@sarmata/repositories';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type Services, servicesFor } from './index';

// Demo evaluations for the demo office (pnpm db:seed:demo, run by pnpm db:reset after the regulation
// sync). They go through the real service as the demo evaluator, so RLS, triggers and gates apply.

const envSchema = z.object({
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const EVALUATOR_EMAIL = 'oceniajacy@kropka.test';
const DEMO_PASSWORD = 'Haslo-Demo-2026';
const today = calendarDate(new Date().toISOString().slice(0, 10));

// Sheet C: five mandatory criteria in catalog order, then the additional ones.
const SHEET_C_MANDATORY = [
  'knowledge-use',
  'reliability',
  'work-organization',
  'cooperation',
  'communication',
];

async function employeeIdByEmail(db: Db, email: string): Promise<string> {
  const { data, error } = await db.from('employees').select('id').eq('email', email).single();
  if (error) throw new Error(`Demo employee ${email} not found: ${error.message}`);
  return data.id;
}

async function seedMarek(services: Services, employeeId: string): Promise<void> {
  const started = await services.evaluations.start({ employeeId, today });
  const content = sheetContentSchema.parse({
    partOne: { additionalCriteria: ['negotiation'], dueOn: null },
    partTwo: started.sheet.content.partTwo,
  });
  await services.evaluations.saveDraft(started.id, content);
  await services.evaluations.transition(started.id, {
    type: 'approve_part_one',
    startingInterviewOn: today,
  });
  await services.evaluations.transition(started.id, {
    type: 'record_part_one_signature',
    signedOn: today,
  });
}

async function seedEwa(services: Services, employeeId: string): Promise<void> {
  const started = await services.evaluations.start({ employeeId, today });
  const additional = ['negotiation', 'analytical-thinking', 'public-speaking'];
  const points = [9, 5, 7, 7, 7, 5, 7, 7];
  const ratings = Object.fromEntries(
    [...SHEET_C_MANDATORY, ...additional].map((id, index) => [id, points[index] ?? 0]),
  );
  const content = sheetContentSchema.parse({
    partOne: { additionalCriteria: additional, dueOn: null },
    partTwo: { ...started.sheet.content.partTwo, ratings, interviewOn: today },
  });
  await services.evaluations.saveDraft(started.id, content);
  await services.evaluations.transition(started.id, {
    type: 'approve_part_one',
    startingInterviewOn: today,
  });
  await services.evaluations.transition(started.id, {
    type: 'record_part_one_signature',
    signedOn: today,
  });
  await services.evaluations.transition(started.id, {
    type: 'record_evaluation_interview',
    heldOn: today,
  });
}

async function main(): Promise<void> {
  const env = parseEnv(envSchema, process.env, 'seed-demo-evaluations');
  const db: Db = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({
    email: EVALUATOR_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`Cannot sign in as ${EVALUATOR_EMAIL}: ${error.message}`);

  const services = servicesFor(db);
  if ((await services.evaluations.list()).length > 0) {
    console.log('demo evaluations already exist, skipping');
    return;
  }
  await seedMarek(services, await employeeIdByEmail(db, 'marek.merytoryczny@kropka.test'));
  await seedEwa(services, await employeeIdByEmail(db, 'ewa.ewidencyjna@kropka.test'));
  console.log('demo evaluations seeded: Marek Merytoryczny (period), Ewa Ewidencyjna (interview)');
}

try {
  await main();
} catch (error) {
  console.error(errorMessage(error));
  process.exit(1);
}

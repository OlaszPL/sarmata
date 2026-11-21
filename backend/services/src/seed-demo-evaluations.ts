import {
  type CalendarDate,
  calendarDate,
  errorMessage,
  parseEnv,
  sheetContentSchema,
} from '@sarmata/domain';
import { type Database, type Db } from '@sarmata/repositories';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type AppServices, type Services, servicesFor } from './index';

// Demo evaluations for the demo office (pnpm db:seed:demo, run by pnpm db:reset after the regulation
// sync). They go through the real service as the demo evaluator, so RLS, triggers and gates apply.

const envSchema = z.object({
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const EVALUATOR_EMAIL = 'oceniajacy@kropka.test';
const HR_EMAIL = 'kadry@kropka.test';
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

// Stefan: an archived evaluation above expectations (2023), then a current one above expectations that
// is delivered and objected by hr. The two consecutive evaluations since the grade was granted
// (2021-03-01) make the grade by law visible in the signals.
async function seedStefan(evaluator: Services, hr: Services, employeeId: string): Promise<void> {
  await evaluator.archivedEvaluations.create({
    employeeId,
    draftedOn: calendarDate('2023-05-10'),
    acquaintedOn: calendarDate('2023-05-12'),
    levelCode: 'above',
    outcome: 'positive',
    ratings: null,
  });
  const started = await evaluator.evaluations.start({ employeeId, today });
  const ratings = Object.fromEntries(SHEET_C_MANDATORY.map((id) => [id, 7]));
  const content = sheetContentSchema.parse({
    partOne: { additionalCriteria: [], dueOn: null },
    partTwo: {
      ...started.sheet.content.partTwo,
      ratings,
      interviewOn: today,
      developmentConclusions: 'Szkolenie z zarządzania projektami i mentoring w zespole.',
    },
  });
  await evaluator.evaluations.saveDraft(started.id, content);
  const commands = [
    { type: 'approve_part_one', startingInterviewOn: today },
    { type: 'record_part_one_signature', signedOn: today },
    { type: 'record_evaluation_interview', heldOn: today },
    { type: 'approve_sheet', draftedOn: today },
    { type: 'record_acquaintance', acquaintedOn: today, signatureRefused: false },
  ] as const;
  for (const command of commands) await evaluator.evaluations.transition(started.id, command);
  const objected = await hr.evaluations.transition(started.id, {
    type: 'file_objection',
    filedOn: today,
  });
  if (objected.signals.gradeByLaw === null) {
    throw new Error('Stefan Sprzeciwny should have the grade by law signal');
  }
}

async function signedInServices(url: string, key: string, email: string): Promise<AppServices> {
  const db: Db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`Cannot sign in as ${email}: ${error.message}`);
  return servicesFor(db);
}

function addDays(date: string, days: number): CalendarDate {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return calendarDate(moved.toISOString().slice(0, 10));
}

interface ClosedSpec {
  readonly employeeId: string;
  readonly points: number;
  readonly conclusions: string;
  readonly justification?: string;
  readonly gradeRequest?: { requestedGrade: number; motivation: string };
  /** hr files the objection and rejects it. */
  readonly rejectedObjectionBy?: Services;
}

// A complete evaluation of the year, through the real service: sheet C with the same points everywhere.
async function seedClosed(services: Services, spec: ClosedSpec): Promise<string> {
  const started = await services.evaluations.start({ employeeId: spec.employeeId, today });
  const ratings = Object.fromEntries(SHEET_C_MANDATORY.map((id) => [id, spec.points]));
  const content = sheetContentSchema.parse({
    partOne: { additionalCriteria: [], dueOn: null },
    partTwo: {
      ...started.sheet.content.partTwo,
      ratings,
      interviewOn: today,
      developmentConclusions: spec.conclusions,
      justification: spec.justification ?? '',
      gradeRequest: spec.gradeRequest ?? null,
    },
  });
  await services.evaluations.saveDraft(started.id, content);
  const commands = [
    { type: 'approve_part_one', startingInterviewOn: today },
    { type: 'record_part_one_signature', signedOn: today },
    { type: 'record_evaluation_interview', heldOn: today },
    { type: 'approve_sheet', draftedOn: today },
    { type: 'record_acquaintance', acquaintedOn: today, signatureRefused: false },
  ] as const;
  for (const command of commands) await services.evaluations.transition(started.id, command);
  if (spec.rejectedObjectionBy === undefined) {
    await services.evaluations.transition(started.id, {
      type: 'close_after_objection_window',
      closedOn: addDays(today, 60),
    });
  } else {
    await spec.rejectedObjectionBy.evaluations.transition(started.id, {
      type: 'file_objection',
      filedOn: today,
    });
    await spec.rejectedObjectionBy.evaluations.decideObjection(started.id, {
      outcome: 'rejected',
      decidedOn: today,
    });
  }
  return started.id;
}

// Closed evaluations of the year for the statistics: two evaluators (Olga and Karol), three units, one
// negative evaluation with a rejected objection and an appeal to the labour court, one civil servant with a
// grade request whose grade is then granted on request.
async function seedClosedEvaluations(
  evaluator: Services,
  hr: AppServices,
  employees: { anna: string; karol: string; olga: string },
): Promise<void> {
  await seedClosed(evaluator, {
    employeeId: employees.anna,
    points: 5,
    conclusions: 'Szkolenie z obsługi nowego systemu kancelaryjnego.',
  });
  const karolEvaluation = await seedClosed(evaluator, {
    employeeId: employees.karol,
    points: 7,
    conclusions: 'Mentoring dla nowych pracowników i kurs prawa pracy.',
    gradeRequest: {
      requestedGrade: 3,
      motivation: 'Ocena powyżej oczekiwań i rozwój kompetencji kadrowych.',
    },
  });
  const olgaEvaluation = await seedClosed(hr, {
    employeeId: employees.olga,
    points: 3,
    conclusions: 'Szkolenie z planowania pracy i komunikacji w zespole.',
    justification: 'Kryteria poniżej oczekiwań w całym okresie oceny, przykłady w notatkach.',
    rejectedObjectionBy: hr,
  });
  await seedClosed(hr, {
    employeeId: employees.anna,
    points: 7,
    conclusions: 'Kurs zarządzania projektami.',
  });
  await hr.hrRegister.recordLabourCourtAppeal({ evaluationId: olgaEvaluation, filedOn: today });
  await hr.hrRegister.recordGradeGrant({
    employeeId: employees.karol,
    evaluationId: karolEvaluation,
    basis: 'on_request',
    grantedOn: today,
    newGrade: 3,
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
  const hr = await signedInServices(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, HR_EMAIL);
  await seedStefan(services, hr, await employeeIdByEmail(db, 'stefan.sprzeciwny@kropka.test'));
  await seedClosedEvaluations(services, hr, {
    anna: await employeeIdByEmail(db, 'admin@kropka.test'),
    karol: await employeeIdByEmail(db, 'kadry@kropka.test'),
    olga: await employeeIdByEmail(db, 'oceniajacy@kropka.test'),
  });
  console.log(
    'demo evaluations seeded: Marek Merytoryczny (period), Ewa Ewidencyjna (interview), Stefan Sprzeciwny (objection), four closed evaluations for the statistics',
  );
}

try {
  await main();
} catch (error) {
  console.error(errorMessage(error));
  process.exit(1);
}

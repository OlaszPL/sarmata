import type { Database } from '@sarmata/database';
import { calendarDate, evaluationResult, retainedFacts } from '@sarmata/domain';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  createRetentionStore,
  createRepositories,
  createServiceClient,
  createStatisticsRepository,
} from './index';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

async function signedIn(email: string): Promise<Db> {
  const db: Db = createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password: 'Haslo-Demo-2026' });
  if (error) throw error;
  return db;
}

describe('retention of the demo office', () => {
  // Needs a fresh `pnpm db:reset`: the seed holds Roman Dawny, who left in 2016 (retention ends 2026-12-31).
  it('demo retention purges the seeded employee and the report is unchanged', async () => {
    const hrDb = await signedIn('kadry@kropka.test');
    const statistics = createStatisticsRepository(hrDb);
    const service = createServiceClient({
      url: env('SUPABASE_URL'),
      secretKey: env('SUPABASE_SECRET_KEY'),
    });
    const roman = await service
      .from('employees')
      .select('id, anonymized_at')
      .eq('email', 'roman.dawny@kropka.test')
      .single();
    if (roman.error) throw roman.error;
    expect(roman.data.anonymized_at).toBeNull();

    // The projection of the 2016 results, as the statistics service saves it before a report.
    const sources = await statistics.resultSources(2016);
    expect(sources.length).toBeGreaterThan(0);
    await statistics.saveResults(
      sources.map((source) => ({
        evaluationId: source.evaluationId,
        sheetVersion: source.sheetVersion,
        ...evaluationResult(source.regulation, { ...source, history: [] }),
      })),
    );
    const before = {
      figures: await statistics.officeFigures(2016),
      evaluators: await statistics.evaluatorFigures(2016),
    };
    expect(before.figures.distribution.length).toBeGreaterThan(0);

    // The period is not over yet today, a day after 2026-12-31 it is.
    const store = createRetentionStore(service);
    expect(
      (await store.dueEmployees(calendarDate('2026-12-31'))).map((d) => d.employeeId),
    ).not.toContain(roman.data.id);
    const day = calendarDate('2027-01-01');
    const due = await store.dueEmployees(day);
    expect(due.map((entry) => entry.employeeId)).toContain(roman.data.id);
    await store.purgeExpiredContent(day);
    for (const entry of due) {
      const evaluations = await store.evaluationsOf(entry.employeeId);
      const facts = evaluations.flatMap((source) => retainedFacts(source.regulation, source) ?? []);
      await store.anonymize(entry.employeeId, day, facts);
    }

    const after = {
      figures: await statistics.officeFigures(2016),
      evaluators: await statistics.evaluatorFigures(2016),
    };
    expect(after).toEqual(before);
    const anonymized = await service
      .from('employees')
      .select('first_name, anonymized_at')
      .eq('id', roman.data.id)
      .single();
    expect(anonymized.data?.first_name).toBe('Anonimizowany');
    expect(anonymized.data?.anonymized_at).not.toBeNull();
    // The list tells an anonymized record apart without reading the name.
    const listed = (await createRepositories(hrDb).employees.list()).find(
      (e) => e.id === roman.data.id,
    );
    expect(listed?.anonymizedAt).not.toBeNull();
  });
});

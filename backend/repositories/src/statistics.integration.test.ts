import type { Database } from '@sarmata/database';
import { evaluationResult } from '@sarmata/domain';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { type Db, createStatisticsRepository } from './index';

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

const year = new Date().getUTCFullYear();

describe('statistics repository', () => {
  it('result sources include a demo evaluation with a locked sheet', async () => {
    const hr = createStatisticsRepository(await signedIn('kadry@kropka.test'));
    const sources = await hr.resultSources(year);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0]?.regulation.id).toBe('regulation-2016');
  });

  it('hr saves results and reads office figures', async () => {
    const hr = createStatisticsRepository(await signedIn('kadry@kropka.test'));
    const sources = await hr.resultSources(year);
    const rows = sources.map((source) => ({
      evaluationId: source.evaluationId,
      sheetVersion: source.sheetVersion,
      ...evaluationResult(source.regulation, { ...source, history: [] }),
    }));
    expect(await hr.saveResults(rows)).toBe(rows.length);
    const figures = await hr.officeFigures(year);
    const counted = figures.distribution.reduce((sum, row) => sum + row.evaluations, 0);
    expect(counted).toBe(rows.length);
    expect(figures.counts.civilServants).toBeGreaterThan(0);
    expect(await hr.evaluatorFigures(year)).not.toHaveLength(0);
  });

  it('evaluator gets 42501 from office figures', async () => {
    const evaluator = createStatisticsRepository(await signedIn('oceniajacy@kropka.test'));
    await expect(evaluator.officeFigures(year)).rejects.toMatchObject({ code: '42501' });
    await expect(evaluator.schedule()).rejects.toMatchObject({ code: '42501' });
  });

  it('admin gets 42501 from evaluator figures', async () => {
    const admin = createStatisticsRepository(await signedIn('admin@kropka.test'));
    await expect(admin.evaluatorFigures(year)).rejects.toMatchObject({ code: '42501' });
    expect(await admin.officeFigures(year)).toHaveProperty('distribution');
  });
});

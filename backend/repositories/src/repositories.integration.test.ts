import type { Database } from '@sarmata/database';
import { officialRegulations } from '@sarmata/regulations';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  RepositoryError,
  createJobQueue,
  createRepositories,
  createServiceClient,
} from './index';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');

const DEMO_OFFICE_ID = '11111111-1111-4111-8111-111111111111';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

function anonymousClient(): Db {
  return createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(email: string): Promise<Db> {
  const db = anonymousClient();
  const { error } = await db.auth.signInWithPassword({ email, password: 'Haslo-Demo-2026' });
  if (error) throw error;
  return db;
}

const serviceClient = (): Db =>
  createServiceClient({ url: env('SUPABASE_URL'), secretKey: env('SUPABASE_SECRET_KEY') });

describe('employees', () => {
  it('lists the employees of the signed-in office sorted by last name', async () => {
    const employees = await createRepositories(
      await signedIn('kadry@kropka.test'),
    ).employees.list();
    expect(employees.map((employee) => employee.lastName)).toEqual([
      'Administracyjna',
      'Ewidencyjna',
      'Kadrowy',
      'Merytoryczny',
      'Oceniająca',
    ]);
    expect(new Set(employees.map((employee) => employee.officeId))).toEqual(
      new Set([DEMO_OFFICE_ID]),
    );
  });

  it('refuses an anonymous client', async () => {
    await expect(createRepositories(anonymousClient()).employees.list()).rejects.toThrow(
      RepositoryError,
    );
  });
});

describe('regulation versions', () => {
  it('returns the synced official versions equal to the code catalog', async () => {
    const repositories = createRepositories(await signedIn('oceniajacy@kropka.test'));
    expect(await repositories.regulationVersions.listOfficial()).toEqual([...officialRegulations]);
  });

  it('returns null for an unknown code', async () => {
    const repositories = createRepositories(await signedIn('oceniajacy@kropka.test'));
    expect(await repositories.regulationVersions.findOfficial('regulation-1999')).toBeNull();
  });

  it('does not let an account write an official version', async () => {
    const repositories = createRepositories(await signedIn('admin@kropka.test'));
    const document = { ...regulation2016, id: 'regulation-fake' };
    await expect(repositories.regulationVersions.insertOfficial(document)).rejects.toThrow(
      RepositoryError,
    );
  });
});

describe('job queue', () => {
  it('sends, reads and archives a job with the service client', async () => {
    const queue = createJobQueue(serviceClient());
    const id = await queue.send({ type: 'test.integration', payload: { at: Date.now() } });
    const read = await queue.read(100, 30);
    expect(read.find((job) => job.id === id)).toMatchObject({
      readCount: 1,
      message: { type: 'test.integration' },
    });
    await queue.archive(id);
  });

  it('does not let an account use the queue', async () => {
    const queue = createJobQueue(await signedIn('admin@kropka.test'));
    await expect(queue.send({ type: 'test.denied', payload: {} })).rejects.toThrow(RepositoryError);
  });
});

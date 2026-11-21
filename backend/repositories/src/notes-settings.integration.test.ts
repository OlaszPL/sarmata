import type { Database } from '@sarmata/database';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  createNoteRepository,
  createOfficeSettingsRepository,
  createRepositories,
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

async function employeeId(db: Db, lastName: string): Promise<string> {
  const employee = (await createRepositories(db).employees.list()).find(
    (e) => e.lastName === lastName,
  );
  if (employee === undefined) throw new Error(`No demo employee ${lastName}`);
  return employee.id;
}

const SIGNAL = '2026-03-02';

describe('notes', () => {
  it('evaluator writes a note and hr reads it', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const marek = await employeeId(evaluator, 'Merytoryczny');
    const note = await createNoteRepository(evaluator).create({
      employeeId: marek,
      kind: 'appreciation',
      occurredOn: SIGNAL,
      sign: 'plus',
      communicated: false,
      body: 'Test: pomogła zespołowi przy kontroli.',
    });
    expect(note).toMatchObject({ employeeId: marek, version: 1, criterionId: null });

    const hr = await signedIn('kadry@kropka.test');
    const seen = await createNoteRepository(hr).listForEmployee(marek);
    expect(seen.map((n) => n.id)).toContain(note.id);
  });

  it('edit keeps history in order', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const notes = createNoteRepository(evaluator);
    const marek = await employeeId(evaluator, 'Merytoryczny');
    const note = await notes.create({
      employeeId: marek,
      kind: 'observation',
      occurredOn: SIGNAL,
      sign: 'minus',
      communicated: false,
      body: 'Test: wersja 1',
    });
    await notes.update(note.id, { body: 'Test: wersja 2' });
    await notes.update(note.id, { body: 'Test: wersja 3', communicated: true });
    const versions = await notes.versions(note.id);
    expect(versions.map((v) => [v.version, v.body, v.validTo === null])).toEqual([
      [1, 'Test: wersja 1', false],
      [2, 'Test: wersja 2', false],
      [3, 'Test: wersja 3', true],
    ]);
  });

  it('hr update of evaluator note returns null', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const marek = await employeeId(evaluator, 'Merytoryczny');
    const note = await createNoteRepository(evaluator).create({
      employeeId: marek,
      kind: 'observation',
      occurredOn: SIGNAL,
      sign: 'plus',
      communicated: false,
      body: 'Test: tylko autor edytuje',
    });
    const hr = await signedIn('kadry@kropka.test');
    expect(await createNoteRepository(hr).update(note.id, { body: 'Zmiana kadr' })).toBeNull();
  });
});

describe('demo seed', () => {
  it('demo seed has notes about Marek with one edited', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const marek = await employeeId(evaluator, 'Merytoryczny');
    // Other tests in this file write notes with the "Test:" prefix.
    const seeded = (await createNoteRepository(evaluator).listForEmployee(marek)).filter(
      (note) => !note.body.startsWith('Test:'),
    );
    expect(seeded).toHaveLength(3);
    expect(seeded.filter((note) => note.version === 2)).toHaveLength(1);
    expect(seeded.map((note) => note.kind).sort()).toEqual([
      'observation',
      'ongoing_conversation',
      'workload_fact',
    ]);
    expect(seeded.find((note) => note.kind === 'workload_fact')?.sign).toBeNull();
    const settings = await createOfficeSettingsRepository(evaluator).get();
    expect(settings).toMatchObject({ notesRetentionMonths: 36, aiEnabled: true });
  });
});

describe('office settings', () => {
  it('admin updates settings and evaluator sees them', async () => {
    const admin = await signedIn('admin@kropka.test');
    const settings = createOfficeSettingsRepository(admin);
    const updated = await settings.update({ reminderLeadDays: [7], evaluationVisibility: 'tree' });
    try {
      expect(updated).toMatchObject({ reminderLeadDays: [7], evaluationVisibility: 'tree' });
      const seen = await createOfficeSettingsRepository(
        await signedIn('oceniajacy@kropka.test'),
      ).get();
      expect(seen).toMatchObject({ reminderLeadDays: [7], evaluationVisibility: 'tree' });
      const denied = await createOfficeSettingsRepository(
        await signedIn('kadry@kropka.test'),
      ).update({
        aiEnabled: false,
      });
      expect(denied).toBeNull();
    } finally {
      await settings.update({ reminderLeadDays: [14, 3], evaluationVisibility: 'office' });
    }
  });

  it('smtp password sets passwordSet only', async () => {
    const settings = createOfficeSettingsRepository(await signedIn('admin@kropka.test'));
    await settings.setSmtpPassword('integration-secret');
    const seen = await settings.get();
    expect(seen?.smtp.passwordSet).toBe(true);
    expect(JSON.stringify(seen)).not.toContain('integration-secret');
    expect(Object.keys(seen?.smtp ?? {}).sort()).toEqual([
      'from',
      'host',
      'passwordSet',
      'port',
      'user',
    ]);
  });
});

import type { Database } from '@sarmata/database';
import { type RegulationDocument, calendarDate, parseRegulationDocument } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  RepositoryError,
  createRegulationDraftRepository,
  createRegulationVersionRepository,
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

const official = officialRegulations[0];
if (!official) throw new Error('missing official regulation');

const unique = (): string => Math.random().toString(36).slice(2, 8);

/** The official document as a draft of the office: own id and a far-future date. */
function cloneAs(code: string, effectiveFrom: string): RegulationDocument {
  return parseRegulationDocument({ ...official, id: code, effectiveFrom });
}

describe('regulation drafts', () => {
  it('admin clones, edits and publishes a local version', async () => {
    const drafts = createRegulationDraftRepository(await signedIn('admin@kropka.test'));
    const code = `regulation-2016-local-${unique()}`;
    const created = await drafts.createDraft({
      code,
      basedOn: null,
      document: cloneAs(code, '2090-01-05'),
    });
    expect(created).toMatchObject({ code, status: 'draft', publishedAt: null });

    const edited = parseRegulationDocument({ ...created.document, name: 'Przepisy urzędu' });
    expect(await drafts.updateDraft(created.id, edited)).toMatchObject({
      document: { name: 'Przepisy urzędu' },
    });

    const published = await drafts.publish(
      created.id,
      parseRegulationDocument({ ...edited, effectiveFrom: '2090-02-01' }),
    );
    expect(published).toMatchObject({ status: 'published', effectiveFrom: '2090-02-01' });
    expect(published?.publishedAt).not.toBeNull();

    expect(await drafts.updateDraft(created.id, edited)).toBeNull();
    expect(await drafts.deleteDraft(created.id)).toBe(false);
    expect((await drafts.listLocal()).map((version) => version.code)).toContain(code);
  });

  it('hr reads local versions but updateDraft returns null', async () => {
    const admin = createRegulationDraftRepository(await signedIn('admin@kropka.test'));
    const code = `regulation-2016-local-${unique()}`;
    const document = cloneAs(code, '2090-03-01');
    const created = await admin.createDraft({ code, basedOn: null, document });

    const hr = createRegulationDraftRepository(await signedIn('kadry@kropka.test'));
    expect((await hr.listLocal()).map((version) => version.id)).toContain(created.id);
    expect(await hr.updateDraft(created.id, document)).toBeNull();
    expect(await hr.deleteDraft(created.id)).toBe(false);
    await expect(hr.createDraft({ code: `${code}-b`, basedOn: null, document })).rejects.toThrow(
      RepositoryError,
    );
    expect(await admin.deleteDraft(created.id)).toBe(true);
  });

  it('listInForceCandidates skips drafts', async () => {
    const db = await signedIn('admin@kropka.test');
    const code = `regulation-2016-local-${unique()}`;
    const created = await createRegulationDraftRepository(db).createDraft({
      code,
      basedOn: null,
      document: cloneAs(code, '2090-04-01'),
    });
    const candidates = await createRegulationVersionRepository(db).listInForceCandidates();
    expect(candidates.map((candidate) => candidate.rowId)).not.toContain(created.id);
    expect(candidates.find((candidate) => candidate.code === 'regulation-2016')).toMatchObject({
      isOfficial: true,
      document: { effectiveFrom: calendarDate('2016-04-23') },
    });
    await createRegulationDraftRepository(db).deleteDraft(created.id);
  });

  it('findByCode finds a draft of the office', async () => {
    const db = await signedIn('admin@kropka.test');
    const code = `regulation-2016-local-${unique()}`;
    const drafts = createRegulationDraftRepository(db);
    const created = await drafts.createDraft({
      code,
      basedOn: null,
      document: cloneAs(code, '2090-05-01'),
    });
    const versions = createRegulationVersionRepository(db);
    expect(await versions.findByCode(code)).toMatchObject({
      rowId: created.id,
      isOfficial: false,
    });
    expect(await versions.findByCode('regulation-2016')).toMatchObject({ isOfficial: true });
    expect(await versions.findByCode('no-such-version')).toBeNull();
    await drafts.deleteDraft(created.id);
  });
});

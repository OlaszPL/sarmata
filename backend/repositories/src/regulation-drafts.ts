import { type RegulationDocument, parseRegulationDocument } from '@sarmata/domain';
import { type Db } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

/** A regulation version of the office: a draft the admin edits or a published, immutable version. */
export interface LocalRegulationVersion {
  id: string;
  code: string;
  status: 'draft' | 'published';
  /** Row id of the version this one was cloned from. */
  basedOn: string | null;
  effectiveFrom: string;
  publishedAt: string | null;
  document: RegulationDocument;
}

export interface RegulationDraftRepository {
  /** Versions of the own office, oldest first. */
  listLocal(): Promise<LocalRegulationVersion[]>;
  createDraft(input: {
    code: string;
    basedOn: string | null;
    document: RegulationDocument;
  }): Promise<LocalRegulationVersion>;
  /** Null when no draft was changed: unknown id, already published or not allowed for the account. */
  updateDraft(id: string, document: RegulationDocument): Promise<LocalRegulationVersion | null>;
  /** Writes status, effective date and document in one update. Null as `updateDraft`. */
  publish(id: string, document: RegulationDocument): Promise<LocalRegulationVersion | null>;
  /** False when no draft was deleted. */
  deleteDraft(id: string): Promise<boolean>;
}

const COLUMNS = 'id, code, status, based_on, effective_from, published_at, document';

interface Row {
  id: string;
  code: string;
  status: string;
  based_on: string | null;
  effective_from: string;
  published_at: string | null;
  document: unknown;
}

const toLocal = (row: Row): LocalRegulationVersion => ({
  id: row.id,
  code: row.code,
  status: row.status === 'published' ? 'published' : 'draft',
  basedOn: row.based_on,
  effectiveFrom: row.effective_from,
  publishedAt: row.published_at,
  document: parseRegulationDocument(row.document),
});

export function createRegulationDraftRepository(db: Db): RegulationDraftRepository {
  return {
    async listLocal() {
      const { data, error } = await db
        .from('regulation_versions')
        .select(COLUMNS)
        .eq('is_official', false)
        .order('effective_from')
        .order('created_at');
      if (error) throw new RepositoryError('regulationDrafts.listLocal', error);
      return data.map(toLocal);
    },

    async createDraft({ code, basedOn, document }) {
      const { data, error } = await db
        .from('regulation_versions')
        .insert({
          code,
          is_official: false,
          based_on: basedOn,
          effective_from: document.effectiveFrom,
          document: toJson(document),
        })
        .select(COLUMNS)
        .single();
      if (error) throw new RepositoryError('regulationDrafts.createDraft', error);
      return toLocal(data);
    },

    async updateDraft(id, document) {
      const { data, error } = await db
        .from('regulation_versions')
        .update({ effective_from: document.effectiveFrom, document: toJson(document) })
        .eq('id', id)
        .eq('status', 'draft')
        .eq('is_official', false)
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw new RepositoryError('regulationDrafts.updateDraft', error);
      return data === null ? null : toLocal(data);
    },

    async publish(id, document) {
      const { data, error } = await db
        .from('regulation_versions')
        .update({
          status: 'published',
          effective_from: document.effectiveFrom,
          document: toJson(document),
        })
        .eq('id', id)
        .eq('status', 'draft')
        .eq('is_official', false)
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw new RepositoryError('regulationDrafts.publish', error);
      return data === null ? null : toLocal(data);
    },

    async deleteDraft(id) {
      const { data, error } = await db
        .from('regulation_versions')
        .delete()
        .eq('id', id)
        .eq('status', 'draft')
        .eq('is_official', false)
        .select('id');
      if (error) throw new RepositoryError('regulationDrafts.deleteDraft', error);
      return data.length > 0;
    },
  };
}

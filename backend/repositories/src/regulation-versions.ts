import { type RegulationDocument, parseRegulationDocument } from '@sarmata/domain';
import { type Db, type ServiceDb } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

/** A regulation version with the uuid of its row, which an evaluation pins. */
export interface StoredRegulationVersion {
  rowId: string;
  code: string;
  isOfficial: boolean;
  document: RegulationDocument;
}

export interface RegulationVersionRepository {
  /** Official versions, oldest first. */
  listOfficial(): Promise<RegulationDocument[]>;
  /** The official version with this document id. The id is stored in the `code` column. */
  findOfficialById(id: string): Promise<RegulationDocument | null>;
  /** The `regulation_versions` row uuid of the official version with this document id (for foreign keys). */
  findOfficialRowId(id: string): Promise<string | null>;
  /** Published versions an evaluation can pin: the official ones and the published ones of the office (RLS). */
  listInForceCandidates(): Promise<StoredRegulationVersion[]>;
  /** An official version or a version of the office, drafts included, by document id. */
  findByCode(code: string): Promise<StoredRegulationVersion | null>;
}

interface VersionRow {
  id: string;
  code: string;
  is_official: boolean;
  document: unknown;
}

const toStored = (row: VersionRow): StoredRegulationVersion => ({
  rowId: row.id,
  code: row.code,
  isOfficial: row.is_official,
  document: parseRegulationDocument(row.document),
});

/** Writes official versions. Needs the service client: accounts cannot create them (RLS). */
export interface OfficialRegulationWriter {
  insertOfficial(document: RegulationDocument): Promise<void>;
}

export function createRegulationVersionRepository(db: Db | ServiceDb): RegulationVersionRepository {
  return {
    async listOfficial() {
      const { data, error } = await db
        .from('regulation_versions')
        .select('document')
        .eq('is_official', true)
        .order('effective_from');
      if (error) throw new RepositoryError('regulationVersions.listOfficial', error);
      return data.map((row) => parseRegulationDocument(row.document));
    },

    async findOfficialById(id) {
      const { data, error } = await db
        .from('regulation_versions')
        .select('document')
        .eq('is_official', true)
        .eq('code', id)
        .maybeSingle();
      if (error) throw new RepositoryError('regulationVersions.findOfficialById', error);
      return data === null ? null : parseRegulationDocument(data.document);
    },

    async findOfficialRowId(id) {
      const { data, error } = await db
        .from('regulation_versions')
        .select('id')
        .eq('is_official', true)
        .eq('code', id)
        .maybeSingle();
      if (error) throw new RepositoryError('regulationVersions.findOfficialRowId', error);
      return data?.id ?? null;
    },

    async listInForceCandidates() {
      const { data, error } = await db
        .from('regulation_versions')
        .select('id, code, is_official, document')
        .eq('status', 'published')
        .order('effective_from');
      if (error) throw new RepositoryError('regulationVersions.listInForceCandidates', error);
      return data.map(toStored);
    },

    async findByCode(code) {
      const { data, error } = await db
        .from('regulation_versions')
        .select('id, code, is_official, document')
        .eq('code', code)
        .maybeSingle();
      if (error) throw new RepositoryError('regulationVersions.findByCode', error);
      return data === null ? null : toStored(data);
    },
  };
}

export function createOfficialRegulationWriter(db: ServiceDb): OfficialRegulationWriter {
  return {
    async insertOfficial(document) {
      const { error } = await db.from('regulation_versions').insert({
        code: document.id,
        office_id: null,
        is_official: true,
        effective_from: document.effectiveFrom,
        document: toJson(document),
      });
      if (error) throw new RepositoryError('regulationVersions.insertOfficial', error);
    },
  };
}

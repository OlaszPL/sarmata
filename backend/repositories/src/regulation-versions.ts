import { type RegulationDocument, parseRegulationDocument } from '@sarmata/domain';
import { type Db, type ServiceDb } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

export interface RegulationVersionRepository {
  /** Official versions, oldest first. */
  listOfficial(): Promise<RegulationDocument[]>;
  /** The official version with this document id. The id is stored in the `code` column. */
  findOfficialById(id: string): Promise<RegulationDocument | null>;
  /** The `regulation_versions` row uuid of the official version with this document id (for foreign keys). */
  findOfficialRowId(id: string): Promise<string | null>;
}

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

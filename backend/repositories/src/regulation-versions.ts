import { type RegulationDocument, parseRegulationDocument } from '@sarmata/domain';
import { type Db } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

export interface RegulationVersionRepository {
  /** Official versions, oldest first. */
  listOfficial(): Promise<RegulationDocument[]>;
  findOfficial(code: string): Promise<RegulationDocument | null>;
  /** Needs the service client: accounts cannot create official versions (RLS). */
  insertOfficial(document: RegulationDocument): Promise<void>;
}

export function createRegulationVersionRepository(db: Db): RegulationVersionRepository {
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

    async findOfficial(code) {
      const { data, error } = await db
        .from('regulation_versions')
        .select('document')
        .eq('is_official', true)
        .eq('code', code)
        .maybeSingle();
      if (error) throw new RepositoryError('regulationVersions.findOfficial', error);
      return data === null ? null : parseRegulationDocument(data.document);
    },

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

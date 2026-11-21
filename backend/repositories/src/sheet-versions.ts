import { type SheetContent, sheetContentSchema } from '@sarmata/domain';
import { type Db } from './db';
import { RepositoryError } from './errors';

/** One stored version of an evaluation sheet, including the replaced and cancelled ones. */
export interface SheetVersion {
  readonly version: number;
  readonly state: 'draft' | 'locked' | 'superseded' | 'cancelled';
  readonly content: SheetContent;
  readonly reason: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface SheetVersionRepository {
  /** All versions of the evaluation, oldest first. Empty for an evaluation that is not visible. */
  listForEvaluation(evaluationId: string): Promise<SheetVersion[]>;
}

const COLUMNS = 'version, state, content, reason, created_by, created_at' as const;

export function createSheetVersionRepository(db: Db): SheetVersionRepository {
  return {
    async listForEvaluation(evaluationId) {
      const { data, error } = await db
        .from('evaluation_sheets')
        .select(COLUMNS)
        .eq('evaluation_id', evaluationId)
        .order('version', { ascending: true });
      if (error) throw new RepositoryError('sheetVersions.listForEvaluation', error);
      return data.map((row) => ({
        version: row.version,
        state: row.state as SheetVersion['state'],
        content: sheetContentSchema.parse(row.content),
        reason: row.reason,
        createdBy: row.created_by,
        createdAt: row.created_at,
      }));
    },
  };
}

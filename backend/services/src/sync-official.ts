import { type RegulationDocument } from '@sarmata/domain';
import { type RegulationVersionRepository } from '@sarmata/repositories';
import { ServiceError } from './errors';
import { sameJson } from './same-json';

export interface SyncReport {
  readonly inserted: string[];
  readonly unchanged: string[];
}

/**
 * Loads official versions from code into the database as immutable rows. Checks every version first,
 * so a drift stops the sync before anything is written.
 */
export async function syncOfficialRegulations(
  repository: RegulationVersionRepository,
  official: readonly RegulationDocument[],
): Promise<SyncReport> {
  const missing: RegulationDocument[] = [];
  const unchanged: string[] = [];
  for (const document of official) {
    const stored = await repository.findOfficial(document.id);
    if (stored === null) {
      missing.push(document);
    } else if (sameJson(stored, document)) {
      unchanged.push(document.id);
    } else {
      throw new ServiceError(
        'regulation_drift',
        `Official regulation version ${document.id} in the database differs from the code. ` +
          'Official versions are immutable: publish the change as a new version.',
      );
    }
  }
  for (const document of missing) await repository.insertOfficial(document);
  return { inserted: missing.map((document) => document.id), unchanged };
}

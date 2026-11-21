import { officialRegulations } from '@sarmata/regulations';
import {
  type ServiceDb,
  createEvaluationClosingStore,
  createOfficialRegulationWriter,
  createRegulationVersionRepository,
} from '@sarmata/repositories';
import { type EvaluationClosing, createEvaluationClosing } from './evaluations/evaluation-closing';
import { type SyncReport, syncOfficialRegulations } from './sync-official';

/** Services that act for the system, not for an account. Never handed to the frontend. */
export interface SystemServices {
  readonly regulations: {
    /** Loads the official versions of @sarmata/regulations into the database. */
    syncOfficial(): Promise<SyncReport>;
  };
  readonly evaluationClosing: EvaluationClosing;
}

/** Needs the service client (`ServiceDb`), so only the worker and scripts can build it. */
export function createSystemServices(db: ServiceDb): SystemServices {
  return {
    regulations: {
      syncOfficial: () =>
        syncOfficialRegulations({
          reader: createRegulationVersionRepository(db),
          writer: createOfficialRegulationWriter(db),
          official: officialRegulations,
        }),
    },
    evaluationClosing: createEvaluationClosing(createEvaluationClosingStore(db)),
  };
}

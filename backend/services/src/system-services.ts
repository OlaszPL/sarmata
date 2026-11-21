import { officialRegulations } from '@sarmata/regulations';
import {
  type ServiceDb,
  createEvaluationClosingStore,
  createOfficialRegulationWriter,
  createRegulationVersionRepository,
  createRetentionStore,
  createAccountAdminStore,
} from '@sarmata/repositories';
import {
  type AccountAdministration,
  createAccountAdministration,
} from './accounts/account-administration';
import { type EvaluationClosing, createEvaluationClosing } from './evaluations/evaluation-closing';
import { type RetentionService, createRetentionService } from './retention/retention-service';
import { type SyncReport, syncOfficialRegulations } from './sync-official';

/** Services that act for the system, not for an account. Never handed to the frontend. */
export interface SystemServices {
  readonly regulations: {
    /** Loads the official versions of @sarmata/regulations into the database. */
    syncOfficial(): Promise<SyncReport>;
  };
  readonly evaluationClosing: EvaluationClosing;
  readonly retention: RetentionService;
  /** Invites accounts (Supabase Auth admin). The frontend gets it only through `servicesFor(db, { accountAdministration })`. */
  readonly accounts: AccountAdministration;
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
    accounts: createAccountAdministration({ store: createAccountAdminStore(db) }),
    retention: createRetentionService({
      store: createRetentionStore(db),
      log: (message) => {
        console.warn(message);
      },
    }),
  };
}

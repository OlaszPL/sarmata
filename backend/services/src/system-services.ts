import { officialRegulations } from '@sarmata/regulations';
import {
  type ServiceDb,
  createEvaluationClosingStore,
  createOfficialRegulationWriter,
  createRegulationVersionRepository,
  createRetentionStore,
  createAccountAdminStore,
  createAccountInvitationStore,
} from '@sarmata/repositories';
import {
  type AccountAdministration,
  createAccountAdministration,
} from './accounts/account-administration';
import {
  type InvitationProcessing,
  createInvitationProcessing,
} from './accounts/invitation-processing';
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
  /** Invites accounts (Supabase Auth admin). The frontend asks for it through `services.accounts.invite`, the worker runs it. */
  readonly accounts: AccountAdministration;
  /** Carries out the invitation requests the frontend queued, for the `accounts.invite` job. */
  readonly accountInvitations: InvitationProcessing;
}

export interface SystemServicesOptions {
  /** Where the link of an invitation e-mail leads (the site URL). */
  readonly siteUrl?: string;
}

/** Needs the service client (`ServiceDb`), so only the worker and scripts can build it. */
export function createSystemServices(
  db: ServiceDb,
  options: SystemServicesOptions = {},
): SystemServices {
  const accounts = createAccountAdministration({ store: createAccountAdminStore(db) });
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
    accounts,
    accountInvitations: createInvitationProcessing({
      store: createAccountInvitationStore(db),
      administration: accounts,
      ...(options.siteUrl === undefined ? {} : { redirectTo: options.siteUrl }),
    }),
    retention: createRetentionService({
      store: createRetentionStore(db),
      log: (message) => {
        console.warn(message);
      },
    }),
  };
}

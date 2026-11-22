import {
  type CalendarDate,
  type DeadlineFacts,
  type DeadlineResult,
  type DeadlineSlot,
  type NewEmployeeInput,
  type RegulationDocument,
  computeDeadline,
  employeePatchSchema,
  newEmployeeSchema,
  officeVersionInForce,
} from '@sarmata/domain';
import {
  type Db,
  type ArchivedEvaluation,
  type Employee,
  type NewArchivedEvaluation,
  type OfficeSettingsRepository,
  type Repositories,
  type SimilarEmployee,
  createEmploymentRepository,
  createHrRegisterRepository,
  createAiRunRepository,
  createNoteRepository,
  createRegulationDraftRepository,
  createNotificationRepository,
  createStatisticsRepository,
  createNotesRetentionPreviewRepository,
  createOfficeSettingsRepository,
  createRepositories,
  createAccountInvitationRepository,
  createAccountRepository,
} from '@sarmata/repositories';
import { type AccountsService, createAccountsService } from './accounts/accounts-service';
import {
  type EmployeeImportService,
  createEmployeeImportService,
} from './employee-import/employee-import-service';
import { ServiceError } from './errors';
import { type EmploymentService, createEmploymentService } from './employment/employment-service';
import { type HrRegisterService, createHrRegisterService } from './hr-register/hr-register-service';
import { type StatisticsService, createStatisticsService } from './statistics/statistics-service';
import { type NoteService, createNoteService } from './notes/note-service';
import {
  type NotificationService,
  createNotificationService,
} from './notifications/notification-service';
import {
  type OfficeSettingsService,
  createOfficeSettingsService,
} from './office-settings/office-settings-service';
import { type EvaluationService, createEvaluationService } from './evaluations/evaluation-service';
import { getCurrentAccount } from './account/current-account';
import { type AiService, createAiService } from './ai/ai-service';
import {
  type RegulationEditorService,
  createRegulationEditorService,
  todayUtc,
} from './regulations/regulation-editor-service';
import { officialCases, trainingCatalog } from '@sarmata/regulations';
import {
  type DevelopmentService,
  createDevelopmentService,
} from './development/development-service';

export interface ServiceDependencies {
  readonly repositories: Repositories;
  /** Id of the signed-in account, needed to start an evaluation without a named evaluator. */
  readonly currentAccountId?: () => Promise<string>;
  /** Default place and sheet A objection addressee. Without it the rules text applies. */
  readonly officeSettings?: OfficeSettingsRepository;
}

export interface DeadlineRequest {
  /** Id of the regulation document, e.g. `regulation-2016`. */
  readonly regulationId: string;
  readonly slot: DeadlineSlot;
  readonly facts: DeadlineFacts;
}

export interface Services {
  readonly employees: {
    list(): Promise<Employee[]>;
    get(id: string): Promise<Employee | null>;
    /** Throws `ZodError` for invalid input. */
    create(input: NewEmployeeInput): Promise<Employee>;
    update(id: string, patch: Partial<NewEmployeeInput>): Promise<Employee>;
    findSimilar(search: string): Promise<SimilarEmployee[]>;
  };
  readonly regulations: {
    inForceOn(on: CalendarDate): Promise<RegulationDocument>;
    /** The regulation version the evaluation is pinned to. `not_found` for an evaluation the account cannot see, `unknown_regulation` for a missing version. */
    forEvaluation(evaluationId: string): Promise<RegulationDocument>;
  };
  readonly evaluations: EvaluationService;
  readonly archivedEvaluations: {
    /** Enters a past evaluation result by hand (hr or evaluator). */
    create(input: NewArchivedEvaluation): Promise<void>;
    listForEmployee(employeeId: string): Promise<ArchivedEvaluation[]>;
  };
  readonly deadlines: { compute(request: DeadlineRequest): Promise<DeadlineResult> };
}

export function createServices(dependencies: ServiceDependencies): Services {
  const { repositories, currentAccountId, officeSettings } = dependencies;

  const evaluations = createEvaluationService({
    repositories,
    regulationInForceOn: (on) => regulations.inForceOn(on),
    ...(currentAccountId === undefined ? {} : { currentAccountId }),
    ...(officeSettings === undefined ? {} : { officeSettings }),
  });

  const regulations: Services['regulations'] = {
    async inForceOn(on) {
      const candidates = await repositories.regulationVersions.listInForceCandidates();
      const version = officeVersionInForce(
        candidates.map((candidate) => ({
          ...candidate,
          effectiveFrom: candidate.document.effectiveFrom,
        })),
        on,
      );
      if (version === null) {
        throw new ServiceError(
          'no_regulation_in_force',
          `No regulation version is in force on ${on}`,
        );
      }
      return version.document;
    },

    forEvaluation: (evaluationId) => evaluations.pinnedRegulation(evaluationId),
  };

  return {
    employees: {
      list: () => repositories.employees.list(),
      get: (id) => repositories.employees.get(id),
      create: async (input) => repositories.employees.create(newEmployeeSchema.parse(input)),
      update: async (id, patch) =>
        repositories.employees.update(id, employeePatchSchema.parse(patch)),
      findSimilar: (search) => repositories.employees.findSimilar(search),
    },
    regulations,
    evaluations,
    archivedEvaluations: {
      create: (input) => repositories.archivedEvaluations.create(input),
      listForEmployee: (employeeId) => repositories.archivedEvaluations.listForEmployee(employeeId),
    },
    deadlines: {
      async compute({ regulationId, slot, facts }) {
        const stored = await repositories.regulationVersions.findByCode(regulationId);
        if (stored === null) {
          throw new ServiceError(
            'unknown_regulation',
            `Unknown regulation version ${regulationId}`,
          );
        }
        const version = stored.document;
        const rule = version.deadlines[slot];
        if (rule === undefined) {
          throw new ServiceError(
            'missing_deadline_slot',
            `Regulation version ${regulationId} has no ${slot} deadline`,
          );
        }
        return computeDeadline(rule, facts);
      },
    },
  };
}

/** `Services` plus the notes and office settings services, which have their own repositories. */
export type AppServices = Services & {
  readonly notes: NoteService;
  readonly officeSettings: OfficeSettingsService;
  readonly notifications: NotificationService;
  readonly hrRegister: HrRegisterService;
  readonly statistics: StatisticsService;
  readonly ai: AiService;
  readonly regulationEditor: RegulationEditorService;
  readonly development: DevelopmentService;
  readonly employment: EmploymentService;
  readonly accounts: AccountsService;
  readonly employeeImport: EmployeeImportService;
};

/** Services on a supabase-js client. The frontend passes a client with the user's JWT. */
export const servicesFor = (db: Db): AppServices => {
  const officeSettings = createOfficeSettingsRepository(db);
  const repositories = createRepositories(db);
  const notes = createNoteRepository(db);
  const services = createServices({
    repositories,
    officeSettings,
    currentAccountId: async () => {
      const account = await getCurrentAccount(db);
      if (account.status === 'signed-out') {
        throw new ServiceError('not_found', 'Nobody is signed in');
      }
      return account.userId;
    },
  });
  const ai = createAiService({
    runs: createAiRunRepository(db),
    notes,
    settings: officeSettings,
    evaluations: services.evaluations,
    regulations: repositories.regulationVersions,
  });
  const noteService = createNoteService({ notes, ai });
  return {
    ...services,
    notes: noteService,
    officeSettings: createOfficeSettingsService(
      officeSettings,
      createNotesRetentionPreviewRepository(db),
    ),
    notifications: createNotificationService(createNotificationRepository(db)),
    hrRegister: createHrRegisterService({ repository: createHrRegisterRepository(db) }),
    statistics: createStatisticsService({
      repository: createStatisticsRepository(db),
      settings: officeSettings,
      history: (employeeId) => repositories.evaluations.history(employeeId),
      regulationInForceOn: (on) => services.regulations.inForceOn(on),
    }),
    ai,
    regulationEditor: createRegulationEditorService({
      versions: repositories.regulationVersions,
      drafts: createRegulationDraftRepository(db),
      officialCases,
      today: todayUtc,
    }),
    development: createDevelopmentService({
      evaluations: services.evaluations,
      regulations: repositories.regulationVersions,
      catalog: trainingCatalog,
      today: todayUtc,
    }),
    accounts: createAccountsService({
      repository: createAccountRepository(db),
      current: async () => {
        const account = await getCurrentAccount(db);
        return account.status === 'member'
          ? { officeId: account.office.id, role: account.role }
          : null;
      },
      invitations: createAccountInvitationRepository(db),
    }),
    employeeImport: createEmployeeImportService({
      employees: repositories.employees,
      role: async () => {
        const account = await getCurrentAccount(db);
        return account.status === 'member' ? account.role : null;
      },
    }),
    employment: createEmploymentService({
      employment: createEmploymentRepository(db),
      employees: repositories.employees,
      evaluations: repositories.evaluations,
    }),
  };
};

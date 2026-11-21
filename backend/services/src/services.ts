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
  versionInForce,
} from '@sarmata/domain';
import {
  type Db,
  type ArchivedEvaluation,
  type Employee,
  type NewArchivedEvaluation,
  type OfficeSettingsRepository,
  type Repositories,
  type SimilarEmployee,
  createNoteRepository,
  createNotificationRepository,
  createOfficeSettingsRepository,
  createRepositories,
} from '@sarmata/repositories';
import { ServiceError } from './errors';
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

  const regulations: Services['regulations'] = {
    async inForceOn(on) {
      const version = versionInForce(await repositories.regulationVersions.listOfficial(), on);
      if (version === null) {
        throw new ServiceError(
          'no_regulation_in_force',
          `No regulation version is in force on ${on}`,
        );
      }
      return version;
    },
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
    evaluations: createEvaluationService({
      repositories,
      regulationInForceOn: (on) => regulations.inForceOn(on),
      ...(currentAccountId === undefined ? {} : { currentAccountId }),
      ...(officeSettings === undefined ? {} : { officeSettings }),
    }),
    archivedEvaluations: {
      create: (input) => repositories.archivedEvaluations.create(input),
      listForEmployee: (employeeId) => repositories.archivedEvaluations.listForEmployee(employeeId),
    },
    deadlines: {
      async compute({ regulationId, slot, facts }) {
        const version = await repositories.regulationVersions.findOfficialById(regulationId);
        if (version === null) {
          throw new ServiceError(
            'unknown_regulation',
            `Unknown regulation version ${regulationId}`,
          );
        }
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
};

/** Services on a supabase-js client. The frontend passes a client with the user's JWT. */
export const servicesFor = (db: Db): AppServices => {
  const officeSettings = createOfficeSettingsRepository(db);
  return {
    ...createServices({
      repositories: createRepositories(db),
      officeSettings,
      currentAccountId: async () => {
        const account = await getCurrentAccount(db);
        if (account.status === 'signed-out') {
          throw new ServiceError('not_found', 'Nobody is signed in');
        }
        return account.userId;
      },
    }),
    notes: createNoteService(createNoteRepository(db)),
    officeSettings: createOfficeSettingsService(officeSettings),
    notifications: createNotificationService(createNotificationRepository(db)),
  };
};

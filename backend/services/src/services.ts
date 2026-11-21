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
  type Employee,
  type Repositories,
  type SimilarEmployee,
  createRepositories,
} from '@sarmata/repositories';
import { ServiceError } from './errors';

export interface ServiceDependencies {
  readonly repositories: Repositories;
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
  readonly deadlines: { compute(request: DeadlineRequest): Promise<DeadlineResult> };
}

export function createServices(dependencies: ServiceDependencies): Services {
  const { repositories } = dependencies;

  return {
    employees: {
      list: () => repositories.employees.list(),
      get: (id) => repositories.employees.get(id),
      create: async (input) => repositories.employees.create(newEmployeeSchema.parse(input)),
      update: async (id, patch) =>
        repositories.employees.update(id, employeePatchSchema.parse(patch)),
      findSimilar: (search) => repositories.employees.findSimilar(search),
    },
    regulations: {
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

/** Services on a supabase-js client. The frontend passes a client with the user's JWT. */
export const servicesFor = (db: Db): Services =>
  createServices({ repositories: createRepositories(db) });

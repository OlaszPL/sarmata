import {
  type CalendarDate,
  type DeadlineFacts,
  type DeadlineResult,
  type DeadlineSlot,
  type RegulationDocument,
  computeDeadline,
  versionInForce,
} from '@sarmata/domain';
import {
  type Db,
  type Employee,
  type Repositories,
  createRepositories,
} from '@sarmata/repositories';
import { ServiceError } from './errors';

export interface ServiceDependencies {
  readonly repositories: Pick<Repositories, 'employees' | 'regulationVersions'>;
}

export interface DeadlineRequest {
  readonly regulationCode: string;
  readonly slot: DeadlineSlot;
  readonly facts: DeadlineFacts;
}

export interface Services {
  readonly employees: { list(): Promise<Employee[]> };
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
      async compute({ regulationCode, slot, facts }) {
        const version = await repositories.regulationVersions.findOfficial(regulationCode);
        if (version === null) {
          throw new ServiceError(
            'unknown_regulation',
            `Unknown regulation version ${regulationCode}`,
          );
        }
        const rule = version.deadlines[slot];
        if (rule === undefined) {
          throw new ServiceError(
            'missing_deadline_slot',
            `Regulation version ${regulationCode} has no ${slot} deadline`,
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

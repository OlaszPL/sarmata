import { type Db } from './db';
import { type EmployeeRepository, createEmployeeRepository } from './employees';
import {
  type RegulationVersionRepository,
  createRegulationVersionRepository,
} from './regulation-versions';

export interface Repositories {
  readonly employees: EmployeeRepository;
  readonly regulationVersions: RegulationVersionRepository;
}

/** All repositories on one client. With the user's JWT, RLS decides what they see. */
export function createRepositories(db: Db): Repositories {
  return {
    employees: createEmployeeRepository(db),
    regulationVersions: createRegulationVersionRepository(db),
  };
}

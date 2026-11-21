import { type Db } from './db';
import {
  type ArchivedEvaluationRepository,
  createArchivedEvaluationRepository,
} from './archived-evaluations';
import { type EmployeeRepository, createEmployeeRepository } from './employees';
import { type EvaluationRepository, createEvaluationRepository } from './evaluations';
import { type SheetVersionRepository, createSheetVersionRepository } from './sheet-versions';
import {
  type RegulationVersionRepository,
  createRegulationVersionRepository,
} from './regulation-versions';

export interface Repositories {
  readonly employees: EmployeeRepository;
  readonly regulationVersions: RegulationVersionRepository;
  readonly evaluations: EvaluationRepository;
  readonly archivedEvaluations: ArchivedEvaluationRepository;
  readonly sheetVersions: SheetVersionRepository;
}

/** All repositories on one client. With the user's JWT, RLS decides what they see. */
export function createRepositories(db: Db): Repositories {
  return {
    employees: createEmployeeRepository(db),
    regulationVersions: createRegulationVersionRepository(db),
    evaluations: createEvaluationRepository(db),
    archivedEvaluations: createArchivedEvaluationRepository(db),
    sheetVersions: createSheetVersionRepository(db),
  };
}

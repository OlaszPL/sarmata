import { type Db, createEmploymentRepository, createRepositories } from '@sarmata/repositories';
import { type EmployeeArchiveService, createEmployeeArchiveService } from './employee-archive';
import { type ExportService, createExportService } from './export-service';
import { loadExportSource } from './load-source';

export { attachmentDisposition } from './content-disposition';
export { ExportError, type ExportErrorCode } from './errors';
export {
  type ExportFile,
  type ExportRequest,
  type ExportService,
  createExportService,
} from './export-service';

/** The export service on one client. With the user's JWT, RLS decides which evaluations exist. */
export function exportsFor(db: Db): ExportService {
  return createExportService({ load: loadExportSource(db), now: () => new Date() });
}

export {
  type EmployeeArchiveDependencies,
  type EmployeeArchiveService,
  createEmployeeArchiveService,
} from './employee-archive';

/** The archive of a former employee on one client (hr). Every case file goes through the RLS of the client. */
export function archiveFor(db: Db): EmployeeArchiveService {
  const repositories = createRepositories(db);
  return createEmployeeArchiveService({
    exports: exportsFor(db),
    employees: repositories.employees,
    evaluations: repositories.evaluations,
    employment: createEmploymentRepository(db),
  });
}

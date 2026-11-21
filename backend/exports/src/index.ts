import { type Db } from '@sarmata/repositories';
import { type ExportService, createExportService } from './export-service';
import { loadExportSource } from './load-source';

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

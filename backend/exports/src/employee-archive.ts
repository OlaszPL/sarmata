import { strToU8, unzipSync, zipSync } from 'fflate';
import {
  RepositoryError,
  type EmployeeRepository,
  type EmploymentRepository,
  type EvaluationRepository,
} from '@sarmata/repositories';
import { ServiceError } from '@sarmata/services';
import { sha256Hex } from './case-file';
import { ExportError } from './errors';
import { type ExportFile, type ExportService } from './export-service';
import { fileNamePart } from './format';

/** The archive of a former employee: one case file per evaluation in one ZIP, for hr before the data is anonymized. */
export interface EmployeeArchiveService {
  /**
   * Builds `teczka-pracownika-<nazwisko>-<rok>.zip` with a folder per evaluation (the files of its case
   * file) and `manifest.json` with the hashes. Only after the file is complete it records the download
   * (`confirm_archive_export`). Evaluations that cannot be exported (interrupted, no locked sheet) are
   * listed as skipped in the manifest. Fails with `not_ended` before the end of employment, `not_found`
   * for an unknown employee and `forbidden` for a role other than hr. Any other failure of a case file
   * fails the whole archive and confirms nothing.
   */
  exportEmployeeArchive(employeeId: string): Promise<ExportFile>;
}

export interface EmployeeArchiveDependencies {
  readonly exports: Pick<ExportService, 'export'>;
  readonly employees: Pick<EmployeeRepository, 'get'>;
  readonly evaluations: Pick<EvaluationRepository, 'listForOffice'>;
  readonly employment: Pick<EmploymentRepository, 'confirmArchiveExport'>;
}

const ZIP = 'application/zip';

export function createEmployeeArchiveService(
  deps: EmployeeArchiveDependencies,
): EmployeeArchiveService {
  return {
    async exportEmployeeArchive(employeeId) {
      const employee = await deps.employees.get(employeeId);
      if (employee === null) throw new ServiceError('not_found', 'Employee not found');
      if (employee.employmentEndedOn === null) {
        throw new ServiceError('not_ended', 'The employment of this employee has not ended');
      }

      const evaluations = (await deps.evaluations.listForOffice({ employeeId })).sort((a, b) =>
        a.cycleStart.localeCompare(b.cycleStart),
      );
      const files: Record<string, Uint8Array> = {};
      const entries: {
        evaluationId: string;
        folder: string;
        status: string;
        files: { path: string; sha256: string }[];
        skipped?: 'not_exportable';
      }[] = [];

      for (const [index, evaluation] of evaluations.entries()) {
        const folder = `${String(index + 1).padStart(2, '0')}-ocena-${evaluation.cycleStart}-arkusz-${evaluation.sheetId}`;
        try {
          const caseFile = await deps.exports.export(evaluation.id, { kind: 'case_file' });
          const inner = unzipSync(caseFile.bytes);
          const listed: { path: string; sha256: string }[] = [];
          for (const [name, bytes] of Object.entries(inner)) {
            const path = `${folder}/${name}`;
            files[path] = bytes;
            listed.push({ path, sha256: sha256Hex(bytes) });
          }
          entries.push({
            evaluationId: evaluation.id,
            folder,
            status: evaluation.status,
            files: listed,
          });
        } catch (error) {
          if (error instanceof ExportError && error.code === 'not_exportable') {
            entries.push({
              evaluationId: evaluation.id,
              folder,
              status: evaluation.status,
              files: [],
              skipped: 'not_exportable',
            });
            continue;
          }
          throw error;
        }
      }

      files['manifest.json'] = strToU8(
        JSON.stringify(
          {
            employeeId,
            employmentEndedOn: employee.employmentEndedOn,
            evaluations: entries,
          },
          null,
          2,
        ),
      );
      const bytes = zipSync(files);
      const endedYear = employee.employmentEndedOn.slice(0, 4);
      // The download is recorded only when the whole file exists.
      try {
        await deps.employment.confirmArchiveExport(employeeId);
      } catch (error) {
        if (error instanceof RepositoryError && error.code === '42501') {
          throw new ServiceError('forbidden', 'Only hr can download the archive of an employee');
        }
        throw error;
      }
      return {
        fileName: `teczka-pracownika-${fileNamePart(employee.lastName)}-${endedYear}.zip`,
        contentType: ZIP,
        bytes,
      };
    },
  };
}

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { calendarDate } from '@sarmata/domain';
import { type Employee, type Evaluation } from '@sarmata/repositories';
import { ServiceError } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { createEmployeeArchiveService } from './employee-archive';
import { ExportError } from './errors';
import { type ExportRequest } from './export-service';

const EMPLOYEE = '11111111-1111-4111-8111-111111111111';

const employee = (endedOn: string | null): Employee => ({
  id: EMPLOYEE,
  officeId: 'o1',
  firstName: 'Lena',
  lastName: 'Odeszła Nowak',
  email: null,
  userId: null,
  positionTitle: null,
  orgUnit: null,
  positionKind: 'other',
  serviceStatus: 'employee',
  employmentBasis: 'indefinite',
  employmentStart: null,
  appointmentYear: null,
  grade: null,
  gradeGrantedOn: null,
  employmentEndedOn: endedOn === null ? null : calendarDate(endedOn),
  supervisorEmployeeId: null,
  anonymizedAt: null,
});

const evaluation = (id: string, cycleStart: string, status: Evaluation['status']): Evaluation =>
  ({ id, cycleStart: calendarDate(cycleStart), sheetId: 'C', status }) as Evaluation;

const caseFile = (text: string) =>
  zipSync({ 'arkusz.pdf': strToU8(text), 'dziennik.csv': strToU8('rodzaj\r\n') });

function setup(
  options: {
    endedOn?: string | null;
    evaluations?: Evaluation[];
    failFor?: string;
    unexportable?: string;
  } = {},
) {
  const requests: { id: string; request: ExportRequest }[] = [];
  const confirmed: string[] = [];
  const service = createEmployeeArchiveService({
    exports: {
      export: (id, request) => {
        requests.push({ id, request });
        if (id === options.failFor) return Promise.reject(new Error('typst failed'));
        if (id === options.unexportable) {
          return Promise.reject(new ExportError('not_exportable', 'no locked sheet'));
        }
        return Promise.resolve({
          fileName: 'x.zip',
          contentType: 'application/zip',
          bytes: caseFile(`case ${id}`),
        });
      },
    },
    employees: {
      get: () =>
        Promise.resolve(employee(options.endedOn === undefined ? '2026-03-15' : options.endedOn)),
    },
    evaluations: {
      listForOffice: () =>
        Promise.resolve(
          options.evaluations ?? [
            evaluation('e2', '2025-01-01', 'closed'),
            evaluation('e1', '2024-01-01', 'closed'),
          ],
        ),
    },
    employment: {
      confirmArchiveExport: (id) => {
        confirmed.push(id);
        return Promise.resolve();
      },
    },
  });
  return { service, requests, confirmed };
}

describe('employee archive', () => {
  it('archive zips one case file per evaluation and confirms export', async () => {
    const { service, requests, confirmed } = setup();
    const file = await service.exportEmployeeArchive(EMPLOYEE);
    expect(file.fileName).toBe('teczka-pracownika-Odeszła-Nowak-2026.zip');
    expect(file.contentType).toBe('application/zip');
    expect(requests.map((call) => call.request.kind)).toEqual(['case_file', 'case_file']);
    const entries = unzipSync(file.bytes);
    expect(Object.keys(entries).sort()).toEqual([
      '01-ocena-2024-01-01-arkusz-C/arkusz.pdf',
      '01-ocena-2024-01-01-arkusz-C/dziennik.csv',
      '02-ocena-2025-01-01-arkusz-C/arkusz.pdf',
      '02-ocena-2025-01-01-arkusz-C/dziennik.csv',
      'manifest.json',
    ]);
    expect(strFromU8(entries['01-ocena-2024-01-01-arkusz-C/arkusz.pdf'] ?? new Uint8Array())).toBe(
      'case e1',
    );
    const manifest = JSON.parse(strFromU8(entries['manifest.json'] ?? new Uint8Array())) as {
      evaluations: { evaluationId: string; files: { sha256: string }[] }[];
    };
    expect(manifest.evaluations.map((entry) => entry.evaluationId)).toEqual(['e1', 'e2']);
    expect(manifest.evaluations[0]?.files[0]?.sha256).toHaveLength(64);
    expect(confirmed).toEqual([EMPLOYEE]);
  });

  it('archive without end fails not_ended', async () => {
    const { service, confirmed } = setup({ endedOn: null });
    const error: unknown = await service.exportEmployeeArchive(EMPLOYEE).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).code).toBe('not_ended');
    expect(confirmed).toEqual([]);
  });

  it('archive does not confirm when a case file fails', async () => {
    const { service, confirmed } = setup({ failFor: 'e2' });
    await expect(service.exportEmployeeArchive(EMPLOYEE)).rejects.toThrow('typst failed');
    expect(confirmed).toEqual([]);
  });

  it('archive lists an unexportable evaluation as skipped', async () => {
    const { service, confirmed } = setup({ unexportable: 'e2' });
    const entries = unzipSync((await service.exportEmployeeArchive(EMPLOYEE)).bytes);
    const manifest = JSON.parse(strFromU8(entries['manifest.json'] ?? new Uint8Array())) as {
      evaluations: { evaluationId: string; skipped?: string }[];
    };
    expect(manifest.evaluations.find((entry) => entry.evaluationId === 'e2')?.skipped).toBe(
      'not_exportable',
    );
    expect(confirmed).toEqual([EMPLOYEE]);
  });
});

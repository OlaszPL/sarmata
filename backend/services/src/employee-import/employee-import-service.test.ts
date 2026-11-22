import { describe, expect, it } from 'vitest';
import type { Employee, NewEmployee, SimilarEmployee } from '@sarmata/repositories';
import { RepositoryError } from '@sarmata/repositories';
import { ServiceError } from '../errors';
import { parseCsv } from './csv';
import { createEmployeeImportService, proposeColumnMapping } from './employee-import-service';

const employee = (patch: Partial<Employee>): Employee => ({
  id: 'e0',
  officeId: 'o1',
  firstName: 'Jan',
  lastName: 'Kowalski',
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
  employmentEndedOn: null,
  supervisorEmployeeId: 'boss',
  anonymizedAt: null,
  ...patch,
});

const nowack: SimilarEmployee = {
  id: 'e9',
  firstName: 'Anna',
  lastName: 'Nowack',
  positionTitle: null,
  orgUnit: null,
  score: 0.8,
};

function setup(
  existing: Employee[],
  similar: SimilarEmployee[] = [],
  role: string | null = 'hr',
  createError?: Error,
) {
  const created: NewEmployee[] = [];
  const updated: { id: string; patch: unknown }[] = [];
  const service = createEmployeeImportService({
    role: () => Promise.resolve(role),
    employees: {
      list: () => Promise.resolve(existing),
      findSimilar: (search) => Promise.resolve(search === 'Anna Nowak' ? similar : []),
      create: (input) => {
        if (createError !== undefined) return Promise.reject(createError);
        created.push(input);
        return Promise.resolve(employee({}));
      },
      update: (id, patch) => {
        updated.push({ id, patch });
        return Promise.resolve(employee({}));
      },
    },
  });
  return { service, created, updated };
}

const mapping = {
  firstName: 'Imię',
  lastName: 'Nazwisko',
  email: 'E-mail',
  positionTitle: 'Stanowisko',
  serviceStatus: 'Status',
  grade: 'Stopień',
};

describe('parseCsv', () => {
  it('reads BOM, quoted cells, doubled quotes and CRLF', () => {
    const parsed = parseCsv('﻿a;b\r\n"x;1";"he said ""hi"""\r\n\r\n');
    expect(parsed.delimiter).toBe(';');
    expect(parsed.headers).toEqual(['a', 'b']);
    expect(parsed.rows).toEqual([['x;1', 'he said "hi"']]);
  });

  it('detects a comma and pads short rows', () => {
    const parsed = parseCsv('a,b,c\n1,2\n');
    expect(parsed.delimiter).toBe(',');
    expect(parsed.rows).toEqual([['1', '2', '']]);
  });

  it('rejects an empty file and an unclosed quote', () => {
    expect(() => parseCsv('')).toThrow();
    expect(() => parseCsv('a;b\n"x;1')).toThrow(/quote/);
  });
});

describe('proposeColumnMapping', () => {
  it('matches Polish headers and never proposes the supervisor', () => {
    const { mapping: proposed, missing } = proposeColumnMapping([
      'Imię',
      'Nazwisko',
      'E-mail',
      'Komórka organizacyjna',
      'Przełożony',
    ]);
    expect(proposed).toEqual({
      firstName: 'Imię',
      lastName: 'Nazwisko',
      email: 'E-mail',
      orgUnit: 'Komórka organizacyjna',
    });
    expect(missing).toEqual([]);
  });

  it('lists the required fields without a header', () => {
    expect(proposeColumnMapping(['Stanowisko']).missing).toEqual(['firstName', 'lastName']);
  });
});

describe('employee import', () => {
  const csv = [
    'Imię;Nazwisko;E-mail;Stanowisko;Status;Stopień',
    'Ewa;Nowa;ewa@x.test;Specjalista;urzędnik;VI',
    'Jan;Kowalski;jan@x.test;Starszy specjalista;;',
    'Anna;Nowak;;Referent;;',
    ';Pusty;;;;',
    'Piotr;Zly;;Referent;pracownik;7',
  ].join('\n');

  it('a dry run proposes an action per row and writes nothing', async () => {
    const { service, created, updated } = setup(
      [employee({ id: 'e1', email: 'JAN@x.test' })],
      [nowack],
    );
    const result = await service.dryRun(csv, mapping);
    expect(result.rows.map((row) => row.proposedAction)).toEqual([
      'create',
      'update',
      'needs_decision',
      'invalid',
      'invalid',
    ]);
    expect(result.rows[0]?.values).toMatchObject({ serviceStatus: 'civil_servant', grade: 6 });
    expect(result.rows[1]?.match).toEqual({ kind: 'email', employeeId: 'e1' });
    expect(result.rows[3]?.errors.some((error) => error.field === 'firstName')).toBe(true);
    expect(result.rows[4]?.errors[0]?.field).toBe('grade');
    expect(result.summary).toEqual({ create: 1, update: 1, needs_decision: 1, invalid: 2 });
    expect(created).toEqual([]);
    expect(updated).toEqual([]);
  });

  it('commit creates, updates by e-mail, holds similar rows and reports invalid ones', async () => {
    const { service, created, updated } = setup(
      [employee({ id: 'e1', email: 'jan@x.test' })],
      [nowack],
    );
    const report = await service.commit(csv, mapping);
    expect(report.created).toBe(1);
    expect(created[0]).toMatchObject({ firstName: 'Ewa', grade: 6, supervisorEmployeeId: null });
    expect(report.updated).toBe(1);
    expect(updated[0]).toMatchObject({
      id: 'e1',
      patch: { positionTitle: 'Starszy specjalista' },
    });
    expect(updated[0]?.patch).not.toHaveProperty('supervisorEmployeeId');
    expect(report.undecided).toEqual([3]);
    expect(report.failed.map((failure) => failure.row)).toEqual([4, 5]);
  });

  it('applies hr decisions for similar rows', async () => {
    const merge = setup([], [nowack]);
    const merged = await merge.service.commit(csv, mapping, { 3: { updateEmployeeId: 'e9' } });
    expect(merged.undecided).toEqual([]);
    expect(merge.updated.map((entry) => entry.id)).toEqual(['e9']);

    const skip = setup([], [nowack]);
    expect((await skip.service.commit(csv, mapping, { 3: 'skip' })).skipped).toBe(1);

    const add = setup([], [nowack]);
    expect((await add.service.commit(csv, mapping, { 3: 'create' })).created).toBe(3);
  });

  it('sets the supervisor only when it is mapped explicitly', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const { service, updated } = setup([
      employee({ id: 'e1', email: 'jan@x.test' }),
      employee({ id, email: 'boss@x.test' }),
    ]);
    await service.commit(`Imię;Nazwisko;E-mail;Przełożony\nJan;Kowalski;jan@x.test;${id}`, {
      firstName: 'Imię',
      lastName: 'Nazwisko',
      email: 'E-mail',
      supervisorEmployeeId: 'Przełożony',
    });
    expect(updated[0]?.patch).toMatchObject({ supervisorEmployeeId: id });
  });

  it('flags a repeated e-mail inside the file', async () => {
    const { service } = setup([]);
    const result = await service.dryRun('Imię;Nazwisko;E-mail\nA;B;a@x.test\nC;D;a@x.test', {
      firstName: 'Imię',
      lastName: 'Nazwisko',
      email: 'E-mail',
    });
    expect(result.rows.map((row) => row.proposedAction)).toEqual(['create', 'invalid']);
  });

  it('refuses anyone but hr and unknown mapped columns', async () => {
    const { service } = setup([], [], 'evaluator');
    await expect(service.commit(csv, mapping)).rejects.toMatchObject({ code: 'forbidden' });
    const hr = setup([]);
    await expect(hr.service.dryRun(csv, { firstName: 'Brak' })).rejects.toBeInstanceOf(
      ServiceError,
    );
  });
});

describe('employee import row error codes', () => {
  const cols = {
    firstName: 'Imię',
    lastName: 'Nazwisko',
    email: 'E-mail',
    positionKind: 'Rodzaj',
    serviceStatus: 'Status',
    employmentStart: 'Start',
    appointmentYear: 'Rok',
    grade: 'Stopień',
    supervisorEmployeeId: 'Przełożony',
  };
  const header = 'Imię;Nazwisko;E-mail;Rodzaj;Status;Start;Rok;Stopień;Przełożony';
  const row = (cells: Partial<Record<keyof typeof cols, string>>) =>
    (Object.keys(cols) as (keyof typeof cols)[])
      .map((key) => cells[key] ?? (key === 'firstName' ? 'Jan' : key === 'lastName' ? 'Test' : ''))
      .join(';');
  const errorsOf = async (cells: Partial<Record<keyof typeof cols, string>>) => {
    const { service } = setup([]);
    const result = await service.dryRun(`${header}\n${row(cells)}`, cols);
    return result.rows[0]?.errors.map(({ field, code }) => ({ field, code }));
  };

  it('missing_field for a blank last name', async () => {
    expect(await errorsOf({ lastName: '' })).toEqual([
      { field: 'lastName', code: 'missing_field' },
    ]);
  });
  it('invalid_date for a date that does not exist', async () => {
    expect(await errorsOf({ employmentStart: '31.13.2026' })).toEqual([
      { field: 'employmentStart', code: 'invalid_date' },
    ]);
  });
  it('unknown_value for an unrecognised enum cell', async () => {
    expect(await errorsOf({ positionKind: 'kierownik?' })).toEqual([
      { field: 'positionKind', code: 'unknown_value' },
    ]);
  });
  it('not_a_number for text in grade', async () => {
    expect(await errorsOf({ serviceStatus: 'urzędnik', grade: 'abc' })).toEqual([
      { field: 'grade', code: 'not_a_number' },
    ]);
  });
  it('out_of_range for grade 12 and for a year past 2100', async () => {
    expect(await errorsOf({ serviceStatus: 'urzędnik', grade: '12' })).toEqual([
      { field: 'grade', code: 'out_of_range' },
    ]);
    expect(await errorsOf({ serviceStatus: 'urzędnik', appointmentYear: '3000' })).toEqual([
      { field: 'appointmentYear', code: 'out_of_range' },
    ]);
  });
  it('civil_servant_only for a grade of an employee', async () => {
    expect(await errorsOf({ serviceStatus: 'pracownik', grade: '5' })).toEqual([
      { field: 'grade', code: 'civil_servant_only' },
    ]);
  });
  it('invalid_format for a supervisor id that is not a uuid', async () => {
    expect(await errorsOf({ supervisorEmployeeId: 'xyz' })).toEqual([
      { field: 'supervisorEmployeeId', code: 'invalid_format' },
    ]);
  });
  it('unknown_supervisor in the preview for a well-formed uuid outside the office', async () => {
    expect(
      await errorsOf({ supervisorEmployeeId: '11111111-1111-4111-8111-111111111111' }),
    ).toEqual([{ field: 'supervisorEmployeeId', code: 'unknown_supervisor' }]);
  });
  it('no preview error for a supervisor among the office employees', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    const { service } = setup([employee({ id })]);
    const result = await service.dryRun(`${header}\n${row({ supervisorEmployeeId: id })}`, cols);
    expect(result.rows[0]?.errors).toEqual([]);
  });
  it('duplicate_email for a repeated e-mail', async () => {
    const { service } = setup([]);
    const result = await service.dryRun(
      `${header}\n${row({ email: 'a@x.test' })}\n${row({ email: 'a@x.test' })}`,
      cols,
    );
    expect(result.rows[1]?.errors.map(({ field, code }) => ({ field, code }))).toEqual([
      { field: 'email', code: 'duplicate_email' },
    ]);
  });

  it('commit carries the same errors as the preview for an invalid row', async () => {
    const { service } = setup([]);
    const text = `${header}\n${row({ lastName: '' })}`;
    const preview = await service.dryRun(text, cols);
    const report = await service.commit(text, cols);
    expect(report.failed[0]?.errors).toEqual(preview.rows[0]?.errors);
    expect(report.failed[0]?.message).toEqual(expect.any(String));
  });

  it('commit maps a foreign key supervisor refusal to unknown_supervisor', async () => {
    const refusal = new RepositoryError('employees.create', {
      code: '23503',
      message:
        'insert or update on table "employees" violates foreign key constraint "employees_supervisor_fkey"',
    });
    const { service } = setup([], [], 'hr', refusal);
    const report = await service.commit(`${header}\n${row({})}`, cols);
    expect(report.failed[0]?.errors).toEqual([
      {
        field: 'supervisorEmployeeId',
        code: 'unknown_supervisor',
        message: expect.any(String) as string,
      },
    ]);
  });

  it('commit maps another supervisor rule to invalid_supervisor and anything else to write_failed', async () => {
    const cycle = new RepositoryError('employees.create', {
      code: 'P0001',
      message: 'supervisor cycle',
    });
    const a = setup([], [], 'hr', cycle);
    const reportA = await a.service.commit(`${header}\n${row({})}`, cols);
    expect(reportA.failed[0]?.errors).toEqual([
      {
        field: 'supervisorEmployeeId',
        code: 'invalid_supervisor',
        message: expect.any(String) as string,
      },
    ]);
    const b = setup([], [], 'hr', new Error('boom'));
    const reportB = await b.service.commit(`${header}\n${row({})}`, cols);
    expect(reportB.failed[0]?.errors).toEqual([
      { field: null, code: 'write_failed', message: 'boom' },
    ]);
  });
});

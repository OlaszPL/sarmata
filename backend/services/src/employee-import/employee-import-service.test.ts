import { describe, expect, it } from 'vitest';
import type { Employee, NewEmployee, SimilarEmployee } from '@sarmata/repositories';
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

function setup(existing: Employee[], similar: SimilarEmployee[] = [], role: string | null = 'hr') {
  const created: NewEmployee[] = [];
  const updated: { id: string; patch: unknown }[] = [];
  const service = createEmployeeImportService({
    role: () => Promise.resolve(role),
    employees: {
      list: () => Promise.resolve(existing),
      findSimilar: (search) => Promise.resolve(search === 'Anna Nowak' ? similar : []),
      create: (input) => {
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
    const { service, updated } = setup([employee({ id: 'e1', email: 'jan@x.test' })]);
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

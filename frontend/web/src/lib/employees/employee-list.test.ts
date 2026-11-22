import { type Employee, type Evaluation } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { employeeRows, normalizeForSearch } from './employee-list';

function employee(overrides: Partial<Employee>): Employee {
  return {
    id: 'e',
    firstName: 'Jan',
    lastName: 'Kowalski',
    positionTitle: null,
    orgUnit: null,
    supervisorEmployeeId: null,
    employmentEndedOn: null,
    anonymizedAt: null,
    ...overrides,
  } as Employee;
}

function evaluation(overrides: Partial<Evaluation>): Evaluation {
  return {
    id: 'ev',
    employeeId: 'e',
    evaluatorAccountId: 'u-other',
    status: 'period',
    cycleStart: '2025-01-01',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  } as Evaluation;
}

const me = { userId: 'u-me', employeeId: 'emp-me' };

const employees = [
  employee({ id: 'emp-me', firstName: 'Olga', lastName: 'Oceniająca' }),
  employee({
    id: 'emp-marek',
    firstName: 'Marek',
    lastName: 'Merytoryczny',
    positionTitle: 'Specjalista',
    supervisorEmployeeId: 'emp-me',
  }),
  employee({ id: 'emp-led', firstName: 'Ewa', lastName: 'Ewidencyjna' }),
  employee({ id: 'emp-other', firstName: 'Roman', lastName: 'Obcy' }),
  employee({
    id: 'emp-anon',
    firstName: 'X',
    lastName: 'Anon',
    supervisorEmployeeId: 'emp-me',
    anonymizedAt: '2026-01-01T00:00:00Z',
  }),
];

const evaluations = [
  evaluation({ id: 'ev-led', employeeId: 'emp-led', evaluatorAccountId: 'u-me' }),
  evaluation({
    id: 'ev-self',
    employeeId: 'emp-me',
    evaluatorAccountId: 'u-me',
  }),
  evaluation({
    id: 'ev-closed',
    employeeId: 'emp-other',
    evaluatorAccountId: 'u-me',
    status: 'closed',
  }),
];

describe('normalizeForSearch', () => {
  it('lowercases and removes Polish diacritics', () => {
    expect(normalizeForSearch('Łukasz Żółć')).toBe('lukasz zolc');
  });
});

describe('employeeRows', () => {
  it('returns subordinates and evaluated employees in scope mine', () => {
    const rows = employeeRows({ employees, evaluations, scope: 'mine', me, query: '' });
    expect(rows.map((row) => row.id)).toEqual(['emp-led', 'emp-marek']);
  });

  it('returns everybody except the anonymized in scope all, sorted by last name', () => {
    const rows = employeeRows({ employees, evaluations, scope: 'all', me, query: '' });
    expect(rows.map((row) => row.name)).toEqual([
      'Ewa Ewidencyjna',
      'Marek Merytoryczny',
      'Roman Obcy',
      'Olga Oceniająca',
    ]);
  });

  it('exposes the newest open evaluation', () => {
    const rows = employeeRows({ employees, evaluations, scope: 'all', me, query: '' });
    expect(rows.find((row) => row.id === 'emp-led')?.current).toEqual({
      evaluationId: 'ev-led',
      status: 'period',
    });
    expect(rows.find((row) => row.id === 'emp-other')?.current).toBeNull();
  });

  it('searches the position without diacritics', () => {
    const rows = employeeRows({ employees, evaluations, scope: 'all', me, query: 'merytor' });
    expect(rows.map((row) => row.id)).toEqual(['emp-marek']);
    const byPosition = employeeRows({
      employees,
      evaluations,
      scope: 'all',
      me,
      query: 'SPECJALISTA',
    });
    expect(byPosition.map((row) => row.id)).toEqual(['emp-marek']);
  });
});

import { describe, expect, it } from 'vitest';
import type { Employee } from '@sarmata/services';
import { orgTree, wouldCreateCycle } from './org-tree';

const emp = (id: string, lastName: string, patch: Partial<Employee> = {}): Employee =>
  ({
    id,
    firstName: 'Jan',
    lastName,
    supervisorEmployeeId: null,
    employmentEndedOn: null,
    anonymizedAt: null,
    ...patch,
  }) as Employee;

const staff = [
  emp('boss', 'Zielinski'),
  emp('mid', 'Nowak', { supervisorEmployeeId: 'boss' }),
  emp('low', 'Kowalski', { supervisorEmployeeId: 'mid' }),
  emp('other', 'Adamski'),
];

describe('orgTree', () => {
  it('puts people without a supervisor at the roots sorted by last name', () => {
    expect(orgTree(staff).map((n) => n.employee.id)).toEqual(['other', 'boss']);
  });

  it('nests reports under their supervisor', () => {
    const boss = orgTree(staff).find((n) => n.employee.id === 'boss');
    expect(boss?.reports[0]?.employee.id).toBe('mid');
    expect(boss?.reports[0]?.reports[0]?.employee.id).toBe('low');
  });

  it('leaves out ended and anonymized employees', () => {
    const list = [
      ...staff,
      emp('gone', 'Aaa', { employmentEndedOn: '2025-01-01' as never }),
      emp('anon', 'Bbb', { anonymizedAt: '2025-01-01' }),
    ];
    const ids = orgTree(list).flatMap((n) => [n.employee.id]);
    expect(ids).not.toContain('gone');
    expect(ids).not.toContain('anon');
  });

  it('makes a root of someone whose supervisor is not in the list', () => {
    const list = [emp('a', 'A', { supervisorEmployeeId: 'missing' })];
    expect(orgTree(list)).toHaveLength(1);
  });
});

describe('wouldCreateCycle', () => {
  it('is true for the employee themselves', () => {
    expect(wouldCreateCycle(staff, 'mid', 'mid')).toBe(true);
  });
  it('is true for a direct report', () => {
    expect(wouldCreateCycle(staff, 'boss', 'mid')).toBe(true);
  });
  it('is true for a grandchild', () => {
    expect(wouldCreateCycle(staff, 'boss', 'low')).toBe(true);
  });
  it('is false for an unrelated person', () => {
    expect(wouldCreateCycle(staff, 'mid', 'other')).toBe(false);
  });
  it('is false for no supervisor', () => {
    expect(wouldCreateCycle(staff, 'boss', null)).toBe(false);
  });
});

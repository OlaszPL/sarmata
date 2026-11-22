import { RepositoryError } from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { supervisorError } from './supervisor-error';

const repositoryError = (code: string, message: string) =>
  new RepositoryError('employees.update', { code, message });

describe('supervisorError', () => {
  it('maps a supervisor cycle to reason cycle', () => {
    expect(supervisorError(repositoryError('P0001', 'supervisor cycle'))).toMatchObject({
      code: 'invalid_supervisor',
      details: { reason: 'cycle' },
    });
  });

  it('maps the own supervisor check to reason self', () => {
    const error = repositoryError(
      '23514',
      'new row for relation "employees" violates check constraint "employees_not_own_supervisor"',
    );
    expect(supervisorError(error)).toMatchObject({
      code: 'invalid_supervisor',
      details: { reason: 'self' },
    });
  });

  it('maps the supervisor foreign key to reason other_office', () => {
    const error = repositoryError(
      '23503',
      'insert or update on table "employees" violates foreign key constraint "employees_supervisor_fkey"',
    );
    expect(supervisorError(error)).toMatchObject({
      code: 'invalid_supervisor',
      details: { reason: 'other_office' },
    });
  });

  it('maps the hr only trigger to reason not_allowed', () => {
    const error = repositoryError('42501', 'supervisor change requires hr or admin');
    expect(supervisorError(error)).toMatchObject({
      code: 'invalid_supervisor',
      details: { reason: 'not_allowed' },
    });
  });

  it('passes through an unrelated 42501', () => {
    const error = repositoryError('42501', 'permission denied for table employees');
    expect(supervisorError(error)).toBe(error);
  });

  it('passes through another check constraint', () => {
    const error = repositoryError(
      '23514',
      'new row for relation "employees" violates check constraint "employees_other_check"',
    );
    expect(supervisorError(error)).toBe(error);
  });

  it('passes through an error that is not a RepositoryError', () => {
    const error = new Error('supervisor cycle');
    expect(supervisorError(error)).toBe(error);
  });
});

import { type Db } from './db';
import { RepositoryError } from './errors';

/** Pracownik: a person from HR records, may exist without an account (GLOSSARY.md). */
export interface Employee {
  readonly id: string;
  readonly officeId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly userId: string | null;
}

export interface EmployeeRepository {
  /** Employees visible to the client, i.e. of the signed-in office, sorted by last and first name. */
  list(): Promise<Employee[]>;
}

export function createEmployeeRepository(db: Db): EmployeeRepository {
  return {
    async list() {
      const { data, error } = await db
        .from('employees')
        .select('id, office_id, first_name, last_name, email, user_id')
        .order('last_name')
        .order('first_name');
      if (error) throw new RepositoryError('employees.list', error);
      return data.map((row) => ({
        id: row.id,
        officeId: row.office_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        userId: row.user_id,
      }));
    },
  };
}

import {
  type CalendarDate,
  type EmploymentBasis,
  type PositionKind,
  type ServiceStatus,
  calendarDate,
} from '@sarmata/domain';
import { type Database } from '@sarmata/database';
import { readAccountClaims } from './auth';
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
  readonly positionTitle: string | null;
  readonly orgUnit: string | null;
  readonly positionKind: PositionKind;
  readonly serviceStatus: ServiceStatus;
  readonly employmentBasis: EmploymentBasis;
  readonly employmentStart: CalendarDate | null;
  readonly appointmentYear: number | null;
  readonly grade: number | null;
  readonly gradeGrantedOn: CalendarDate | null;
  readonly employmentEndedOn: CalendarDate | null;
  readonly supervisorEmployeeId: string | null;
}

/** Fields HR enters. The id, the office and the account link are set by the system. */
export type NewEmployee = Omit<Employee, 'id' | 'officeId' | 'userId'>;

/** Fields to change, absent or `undefined` keys stay untouched. */
export type EmployeePatch = { [K in keyof NewEmployee]?: NewEmployee[K] | undefined };

/** A candidate for "is this person already in the records", best match first. */
export interface SimilarEmployee {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly positionTitle: string | null;
  readonly orgUnit: string | null;
  readonly score: number;
}

export interface EmployeeRepository {
  /** Employees visible to the client, i.e. of the signed-in office, sorted by last and first name. */
  list(): Promise<Employee[]>;
  get(id: string): Promise<Employee | null>;
  create(input: NewEmployee): Promise<Employee>;
  update(id: string, patch: EmployeePatch): Promise<Employee>;
  /** Employees of the signed-in office whose name resembles `search`, tolerant to typos. */
  findSimilar(search: string): Promise<SimilarEmployee[]>;
}

const COLUMNS =
  'id, office_id, first_name, last_name, email, user_id, position_title, org_unit, position_kind, service_status, employment_basis, employment_start, appointment_year, grade, grade_granted_on, employment_ended_on, supervisor_employee_id' as const;

type EmployeeRow = Omit<
  Database['public']['Tables']['employees']['Row'],
  'created_at' | 'anonymized_at'
>;
type EmployeeColumns = Database['public']['Tables']['employees']['Update'];

const optionalDate = (value: string | null): CalendarDate | null =>
  value === null ? null : calendarDate(value);

const toEmployee = (row: EmployeeRow): Employee => ({
  id: row.id,
  officeId: row.office_id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  userId: row.user_id,
  positionTitle: row.position_title,
  orgUnit: row.org_unit,
  positionKind: row.position_kind,
  serviceStatus: row.service_status,
  employmentBasis: row.employment_basis,
  employmentStart: optionalDate(row.employment_start),
  appointmentYear: row.appointment_year,
  grade: row.grade,
  gradeGrantedOn: optionalDate(row.grade_granted_on),
  employmentEndedOn: optionalDate(row.employment_ended_on),
  supervisorEmployeeId: row.supervisor_employee_id,
});

/** Column values of the fields present in the patch, absent keys stay untouched. */
function toColumns(patch: EmployeePatch): EmployeeColumns {
  const columns: EmployeeColumns = {};
  if (patch.firstName !== undefined) columns.first_name = patch.firstName;
  if (patch.lastName !== undefined) columns.last_name = patch.lastName;
  if (patch.email !== undefined) columns.email = patch.email;
  if (patch.positionTitle !== undefined) columns.position_title = patch.positionTitle;
  if (patch.orgUnit !== undefined) columns.org_unit = patch.orgUnit;
  if (patch.positionKind !== undefined) columns.position_kind = patch.positionKind;
  if (patch.serviceStatus !== undefined) columns.service_status = patch.serviceStatus;
  if (patch.employmentBasis !== undefined) columns.employment_basis = patch.employmentBasis;
  if (patch.employmentStart !== undefined) columns.employment_start = patch.employmentStart;
  if (patch.appointmentYear !== undefined) columns.appointment_year = patch.appointmentYear;
  if (patch.grade !== undefined) columns.grade = patch.grade;
  if (patch.gradeGrantedOn !== undefined) columns.grade_granted_on = patch.gradeGrantedOn;
  if (patch.employmentEndedOn !== undefined) columns.employment_ended_on = patch.employmentEndedOn;
  if (patch.supervisorEmployeeId !== undefined) {
    columns.supervisor_employee_id = patch.supervisorEmployeeId;
  }
  return columns;
}

export function createEmployeeRepository(db: Db): EmployeeRepository {
  return {
    async list() {
      const { data, error } = await db
        .from('employees')
        .select(COLUMNS)
        .order('last_name')
        .order('first_name');
      if (error) throw new RepositoryError('employees.list', error);
      return data.map(toEmployee);
    },

    async get(id) {
      const { data, error } = await db.from('employees').select(COLUMNS).eq('id', id).maybeSingle();
      if (error) throw new RepositoryError('employees.get', error);
      return data === null ? null : toEmployee(data);
    },

    async create(input) {
      // RLS only checks office_id, so the insert names the office from the verified JWT.
      const officeId = (await readAccountClaims(db))?.office_id;
      if (typeof officeId !== 'string') {
        throw new RepositoryError('employees.create', { message: 'No office in the session' });
      }
      const { data, error } = await db
        .from('employees')
        .insert({
          ...toColumns(input),
          office_id: officeId,
          first_name: input.firstName,
          last_name: input.lastName,
        })
        .select(COLUMNS)
        .single();
      if (error) throw new RepositoryError('employees.create', error);
      return toEmployee(data);
    },

    async update(id, patch) {
      const { data, error } = await db
        .from('employees')
        .update(toColumns(patch))
        .eq('id', id)
        .select(COLUMNS)
        .single();
      if (error) throw new RepositoryError('employees.update', error);
      return toEmployee(data);
    },

    async findSimilar(search) {
      const { data, error } = await db.rpc('find_similar_employees', { search });
      if (error) throw new RepositoryError('employees.findSimilar', error);
      return data.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        positionTitle: row.position_title,
        orgUnit: row.org_unit,
        score: row.score,
      }));
    },
  };
}

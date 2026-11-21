import {
  type CalendarDate,
  type GradeBasis,
  type GradeGrantInput,
  type LabourCourtAppealInput,
  calendarDate,
} from '@sarmata/domain';
import { type Database } from '@sarmata/database';
import { type Db } from './db';
import { RepositoryError } from './errors';

type GrantArgs = Database['public']['Functions']['record_grade_grant']['Args'];

/** Przyznanie stopnia: a row of the register of grade decisions. */
export interface GradeGrant {
  readonly id: string;
  readonly employeeId: string;
  readonly evaluationId: string | null;
  readonly basis: GradeBasis;
  readonly grantedOn: CalendarDate;
  readonly previousGrade: number | null;
  readonly newGrade: number;
  readonly recordedAt: string;
}

export interface HrRegisterRepository {
  /** hr only, after a rejected objection. Returns the id of the event. Failures carry the Postgres code and message. */
  recordLabourCourtAppeal(input: LabourCourtAppealInput): Promise<string>;
  /** hr only. Changes the grade of the employee and closes the grade by law task. Returns the id of the row. */
  recordGradeGrant(input: GradeGrantInput): Promise<string>;
  /** Newest grant first. */
  gradeGrants(employeeId: string): Promise<GradeGrant[]>;
}

const COLUMNS =
  'id, employee_id, evaluation_id, basis, granted_on, previous_grade, new_grade, recorded_at' as const;

const asBasis = (value: string): GradeBasis => (value === 'by_law' ? 'by_law' : 'on_request');

export function createHrRegisterRepository(db: Db): HrRegisterRepository {
  return {
    async recordLabourCourtAppeal(input) {
      const { data, error } = await db.rpc('record_labour_court_appeal', {
        p_evaluation_id: input.evaluationId,
        p_filed_on: input.filedOn,
      });
      if (error) throw new RepositoryError('hrRegister.recordLabourCourtAppeal', error);
      return data;
    },

    async recordGradeGrant(input) {
      // The generated types mark the nullable evaluation argument as a plain uuid, SQL accepts null.
      const args = {
        p_employee_id: input.employeeId,
        p_evaluation_id: input.evaluationId,
        p_basis: input.basis,
        p_granted_on: input.grantedOn,
        p_new_grade: input.newGrade,
      } as unknown as GrantArgs;
      const { data, error } = await db.rpc('record_grade_grant', args);
      if (error) throw new RepositoryError('hrRegister.recordGradeGrant', error);
      return data;
    },

    async gradeGrants(employeeId) {
      const { data, error } = await db
        .from('grade_grants')
        .select(COLUMNS)
        .eq('employee_id', employeeId)
        .order('granted_on', { ascending: false })
        .order('recorded_at', { ascending: false });
      if (error) throw new RepositoryError('hrRegister.gradeGrants', error);
      return data.map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        evaluationId: row.evaluation_id,
        basis: asBasis(row.basis),
        grantedOn: calendarDate(row.granted_on),
        previousGrade: row.previous_grade,
        newGrade: row.new_grade,
        recordedAt: row.recorded_at,
      }));
    },
  };
}

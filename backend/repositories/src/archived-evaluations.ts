import { type CalendarDate, calendarDate } from '@sarmata/domain';
import { type Db } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

/** Ocena archiwalna: a past evaluation result entered by hand. */
export interface ArchivedEvaluation {
  readonly id: string;
  readonly employeeId: string;
  readonly draftedOn: CalendarDate;
  readonly acquaintedOn: CalendarDate | null;
  readonly levelCode: string | null;
  readonly outcome: 'positive' | 'negative' | null;
  readonly ratings: Record<string, number> | null;
}

export type NewArchivedEvaluation = Omit<ArchivedEvaluation, 'id'>;

export interface ArchivedEvaluationRepository {
  /** The office comes from the signed-in account (hr or evaluator). */
  create(input: NewArchivedEvaluation): Promise<void>;
  /** Sorted by drafting date, oldest first. */
  listForEmployee(employeeId: string): Promise<ArchivedEvaluation[]>;
}

const COLUMNS = 'id, employee_id, drafted_on, acquainted_on, level_code, outcome, ratings' as const;

const asOutcome = (value: string | null): 'positive' | 'negative' | null =>
  value === 'positive' || value === 'negative' ? value : null;

export function createArchivedEvaluationRepository(db: Db): ArchivedEvaluationRepository {
  return {
    async create(input) {
      const { data: employee, error: readError } = await db
        .from('employees')
        .select('office_id')
        .eq('id', input.employeeId)
        .single();
      if (readError) throw new RepositoryError('archivedEvaluations.create', readError);
      const { error } = await db.from('archived_evaluations').insert({
        office_id: employee.office_id,
        employee_id: input.employeeId,
        drafted_on: input.draftedOn,
        acquainted_on: input.acquaintedOn,
        level_code: input.levelCode,
        outcome: input.outcome,
        ratings: input.ratings === null ? null : toJson(input.ratings),
      });
      if (error) throw new RepositoryError('archivedEvaluations.create', error);
    },

    async listForEmployee(employeeId) {
      const { data, error } = await db
        .from('archived_evaluations')
        .select(COLUMNS)
        .eq('employee_id', employeeId)
        .order('drafted_on');
      if (error) throw new RepositoryError('archivedEvaluations.listForEmployee', error);
      return data.map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        draftedOn: calendarDate(row.drafted_on),
        acquaintedOn: row.acquainted_on === null ? null : calendarDate(row.acquainted_on),
        levelCode: row.level_code,
        outcome: asOutcome(row.outcome),
        ratings: row.ratings as Record<string, number> | null,
      }));
    },
  };
}

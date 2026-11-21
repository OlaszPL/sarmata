import { type CalendarDate } from '@sarmata/domain';
import { type ServiceDb } from './db';
import { RepositoryError } from './errors';

export interface ClosedEvaluation {
  readonly evaluationId: string;
  readonly officeId: string;
}

/** System side of closing evaluations after their objection window (worker only). */
export interface EvaluationClosingStore {
  /** Closes the delivered evaluations whose objection window ended before `day`. Returns the closed ones. */
  closeUnobjected(day: CalendarDate): Promise<ClosedEvaluation[]>;
}

export function createEvaluationClosingStore(db: ServiceDb): EvaluationClosingStore {
  return {
    async closeUnobjected(day) {
      const { data, error } = await db.rpc('close_unobjected_evaluations', { p_today: day });
      if (error) throw new RepositoryError('evaluationClosing.closeUnobjected', error);
      return data.map((row) => ({ evaluationId: row.evaluation_id, officeId: row.office_id }));
    },
  };
}

import {
  type CalendarDate,
  type EvaluationResult,
  type RegulationDocument,
  type ServiceStatus,
  type SheetContent,
  calendarDate,
  parseRegulationDocument,
  sheetContentSchema,
} from '@sarmata/domain';
import { type Db } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

/** Everything the service needs to recompute the result of one evaluation with a locked sheet. */
export interface ResultSource {
  readonly evaluationId: string;
  readonly employeeId: string;
  readonly sheetId: string;
  readonly sheetVersion: number;
  readonly content: SheetContent;
  readonly regulation: RegulationDocument;
  readonly serviceStatus: ServiceStatus;
  readonly gradeGrantedOn: CalendarDate | null;
  readonly drafted: CalendarDate;
  readonly acquaintedOn: CalendarDate | null;
}

/** A computed result with the sheet version it was computed for. */
export type SavedResult = EvaluationResult & {
  readonly evaluationId: string;
  readonly sheetVersion: number;
};

export interface ScheduleRow {
  readonly evaluationId: string;
  readonly employeeId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly orgUnit: string | null;
  readonly evaluatorAccountId: string;
  readonly evaluatorName: string | null;
  readonly status: string;
  readonly cycleStart: CalendarDate;
  readonly startingInterviewDueOn: CalendarDate | null;
  readonly evaluationDueOn: CalendarDate | null;
  readonly suspended: boolean;
  readonly interviewHeld: boolean;
}

export interface DistributionRow {
  readonly orgUnit: string | null;
  readonly civilServant: boolean;
  readonly levelCode: string | null;
  readonly evaluations: number;
  readonly negative: number;
  readonly secondNegative: number;
  readonly withConclusions: number;
  readonly gradeRequests: number;
  readonly gradeByLaw: number;
}

export interface DscOckCounts {
  readonly indefiniteEmployees: number;
  readonly civilServants: number;
  readonly objectionsUpheld: number;
  readonly objectionsRejected: number;
  readonly objectionsPending: number;
  readonly labourCourtAppeals: number;
  readonly gradesOnRequest: number;
}

export interface CriterionRatingRow {
  readonly criterionId: string;
  readonly points: number;
  readonly ratings: number;
}

export interface OfficeFigures {
  readonly distribution: DistributionRow[];
  readonly counts: DscOckCounts;
  readonly criteria: CriterionRatingRow[];
}

export interface EvaluatorRow {
  readonly evaluatorAccountId: string;
  readonly evaluatorName: string | null;
  readonly levelCode: string | null;
  readonly evaluations: number;
  readonly pointsSum: number;
  readonly ratings: number;
}

export interface StatisticsRepository {
  /** Evaluations drafted in the year whose current sheet is locked (hr and admin read all of the office). */
  resultSources(year: number): Promise<ResultSource[]>;
  /** Saves the projection and returns the number of saved rows (hr and admin). */
  saveResults(rows: readonly SavedResult[]): Promise<number>;
  /** Open evaluations with their deadlines (hr and admin, 42501 otherwise). */
  schedule(): Promise<ScheduleRow[]>;
  /** The three office reports in parallel (hr and admin, 42501 otherwise). */
  officeFigures(year: number): Promise<OfficeFigures>;
  /** hr only, 42501 otherwise. */
  evaluatorFigures(year: number): Promise<EvaluatorRow[]>;
}

const optionalDate = (value: string | null): CalendarDate | null =>
  value === null ? null : calendarDate(value);

export function createStatisticsRepository(db: Db): StatisticsRepository {
  async function regulationsById(ids: readonly string[]): Promise<Map<string, RegulationDocument>> {
    const documents = new Map<string, RegulationDocument>();
    if (ids.length === 0) return documents;
    const { data, error } = await db
      .from('regulation_versions')
      .select('id, document')
      .in('id', [...ids]);
    if (error) throw new RepositoryError('statistics.resultSources', error);
    for (const row of data) documents.set(row.id, parseRegulationDocument(row.document));
    return documents;
  }

  return {
    async resultSources(year) {
      const { data, error } = await db
        .from('statistics_evaluation_facts')
        .select(
          'evaluation_id, employee_id, regulation_version_id, sheet_id, sheet_version, content, civil_servant, grade_granted_on, drafted_on, acquainted_on',
        )
        .gte('drafted_on', `${String(year)}-01-01`)
        .lte('drafted_on', `${String(year)}-12-31`);
      if (error) throw new RepositoryError('statistics.resultSources', error);
      const documents = await regulationsById([
        ...new Set(data.map((row) => row.regulation_version_id)),
      ]);
      return data.flatMap((row): ResultSource[] => {
        const regulation = documents.get(row.regulation_version_id);
        if (regulation === undefined || row.drafted_on === null) return [];
        return [
          {
            evaluationId: row.evaluation_id,
            employeeId: row.employee_id,
            sheetId: row.sheet_id,
            sheetVersion: row.sheet_version,
            content: sheetContentSchema.parse(row.content),
            regulation,
            serviceStatus: row.civil_servant === true ? 'civil_servant' : 'employee',
            gradeGrantedOn: optionalDate(row.grade_granted_on),
            drafted: calendarDate(row.drafted_on),
            acquaintedOn: optionalDate(row.acquainted_on),
          },
        ];
      });
    },

    async saveResults(rows) {
      const { data, error } = await db.rpc('save_evaluation_results', {
        p_results: toJson(
          rows.map((row) => ({
            evaluation_id: row.evaluationId,
            sheet_version: row.sheetVersion,
            level_code: row.levelCode,
            outcome: row.outcome,
            mean: row.mean,
            second_consecutive_negative: row.secondConsecutiveNegative,
            grade_by_law_due_on: row.gradeByLawDueOn,
          })),
        ),
      });
      if (error) throw new RepositoryError('statistics.saveResults', error);
      return data;
    },

    async schedule() {
      const { data, error } = await db.rpc('statistics_schedule');
      if (error) throw new RepositoryError('statistics.schedule', error);
      return data.map((row) => ({
        evaluationId: row.evaluation_id,
        employeeId: row.employee_id,
        firstName: row.first_name,
        lastName: row.last_name,
        orgUnit: row.org_unit,
        evaluatorAccountId: row.evaluator_account_id,
        evaluatorName: row.evaluator_name,
        status: row.status,
        cycleStart: calendarDate(row.cycle_start),
        startingInterviewDueOn: optionalDate(row.starting_interview_due_on),
        evaluationDueOn: optionalDate(row.evaluation_due_on),
        suspended: row.suspended,
        interviewHeld: row.interview_held,
      }));
    },

    async officeFigures(year) {
      const [distribution, counts, criteria] = await Promise.all([
        db.rpc('statistics_distribution', { p_year: year }),
        db.rpc('statistics_dsc_ock_counts', { p_year: year }),
        db.rpc('statistics_criteria', { p_year: year }),
      ]);
      if (distribution.error) {
        throw new RepositoryError('statistics.officeFigures', distribution.error);
      }
      if (counts.error) throw new RepositoryError('statistics.officeFigures', counts.error);
      if (criteria.error) throw new RepositoryError('statistics.officeFigures', criteria.error);
      const count = counts.data[0];
      return {
        distribution: distribution.data.map((row) => ({
          orgUnit: row.org_unit,
          civilServant: row.civil_servant,
          levelCode: row.level_code,
          evaluations: row.evaluations,
          negative: row.negative,
          secondNegative: row.second_negative,
          withConclusions: row.with_conclusions,
          gradeRequests: row.grade_requests,
          gradeByLaw: row.grade_by_law,
        })),
        counts: {
          indefiniteEmployees: count?.indefinite_employees ?? 0,
          civilServants: count?.civil_servants ?? 0,
          objectionsUpheld: count?.objections_upheld ?? 0,
          objectionsRejected: count?.objections_rejected ?? 0,
          objectionsPending: count?.objections_pending ?? 0,
          labourCourtAppeals: count?.labour_court_appeals ?? 0,
          gradesOnRequest: count?.grades_on_request ?? 0,
        },
        criteria: criteria.data.map((row) => ({
          criterionId: row.criterion_id,
          points: row.points,
          ratings: row.ratings,
        })),
      };
    },

    async evaluatorFigures(year) {
      const { data, error } = await db.rpc('statistics_evaluators', { p_year: year });
      if (error) throw new RepositoryError('statistics.evaluatorFigures', error);
      return data.map((row) => ({
        evaluatorAccountId: row.evaluator_account_id,
        evaluatorName: row.evaluator_name,
        levelCode: row.level_code,
        evaluations: row.evaluations,
        pointsSum: row.points_sum,
        ratings: row.ratings,
      }));
    },
  };
}

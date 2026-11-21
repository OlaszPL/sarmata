import { z } from 'zod';
import {
  type CalendarDate,
  type HistoryEntry,
  type RegulationDocument,
  DEFAULT_EVALUATOR_FLAG_THRESHOLDS,
  calendarDate,
  evaluationResult,
} from '@sarmata/domain';
import {
  type OfficeSettingsRepository,
  type SavedResult,
  type StatisticsRepository,
  RepositoryError,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';
import {
  type EvaluatorReport,
  type OfficeReport,
  type ScheduleReport,
  evaluatorReport,
  officeReport,
  scheduleReport,
} from './reports';

const yearSchema = z.number().int().min(2000).max(2100);
const DEFAULT_HORIZON_DAYS = 30;

export interface StatisticsService {
  /** Open evaluations with punctuality flags (hr and admin). */
  schedule(input: { today: CalendarDate; horizonDays?: number }): Promise<ScheduleReport>;
  /** Distribution, DSC-OCK answers and development needs of the year (hr and admin). Throws `ZodError` for a bad year. */
  officeReport(year: number): Promise<OfficeReport>;
  /** Per evaluator breakdown with flags, hr only: anybody else gets `forbidden`. */
  evaluatorReport(year: number): Promise<EvaluatorReport>;
}

export interface StatisticsServiceDependencies {
  readonly repository: StatisticsRepository;
  readonly settings: Pick<OfficeSettingsRepository, 'get'>;
  readonly history: (employeeId: string) => Promise<HistoryEntry[]>;
  readonly regulationInForceOn: (on: CalendarDate) => Promise<RegulationDocument>;
}

/** Postgres 42501 from the report functions is a denied role. */
async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RepositoryError && error.code === '42501') {
      throw new ServiceError('forbidden', 'This report is not available for your role');
    }
    throw error;
  }
}

export function createStatisticsService(deps: StatisticsServiceDependencies): StatisticsService {
  const { repository } = deps;

  /**
   * Recomputes the projection of the results of the year and saves it. History is read only where it can
   * change the result: negative results (second consecutive negative) and civil servants (grade by law).
   */
  async function refresh(year: number): Promise<void> {
    const sources = await repository.resultSources(year);
    const histories = new Map<string, Promise<HistoryEntry[]>>();
    const historyOf = (employeeId: string) => {
      const cached = histories.get(employeeId) ?? deps.history(employeeId);
      histories.set(employeeId, cached);
      return cached;
    };
    const rows: SavedResult[] = [];
    for (const source of sources) {
      let result = evaluationResult(source.regulation, { ...source, history: [] });
      if (result.outcome === 'negative' || source.serviceStatus === 'civil_servant') {
        result = evaluationResult(source.regulation, {
          ...source,
          history: await historyOf(source.employeeId),
        });
      }
      rows.push({
        evaluationId: source.evaluationId,
        sheetVersion: source.sheetVersion,
        ...result,
      });
    }
    await repository.saveResults(rows);
  }

  const regulationOfYear = (year: number) =>
    deps.regulationInForceOn(calendarDate(`${String(year)}-12-31`));

  return {
    schedule: ({ today, horizonDays }) =>
      guarded(async () =>
        scheduleReport(await repository.schedule(), today, horizonDays ?? DEFAULT_HORIZON_DAYS),
      ),

    officeReport: (year) =>
      guarded(async () => {
        const validYear = yearSchema.parse(year);
        await refresh(validYear);
        const [figures, regulation] = await Promise.all([
          repository.officeFigures(validYear),
          regulationOfYear(validYear),
        ]);
        return officeReport(validYear, regulation, figures);
      }),

    evaluatorReport: (year) =>
      guarded(async () => {
        const validYear = yearSchema.parse(year);
        await refresh(validYear);
        const [rows, regulation, settings] = await Promise.all([
          repository.evaluatorFigures(validYear),
          regulationOfYear(validYear),
          deps.settings.get(),
        ]);
        return evaluatorReport(
          validYear,
          regulation,
          rows,
          settings?.evaluatorFlags ?? DEFAULT_EVALUATOR_FLAG_THRESHOLDS,
        );
      }),
  };
}

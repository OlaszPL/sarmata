import {
  type HistoryEntry,
  type RegulationDocument,
  type SheetContent,
  calendarDate,
  emptySheetContent,
  sheetCriteria,
} from '@sarmata/domain';
import {
  type CriterionRatingRow,
  type DistributionRow,
  type DscOckCounts,
  type EvaluatorRow,
  type OfficeFigures,
  type OfficeSettings,
  type ResultSource,
  type SavedResult,
  type ScheduleRow,
  type StatisticsRepository,
  RepositoryError,
} from '@sarmata/repositories';
import { officialRegulations } from '@sarmata/regulations';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { createStatisticsService } from './statistics-service';

const [first] = officialRegulations;
if (first === undefined) throw new Error('missing official regulation');
const regulation: RegulationDocument = first;

const criteria = sheetCriteria(regulation, 'C', []);
const contentWith = (points: readonly number[]): SheetContent => {
  const content = emptySheetContent();
  content.partTwo.ratings = Object.fromEntries(
    criteria.map((id, index) => [id, points[index] ?? 5]),
  );
  return content;
};
const all = (points: number) => criteria.map(() => points);

const source = (patch: Partial<ResultSource> = {}): ResultSource => ({
  evaluationId: 'ev1',
  employeeId: 'emp1',
  sheetId: 'C',
  sheetVersion: 1,
  content: contentWith(all(5)),
  regulation,
  serviceStatus: 'employee',
  gradeGrantedOn: null,
  drafted: calendarDate('2026-03-01'),
  acquaintedOn: calendarDate('2026-03-05'),
  ...patch,
});

const distributionRow = (patch: Partial<DistributionRow>): DistributionRow => ({
  orgUnit: 'Wydział X',
  civilServant: false,
  levelCode: 'meets',
  evaluations: 1,
  negative: 0,
  secondNegative: 0,
  withConclusions: 0,
  gradeRequests: 0,
  gradeByLaw: 0,
  ...patch,
});

const counts: DscOckCounts = {
  indefiniteEmployees: 10,
  civilServants: 4,
  objectionsUpheld: 1,
  objectionsRejected: 2,
  objectionsPending: 0,
  labourCourtAppeals: 3,
  gradesOnRequest: 5,
  gradesByLaw: 2,
};

interface Fake {
  repository: StatisticsRepository;
  saved: SavedResult[][];
}

function fakeRepository(
  data: {
    sources?: ResultSource[];
    distribution?: DistributionRow[];
    criteria?: CriterionRatingRow[];
    evaluators?: EvaluatorRow[];
    schedule?: ScheduleRow[];
    denied?: boolean;
  } = {},
): Fake {
  const saved: SavedResult[][] = [];
  const denied = () =>
    Promise.reject(new RepositoryError('x', { message: 'denied', code: '42501' }));
  const repository: StatisticsRepository = {
    resultSources: () => Promise.resolve(data.sources ?? []),
    saveResults: (rows) => {
      if (data.denied === true) return denied();
      saved.push([...rows]);
      return Promise.resolve(rows.length);
    },
    schedule: () => (data.denied === true ? denied() : Promise.resolve(data.schedule ?? [])),
    officeFigures: (): Promise<OfficeFigures> =>
      data.denied === true
        ? denied()
        : Promise.resolve({
            distribution: data.distribution ?? [],
            counts,
            criteria: data.criteria ?? [],
          }),
    evaluatorFigures: () =>
      data.denied === true ? denied() : Promise.resolve(data.evaluators ?? []),
  };
  return { repository, saved };
}

const baseSettings: OfficeSettings = {
  officeId: 'o1',
  aiEnabled: true,
  notesRetentionMonths: 36,
  reminderLeadDays: [14, 3],
  evaluationVisibility: 'office',
  defaultPlace: null,
  objectionAddresseeSheetA: null,
  appreciationGapDays: 30,
  evaluatorFlags: { minEvaluations: 5, centralShare: 0.8, leniencyPoints: 1 },
  smtp: { host: null, port: null, user: null, from: null, passwordSet: false },
};

function serviceWith(
  fake: Fake,
  options: {
    settings?: OfficeSettings | null;
    history?: (id: string) => Promise<HistoryEntry[]>;
  } = {},
) {
  const settings = options.settings === undefined ? baseSettings : options.settings;
  return createStatisticsService({
    repository: fake.repository,
    settings: { get: () => Promise.resolve(settings) },
    history: options.history ?? (() => Promise.resolve([])),
    regulationForYear: () => Promise.resolve(regulation),
  });
}

const row = (patch: Partial<ScheduleRow>): ScheduleRow => ({
  evaluationId: 'e',
  employeeId: 'emp',
  firstName: 'Ewa',
  lastName: 'Ewidencyjna',
  orgUnit: null,
  evaluatorAccountId: 'acc',
  evaluatorName: null,
  status: 'period',
  cycleStart: calendarDate('2026-01-01'),
  startingInterviewDueOn: null,
  evaluationDueOn: null,
  suspended: false,
  interviewHeld: false,
  ...patch,
});

const today = calendarDate('2026-06-15');

describe('schedule', () => {
  it('schedule flags overdue and missing interview', async () => {
    const service = serviceWith(
      fakeRepository({
        schedule: [
          row({ evaluationId: 'late', evaluationDueOn: calendarDate('2026-06-01') }),
          row({
            evaluationId: 'soon',
            evaluationDueOn: calendarDate('2026-07-01'),
            interviewHeld: true,
          }),
          row({ evaluationId: 'later', evaluationDueOn: calendarDate('2026-12-01') }),
        ],
      }),
    );
    const report = await service.schedule({ today });
    expect(report.rows.map((r) => r.evaluationId)).toEqual(['late', 'soon', 'later']);
    const late = report.rows[0];
    expect(late).toMatchObject({ overdue: true, withoutInterview: true });
    expect(report.rows[1]).toMatchObject({ overdue: false, withoutInterview: false });
    expect(report.rows[2]).toMatchObject({ overdue: false, withoutInterview: false });
    expect(report.summary).toEqual({
      inProgress: 3,
      overdue: 1,
      withoutInterview: 1,
      startingInterviews: 0,
    });
  });

  it('suspended deadline is not overdue', async () => {
    const service = serviceWith(
      fakeRepository({
        schedule: [row({ evaluationDueOn: calendarDate('2026-06-01'), suspended: true })],
      }),
    );
    expect((await service.schedule({ today })).rows[0]?.overdue).toBe(false);
  });

  it('starting interview within horizon', async () => {
    const service = serviceWith(
      fakeRepository({
        schedule: [
          row({
            evaluationId: 'in',
            status: 'criteria',
            startingInterviewDueOn: calendarDate('2026-07-01'),
          }),
          row({
            evaluationId: 'out',
            status: 'criteria',
            startingInterviewDueOn: calendarDate('2026-09-01'),
          }),
          row({
            evaluationId: 'past',
            status: 'criteria',
            startingInterviewDueOn: calendarDate('2026-05-01'),
          }),
        ],
      }),
    );
    const report = await service.schedule({ today, horizonDays: 30 });
    const flagged = report.rows.filter((r) => r.startingInterviewSoon).map((r) => r.evaluationId);
    expect(flagged.sort()).toEqual(['in', 'past']);
    expect(report.summary.startingInterviews).toBe(2);
  });
});

describe('office report', () => {
  it('office report compares with national shares', async () => {
    const service = serviceWith(
      fakeRepository({
        distribution: [
          distributionRow({ levelCode: 'above', evaluations: 5 }),
          distributionRow({ levelCode: 'meets', evaluations: 5 }),
        ],
      }),
    );
    const report = await service.officeReport(2026);
    const above = report.levels.find((level) => level.code === 'above');
    expect(above).toMatchObject({ count: 5, share: 0.5, nationalShare: 0.43 });
    expect(above?.differencePoints).toBeCloseTo(7, 5);
    expect(report.levels.find((level) => level.code === 'below')?.nationalShare).toBeNull();
    expect(report.negative.nationalShare).toBe(0.0039);
    expect(report.levels.map((level) => level.code)).toEqual([
      'far-above',
      'above',
      'meets',
      'below',
      'far-below',
    ]);
  });

  it('meets with far-below partial counts in level and in negative answers', async () => {
    const points = all(5);
    points[0] = 1;
    points[1] = 7;
    points[2] = 7;
    const fake = fakeRepository({
      sources: [source({ content: contentWith(points) })],
      distribution: [distributionRow({ levelCode: 'meets', negative: 1 })],
    });
    const report = await serviceWith(fake).officeReport(2026);
    expect(fake.saved[0]?.[0]).toMatchObject({ levelCode: 'meets', outcome: 'negative' });
    expect(report.levels.find((level) => level.code === 'meets')?.count).toBe(1);
    expect(report.dscOck.find((answer) => answer.question === 8)?.value).toBe(1);
  });

  it('report after correction uses the new level', async () => {
    const first = fakeRepository({ sources: [source()] });
    await serviceWith(first).officeReport(2026);
    expect(first.saved[0]?.[0]).toMatchObject({ sheetVersion: 1, levelCode: 'meets' });
    const corrected = fakeRepository({
      sources: [source({ sheetVersion: 2, content: contentWith(all(7)) })],
    });
    await serviceWith(corrected).officeReport(2026);
    expect(corrected.saved[0]?.[0]).toMatchObject({ sheetVersion: 2, levelCode: 'above' });
  });

  it('history is read only for negative and civil servant results', async () => {
    const asked: string[] = [];
    const fake = fakeRepository({
      sources: [
        source({ evaluationId: 'plain', employeeId: 'plain' }),
        source({ evaluationId: 'neg', employeeId: 'neg', content: contentWith(all(1)) }),
        source({ evaluationId: 'cs', employeeId: 'cs', serviceStatus: 'civil_servant' }),
      ],
    });
    await serviceWith(fake, {
      history: (id) => {
        asked.push(id);
        return Promise.resolve([]);
      },
    }).officeReport(2026);
    expect(asked.sort()).toEqual(['cs', 'neg']);
  });

  it('dsc-ock answers 14, 16 and 17 come from the counts', async () => {
    const report = await serviceWith(
      fakeRepository({ distribution: [distributionRow({ civilServant: true, gradeByLaw: 7 })] }),
    ).officeReport(2026);
    const value = (question: number) =>
      report.dscOck.find((answer) => answer.question === question)?.value;
    expect(value(14)).toBe(3);
    expect(value(16)).toBe(5);
    // Question 17 counts the grants by law in the register, not the computed due dates.
    expect(value(17)).toBe(2);
    expect(value(4)).toBe(10);
    expect(value(5)).toBe(4);
    expect(value(12)).toBe(3);
    const questions = new Set(report.dscOck.map((answer) => answer.question));
    expect([...questions].sort((a, b) => a - b)).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
  });

  it('small org units are listed', async () => {
    const service = serviceWith(
      fakeRepository({
        distribution: [
          distributionRow({ orgUnit: 'Biuro', levelCode: 'above' }),
          distributionRow({ orgUnit: null, levelCode: 'meets' }),
        ],
      }),
    );
    const report = await service.officeReport(2026);
    expect(report.byUnit).toEqual([
      { orgUnit: 'Biuro', total: 1, levels: { above: 1 } },
      { orgUnit: null, total: 1, levels: { meets: 1 } },
    ]);
  });

  it('development needs are sorted by the share below expectations', async () => {
    const service = serviceWith(
      fakeRepository({
        criteria: [
          { criterionId: 'a', points: 5, ratings: 3 },
          { criterionId: 'a', points: 1, ratings: 1 },
          { criterionId: 'b', points: 3, ratings: 2 },
          { criterionId: 'b', points: 7, ratings: 2 },
        ],
        distribution: [distributionRow({ withConclusions: 1, evaluations: 2 })],
      }),
    );
    const report = await service.officeReport(2026);
    expect(report.developmentNeeds.map((need) => [need.criterionId, need.share])).toEqual([
      ['b', 0.5],
      ['a', 0.25],
    ]);
    expect(report.developmentConclusionsShare).toBe(0.5);
  });

  it('denied role maps to forbidden', async () => {
    const service = serviceWith(fakeRepository({ denied: true }));
    await expect(service.officeReport(2026)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(service.schedule({ today })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(service.evaluatorReport(2026)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('officeReport of a year before the first regulation returns an empty report', async () => {
    const requested: number[] = [];
    const service = createStatisticsService({
      repository: fakeRepository().repository,
      settings: { get: () => Promise.resolve(baseSettings) },
      history: () => Promise.resolve([]),
      regulationForYear: (year) => {
        requested.push(year);
        return Promise.resolve(regulation);
      },
    });
    const report = await service.officeReport(2010);
    expect(requested).toEqual([2010]);
    expect(report.total).toBe(0);
    expect(report.levels.map((level) => level.count)).toEqual([0, 0, 0, 0, 0]);
    expect(report.byUnit).toEqual([]);
  });

  it('year 1999 throws ZodError', async () => {
    await expect(serviceWith(fakeRepository()).officeReport(1999)).rejects.toBeInstanceOf(ZodError);
  });
});

describe('evaluator report', () => {
  const evaluator = (
    id: string,
    levelCode: string,
    evaluations: number,
    pointsSum: number,
    ratings: number,
  ): EvaluatorRow => ({
    evaluatorAccountId: id,
    evaluatorName: id,
    levelCode,
    evaluations,
    pointsSum,
    ratings,
  });

  it('evaluatorReport of a year before the first regulation returns an empty report', async () => {
    const service = createStatisticsService({
      repository: fakeRepository().repository,
      settings: { get: () => Promise.resolve(baseSettings) },
      history: () => Promise.resolve([]),
      regulationForYear: () => Promise.resolve(regulation),
    });
    const report = await service.evaluatorReport(2010);
    expect(report.evaluators).toEqual([]);
  });

  it('evaluator report flags central tendency', async () => {
    const service = serviceWith(
      fakeRepository({
        evaluators: [
          evaluator('mid', 'meets', 5, 125, 25),
          evaluator('other', 'above', 5, 175, 25),
        ],
      }),
    );
    const report = await service.evaluatorReport(2026);
    expect(report.evaluators.find((e) => e.evaluatorAccountId === 'mid')?.flags).toContain(
      'central_tendency',
    );
    expect(report.evaluators.find((e) => e.evaluatorAccountId === 'other')?.flags).not.toContain(
      'central_tendency',
    );
  });

  it('lenient evaluator flagged', async () => {
    const service = serviceWith(
      fakeRepository({
        evaluators: [
          evaluator('soft', 'above', 5, 215, 25),
          evaluator('a', 'meets', 5, 125, 25),
          evaluator('b', 'meets', 5, 125, 25),
        ],
      }),
    );
    const report = await service.evaluatorReport(2026);
    const soft = report.evaluators.find((e) => e.evaluatorAccountId === 'soft');
    expect(soft?.flags).toEqual(['lenient']);
    expect(soft?.leniency).toBeCloseTo(8.6 - (215 + 250) / 75, 5);
    expect(report.thresholds).toEqual(baseSettings.evaluatorFlags);
  });

  it('thresholds come from office settings', async () => {
    const rows = [evaluator('few', 'meets', 2, 50, 10)];
    const strict = await serviceWith(fakeRepository({ evaluators: rows })).evaluatorReport(2026);
    expect(strict.evaluators[0]?.flags).toEqual([]);
    const relaxed = await serviceWith(fakeRepository({ evaluators: rows }), {
      settings: {
        ...baseSettings,
        evaluatorFlags: { minEvaluations: 2, centralShare: 0.8, leniencyPoints: 1 },
      },
    }).evaluatorReport(2026);
    expect(relaxed.evaluators[0]?.flags).toContain('central_tendency');
  });

  it('missing settings fall back to default thresholds', async () => {
    const report = await serviceWith(fakeRepository(), { settings: null }).evaluatorReport(2026);
    expect(report.thresholds).toEqual({ minEvaluations: 5, centralShare: 0.8, leniencyPoints: 1 });
  });
});

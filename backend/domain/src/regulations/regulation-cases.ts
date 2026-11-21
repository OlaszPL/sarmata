import { z } from 'zod';
import { calendarDateSchema } from '../deadlines/calendar-date';
import { computeDeadline } from '../deadlines/compute-deadline';
import { sheetCriteria } from '../evaluations/criteria';
import { scoreSheet } from '../evaluations/score';
import { errorMessage } from '../support/error-message';
import { type RegulationDocument, deadlineSlotSchema } from './regulation-document';

const caseHeader = {
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1),
};

const deadlineCaseSchema = z.strictObject({
  kind: z.literal('deadline'),
  ...caseHeader,
  slot: deadlineSlotSchema,
  eventDate: calendarDateSchema,
  absences: z.array(
    z.strictObject({ from: calendarDateSchema, to: calendarDateSchema.nullable() }),
  ),
  expected: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('due'),
      due: calendarDateSchema,
      windowStart: calendarDateSchema.optional(),
      extendedByDays: z.number().int().nonnegative().optional(),
    }),
    z.strictObject({ kind: z.literal('suspended'), since: calendarDateSchema }),
  ]),
});

const scoreCaseSchema = z.strictObject({
  kind: z.literal('score'),
  ...caseHeader,
  sheetId: z.string().min(1),
  additionalCriteria: z.array(z.string()),
  ratings: z.record(z.string(), z.number()),
  expected: z.strictObject({
    levelCode: z.string(),
    outcome: z.enum(['positive', 'negative']),
    mean: z.number().optional(),
  }),
});

/** A worked example of a regulation version: a deadline to count or a sheet to score, with the expected result. */
export const regulationCaseSchema = z.discriminatedUnion('kind', [
  deadlineCaseSchema,
  scoreCaseSchema,
]);

export const regulationCasesSchema = z.array(regulationCaseSchema);

export type RegulationCase = z.output<typeof regulationCaseSchema>;

export interface RegulationCaseResult {
  caseId: string;
  title: string;
  status: 'passed' | 'failed' | 'error';
  expected: unknown;
  actual: unknown;
  message: string | null;
}

type Verdict = Pick<RegulationCaseResult, 'status' | 'expected' | 'actual' | 'message'>;
interface Outcome {
  passed: boolean;
  expected: unknown;
  actual: unknown;
}

function runDeadline(
  regulation: RegulationDocument,
  testCase: z.output<typeof deadlineCaseSchema>,
): Outcome {
  const rule = regulation.deadlines[testCase.slot];
  if (!rule) throw new RangeError(`The regulation has no ${testCase.slot} slot`);
  const result = computeDeadline(rule, {
    eventDate: testCase.eventDate,
    absences: testCase.absences,
  });
  const expected = testCase.expected;
  if (expected.kind === 'suspended') {
    const passed = result.kind === 'suspended' && result.since === expected.since;
    return { passed, expected, actual: result };
  }
  if (result.kind === 'suspended') return { passed: false, expected, actual: result };
  const actual: Record<string, unknown> = { kind: 'due', due: result.due };
  if (expected.windowStart !== undefined) actual.windowStart = result.windowStart;
  if (expected.extendedByDays !== undefined) actual.extendedByDays = result.extendedByDays;
  const passed =
    result.due === expected.due &&
    (expected.windowStart === undefined || result.windowStart === expected.windowStart) &&
    (expected.extendedByDays === undefined || result.extendedByDays === expected.extendedByDays);
  return { passed, expected, actual };
}

function runScore(
  regulation: RegulationDocument,
  testCase: z.output<typeof scoreCaseSchema>,
): Outcome {
  const criteria = sheetCriteria(regulation, testCase.sheetId, testCase.additionalCriteria);
  const score = scoreSheet(regulation, criteria, testCase.ratings);
  const expected = testCase.expected;
  const actual: Record<string, unknown> = { levelCode: score.levelCode, outcome: score.outcome };
  if (expected.mean !== undefined) actual.mean = score.mean;
  const passed =
    score.complete &&
    score.levelCode === expected.levelCode &&
    score.outcome === expected.outcome &&
    (expected.mean === undefined ||
      (score.mean !== null && Math.abs(score.mean - expected.mean) < 1e-9));
  return { passed, expected, actual };
}

function runCase(regulation: RegulationDocument, testCase: RegulationCase): Verdict {
  try {
    const { passed, expected, actual } =
      testCase.kind === 'deadline'
        ? runDeadline(regulation, testCase)
        : runScore(regulation, testCase);
    return {
      status: passed ? 'passed' : 'failed',
      expected,
      actual,
      message: passed ? null : 'The result differs from the expected one',
    };
  } catch (error) {
    return {
      status: 'error',
      expected: testCase.expected,
      actual: null,
      message: errorMessage(error),
    };
  }
}

/** Runs worked examples against a regulation version. A broken case is an `error` result, never an exception. */
export function runRegulationCases(
  regulation: RegulationDocument,
  cases: readonly RegulationCase[],
): RegulationCaseResult[] {
  return cases.map((testCase) => ({
    caseId: testCase.id,
    title: testCase.title,
    ...runCase(regulation, testCase),
  }));
}

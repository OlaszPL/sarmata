import { z } from 'zod';
import { calendarDate } from '../deadlines/calendar-date';
import { deadlineRuleSchema } from '../deadlines/deadline-rule';

const identifier = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'expected a kebab-case identifier');
const text = z.string().min(1);
const basis = z.string().min(1);

const isoDate = z.string().transform((value, ctx) => {
  try {
    return calendarDate(value);
  } catch {
    ctx.issues.push({ code: 'custom', message: `invalid date ${value}`, input: value });
    return z.NEVER;
  }
});

export const deadlineSlotSchema = z.enum([
  'startingInterview',
  'startingInterviewAfterNegative',
  'evaluationDeadline',
  'reevaluationAfterNegative',
  'criteriaResetAfterPositionChange',
  'evaluationOnPositionChange',
  'objection',
  'objectionDecision',
  'labourCourtAppeal',
  'gradeByLawGrant',
]);

const termChangeReasonSchema = z.enum([
  'evaluatorChange',
  'expectedAbsenceOfEvaluated',
  'expectedAbsenceOfEvaluator',
  'requestOfEvaluated',
]);

/** Kebab-case spelling of `PositionKind` as written in regulation files. */
export const sheetPositionKindSchema = z.enum(['office-head', 'manages-people', 'other']);

const regulationDocumentShape = z.strictObject({
  id: identifier,
  name: text,
  effectiveFrom: isoDate,
  legalBasis: basis,
  sources: z
    .array(
      z.strictObject({
        id: identifier,
        title: text,
        citation: text,
        text: z.string().regex(/^docs\/legal\/[^/]+\.md$/, 'expected a file in docs/legal'),
      }),
    )
    .min(1),
  partialScale: z.strictObject({
    basis,
    levels: z
      .array(z.strictObject({ code: identifier, name: text, points: z.number().int().positive() }))
      .min(2),
  }),
  overallLevel: z.strictObject({
    basis,
    method: z.literal('arithmeticMean'),
    bands: z
      .array(
        z.strictObject({
          code: identifier,
          min: z.number(),
          minInclusive: z.boolean(),
          max: z.number(),
        }),
      )
      .min(2),
  }),
  outcome: z.strictObject({
    basis,
    positiveLevels: z.array(identifier).min(1),
    negativeIfAnyPartialIs: identifier,
  }),
  justification: z.strictObject({
    basis,
    requiredForNegative: z.boolean(),
    requiredForPositive: z.boolean(),
  }),
  criteria: z.strictObject({
    basis,
    catalog: z
      .array(z.strictObject({ id: identifier, name: text, indicators: z.array(text).min(1) }))
      .min(1),
  }),
  additionalCriteria: z.strictObject({
    basis,
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    fromMandatoryAllowed: z.boolean(),
  }),
  sheets: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[A-Z]$/, 'expected a single capital letter'),
        annex: z.number().int().positive(),
        positionKind: sheetPositionKindSchema,
        basis,
        position: text,
        mandatoryCriteria: z.array(identifier).min(1),
        orgUnitFields: z.boolean(),
        objectionAddressee: text.nullable(),
      }),
    )
    .min(1),
  deadlines: z.partialRecord(deadlineSlotSchema, deadlineRuleSchema),
  termChange: z.strictObject({
    basis,
    minimumElapsedMonths: z.number().int().positive(),
    reasons: z.array(termChangeReasonSchema).min(1),
    writtenNoticeRequired: z.boolean(),
  }),
  gradeByLaw: z.strictObject({
    basis,
    consecutiveEvaluations: z.number().int().positive(),
    qualifyingLevels: z.array(identifier).min(1),
    sameLevelRequired: z.boolean(),
  }),
  feedback: z.strictObject({ basis, ongoing: z.boolean(), periodic: z.boolean() }),
});

type Shape = z.output<typeof regulationDocumentShape>;

function checkReferences(document: Shape, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string): void => {
    ctx.addIssue({ code: 'custom', path, message });
  };
  const levels = new Set(document.partialScale.levels.map((level) => level.code));
  const criteria = new Set<string>();
  document.criteria.catalog.forEach((criterion, index) => {
    if (criteria.has(criterion.id)) {
      issue(['criteria', 'catalog', index, 'id'], `duplicate criterion ${criterion.id}`);
    }
    criteria.add(criterion.id);
  });
  const checkLevel = (path: (string | number)[], code: string): void => {
    if (!levels.has(code)) issue(path, `unknown level ${code}`);
  };
  document.overallLevel.bands.forEach((band, index) => {
    checkLevel(['overallLevel', 'bands', index, 'code'], band.code);
  });
  document.outcome.positiveLevels.forEach((code, index) => {
    checkLevel(['outcome', 'positiveLevels', index], code);
  });
  checkLevel(['outcome', 'negativeIfAnyPartialIs'], document.outcome.negativeIfAnyPartialIs);
  document.gradeByLaw.qualifyingLevels.forEach((code, index) => {
    checkLevel(['gradeByLaw', 'qualifyingLevels', index], code);
  });
  const kinds = new Set<string>();
  document.sheets.forEach((sheet, sheetIndex) => {
    if (kinds.has(sheet.positionKind)) {
      issue(['sheets', sheetIndex, 'positionKind'], `duplicate positionKind ${sheet.positionKind}`);
    }
    kinds.add(sheet.positionKind);
    sheet.mandatoryCriteria.forEach((id, index) => {
      if (!criteria.has(id)) {
        issue(['sheets', sheetIndex, 'mandatoryCriteria', index], `unknown criterion ${id}`);
      }
    });
  });
  if (document.additionalCriteria.min > document.additionalCriteria.max) {
    issue(['additionalCriteria', 'min'], 'min is greater than max');
  }
  const points = document.partialScale.levels.map((level) => level.points);
  const bands = document.overallLevel.bands;
  if (bands[0]?.min !== Math.min(...points) || bands.at(-1)?.max !== Math.max(...points)) {
    issue(['overallLevel', 'bands'], 'bands must cover the whole partial scale');
  }
  bands.forEach((band, index) => {
    const previous = bands[index - 1];
    if (previous && previous.max !== band.min) {
      issue(['overallLevel', 'bands', index, 'min'], 'bands must be contiguous');
    }
  });
}

/** A complete regulation version (wersja przepisów): parameters and deadline slots with legal basis. */
export const regulationDocumentSchema = regulationDocumentShape.superRefine(checkReferences);

export type RegulationDocument = z.output<typeof regulationDocumentSchema>;
export type DeadlineSlot = z.infer<typeof deadlineSlotSchema>;

export class RegulationDocumentError extends Error {
  readonly issues: z.ZodError['issues'];

  constructor(message: string, issues: z.ZodError['issues']) {
    super(message);
    this.name = 'RegulationDocumentError';
    this.issues = issues;
  }
}

/** Validates an untrusted document (JSON file, jsonb row, editor draft). Throws `RegulationDocumentError`. */
export function parseRegulationDocument(input: unknown): RegulationDocument {
  const result = regulationDocumentSchema.safeParse(input);
  if (!result.success) {
    throw new RegulationDocumentError(
      `Invalid regulation document:\n${z.prettifyError(result.error)}`,
      result.error.issues,
    );
  }
  return result.data;
}

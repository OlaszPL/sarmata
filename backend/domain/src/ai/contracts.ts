import { z } from 'zod';
import { calendarDateSchema } from '../deadlines/calendar-date';
import { type SensitiveDataWarning } from '../notes/sensitive-data';
import { criterionFactSchema, noteFactSchema } from './facts';

/**
 * Contracts of the AI services: what a user asks for (`AiRequest`), the input snapshot the service
 * stores with the run (`AiInput`) and the result the worker stores (`AiOutput`). Shared by the service,
 * the worker and `@sarmata/ai`, so the web app never imports `@sarmata/ai`. Every result is a suggestion,
 * a person decides (docs/funkcjonalnosci.md, AGENTS.md).
 */

export const aiRunKindSchema = z.enum([
  'sheet_draft',
  'quality_check',
  'sensitive_data',
  'conversation_prep',
  'criteria_proposals',
  'appreciation_moments',
  'hr_signals',
  'procedure_question',
]);
export type AiRunKind = z.infer<typeof aiRunKindSchema>;

export const aiRunStatusSchema = z.enum(['queued', 'running', 'done', 'failed']);
export type AiRunStatus = z.infer<typeof aiRunStatusSchema>;

const uuid = z.uuid();
const text = z.string().trim().min(1).max(10_000);

/** What the user asks for. The service turns it into an input snapshot. */
export const aiRequestSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('sheet_draft'), evaluationId: uuid }),
  z.strictObject({
    kind: z.literal('quality_check'),
    evaluationId: uuid,
    criterionId: z.string().min(1).nullable(),
    text,
  }),
  z.strictObject({ kind: z.literal('sensitive_data'), employeeId: uuid, text }),
  z.strictObject({
    kind: z.literal('conversation_prep'),
    employeeId: uuid,
    conversation: z.enum(['starting', 'evaluation', 'ongoing']),
    evaluationId: uuid.optional(),
  }),
  z.strictObject({ kind: z.literal('criteria_proposals'), evaluationId: uuid, duties: text }),
  z.strictObject({
    kind: z.literal('appreciation_moments'),
    employeeId: uuid,
    today: calendarDateSchema,
  }),
  z.strictObject({ kind: z.literal('hr_signals'), employeeId: uuid }),
  z.strictObject({
    kind: z.literal('procedure_question'),
    question: text,
    today: calendarDateSchema,
    evaluationId: uuid.optional(),
  }),
]);
export type AiRequestInput = z.input<typeof aiRequestSchema>;
export type AiRequest = z.output<typeof aiRequestSchema>;

/** A legal act of the regulation version: `path` is the `text` field of `sources`, relative to the repo. */
export const legalSourceSchema = z.strictObject({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  citation: z.string().min(1),
  path: z.string().min(1),
});
export type LegalSource = z.output<typeof legalSourceSchema>;

/** A retrieved piece of a legal act. `id` counts from 1 within one answer. */
export const legalFragmentSchema = z.strictObject({
  id: z.number().int().positive(),
  sourceId: z.string(),
  title: z.string(),
  citation: z.string(),
  heading: z.string().nullable(),
  text: z.string(),
  path: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
});
export type LegalFragment = z.output<typeof legalFragmentSchema>;

const sensitiveDataWarningSchema: z.ZodType<SensitiveDataWarning> = z.strictObject({
  category: z.enum(['health', 'family', 'religion', 'diagnosis']),
  fragment: z.string(),
});

const scaleLevelSchema = z.strictObject({ points: z.number().int(), name: z.string() });

// Input snapshots, built by the service in the context of the user (RLS).

const hrSignalNameSchema = z.enum(['sentiment', 'overload', 'engagement_drop', 'burnout_risk']);
export type HrSignalName = z.infer<typeof hrSignalNameSchema>;

const sentenceSchema = z.strictObject({ text: z.string(), noteIds: z.array(z.string()) });
export type Sentence = z.output<typeof sentenceSchema>;

const hrSignalsOutputSchema = z.strictObject({
  signals: z.array(
    z.strictObject({
      signal: hrSignalNameSchema,
      present: z.boolean(),
      probability: z.number().min(0).max(1),
      /**
       * False when the text model decided instead of Bielik-One: the probability is the confidence the
       * model reported itself, so the UI labels it ("model tekstowy, pewność deklarowana").
       */
      calibrated: z.boolean().default(true),
      fragments: z.array(z.strictObject({ noteId: z.string(), quote: z.string() })),
    }),
  ),
  questions: z.array(z.string()),
  actions: z.array(
    z.strictObject({
      framework: z.enum(['jd_r', 'hse']),
      signal: hrSignalNameSchema,
      text: z.string(),
    }),
  ),
});

const notes = z.array(noteFactSchema);
const criteria = z.array(criterionFactSchema);

export const aiInputSchemas = {
  sheet_draft: z.strictObject({
    sheetId: z.string(),
    criteria,
    scale: z.array(scaleLevelSchema).min(1),
    notes,
  }),
  quality_check: z.strictObject({ text: z.string(), criterion: criterionFactSchema.nullable() }),
  sensitive_data: z.strictObject({
    text: z.string(),
    keywordWarnings: z.array(sensitiveDataWarningSchema),
  }),
  conversation_prep: z.strictObject({
    conversation: z.enum(['starting', 'evaluation', 'ongoing']),
    criteria,
    notes,
    /** Output of the latest done `hr_signals` run about the employee, as context. */
    signals: hrSignalsOutputSchema.nullable(),
  }),
  criteria_proposals: z.strictObject({
    duties: z.string(),
    mandatory: criteria,
    /** Catalog criteria the evaluator may add: the catalog without the mandatory ones. */
    candidates: criteria,
    maxAdditional: z.number().int().nonnegative(),
  }),
  appreciation_moments: z.strictObject({
    today: calendarDateSchema,
    /** Office setting `appreciationGapDays`. */
    gapDays: z.number().int().min(1).max(365),
    notes,
  }),
  hr_signals: z.strictObject({
    notes,
    /** Partial ratings of the closed evaluations of the employee, oldest first. */
    pastRatings: z.array(
      z.strictObject({
        evaluationId: z.string(),
        cycleStart: calendarDateSchema,
        ratings: z.record(z.string(), z.number()),
      }),
    ),
  }),
  procedure_question: z.strictObject({
    question: z.string(),
    today: calendarDateSchema,
    regulationId: z.string(),
    corpus: z.array(legalSourceSchema).min(1),
  }),
} as const satisfies Record<AiRunKind, z.ZodType>;

export type AiInput<K extends AiRunKind> = z.output<(typeof aiInputSchemas)[K]>;

// Outputs, written by the worker.

const appreciationGapSchema = z.strictObject({
  lastAppreciationOn: calendarDateSchema.nullable(),
  daysSince: z.number().int().nullable(),
  thresholdDays: z.number().int(),
  overdue: z.boolean(),
});
export type AppreciationGap = z.output<typeof appreciationGapSchema>;

export const aiOutputSchemas = {
  sheet_draft: z.strictObject({
    status: z.enum(['draft', 'insufficient_data']),
    ratings: z.array(
      z.strictObject({
        criterionId: z.string(),
        points: z.number().int().nullable(),
        sentences: z.array(sentenceSchema),
      }),
    ),
    justification: z.array(sentenceSchema),
    developmentConclusions: z.array(sentenceSchema),
    questions: z.array(z.string()),
  }),
  quality_check: z.strictObject({
    issues: z.array(
      z.strictObject({
        type: z.enum([
          'no_example',
          'no_date',
          'personality',
          'private_sphere',
          'criterion_mismatch',
        ]),
        fragment: z.string().nullable(),
        suggestion: z.string(),
      }),
    ),
  }),
  sensitive_data: z.strictObject({ warnings: z.array(sensitiveDataWarningSchema) }),
  conversation_prep: z.strictObject({
    goal: z.string(),
    plan: z.array(z.string()),
    questions: z.array(z.strictObject({ criterionId: z.string(), questions: z.array(z.string()) })),
    difficultSituations: z.array(
      z.strictObject({
        situation: z.enum(['defensive_reaction', 'negative_outcome', 'other']),
        hint: z.string(),
      }),
    ),
  }),
  criteria_proposals: z.strictObject({
    additionalCriteria: z.array(z.strictObject({ criterionId: z.string(), reason: z.string() })),
    behaviouralExpectations: z.array(
      z.strictObject({ criterionId: z.string(), expectations: z.array(z.string()) }),
    ),
  }),
  appreciation_moments: z.strictObject({
    gap: appreciationGapSchema,
    moments: z.array(
      z.strictObject({
        noteIds: z.array(z.string()),
        reason: z.string(),
        sbi: z.strictObject({ situation: z.string(), behaviour: z.string(), impact: z.string() }),
      }),
    ),
  }),
  hr_signals: hrSignalsOutputSchema,
  procedure_question: z.strictObject({
    answer: z.string(),
    grounded: z.boolean(),
    citations: z.array(
      z.strictObject({ fragmentId: z.number().int().positive(), reference: z.string() }),
    ),
    fragments: z.array(legalFragmentSchema),
  }),
} as const satisfies Record<AiRunKind, z.ZodType>;

export type AiOutput<K extends AiRunKind> = z.output<(typeof aiOutputSchemas)[K]>;

/** Ids and versions of what the run read. Never content: it outlives the retention of notes. */
export interface AiInputRefs {
  noteIds: { id: string; version: number }[];
  droppedNoteIds: string[];
  sheetVersion?: number;
  regulationId?: string;
  signalsRunId?: string;
}

export const aiInputRefsSchema = z.object({
  noteIds: z.array(z.strictObject({ id: z.string(), version: z.number().int() })).default([]),
  droppedNoteIds: z.array(z.string()).default([]),
  sheetVersion: z.number().int().optional(),
  regulationId: z.string().optional(),
  signalsRunId: z.string().optional(),
});

/**
 * Paths of the fragments a user can accept, edit or reject in a run output. A fragment decision names
 * one of them (`ai_fragment_decisions.fragment`).
 */
export function aiFragmentPaths<K extends AiRunKind>(kind: K, output: AiOutput<K>): string[] {
  const indexed = (prefix: string, items: readonly unknown[]): string[] =>
    items.map((_, index) => `${prefix}.${index}`);
  const typed = { kind, output } as {
    [P in AiRunKind]: { kind: P; output: AiOutput<P> };
  }[AiRunKind];
  switch (typed.kind) {
    case 'sheet_draft':
      return [
        ...typed.output.ratings.map((rating) => `rating.${rating.criterionId}`),
        ...indexed('justification', typed.output.justification),
        ...indexed('developmentConclusions', typed.output.developmentConclusions),
        ...indexed('question', typed.output.questions),
      ];
    case 'quality_check':
      return indexed('issue', typed.output.issues);
    case 'sensitive_data':
      return indexed('warning', typed.output.warnings);
    case 'conversation_prep':
      return [
        'goal',
        ...indexed('plan', typed.output.plan),
        ...typed.output.questions.flatMap((entry) =>
          indexed(`question.${entry.criterionId}`, entry.questions),
        ),
        ...indexed('situation', typed.output.difficultSituations),
      ];
    case 'criteria_proposals':
      return [
        ...typed.output.additionalCriteria.map((entry) => `criterion.${entry.criterionId}`),
        ...typed.output.behaviouralExpectations.map((entry) => `expectations.${entry.criterionId}`),
      ];
    case 'appreciation_moments':
      return indexed('moment', typed.output.moments);
    case 'hr_signals':
      return [
        ...typed.output.signals.map((entry) => `signal.${entry.signal}`),
        ...indexed('question', typed.output.questions),
        ...indexed('action', typed.output.actions),
      ];
    case 'procedure_question':
      return ['answer'];
  }
}

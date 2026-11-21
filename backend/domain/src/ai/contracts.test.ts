import { describe, expect, it } from 'vitest';
import {
  type AiRunKind,
  aiFragmentPaths,
  aiInputSchemas,
  aiOutputSchemas,
  aiRequestSchema,
} from './contracts';

const EMPLOYEE = '11111111-1111-4111-8111-111111111111';

const sentence = { text: 'Terminowo oddał raport 12.03.2026.', noteIds: ['n1'] };

const outputExamples: Record<AiRunKind, unknown> = {
  sheet_draft: {
    status: 'draft',
    ratings: [
      { criterionId: 'communication', points: 7, sentences: [sentence] },
      { criterionId: 'reliability', points: null, sentences: [] },
    ],
    justification: [sentence],
    developmentConclusions: [sentence, sentence],
    questions: ['Jak ocenia Pan współpracę z zespołem?'],
  },
  quality_check: {
    issues: [{ type: 'no_date', fragment: null, suggestion: 'Dodaj datę zdarzenia.' }],
  },
  sensitive_data: {
    warnings: [{ category: 'health', fragment: 'zwolnieniu lekarskim' }],
    rewrite: 'Był nieobecny.',
  },
  conversation_prep: {
    goal: 'Omówienie wyników.',
    plan: ['Powitanie', 'Omówienie kryteriów'],
    questions: [{ criterionId: 'communication', questions: ['Co poszło dobrze?'] }],
    difficultSituations: [{ situation: 'defensive_reaction', hint: 'Wróć do faktów.' }],
  },
  criteria_proposals: {
    additionalCriteria: [{ criterionId: 'negotiation', reason: 'Prowadzi uzgodnienia.' }],
    behaviouralExpectations: [
      { criterionId: 'negotiation', expectations: ['Przygotowuje stanowisko.'] },
    ],
  },
  appreciation_moments: {
    gap: { lastAppreciationOn: '2026-10-01', daysSince: 20, thresholdDays: 30, overdue: false },
    moments: [
      {
        noteIds: ['n1'],
        reason: 'Pomógł zespołowi.',
        sbi: { situation: 'Kontrola', behaviour: 'Przygotował dane', impact: 'Zdążyliśmy' },
      },
    ],
  },
  hr_signals: {
    signals: [
      {
        signal: 'overload',
        present: true,
        probability: 0.8,
        fragments: [{ noteId: 'n1', quote: 'dwóch dodatkowych spraw' }],
      },
    ],
    questions: ['Jak ocenia Pan obecne obciążenie?'],
    actions: [{ framework: 'jd_r', signal: 'overload', text: 'Przegląd priorytetów zadań.' }],
  },
  procedure_question: {
    answer: 'Sprzeciw wnosi się w terminie 7 dni [1].',
    grounded: true,
    citations: [{ fragmentId: 1, reference: 'art. 83 ust. 1' }],
    fragments: [
      {
        id: 1,
        sourceId: 'civil-service-act',
        title: 'Ustawa o służbie cywilnej',
        citation: 'Dz.U. 2026 poz. 590',
        heading: '# Art. 83',
        text: 'Art. 83. 1. ...',
        path: 'backend/regulations/regulation-2016/sources/ustawa.md',
        startLine: 10,
        endLine: 20,
      },
    ],
  },
};

describe('ai contracts', () => {
  it('request schema rejects unknown kind', () => {
    expect(aiRequestSchema.safeParse({ kind: 'horoscope', employeeId: EMPLOYEE }).success).toBe(
      false,
    );
    expect(aiRequestSchema.parse({ kind: 'hr_signals', employeeId: EMPLOYEE })).toEqual({
      kind: 'hr_signals',
      employeeId: EMPLOYEE,
    });
  });

  it.each(Object.entries(outputExamples))(
    'output schema of %s parses its example',
    (kind, example) => {
      const schema = aiOutputSchemas[kind as AiRunKind];
      expect(schema.safeParse(example).success).toBe(true);
    },
  );

  it('fragment paths of sheet draft', () => {
    const output = aiOutputSchemas.sheet_draft.parse(outputExamples.sheet_draft);
    expect(aiFragmentPaths('sheet_draft', output)).toEqual([
      'rating.communication',
      'rating.reliability',
      'justification.0',
      'developmentConclusions.0',
      'developmentConclusions.1',
      'question.0',
    ]);
  });

  it('sensitive data output without rewrite parses as null rewrite', () => {
    expect(aiOutputSchemas.sensitive_data.parse({ warnings: [] })).toEqual({
      warnings: [],
      rewrite: null,
    });
  });

  it('sensitive data fragment paths include rewrite', () => {
    const warnings = [{ category: 'health' as const, fragment: 'L4' }];
    expect(aiFragmentPaths('sensitive_data', { warnings, rewrite: 'Był nieobecny.' })).toEqual([
      'warning.0',
      'rewrite',
    ]);
    expect(aiFragmentPaths('sensitive_data', { warnings, rewrite: null })).toEqual(['warning.0']);
  });

  it('appreciation input requires gap days', () => {
    const input = { today: '2026-11-21', notes: [] };
    expect(aiInputSchemas.appreciation_moments.safeParse(input).success).toBe(false);
    expect(aiInputSchemas.appreciation_moments.safeParse({ ...input, gapDays: 0 }).success).toBe(
      false,
    );
    expect(aiInputSchemas.appreciation_moments.parse({ ...input, gapDays: 14 }).gapDays).toBe(14);
  });
});

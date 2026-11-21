import { type AiRunKind } from '@sarmata/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { type AiConfig } from './config';
import { type FakeServer, type StreamOptions, modelReplies, startFakeServer } from './fake-server';
import { type AiRunner, createAi, createAiRunner } from './index';
import { unavailableLegalSearch } from './legal-search';
import { type AiRunProgress } from './progress';

let server: FakeServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function runnerWith(
  replies: Parameters<typeof modelReplies>[0],
  overrides: Partial<AiConfig> = {},
  stream: StreamOptions = {},
): Promise<{ runner: AiRunner; fake: FakeServer }> {
  server = await startFakeServer(modelReplies(replies, stream));
  const baseUrl = server.baseUrl;
  const config: AiConfig = {
    enabled: true,
    timeoutMs: 2_000,
    text: { baseUrl, model: 'bielik-test', apiKey: null },
    decision: { baseUrl, model: 'decision', apiKey: null },
    ...overrides,
  };
  return {
    runner: createAiRunner({ ai: createAi(config), legalSearch: unavailableLegalSearch }),
    fake: server,
  };
}

async function executeOk(runner: AiRunner, kind: AiRunKind, input: unknown) {
  const result = await runner.execute({ kind, input });
  if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
  return result.value.output;
}

const schemaOf = (fake: FakeServer, index: number): string =>
  JSON.stringify(
    (fake.requests[index]?.body as { response_format?: unknown } | null)?.response_format,
  );

const note = (
  id: string,
  body: string,
  overrides: Partial<{ kind: string; sign: 'plus' | 'minus' | null; occurredOn: string }> = {},
) => ({
  id,
  version: 1,
  kind: 'observation',
  occurredOn: '2026-10-01',
  criterionId: null,
  sign: 'plus',
  communicated: false,
  body,
  ...overrides,
});

const criteria = [
  { id: 'communication', name: 'komunikacja', indicators: ['przekazuje informacje'] },
  { id: 'reliability', name: 'rzetelność', indicators: ['dotrzymuje terminów'] },
];

describe('conversation prep', () => {
  it('conversation prep returns questions per criterion', async () => {
    const { runner, fake } = await runnerWith({
      objects: {
        conversation_prep: {
          goal: 'Omówienie okresu.',
          plan: ['Powitanie', 'Kryteria'],
          questions: [
            { criterionId: 'communication', questions: ['Jak przebiegła narada 1.10?'] },
            { criterionId: 'reliability', questions: ['Co pomogło dotrzymać terminu?'] },
          ],
          difficultSituations: [{ situation: 'defensive_reaction', hint: 'Wróć do faktów.' }],
        },
      },
    });
    const output = await executeOk(runner, 'conversation_prep', {
      conversation: 'evaluation',
      criteria,
      notes: [note('n1', 'Poprowadził naradę.')],
      signals: {
        signals: [
          { signal: 'overload', present: true, probability: 0.8, fragments: [] },
          { signal: 'burnout_risk', present: false, probability: 0.2, fragments: [] },
        ],
        questions: [],
        actions: [],
      },
    });
    expect(output).toMatchObject({
      questions: [{ criterionId: 'communication' }, { criterionId: 'reliability' }],
    });
    const prompt = JSON.stringify(fake.requests[0]?.body);
    expect(prompt).toContain('przeciążenie, prawdopodobieństwo 0.80');
    expect(prompt).not.toContain('ryzyko wypalenia, prawdopodobieństwo');
    expect(schemaOf(fake, 0)).toContain('"enum":["communication","reliability"]');
    // Points, not prose: capped lists and a short token limit.
    expect(schemaOf(fake, 0)).toContain('"maxItems":4');
    expect(fake.requests[0]?.body).toMatchObject({ max_tokens: 300, stream: true });
  });

  it('keeps the finished points of a preparation cut at max_tokens', async () => {
    const { runner } = await runnerWith(
      {
        objects: {
          conversation_prep:
            '{"goal":"Omówienie okresu.","plan":["Powitanie","Kryteria"],"questions":[{"criterionId":"communication","questions":["Jak przeb',
        },
      },
      {},
      { finishReason: 'length' },
    );
    const output = await executeOk(runner, 'conversation_prep', {
      conversation: 'ongoing',
      criteria,
      notes: [note('n1', 'Poprowadził naradę.')],
      signals: null,
    });
    expect(output).toEqual({
      goal: 'Omówienie okresu.',
      plan: ['Powitanie', 'Kryteria'],
      questions: [],
      difficultSituations: [],
    });
  });
});

describe('criteria proposals', () => {
  it('criteria proposals wait for the long limit', async () => {
    const reply = modelReplies({
      objects: { criteria_proposals: { additionalCriteria: [], behaviouralExpectations: [] } },
    });
    server = await startFakeServer((request) => ({ ...reply(request), delayMs: 200 }));
    const text = { baseUrl: server.baseUrl, model: 'bielik-test', apiKey: null };
    const ai = createAi({
      enabled: true,
      timeoutMs: 50,
      longTimeoutMs: 2_000,
      text,
      decision: null,
    });
    const runner = createAiRunner({ ai, legalSearch: unavailableLegalSearch });
    await executeOk(runner, 'criteria_proposals', {
      duties: 'Prowadzi rejestr umów.',
      mandatory: criteria,
      candidates: [],
      maxAdditional: 3,
    });
  });

  it('criteria proposals exclude mandatory criteria', async () => {
    const { runner, fake } = await runnerWith({
      objects: {
        criteria_proposals: {
          additionalCriteria: [
            { criterionId: 'negotiation', reason: 'Prowadzi uzgodnienia.' },
            { criterionId: 'negotiation', reason: 'Powtórka.' },
            { criterionId: 'creativity', reason: 'Nowe rozwiązania.' },
            { criterionId: 'public-speaking', reason: 'Wystąpienia.' },
          ],
          behaviouralExpectations: [
            { criterionId: 'communication', expectations: ['Przekazuje ustalenia w 1 dzień.'] },
            { criterionId: 'creativity', expectations: ['Proponuje usprawnienia.'] },
            { criterionId: 'public-speaking', expectations: ['Prezentuje wyniki.'] },
          ],
        },
      },
    });
    const output = await executeOk(runner, 'criteria_proposals', {
      duties: 'Prowadzi uzgodnienia międzyresortowe.',
      mandatory: criteria,
      candidates: [
        { id: 'negotiation', name: 'negocjacje', indicators: [] },
        { id: 'creativity', name: 'kreatywność', indicators: [] },
        { id: 'public-speaking', name: 'wystąpienia', indicators: [] },
      ],
      maxAdditional: 2,
    });
    expect(output).toMatchObject({
      additionalCriteria: [{ criterionId: 'negotiation' }, { criterionId: 'creativity' }],
    });
    // public-speaking is not proposed, so it gets no expectations.
    expect(output).toMatchObject({
      behaviouralExpectations: [{ criterionId: 'communication' }, { criterionId: 'creativity' }],
    });
    const schema = schemaOf(fake, 0);
    expect(schema).toContain('"minItems":1');
    expect(schema).toContain('"enum":["negotiation","creativity","public-speaking"]');
    expect(schema).toContain(
      '"enum":["communication","reliability","negotiation","creativity","public-speaking"]',
    );
  });
});

describe('appreciation moments', () => {
  const moment = {
    noteIds: ['n1', 'ghost'],
    reason: 'Pomógł przy kontroli.',
    sbi: { situation: 'Kontrola 1.10', behaviour: 'Przygotował dane', impact: 'Zdążyliśmy' },
  };

  it.each([
    [14, true],
    [30, false],
  ])(
    'appreciation gap overdue after the office threshold (gap days %i gives %s)',
    async (gapDays, overdue) => {
      const { runner } = await runnerWith({
        objects: { appreciation_moments: { moments: [moment] } },
      });
      const output = await executeOk(runner, 'appreciation_moments', {
        today: '2026-11-21',
        gapDays,
        notes: [
          note('n1', 'Pomógł przy kontroli.', { occurredOn: '2026-11-15' }),
          note('n0', 'Podziękowanie za raport.', {
            kind: 'appreciation',
            occurredOn: '2026-11-01',
          }),
          note('n2', 'Spóźniony raport.', { sign: 'minus', occurredOn: '2026-11-10' }),
        ],
      });
      expect(output).toEqual({
        gap: { lastAppreciationOn: '2026-11-01', daysSince: 20, thresholdDays: gapDays, overdue },
        moments: [{ ...moment, noteIds: ['n1'] }],
      });
    },
  );

  it('appreciation without positive notes skips the model', async () => {
    const { runner, fake } = await runnerWith({});
    const output = await executeOk(runner, 'appreciation_moments', {
      today: '2026-11-21',
      gapDays: 30,
      notes: [note('n2', 'Spóźniony raport.', { sign: 'minus' })],
    });
    expect(output).toEqual({
      gap: { lastAppreciationOn: null, daysSince: null, thresholdDays: 30, overdue: true },
      moments: [],
    });
    expect(fake.requests).toEqual([]);
  });
});

describe('hr signals', () => {
  const notes = [
    note('n1', 'Przejął dwie dodatkowe sprawy i zostaje po godzinach.', {
      kind: 'workload_fact',
      sign: null,
    }),
    note('n2', 'Oddał raport po terminie.', { sign: 'minus' }),
  ];
  const input = {
    notes,
    pastRatings: [{ evaluationId: 'e1', cycleStart: '2024-01-01', ratings: { reliability: 7 } }],
  };
  const noul = (probability: number) => ({
    type: 'noul',
    noul: probability,
    probabilities: { true: probability, false: 1 - probability },
    confidence: Math.max(probability, 1 - probability),
  });
  const bielikAnswers = (overload: number) => ({
    answers: {
      sentiment: {
        type: 'choice',
        choice: 'neutral',
        probabilities: { negative: 0.3, neutral: 0.6, positive: 0.1 },
        confidence: 0.6,
      },
      overload: noul(overload),
      engagement_drop: noul(0.1),
      burnout_risk: noul(0.2),
    },
  });
  const explanation = {
    evidence: {
      overload: [
        { noteId: 'N1', quote: 'zostaje po godzinach' },
        { noteId: 'N2', quote: 'zostaje po godzinach' },
      ],
    },
    questions: ['Które zadania można przesunąć?', 'Czy leczy Pan depresję?'],
    actions: [
      { framework: 'jd_r', signal: 'overload', text: 'Przegląd priorytetów zadań.' },
      { framework: 'hse', signal: 'overload', text: 'Skierowanie na terapię depresji.' },
    ],
  };

  it('signals use bielik-one endpoint', async () => {
    const { runner, fake } = await runnerWith({
      decision: bielikAnswers(0.8),
      objects: { hr_signals: explanation },
    });
    const output = await executeOk(runner, 'hr_signals', input);
    expect(fake.requests.map((request) => request.url)).toEqual([
      '/v1/systemone',
      '/v1/chat/completions',
    ]);
    expect(output).toMatchObject({
      signals: [
        { signal: 'sentiment', present: false, probability: 0.3 },
        { signal: 'overload', present: true, probability: 0.8 },
        { signal: 'engagement_drop', present: false },
        { signal: 'burnout_risk', present: false },
      ],
    });
    expect(JSON.stringify(fake.requests[0]?.body)).toContain('reliability 7');
    // Notes go to the models as N1, N2: short citations instead of UUIDs.
    expect(JSON.stringify(fake.requests[1]?.body)).toContain('[N1]');
    expect(schemaOf(fake, 1)).toContain('"enum":["N1","N2"]');
  });

  it('requires evidence, questions and actions in the schema', async () => {
    const { runner, fake } = await runnerWith({
      decision: bielikAnswers(0.8),
      objects: { hr_signals: explanation },
    });
    await executeOk(runner, 'hr_signals', input);
    const schema = schemaOf(fake, 1);
    expect(schema).toContain('"minItems":1');
    expect(schema.match(/"minItems":2/g)).toHaveLength(2);
    expect(schema).toContain('"evidence"');
    expect(schema).toContain('"required":["overload"]');
  });

  it('asks the text model only about signals above the minimum probability', async () => {
    const { runner, fake } = await runnerWith({
      decision: bielikAnswers(0.55),
      objects: { hr_signals: explanation },
    });
    const output = await executeOk(runner, 'hr_signals', input);
    expect(fake.requests.map((request) => request.url)).toEqual(['/v1/systemone']);
    expect(output).toMatchObject({ questions: [], actions: [] });
  });

  it('streams the decided signals before the questions and actions', async () => {
    const { runner } = await runnerWith({
      decision: bielikAnswers(0.8),
      objects: { hr_signals: explanation },
    });
    const updates: AiRunProgress[] = [];
    const result = await runner.execute(
      { kind: 'hr_signals', input },
      { onProgress: (progress) => updates.push(progress) },
    );
    expect(result.ok).toBe(true);
    expect(updates[0]).toMatchObject({
      outputTokens: 0,
      partialOutput: {
        signals: [
          { signal: 'sentiment' },
          { signal: 'overload', present: true },
          { signal: 'engagement_drop' },
          { signal: 'burnout_risk' },
        ],
      },
    });
    expect(updates[0]?.partialOutput).not.toHaveProperty('questions');
    const last = updates.at(-1)?.partialOutput as { questions?: string[] } | undefined;
    expect(last?.questions).toEqual(['Które zadania można przesunąć?']);
  });

  it('keeps the finished part of an explanation cut at max_tokens', async () => {
    const cut = JSON.stringify(explanation).slice(
      0,
      JSON.stringify(explanation).indexOf('actions'),
    );
    const { runner } = await runnerWith(
      { decision: bielikAnswers(0.8), objects: { hr_signals: cut } },
      {},
      { finishReason: 'length' },
    );
    const output = await executeOk(runner, 'hr_signals', input);
    expect(output).toMatchObject({
      signals: [
        { signal: 'sentiment' },
        { signal: 'overload', fragments: [{ noteId: 'n1', quote: 'zostaje po godzinach' }] },
        { signal: 'engagement_drop' },
        { signal: 'burnout_risk' },
      ],
      questions: ['Które zadania można przesunąć?'],
      actions: [],
    });
  });

  it.each([
    ['not configured', null],
    ['not running', 'http://127.0.0.1:9/v1'],
  ])(
    'signals of Bielik-One stay when the text model is %s, without fragments',
    async (_, textUrl) => {
      const { runner } = await runnerWith(
        { decision: bielikAnswers(0.8) },
        { text: textUrl === null ? null : { baseUrl: textUrl, model: 'bielik', apiKey: null } },
      );
      const output = await executeOk(runner, 'hr_signals', input);
      expect(output).toMatchObject({
        signals: [
          { signal: 'sentiment', present: false },
          { signal: 'overload', present: true, probability: 0.8, fragments: [] },
          { signal: 'engagement_drop', present: false },
          { signal: 'burnout_risk', present: false },
        ],
        questions: [],
        actions: [],
      });
    },
  );

  it('signals fall back to text model', async () => {
    const { runner, fake } = await runnerWith(
      {
        objects: {
          decision_answers: {
            sentiment: { choice: 'negative', confidence: 0.7 },
            overload: { value: true, confidence: 0.9 },
            engagement_drop: { value: false, confidence: 0.8 },
            burnout_risk: { value: false, confidence: 0.6 },
          },
          hr_signals: { ...explanation, evidence: { overload: [] } },
        },
      },
      { decision: null },
    );
    const output = await executeOk(runner, 'hr_signals', input);
    expect(schemaOf(fake, 0)).toContain('"name":"decision_answers"');
    // The fallback probability is not its own: the probability is the confidence the model reported.
    expect(output).toMatchObject({
      signals: [
        { signal: 'sentiment', present: true, probability: 0.7 },
        { signal: 'overload', present: true, probability: 0.9 },
        { signal: 'engagement_drop', present: false },
        { signal: 'burnout_risk', present: false },
      ],
    });
    const signals = (output as { signals: { probability: number }[] }).signals;
    expect(signals[2]?.probability).toBeCloseTo(0.2);
    expect(signals[3]?.probability).toBeCloseTo(0.4);
    for (const entry of signals) {
      expect(entry.probability).not.toBe(0);
      expect(entry.probability).not.toBe(1);
    }
  });

  it('signals without notes skip the model', async () => {
    const { runner, fake } = await runnerWith({ decision: bielikAnswers(0.8) });
    const output = await executeOk(runner, 'hr_signals', { notes: [], pastRatings: [] });
    expect(fake.requests).toHaveLength(0);
    expect(output).toMatchObject({
      signals: [
        { signal: 'sentiment', present: false, probability: 0 },
        { signal: 'overload', present: false, probability: 0 },
        { signal: 'engagement_drop', present: false, probability: 0 },
        { signal: 'burnout_risk', present: false, probability: 0 },
      ],
      questions: [],
      actions: [],
    });
  });

  it('absent signals skip the second call', async () => {
    const { runner, fake } = await runnerWith({ decision: bielikAnswers(0.1) });
    const output = await executeOk(runner, 'hr_signals', input);
    expect(fake.requests).toHaveLength(1);
    expect(output).toMatchObject({ questions: [], actions: [] });
  });

  it('quote outside the note is dropped', async () => {
    const { runner } = await runnerWith({
      decision: bielikAnswers(0.8),
      objects: { hr_signals: explanation },
    });
    const output = await executeOk(runner, 'hr_signals', input);
    expect(output).toMatchObject({
      signals: [
        { signal: 'sentiment', fragments: [] },
        { signal: 'overload', fragments: [{ noteId: 'n1', quote: 'zostaje po godzinach' }] },
        { signal: 'engagement_drop', fragments: [] },
        { signal: 'burnout_risk', fragments: [] },
      ],
    });
  });

  it('diagnostic action is dropped', async () => {
    const { runner } = await runnerWith({
      decision: bielikAnswers(0.8),
      objects: { hr_signals: explanation },
    });
    const output = await executeOk(runner, 'hr_signals', input);
    expect(output).toMatchObject({
      questions: ['Które zadania można przesunąć?'],
      actions: [{ framework: 'jd_r', signal: 'overload', text: 'Przegląd priorytetów zadań.' }],
    });
    expect('actions' in output && output.actions).toHaveLength(1);
  });
});

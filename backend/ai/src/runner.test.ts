import { type AiInput, type AiRunKind, aiRunKindSchema } from '@sarmata/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { type AiConfig } from './config';
import {
  type FakeServer,
  type RecordedRequest,
  type StreamOptions,
  modelReplies,
  promptOf,
  startFakeServer,
} from './fake-server';
import { type AiRunner, createAi, createAiRunner } from './index';
import { unavailableLegalSearch } from './legal-search';
import { type AiRunProgress } from './progress';
import { PROMPT_VERSIONS, type PromptName, loadPrompt } from './prompts';

let server: FakeServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

const config = (baseUrl: string, overrides: Partial<AiConfig> = {}): AiConfig => ({
  enabled: true,
  timeoutMs: 2_000,
  text: { baseUrl, model: 'bielik-test', apiKey: null },
  decision: { baseUrl, model: 'decision', apiKey: null },
  ...overrides,
});

async function runnerWith(
  replies: Parameters<typeof modelReplies>[0],
  stream: StreamOptions = {},
  overrides: Partial<AiConfig> = {},
): Promise<{ runner: AiRunner; fake: FakeServer }> {
  server = await startFakeServer(modelReplies(replies, stream));
  const runner = createAiRunner({
    ai: createAi(config(server.baseUrl, overrides)),
    legalSearch: unavailableLegalSearch,
  });
  return { runner, fake: server };
}

const note = (id: string, body: string) => ({
  id,
  version: 1,
  kind: 'observation' as const,
  occurredOn: '2026-03-12',
  criterionId: 'communication',
  sign: 'plus' as const,
  communicated: false,
  body,
});

const criteria = [
  { id: 'communication', name: 'komunikacja', indicators: ['przekazuje informacje'] },
  { id: 'reliability', name: 'rzetelność', indicators: ['dotrzymuje terminów'] },
];

const scale = [1, 3, 5, 7, 9].map((points) => ({ points, name: `poziom ${points}` }));

const draftInput = {
  sheetId: 'C',
  criteria,
  scale,
  notes: [
    note('n1', 'Przekazał ustalenia zespołowi.'),
    { ...note('n2', 'Oddał raport po terminie.'), criterionId: 'reliability' },
  ],
} satisfies Record<keyof AiInput<'sheet_draft'>, unknown>;

const schemaOf = (request: RecordedRequest): string | undefined =>
  (request.body as { response_format?: { json_schema?: { name?: string } } } | null)
    ?.response_format?.json_schema?.name;

const executeOk = async (runner: AiRunner, kind: AiRunKind, input: unknown) => {
  const result = await runner.execute({ kind, input });
  if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
  return result.value;
};

describe('prompts', () => {
  it('every kind has a prompt file', () => {
    const names = Object.keys(PROMPT_VERSIONS) as PromptName[];
    expect([...names].sort()).toEqual(
      aiRunKindSchema.options.map((kind) => kind.replaceAll('_', '-')).sort(),
    );
    for (const name of names) {
      const prompt = loadPrompt(name);
      expect(prompt.id).toBe(`${name}.v${PROMPT_VERSIONS[name]}`);
      expect(prompt.system.length).toBeGreaterThan(100);
    }
  });
});

/** Criterion replies by id, from the task at the end of the prompt (`Zadanie: kryterium <id>`). */
const perCriterion =
  (replies: Record<string, unknown>) =>
  (request: RecordedRequest): unknown =>
    replies[/Zadanie: kryterium (\S+)/.exec(promptOf(request))?.[1] ?? ''];

const emptySummary = { justification: [], developmentConclusions: [], questions: [] };

describe('sheet draft', () => {
  it('calls the model per criterion, then once for the summary, with notes filtered by criterion', async () => {
    const { runner, fake } = await runnerWith({
      objects: {
        sheet_draft_criterion: perCriterion({
          communication: {
            sentences: [{ text: '12.03.2026 przekazał ustalenia.', noteIds: ['N1'] }],
            points: 7,
          },
          reliability: { sentences: [], points: null },
        }),
        sheet_draft_summary: emptySummary,
      },
    });
    const value = await executeOk(runner, 'sheet_draft', draftInput);
    expect(value.promptVersion).toBe('sheet-draft.v3');
    expect(fake.requests.map((request) => schemaOf(request))).toEqual([
      'sheet_draft_criterion',
      'sheet_draft_criterion',
      'sheet_draft_summary',
    ]);
    const first = JSON.stringify(fake.requests[0]?.body);
    expect(first).toContain('[1,3,5,7,9]');
    expect(first).toContain('"enum":["N1"]');
    expect(first).toContain('przekazuje informacje');
    expect(first).toContain('"maxItems":2');
    expect(first).toContain('"stream":true');
    const prompts = fake.requests.map(promptOf);
    expect(prompts[0]).toContain('[N1]');
    expect(prompts[0]).not.toContain('[n1]');
    // Each criterion call sees only the notes tagged for it (and the untagged ones).
    expect(prompts[0]).not.toContain('[N2]');
    expect(prompts[1]).toContain('[N2]');
    expect(prompts[1]).not.toContain('[N1]');
    expect(prompts[1]).toContain('dotrzymuje terminów');
    expect(prompts[2]).toContain('[N1]');
    expect(prompts[2]).toContain('[N2]');
    expect(prompts[2]).toContain('Proponowane oceny cząstkowe: communication 7, reliability brak');
    expect(value.output).toMatchObject({
      status: 'draft',
      ratings: [
        { criterionId: 'communication', points: 7, sentences: [{ noteIds: ['n1'] }] },
        { criterionId: 'reliability', points: null, sentences: [] },
      ],
    });
  });

  it('makes no call for a criterion without tagged notes', async () => {
    const { runner, fake } = await runnerWith({
      objects: {
        sheet_draft_criterion: perCriterion({
          communication: {
            sentences: [{ text: '12.03.2026 przekazał ustalenia.', noteIds: ['N1'] }],
            points: 7,
          },
        }),
        sheet_draft_summary: emptySummary,
      },
    });
    const only = { ...draftInput, notes: [draftInput.notes[0]] };
    const { output } = await executeOk(runner, 'sheet_draft', only);
    expect(fake.requests.map((request) => schemaOf(request))).toEqual([
      'sheet_draft_criterion',
      'sheet_draft_summary',
    ]);
    expect(output).toMatchObject({
      ratings: [{ points: 7 }, { criterionId: 'reliability', points: null, sentences: [] }],
    });
  });

  it('drops sentences citing unknown notes', async () => {
    const { runner } = await runnerWith({
      objects: {
        sheet_draft_criterion: perCriterion({
          communication: {
            sentences: [
              { text: 'Przekazał ustalenia 12.03.2026.', noteIds: ['N1'] },
              { text: 'Wymyślone zdanie.', noteIds: ['N9'] },
            ],
            points: 7,
          },
          reliability: { sentences: [{ text: 'Bez źródła.', noteIds: [] }], points: 3 },
        }),
        sheet_draft_summary: {
          justification: [
            { text: 'Bez źródła.', noteIds: [] },
            { text: 'Z notatki.', noteIds: ['N2'] },
          ],
          developmentConclusions: [{ text: 'Obca notatka.', noteIds: ['N1', 'N9'] }],
          questions: ['Co pomogło?'],
        },
      },
    });
    const { output } = await executeOk(runner, 'sheet_draft', draftInput);
    expect(output).toEqual({
      status: 'draft',
      ratings: [
        {
          criterionId: 'communication',
          points: 7,
          sentences: [{ text: 'Przekazał ustalenia 12.03.2026.', noteIds: ['n1'] }],
        },
        { criterionId: 'reliability', points: null, sentences: [] },
      ],
      justification: [{ text: 'Z notatki.', noteIds: ['n2'] }],
      developmentConclusions: [],
      questions: ['Co pomogło?'],
    });
  });

  it('asks for more data without a summary call when no criterion has a cited sentence', async () => {
    const { runner, fake } = await runnerWith({
      objects: {
        sheet_draft_criterion: {
          sentences: [{ text: 'Spóźnia się.', noteIds: ['N9'] }],
          points: 3,
        },
        sheet_draft_summary: emptySummary,
      },
    });
    const { output } = await executeOk(runner, 'sheet_draft', draftInput);
    expect(output).toMatchObject({
      status: 'insufficient_data',
      ratings: [
        { criterionId: 'communication', points: null },
        { criterionId: 'reliability', points: null, sentences: [] },
      ],
    });
    expect('questions' in output && output.questions).toHaveLength(2);
    expect(fake.requests).toHaveLength(2);
  });

  it('keeps the finished sentences of a criterion cut at max_tokens', async () => {
    const cut =
      '{"sentences":[{"text":"12.03.2026 przekazał ustalenia.","noteIds":["N1"]},{"text":"Prowa';
    const { runner } = await runnerWith(
      {
        objects: {
          sheet_draft_criterion: perCriterion({
            communication: cut,
            reliability: { sentences: [], points: null },
          }),
          sheet_draft_summary: emptySummary,
        },
      },
      { finishReason: 'length' },
    );
    const { output } = await executeOk(runner, 'sheet_draft', draftInput);
    expect(output).toMatchObject({
      status: 'draft',
      ratings: [
        {
          criterionId: 'communication',
          points: null,
          sentences: [{ text: '12.03.2026 przekazał ustalenia.', noteIds: ['n1'] }],
        },
        { criterionId: 'reliability', points: null, sentences: [] },
      ],
    });
  });

  it('streams finished sentences and criteria before the run ends', async () => {
    const { runner } = await runnerWith({
      objects: {
        sheet_draft_criterion: perCriterion({
          communication: {
            sentences: [
              { text: '12.03.2026 przekazał ustalenia.', noteIds: ['N1'] },
              { text: '13.03.2026 omówił je z zespołem.', noteIds: ['N1'] },
            ],
            points: 7,
          },
          reliability: {
            sentences: [{ text: 'Oddał raport po terminie.', noteIds: ['N2'] }],
            points: 3,
          },
        }),
        sheet_draft_summary: {
          justification: [{ text: 'Komunikuje terminowo.', noteIds: ['N1'] }],
          developmentConclusions: [],
          questions: [],
        },
      },
    });
    const updates: AiRunProgress[] = [];
    const result = await runner.execute(
      { kind: 'sheet_draft', input: draftInput },
      { onProgress: (progress) => updates.push(progress) },
    );
    if (!result.ok) throw new Error(result.message);
    interface PartialDraft {
      ratings?: { criterionId: string; sentences: unknown[] }[];
    }
    const ratingsAt = (update: AiRunProgress) =>
      (update.partialOutput as PartialDraft | null)?.ratings;
    // The first sentence of the first criterion shows up before the model writes the second.
    const early = updates.find((update) => ratingsAt(update)?.[0]?.sentences.length === 1);
    expect(early?.text).toContain('12.03');
    expect(early?.text).not.toContain('13.03');
    // Both criteria are finished while the summary call streams.
    expect(
      updates.some(
        (update) => ratingsAt(update)?.length === 2 && update.text.includes('justification'),
      ),
    ).toBe(true);
    const tokens = updates.map((update) => update.outputTokens);
    expect(tokens).toEqual([...tokens].sort((a, b) => a - b));
    expect(tokens.at(-1)).toBeGreaterThan(30);
  });

  it('no notes gives insufficient_data without model call', async () => {
    const { runner, fake } = await runnerWith({});
    const { output } = await executeOk(runner, 'sheet_draft', { ...draftInput, notes: [] });
    expect(output).toMatchObject({ status: 'insufficient_data' });
    expect('questions' in output && output.questions).toHaveLength(2);
    expect(fake.requests).toEqual([]);
  });
});

describe('quality check', () => {
  it('quality check adds no_date without date', async () => {
    const { runner } = await runnerWith({ objects: { quality_check: { issues: [] } } });
    const { output } = await executeOk(runner, 'quality_check', {
      text: 'Terminowo pracuje.',
      criterion: null,
    });
    expect(output).toEqual({
      issues: [expect.objectContaining({ type: 'no_date', fragment: null })],
    });
  });

  it('quality check nulls fragment not in text', async () => {
    const { runner } = await runnerWith({
      objects: {
        quality_check: {
          issues: [
            { type: 'personality', fragment: 'jest LENIWY', suggestion: 'Opisz zachowanie.' },
            {
              type: 'no_example',
              fragment: 'czego nie ma w tekście',
              suggestion: 'Dodaj przykład.',
            },
          ],
        },
      },
    });
    const { output } = await executeOk(runner, 'quality_check', {
      text: 'Dnia 12.03.2026 pokazał, że jest leniwy.',
      criterion: criteria[0],
    });
    expect(output).toEqual({
      issues: [
        { type: 'personality', fragment: 'jest leniwy', suggestion: 'Opisz zachowanie.' },
        { type: 'no_example', fragment: null, suggestion: 'Dodaj przykład.' },
      ],
    });
  });
});

describe('sensitive data', () => {
  it('sensitive data merges keyword and model warnings', async () => {
    const { runner } = await runnerWith({
      objects: {
        sensitive_data: {
          warnings: [
            { category: 'health', fragment: 'zwolnieniu lekarskim' },
            { category: 'family', fragment: 'opiekował się synem' },
            { category: 'religion', fragment: 'nie ma tego w notatce' },
          ],
          rewrite: 'Był nieobecny w pracy.',
        },
      },
    });
    const { output } = await executeOk(runner, 'sensitive_data', {
      text: 'Był na zwolnieniu lekarskim, bo opiekował się synem.',
      keywordWarnings: [{ category: 'health', fragment: 'zwolnieniu lekarskim' }],
    });
    expect(output).toEqual({
      warnings: [
        { category: 'health', fragment: 'zwolnieniu lekarskim' },
        { category: 'family', fragment: 'opiekował się synem' },
      ],
      rewrite: 'Był nieobecny w pracy.',
    });
  });

  it('sensitive data drops a rewrite that keeps a flagged fragment', async () => {
    const { runner } = await runnerWith({
      objects: {
        sensitive_data: { warnings: [], rewrite: 'Był na zwolnieniu lekarskim w marcu.' },
      },
    });
    const { output } = await executeOk(runner, 'sensitive_data', {
      text: 'Był na zwolnieniu lekarskim.',
      keywordWarnings: [{ category: 'health', fragment: 'zwolnieniu lekarskim' }],
    });
    expect(output).toEqual({
      warnings: [{ category: 'health', fragment: 'zwolnieniu lekarskim' }],
      rewrite: null,
    });
  });

  it('sensitive data has no rewrite without warnings', async () => {
    const { runner } = await runnerWith({
      objects: { sensitive_data: { warnings: [], rewrite: 'Coś innego.' } },
    });
    const { output } = await executeOk(runner, 'sensitive_data', {
      text: 'Oddał raport w terminie.',
      keywordWarnings: [],
    });
    expect(output).toEqual({ warnings: [], rewrite: null });
  });

  it('sensitive data drops a rewrite equal to the note', async () => {
    const { runner } = await runnerWith({
      objects: { sensitive_data: { warnings: [], rewrite: ' Był na zwolnieniu lekarskim. ' } },
    });
    const { output } = await executeOk(runner, 'sensitive_data', {
      text: 'Był na zwolnieniu lekarskim.',
      keywordWarnings: [{ category: 'health', fragment: 'zwolnieniu lekarskim' }],
    });
    expect(output).toEqual({
      warnings: [{ category: 'health', fragment: 'zwolnieniu lekarskim' }],
      rewrite: null,
    });
  });

  it('sensitive data prompt lists keyword warnings', async () => {
    const { runner, fake } = await runnerWith({
      objects: { sensitive_data: { warnings: [], rewrite: null } },
    });
    await executeOk(runner, 'sensitive_data', {
      text: 'Był na zwolnieniu lekarskim.',
      keywordWarnings: [{ category: 'health', fragment: 'zwolnieniu lekarskim' }],
    });
    const prompt = fake.requests.map(promptOf)[0];
    expect(prompt).toContain('Notatka:\nBył na zwolnieniu lekarskim.');
    expect(prompt).toContain('Słownik wskazał fragmenty:\n- health: zwolnieniu lekarskim');
  });
});

describe('runner', () => {
  it('invalid input is rejected', async () => {
    const { runner, fake } = await runnerWith({});
    const result = await runner.execute({ kind: 'sheet_draft', input: { notes: 'nope' } });
    expect(result).toMatchObject({ ok: false, reason: 'rejected' });
    expect(fake.requests).toEqual([]);
  });

  it('disabled ai fails disabled', async () => {
    const { runner, fake } = await runnerWith({}, {}, { enabled: false });
    const result = await runner.execute({ kind: 'sheet_draft', input: draftInput });
    expect(result).toMatchObject({ ok: false, reason: 'disabled' });
    expect(fake.requests).toEqual([]);
  });
});

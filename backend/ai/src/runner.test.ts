import { type AiInput, type AiRunKind, aiRunKindSchema } from '@sarmata/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { type AiConfig } from './config';
import { type FakeServer, modelReplies, startFakeServer } from './fake-server';
import { type AiRunner, createAi, createAiRunner } from './index';
import { unavailableLegalSearch } from './legal-search';
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
  overrides: Partial<AiConfig> = {},
): Promise<{ runner: AiRunner; fake: FakeServer }> {
  server = await startFakeServer(modelReplies(replies));
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
  notes: [note('n1', 'Przekazał ustalenia zespołowi.'), note('n2', 'Oddał raport po terminie.')],
} satisfies Record<keyof AiInput<'sheet_draft'>, unknown>;

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

describe('sheet draft', () => {
  it('sheet draft sends criteria enum and scale points', async () => {
    const { runner, fake } = await runnerWith({
      objects: {
        sheet_draft: { ratings: [], justification: [], developmentConclusions: [], questions: [] },
      },
    });
    const value = await executeOk(runner, 'sheet_draft', draftInput);
    expect(value.promptVersion).toBe('sheet-draft.v1');
    const body = JSON.stringify(fake.requests[0]?.body);
    expect(body).toContain('"enum":["communication","reliability"]');
    expect(body).toContain('[1,3,5,7,9]');
    expect(body).toContain('[n1]');
  });

  it('drops sentences citing unknown notes', async () => {
    const { runner } = await runnerWith({
      objects: {
        sheet_draft: {
          ratings: [
            {
              criterionId: 'communication',
              points: 7,
              sentences: [
                { text: 'Przekazał ustalenia 12.03.2026.', noteIds: ['n1'] },
                { text: 'Wymyślone zdanie.', noteIds: ['ghost'] },
              ],
            },
          ],
          justification: [
            { text: 'Bez źródła.', noteIds: [] },
            { text: 'Z notatki.', noteIds: ['n2'] },
          ],
          developmentConclusions: [{ text: 'Obca notatka.', noteIds: ['n1', 'ghost'] }],
          questions: [],
        },
      },
    });
    const { output } = await executeOk(runner, 'sheet_draft', draftInput);
    expect(output).toMatchObject({
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
    });
  });

  it('rating without supported sentence has null points', async () => {
    const { runner } = await runnerWith({
      objects: {
        sheet_draft: {
          ratings: [
            {
              criterionId: 'reliability',
              points: 3,
              sentences: [{ text: 'Spóźnia się.', noteIds: ['ghost'] }],
            },
          ],
          justification: [],
          developmentConclusions: [],
          questions: [],
        },
      },
    });
    const { output } = await executeOk(runner, 'sheet_draft', draftInput);
    expect(output).toMatchObject({
      ratings: [
        { criterionId: 'communication', points: null },
        { criterionId: 'reliability', points: null, sentences: [] },
      ],
    });
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
    });
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
    const { runner, fake } = await runnerWith({}, { enabled: false });
    const result = await runner.execute({ kind: 'sheet_draft', input: draftInput });
    expect(result).toMatchObject({ ok: false, reason: 'disabled' });
    expect(fake.requests).toEqual([]);
  });
});

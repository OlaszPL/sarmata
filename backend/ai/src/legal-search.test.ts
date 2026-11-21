import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type LegalFragment, type LegalSource } from '@sarmata/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { legalSearchConfigFromEnv } from './config';
import { type FakeServer, modelReplies, startFakeServer } from './fake-server';
import { type LegalSearch, createAi, createAiRunner } from './index';
import { createSembleLegalSearch } from './legal-search';

const SOURCES = 'backend/regulations/regulation-2016/sources';

const corpus: LegalSource[] = [
  {
    sourceId: 'civil-service-act',
    title: 'Ustawa o służbie cywilnej',
    citation: 'Dz.U. 2026 poz. 590 t.j.',
    path: `${SOURCES}/ustawa-o-sluzbie-cywilnej-tj-2026.md`,
  },
  {
    sourceId: 'periodic-evaluation-regulation',
    title: 'Rozporządzenie w sprawie ocen okresowych',
    citation: 'Dz.U. 2016 poz. 470',
    path: `${SOURCES}/rozporzadzenie-oceny-okresowe-2016.md`,
  },
  {
    sourceId: 'hr-standards-order-6',
    title: 'Zarządzenie nr 6 Szefa Służby Cywilnej',
    citation: 'gov.pl',
    path: `${SOURCES}/zarzadzenie-6-szefa-sc-2020-standardy-zzl.md`,
  },
];

const FIXTURE = fileURLToPath(new URL('./__fixtures__/semble-search.json', import.meta.url));

/** A stand-in for semble: prints the recorded output and writes its arguments to `argsFile`. */
function fakeSemble(argsFile?: string): string[] {
  const record =
    argsFile === undefined
      ? ''
      : `require('fs').writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(1)));`;
  return [
    process.execPath,
    '-e',
    `${record}process.stdout.write(require('fs').readFileSync(${JSON.stringify(FIXTURE)}, 'utf8'))`,
  ];
}

const search = (command: string[], topK?: number): LegalSearch =>
  createSembleLegalSearch({
    command,
    root: process.cwd(),
    timeoutMs: 10_000,
    ...(topK === undefined ? {} : { topK }),
  });

describe('semble legal search', () => {
  it('parses semble json and keeps corpus files only', async () => {
    const result = await search(fakeSemble(), 10).search('termin sprzeciwu', corpus);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toHaveLength(7);
    expect(result.value.every((fragment) => !fragment.path.includes('NOTES'))).toBe(true);
    expect(result.value.map((fragment) => fragment.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.value[0]).toMatchObject({
      sourceId: 'civil-service-act',
      heading: 'Art. 83',
      path: corpus[0]?.path,
      startLine: 1438,
      endLine: 1449,
    });
  });

  it('passes directories not files', async () => {
    const argsFile = join(mkdtempSync(join(tmpdir(), 'semble-args-')), 'args.json');
    await search(fakeSemble(argsFile)).search('termin sprzeciwu', corpus);
    const args = JSON.parse(readFileSync(argsFile, 'utf8')) as string[];
    expect(args).toEqual([
      'search',
      'termin sprzeciwu',
      SOURCES,
      '--content',
      'docs',
      '--format',
      'json',
      '-k',
      '15',
    ]);
  });

  it('keeps top five', async () => {
    const result = await search(fakeSemble()).search('termin sprzeciwu', corpus);
    expect(result.ok && result.value.length).toBe(5);
  });

  it('missing command fails unavailable', async () => {
    const result = await search(['sarmata-no-such-semble']).search('termin', corpus);
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
  });
});

describe('procedure assistant', () => {
  let server: FakeServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  const fragment: LegalFragment = {
    id: 1,
    sourceId: 'civil-service-act',
    title: 'Ustawa o służbie cywilnej',
    citation: 'Dz.U. 2026 poz. 590 t.j.',
    heading: 'Art. 83',
    text: 'Art. 83. 1. Od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw.',
    path: corpus[0]?.path ?? '',
    startLine: 1438,
    endLine: 1449,
  };

  async function ask(answer: unknown, fragments: LegalFragment[]) {
    server = await startFakeServer(modelReplies({ objects: { procedure_question: answer } }));
    const baseUrl = server.baseUrl;
    const runner = createAiRunner({
      ai: createAi({
        enabled: true,
        timeoutMs: 2_000,
        text: { baseUrl, model: 'bielik-test', apiKey: null },
        decision: null,
      }),
      legalSearch: { search: () => Promise.resolve({ ok: true, value: fragments }) },
    });
    const result = await runner.execute({
      kind: 'procedure_question',
      input: {
        question: 'Jaki jest termin sprzeciwu?',
        today: '2026-11-21',
        regulationId: 'regulation-2016',
        corpus,
      },
    });
    if (!result.ok) throw new Error(result.message);
    return { output: result.value.output, fake: server };
  }

  it('answer cites retrieved fragment', async () => {
    const { output, fake } = await ask(
      {
        answer: 'Sprzeciw wnosi się w terminie 7 dni od zapoznania się z oceną [1].',
        citations: [{ fragmentId: 1, reference: 'art. 83 ust. 1 ustawy' }],
      },
      [fragment],
    );
    expect(output).toEqual({
      answer: 'Sprzeciw wnosi się w terminie 7 dni od zapoznania się z oceną [1].',
      grounded: true,
      citations: [{ fragmentId: 1, reference: 'art. 83 ust. 1 ustawy' }],
      fragments: [fragment],
    });
    expect(JSON.stringify(fake.requests[0]?.body)).toMatch(/"fragmentId":\{[^}]*"const":1/);
  });

  it('answer without valid citation is not grounded', async () => {
    const { output } = await ask({ answer: 'Nie wiem.', citations: [] }, [fragment]);
    expect(output).toMatchObject({ grounded: false, citations: [] });
  });

  it('no fragments answers without the model', async () => {
    const { output, fake } = await ask({ answer: 'x', citations: [] }, []);
    expect(output).toMatchObject({ grounded: false, fragments: [] });
    expect(fake.requests).toEqual([]);
  });
});

describe.runIf(process.env.SARMATA_SEMBLE_TEST === '1')('real semble', () => {
  it('objection deadline finds art. 83 first', async () => {
    const result = await createSembleLegalSearch({
      ...legalSearchConfigFromEnv({ SARMATA_SEMBLE_COMMAND: 'semble' }),
      timeoutMs: 120_000,
    }).search('termin wniesienia sprzeciwu od oceny okresowej', corpus);
    if (!result.ok) throw new Error(result.message);
    expect(result.value[0]?.heading).toBe('Art. 83');
  }, 180_000);
});

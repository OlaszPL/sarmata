import { describe, expect, it, vi } from 'vitest';
import {
  QUESTION_MAX,
  QUESTION_TIMEOUT_MS,
  type QuestionRun,
  evaluationIdOf,
  questionFromParams,
  questionHref,
  questionSchema,
  questionState,
} from './question';

const REQUESTED = '2026-11-22T10:00:00.000Z';
const requestedMs = Date.parse(REQUESTED);
const at = (offsetMs: number) => new Date(requestedMs + offsetMs);
const RUN_ID = '3f2b8a8e-6a7e-4d0e-9f53-6a1c2f1f9e11';
const EVALUATION_ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';

function fragment(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sourceId: 'ustawa',
    title: 'Ustawa o służbie cywilnej',
    citation: 'Dz.U. 2026 poz. 1',
    heading: 'Art. 83',
    text: `Tekst przepisu ${id}.`,
    path: 'sources/ustawa.md',
    startLine: 1,
    endLine: 4,
    ...overrides,
  };
}

function run(overrides: Record<string, unknown> = {}): QuestionRun {
  return {
    id: RUN_ID,
    officeId: 'office',
    kind: 'procedure_question',
    status: 'done',
    requestedBy: 'user',
    employeeId: null,
    evaluationId: null,
    inputRefs: {},
    promptVersion: null,
    failure: null,
    requestedAt: REQUESTED,
    startedAt: null,
    finishedAt: null,
    contentDeletedAt: null,
    decisions: [],
    partialText: null,
    outputTokens: null,
    progressUpdatedAt: null,
    partialOutput: null,
    output: {
      answer: 'Masz 7 dni.',
      grounded: true,
      citations: [{ fragmentId: 1, reference: 'art. 83 ust. 1' }],
      fragments: [fragment(1)],
    },
    ...overrides,
  } as unknown as QuestionRun;
}

describe('questionState', () => {
  it('waits for a queued or running run', () => {
    expect(questionState(run({ status: 'queued', output: null }), at(1000))).toEqual({
      kind: 'waiting',
    });
    expect(
      questionState(run({ status: 'running', output: null }), at(QUESTION_TIMEOUT_MS)),
    ).toEqual({ kind: 'waiting' });
  });

  it('times out after 240 001 ms', () => {
    expect(
      questionState(run({ status: 'running', output: null }), at(QUESTION_TIMEOUT_MS + 1)),
    ).toEqual({ kind: 'timed_out' });
  });

  it('names the disabled switch', () => {
    const state = questionState(
      run({ status: 'failed', output: null, failure: { reason: 'disabled', message: null } }),
      at(1000),
    );
    expect(state).toEqual({ kind: 'failed', message: 'AI jest wyłączone w ustawieniach urzędu.' });
  });

  it('gives one generic message for other failures', () => {
    const state = questionState(
      run({ status: 'failed', output: null, failure: { reason: 'timeout', message: 'x' } }),
      at(1000),
    );
    expect(state).toEqual({
      kind: 'failed',
      message: 'Asystent nie odpowiedział. Spróbuj ponownie albo skorzystaj z instrukcji poniżej.',
    });
  });

  it('reports removed content', () => {
    expect(
      questionState(run({ contentDeletedAt: '2026-11-22T11:00:00.000Z', output: null }), at(1000)),
    ).toEqual({ kind: 'deleted' });
    expect(questionState(run({ output: null }), at(1000))).toEqual({ kind: 'deleted' });
  });

  it('merges citations of one fragment into one source', () => {
    const state = questionState(
      run({
        output: {
          answer: 'Odpowiedź.',
          grounded: true,
          citations: [
            { fragmentId: 2, reference: 'art. 83 ust. 1' },
            { fragmentId: 1, reference: 'art. 81 ust. 7' },
            { fragmentId: 2, reference: 'art. 83 ust. 2' },
          ],
          fragments: [fragment(1), fragment(2)],
        },
      }),
      at(1000),
    );
    expect(state.kind).toBe('done');
    if (state.kind !== 'done') return;
    expect(state.sources.map((source) => [source.number, source.reference])).toEqual([
      [2, 'art. 83 ust. 1'],
      [1, 'art. 81 ust. 7'],
    ]);
    expect(state.sources[0]).toMatchObject({
      title: 'Ustawa o służbie cywilnej',
      citation: 'Dz.U. 2026 poz. 1',
      heading: 'Art. 83',
      text: 'Tekst przepisu 2.',
    });
  });

  it('drops a citation whose fragment is missing', () => {
    const state = questionState(
      run({
        output: {
          answer: 'Odpowiedź.',
          grounded: true,
          citations: [
            { fragmentId: 9, reference: 'art. 1' },
            { fragmentId: 1, reference: 'art. 83 ust. 1' },
          ],
          fragments: [fragment(1)],
        },
      }),
      at(1000),
    );
    if (state.kind !== 'done') throw new Error('expected done');
    expect(state.sources.map((source) => source.number)).toEqual([1]);
  });

  it('keeps an answer that is not grounded', () => {
    const state = questionState(
      run({ output: { answer: 'Nie wiem.', grounded: false, citations: [], fragments: [] } }),
      at(1000),
    );
    expect(state).toEqual({
      kind: 'done',
      answer: 'Nie wiem.',
      grounded: false,
      sources: [],
      decided: null,
    });
  });

  it('takes the latest decision of the answer fragment, edited counts as accepted', () => {
    const decision = (fragmentPath: string, kind: string, decidedAt: string) => ({
      fragment: fragmentPath,
      decision: kind,
      finalText: null,
      contentDeletedAt: null,
      decidedBy: 'user',
      decidedAt,
    });
    const decided = (decisions: unknown[]) => {
      const state = questionState(run({ decisions }), at(1000));
      return state.kind === 'done' ? state.decided : 'not done';
    };
    expect(decided([])).toBeNull();
    expect(
      decided([
        decision('answer', 'accepted', '2026-11-22T10:01:00.000Z'),
        decision('answer', 'rejected', '2026-11-22T10:02:00.000Z'),
      ]),
    ).toBe('rejected');
    expect(
      decided([
        decision('answer', 'rejected', '2026-11-22T10:01:00.000Z'),
        decision('answer', 'edited', '2026-11-22T10:02:00.000Z'),
      ]),
    ).toBe('accepted');
    expect(decided([decision('other', 'rejected', '2026-11-22T10:01:00.000Z')])).toBeNull();
  });
});

describe('questionFromParams', () => {
  it('gives none for an empty or non-uuid id without calling get', async () => {
    const get = vi.fn();
    expect(await questionFromParams({ pytanie: '', tresc: 'x' }, get, at(0))).toEqual({
      kind: 'none',
    });
    expect(await questionFromParams({ pytanie: 'nie-uuid', tresc: 'x' }, get, at(0))).toEqual({
      kind: 'none',
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('gives missing when get rejects or the run is another kind', async () => {
    const rejecting = vi.fn().mockRejectedValue(new Error('not_found'));
    expect(await questionFromParams({ pytanie: RUN_ID, tresc: 'x' }, rejecting, at(0))).toEqual({
      kind: 'missing',
    });
    const other = vi.fn().mockResolvedValue({ ...run(), kind: 'hr_signals' });
    expect(await questionFromParams({ pytanie: RUN_ID, tresc: 'x' }, other, at(0))).toEqual({
      kind: 'missing',
    });
  });

  it('gives found with the question cut to 500 characters', async () => {
    const get = vi.fn().mockResolvedValue(run());
    const result = await questionFromParams(
      { pytanie: RUN_ID, tresc: 'a'.repeat(QUESTION_MAX + 20) },
      get,
      at(1000),
    );
    expect(get).toHaveBeenCalledWith(RUN_ID);
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.runId).toBe(RUN_ID);
    expect(result.question).toHaveLength(QUESTION_MAX);
    expect(result.state.kind).toBe('done');
    expect(result.evaluationId).toBeNull();
  });
});

describe('questionHref', () => {
  it('encodes Polish letters and adds the error flag', () => {
    expect(questionHref(RUN_ID, 'Ile dni na sprzeciw?')).toBe(
      `/pomoc?pytanie=${RUN_ID}&tresc=Ile%20dni%20na%20sprzeciw%3F#odpowiedz`,
    );
    expect(questionHref(RUN_ID, 'zażółć')).toContain(`tresc=${encodeURIComponent('zażółć')}`);
    expect(questionHref(RUN_ID, 'x', { blad: '1' })).toBe(
      `/pomoc?pytanie=${RUN_ID}&tresc=x&blad=1#odpowiedz`,
    );
  });

  it('keeps the evaluation the question is about', () => {
    expect(questionHref(RUN_ID, 'x', { ocena: EVALUATION_ID, blad: '1' })).toBe(
      `/pomoc?pytanie=${RUN_ID}&tresc=x&ocena=${EVALUATION_ID}&blad=1#odpowiedz`,
    );
    expect(questionHref(RUN_ID, 'x', { ocena: null })).toBe(
      `/pomoc?pytanie=${RUN_ID}&tresc=x#odpowiedz`,
    );
  });
});

describe('evaluationIdOf', () => {
  it('accepts a uuid and nothing else', () => {
    expect(evaluationIdOf(EVALUATION_ID)).toBe(EVALUATION_ID);
    expect(evaluationIdOf('nie-uuid')).toBeNull();
    expect(evaluationIdOf('')).toBeNull();
    expect(evaluationIdOf(null)).toBeNull();
    expect(evaluationIdOf(undefined)).toBeNull();
  });
});

describe('questionSchema', () => {
  const message = (question: string) => {
    const result = questionSchema.safeParse({ question });
    return result.success ? null : result.error.issues[0]?.message;
  };

  it('rejects a short question', () => {
    expect(message('krótko')).toBe('Wpisz pytanie, co najmniej 10 znaków.');
    expect(message('   ')).toBe('Wpisz pytanie, co najmniej 10 znaków.');
  });

  it('rejects a question over 500 characters', () => {
    expect(message('a'.repeat(501))).toBe('Pytanie może mieć najwyżej 500 znaków.');
    expect(message('a'.repeat(500))).toBeNull();
  });

  it('trims', () => {
    expect(questionSchema.parse({ question: '  Ile dni na sprzeciw?  ' })).toEqual({
      question: 'Ile dni na sprzeciw?',
    });
  });
});

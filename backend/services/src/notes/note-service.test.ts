/* eslint-disable @typescript-eslint/unbound-method -- the vi.fn mocks are asserted through the repository object */
import {
  type AiRun,
  type Note,
  type NoteRepository,
  type NoteVersion,
  RepositoryError,
} from '@sarmata/repositories';
import { type SensitiveDataWarning, calendarDate } from '@sarmata/domain';
import { ZodError } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../errors';
import { createNoteService } from './note-service';
import type { AiService } from '../ai/ai-service';

const EMPLOYEE = '11111111-1111-4111-8111-111111111111';

const stored: Note = {
  id: 'n1',
  officeId: 'o1',
  employeeId: EMPLOYEE,
  authorAccountId: 'a1',
  kind: 'observation',
  occurredOn: calendarDate('2026-03-01'),
  criterionId: null,
  sign: 'plus',
  communicated: false,
  body: 'Terminowo oddała raport.',
  version: 1,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

function fakeRepository(overrides: Partial<NoteRepository> = {}): NoteRepository {
  return {
    create: vi.fn(() => Promise.resolve(stored)),
    update: vi.fn(() => Promise.resolve(stored)),
    get: vi.fn(() => Promise.resolve(stored)),
    listForEmployee: vi.fn(() => Promise.resolve([stored])),
    listMine: vi.fn(() => Promise.resolve([stored])),
    versions: vi.fn(() => Promise.resolve([] as NoteVersion[])),
    ...overrides,
  };
}

type FakeAi = Pick<AiService, 'start' | 'get'>;

function fakeAi(overrides: Partial<FakeAi> = {}): FakeAi {
  return {
    start: vi.fn(() => Promise.reject(new Error('ai.start not expected'))),
    get: vi.fn(() => Promise.reject(new Error('ai.get not expected'))),
    ...overrides,
  };
}

type SensitiveRun = Extract<AiRun, { kind: 'sensitive_data' }>;

function sensitiveRun(overrides: Partial<SensitiveRun> = {}): AiRun {
  return {
    id: 'r1',
    officeId: 'o1',
    kind: 'sensitive_data',
    status: 'queued',
    requestedBy: 'a1',
    employeeId: EMPLOYEE,
    evaluationId: null,
    inputRefs: { noteIds: [], droppedNoteIds: [] },
    promptVersion: null,
    failure: null,
    requestedAt: '2026-03-01T10:00:00Z',
    startedAt: null,
    finishedAt: null,
    contentDeletedAt: null,
    decisions: [],
    partialText: null,
    outputTokens: null,
    progressUpdatedAt: null,
    output: null,
    partialOutput: null,
    ...overrides,
  };
}

const warning: SensitiveDataWarning = { category: 'health', fragment: 'choroba' };

const aiDisabled = () => new ServiceError('ai_disabled', 'AI is switched off');

const input = {
  employeeId: EMPLOYEE,
  kind: 'observation' as const,
  occurredOn: '2026-03-01',
  sign: 'minus' as const,
  body: 'Był na zwolnieniu lekarskim',
};

async function failureOf(promise: Promise<unknown>): Promise<ServiceError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ServiceError)) throw new Error('Expected a ServiceError');
  return error;
}

describe('note service', () => {
  it('create with health keyword fails sensitive_data', async () => {
    const repository = fakeRepository();
    const error = await failureOf(
      createNoteService({ notes: repository, ai: fakeAi() }).create(input),
    );
    expect(error.code).toBe('sensitive_data');
    expect(error.details).toMatchObject([{ category: 'health' }]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create with accepted warnings saves', async () => {
    const repository = fakeRepository();
    await createNoteService({ notes: repository, ai: fakeAi() }).create(input, {
      acceptWarnings: true,
    });
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('create saves a clean note with a trimmed body', async () => {
    const repository = fakeRepository();
    await createNoteService({ notes: repository, ai: fakeAi() }).create({
      ...input,
      body: '  Terminowy raport  ',
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Terminowy raport' }),
    );
  });

  it('update without body skips the guard', async () => {
    const repository = fakeRepository();
    await createNoteService({ notes: repository, ai: fakeAi() }).update('n1', {
      communicated: true,
    });
    expect(repository.update).toHaveBeenCalledWith('n1', { communicated: true });
  });

  it('update with a sensitive body fails sensitive_data', async () => {
    const repository = fakeRepository();
    const error = await failureOf(
      createNoteService({ notes: repository, ai: fakeAi() }).update('n1', {
        body: 'Choroba w rodzinie',
      }),
    );
    expect(error.code).toBe('sensitive_data');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('update rejected by access fails forbidden', async () => {
    const repository = fakeRepository({ update: vi.fn(() => Promise.resolve(null)) });
    const error = await failureOf(
      createNoteService({ notes: repository, ai: fakeAi() }).update('n1', { communicated: true }),
    );
    expect(error.code).toBe('forbidden');
  });

  it('create denied by RLS fails forbidden', async () => {
    const repository = fakeRepository({
      create: vi.fn(() =>
        Promise.reject(new RepositoryError('notes.create', { message: 'denied', code: '42501' })),
      ),
    });
    const error = await failureOf(
      createNoteService({ notes: repository, ai: fakeAi() }).create({
        ...input,
        body: 'Terminowy raport',
      }),
    );
    expect(error.code).toBe('forbidden');
  });

  it('empty patch returns the current note without an update', async () => {
    const repository = fakeRepository();
    const note = await createNoteService({ notes: repository, ai: fakeAi() }).update('n1', {});
    expect(note).toBe(stored);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('empty patch of an invisible note fails not_found', async () => {
    const repository = fakeRepository({ get: vi.fn(() => Promise.resolve(null)) });
    const error = await failureOf(
      createNoteService({ notes: repository, ai: fakeAi() }).update('n1', {}),
    );
    expect(error.code).toBe('not_found');
  });

  it('history of invisible note fails not_found', async () => {
    const error = await failureOf(
      createNoteService({ notes: fakeRepository(), ai: fakeAi() }).history('n1'),
    );
    expect(error.code).toBe('not_found');
  });
});

describe('note check', () => {
  const body = 'Był na zwolnieniu lekarskim';

  it('check returns keyword warnings and a pending run', async () => {
    const ai = fakeAi({ start: vi.fn(() => Promise.resolve(sensitiveRun())) });
    const result = await createNoteService({ notes: fakeRepository(), ai }).check({
      employeeId: EMPLOYEE,
      body,
    });
    expect(result.keywordWarnings).toMatchObject([{ category: 'health' }]);
    expect(result.ai).toEqual({ status: 'pending', runId: 'r1' });
    expect(ai.start).toHaveBeenCalledWith({
      kind: 'sensitive_data',
      employeeId: EMPLOYEE,
      text: body,
    });
  });

  it('check with AI switched off returns disabled', async () => {
    const ai = fakeAi({ start: vi.fn(() => Promise.reject(aiDisabled())) });
    const result = await createNoteService({ notes: fakeRepository(), ai }).check({
      employeeId: EMPLOYEE,
      body,
    });
    expect(result.ai).toEqual({ status: 'disabled' });
    expect(result.keywordWarnings).toMatchObject([{ category: 'health' }]);
  });

  it('check rethrows other AI errors', async () => {
    const ai = fakeAi({
      start: vi.fn(() => Promise.reject(new ServiceError('forbidden', 'No'))),
    });
    const error = await failureOf(
      createNoteService({ notes: fakeRepository(), ai }).check({ employeeId: EMPLOYEE, body }),
    );
    expect(error.code).toBe('forbidden');
  });

  it('check rejects an empty body', async () => {
    const ai = fakeAi();
    await expect(
      createNoteService({ notes: fakeRepository(), ai }).check({
        employeeId: EMPLOYEE,
        body: '  ',
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(ai.start).not.toHaveBeenCalled();
  });

  function serviceWith(run: AiRun, now?: () => Date) {
    const ai = fakeAi({ get: vi.fn(() => Promise.resolve(run)) });
    return createNoteService({ notes: fakeRepository(), ai, ...(now ? { now } : {}) });
  }

  it('check result maps a done run', async () => {
    const run = sensitiveRun({ status: 'done', output: { warnings: [warning], rewrite: 'X' } });
    expect(await serviceWith(run).checkResult('r1')).toEqual({
      status: 'done',
      runId: 'r1',
      warnings: [warning],
      rewrite: 'X',
    });
  });

  it('check result maps a failed run to unavailable', async () => {
    const run = sensitiveRun({ status: 'failed', failure: { reason: 'x', message: null } });
    expect(await serviceWith(run).checkResult('r1')).toEqual({
      status: 'unavailable',
      runId: 'r1',
    });
  });

  it('check result maps a run failed as disabled to disabled', async () => {
    const run = sensitiveRun({ status: 'failed', failure: { reason: 'disabled', message: null } });
    expect(await serviceWith(run).checkResult('r1')).toEqual({ status: 'disabled' });
  });

  it.each(['queued', 'running'] as const)('check result times out a %s run', async (status) => {
    const run = sensitiveRun({ status });
    const late = serviceWith(run, () => new Date('2026-03-01T10:00:46Z'));
    expect(await late.checkResult('r1')).toEqual({ status: 'unavailable', runId: 'r1' });
    const boundary = serviceWith(run, () => new Date('2026-03-01T10:00:45Z'));
    expect(await boundary.checkResult('r1')).toEqual({ status: 'pending', runId: 'r1' });
    const early = serviceWith(run, () => new Date('2026-03-01T10:00:30Z'));
    expect(await early.checkResult('r1')).toEqual({ status: 'pending', runId: 'r1' });
  });

  it('check result rejects another kind', async () => {
    const run = { ...sensitiveRun(), kind: 'quality_check' } as unknown as AiRun;
    const error = await failureOf(serviceWith(run).checkResult('r1'));
    expect(error.code).toBe('not_found');
  });

  it('check result of a done run with deleted content is unavailable', async () => {
    const run = sensitiveRun({ status: 'done', output: null });
    expect(await serviceWith(run).checkResult('r1')).toEqual({
      status: 'unavailable',
      runId: 'r1',
    });
  });
});

describe('notes.listMine', () => {
  it("list mine returns the author's notes", async () => {
    const mine: Note[] = [stored, { ...stored, id: 'n2', occurredOn: calendarDate('2026-02-01') }];
    const repository = fakeRepository({ listMine: vi.fn(() => Promise.resolve(mine)) });
    const service = createNoteService({ notes: repository, ai: fakeAi() });
    expect(await service.listMine()).toEqual(mine);
    expect(repository.listMine).toHaveBeenCalledTimes(1);
  });
});

/* eslint-disable @typescript-eslint/unbound-method -- the vi.fn mocks are asserted through the repository object */
import { type Note, type NoteRepository, type NoteVersion } from '@sarmata/repositories';
import { calendarDate } from '@sarmata/domain';
import { describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../errors';
import { createNoteService } from './note-service';

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
    listForEmployee: vi.fn(() => Promise.resolve([stored])),
    versions: vi.fn(() => Promise.resolve([] as NoteVersion[])),
    ...overrides,
  };
}

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
    const error = await failureOf(createNoteService(repository).create(input));
    expect(error.code).toBe('sensitive_data');
    expect(error.details).toMatchObject([{ category: 'health' }]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create with accepted warnings saves', async () => {
    const repository = fakeRepository();
    await createNoteService(repository).create(input, { acceptWarnings: true });
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('create saves a clean note with a trimmed body', async () => {
    const repository = fakeRepository();
    await createNoteService(repository).create({ ...input, body: '  Terminowy raport  ' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Terminowy raport' }),
    );
  });

  it('update without body skips the guard', async () => {
    const repository = fakeRepository();
    await createNoteService(repository).update('n1', { communicated: true });
    expect(repository.update).toHaveBeenCalledWith('n1', { communicated: true });
  });

  it('update with a sensitive body fails sensitive_data', async () => {
    const repository = fakeRepository();
    const error = await failureOf(
      createNoteService(repository).update('n1', { body: 'Choroba w rodzinie' }),
    );
    expect(error.code).toBe('sensitive_data');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('update rejected by access fails forbidden', async () => {
    const repository = fakeRepository({ update: vi.fn(() => Promise.resolve(null)) });
    const error = await failureOf(
      createNoteService(repository).update('n1', { communicated: true }),
    );
    expect(error.code).toBe('forbidden');
  });

  it('history of invisible note fails not_found', async () => {
    const error = await failureOf(createNoteService(fakeRepository()).history('n1'));
    expect(error.code).toBe('not_found');
  });
});

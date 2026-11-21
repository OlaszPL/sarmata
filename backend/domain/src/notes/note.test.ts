import { describe, expect, it } from 'vitest';
import { newNoteSchema, notePatchSchema } from './note';

const valid = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  kind: 'observation',
  occurredOn: '2026-03-01',
  sign: 'plus',
  body: '  Jasno przekazała ustalenia.  ',
};

describe('newNoteSchema', () => {
  it('trims the body and defaults communicated to false', () => {
    const note = newNoteSchema.parse(valid);
    expect(note.body).toBe('Jasno przekazała ustalenia.');
    expect(note.communicated).toBe(false);
  });

  it('rejects empty body', () => {
    expect(newNoteSchema.safeParse({ ...valid, body: '   ' }).success).toBe(false);
  });

  it('rejects criterion id with spaces', () => {
    expect(newNoteSchema.safeParse({ ...valid, criterionId: 'bad id' }).success).toBe(false);
  });

  it('accepts a workload fact without a sign', () => {
    expect(newNoteSchema.safeParse({ ...valid, kind: 'workload_fact', sign: null }).success).toBe(
      true,
    );
  });
});

describe('notePatchSchema', () => {
  it('patch accepts single field', () => {
    expect(notePatchSchema.parse({ communicated: true })).toEqual({ communicated: true });
  });
});

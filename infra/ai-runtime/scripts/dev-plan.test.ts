import { describe, expect, it } from 'vitest';
import { parseOnly, planStart, type Endpoint } from './dev-plan.ts';

const none = new Set<Endpoint>();

describe('parseOnly', () => {
  it.each<[string[], Endpoint | null]>([
    [[], null],
    [['--only', 'text'], 'text'],
    [['--only=decision'], 'decision'],
  ])('reads %j', (argv, expected) => {
    expect(parseOnly(argv)).toBe(expected);
  });

  it('refuses other values', () => {
    expect(() => parseOnly(['--only', 'both'])).toThrow('--only takes text or decision');
  });
});

describe('planStart', () => {
  it('starts only the text model without Bielik-One', () => {
    expect(planStart(null, { installed: false, together: false }, none)).toEqual({
      start: ['text'],
      note: null,
    });
  });

  it('starts both where they fit together', () => {
    expect(planStart(null, { installed: true, together: true }, none).start).toEqual([
      'text',
      'decision',
    ]);
  });

  it('starts the text model alone on a 16 GB Mac and explains how to test Bielik-One', () => {
    const plan = planStart(null, { installed: true, together: false }, none);
    expect(plan.start).toEqual(['text']);
    expect(plan.note).toContain('pnpm ai:start --only decision');
  });

  it('refuses Bielik-One while the text model runs where they do not fit together', () => {
    expect(() =>
      planStart('decision', { installed: true, together: false }, new Set(['text'])),
    ).toThrow('pnpm ai:stop --only text');
  });

  it('refuses the text model while Bielik-One runs where they do not fit together', () => {
    expect(() =>
      planStart(null, { installed: true, together: false }, new Set(['decision'])),
    ).toThrow('pnpm ai:stop --only decision');
  });

  it('allows both at once where they fit together', () => {
    expect(
      planStart('decision', { installed: true, together: true }, new Set(['text'])).start,
    ).toEqual(['decision']);
  });

  it('asks to install Bielik-One first', () => {
    expect(() => planStart('decision', { installed: false, together: false }, none)).toThrow(
      'pnpm ai:setup --with-bielik-one',
    );
  });
});

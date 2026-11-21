import { ServiceError } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseForm, runService } from './form-action';

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const schema = z.object({
  place: z.string().trim().min(1, 'Wpisz miejscowość.'),
  heldOn: z.iso.date('Wpisz datę w formacie dd.mm.rrrr.'),
  criteria: z.array(z.string()).max(3, 'Wybierz najwyżej 3 kryteria.'),
});

describe('parseForm', () => {
  it('returns the parsed data', () => {
    const result = parseForm(
      schema,
      form({ place: ' Kropka ', heldOn: '2026-11-18', criteria: ['a', 'b'] }),
    );
    expect(result).toEqual({
      data: { place: 'Kropka', heldOn: '2026-11-18', criteria: ['a', 'b'] },
    });
  });

  it('keeps what was typed and gives one message per field', () => {
    const result = parseForm(
      schema,
      form({ place: '', heldOn: 'jutro', criteria: ['a', 'b', 'c', 'd'] }),
    );
    expect('state' in result).toBe(true);
    if (!('state' in result)) return;
    expect(result.state.values).toEqual({
      place: '',
      heldOn: 'jutro',
      criteria: ['a', 'b', 'c', 'd'],
    });
    expect(result.state.fieldErrors).toEqual({
      place: 'Wpisz miejscowość.',
      heldOn: 'Wpisz datę w formacie dd.mm.rrrr.',
      criteria: 'Wybierz najwyżej 3 kryteria.',
    });
    expect(result.state.ok).toBeUndefined();
  });

  it('treats a missing single field as an empty string', () => {
    const result = parseForm(z.object({ place: z.string().min(1, 'Wpisz.') }), form({}));
    expect('state' in result && result.state.fieldErrors.place).toBe('Wpisz.');
  });
});

describe('runService', () => {
  it('passes the value through', async () => {
    await expect(runService(() => Promise.resolve(42))).resolves.toEqual({ ok: true, value: 42 });
  });

  it('turns gate issues into field errors and a form error', async () => {
    const result = await runService(
      () =>
        Promise.reject(
          new ServiceError('approval_blocked', 'blocked', [
            { code: 'development_conclusions_missing' },
            { code: 'rating_missing', criterionId: 'reliability' },
          ]),
        ),
      { developmentConclusions: 'conclusions' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.state.formError).toMatch(/zatwierdzić/);
    expect(Object.keys(result.state.fieldErrors)).toEqual(['conclusions', 'rating-reliability']);
    expect(result.state.fieldErrors.conclusions).toBe(
      'Wpisz wnioski do indywidualnego programu rozwoju zawodowego (IPRZ).',
    );
    expect(result.state.fieldErrors['rating-reliability']).toContain('reliability');
  });

  it('maps a role error to a form error only', async () => {
    const result = await runService(() => Promise.reject(new ServiceError('forbidden', 'no')));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.state.values).toEqual({});
    expect(result.state.fieldErrors).toEqual({});
    expect(result.state.formError).toMatch(/rola/);
  });

  it('keeps the typed values when given', async () => {
    const result = await runService(
      () => Promise.reject(new ServiceError('stale_status', 'stale')),
      undefined,
      { place: 'Kropka' },
    );
    expect(!result.ok && result.state.values).toEqual({ place: 'Kropka' });
  });

  it('maps validation errors of a service to fields', async () => {
    const result = await runService(() => {
      z.object({ firstName: z.string().min(1, 'Wpisz imię.') }).parse({ firstName: '' });
      return Promise.resolve(null);
    });
    expect(!result.ok && result.state.fieldErrors).toEqual({ firstName: 'Wpisz imię.' });
  });

  it('rethrows anything else, e.g. the redirect of Next.js', async () => {
    const boom = new Error('NEXT_REDIRECT');
    await expect(runService(() => Promise.reject(boom))).rejects.toBe(boom);
  });
});

import { describe, expect, it } from 'vitest';
import { ServiceError } from '@sarmata/services';
import { z } from 'zod';
import { serviceErrorMessage } from '@/lib/service-errors';
import { registerErrorMessage, runRegisterService } from './register-errors';

const rules: Record<string, string> = {
  no_rejected_objection: 'Odwołanie można zapisać tylko po nieuwzględnionym sprzeciwie.',
  already_recorded: 'Ten wpis jest już zapisany w rejestrze.',
  date_before_outcome:
    'Data wniesienia odwołania nie może być wcześniejsza niż rozstrzygnięcie sprzeciwu.',
  not_civil_servant: 'Stopień służbowy można przyznać tylko urzędnikowi służby cywilnej.',
  grade_not_higher: 'Nowy stopień musi być wyższy niż obecny stopień pracownika.',
  date_before_previous_grant:
    'Data przyznania nie może być wcześniejsza niż data poprzedniego stopnia.',
  evaluation_required: 'Wybierz ocenę tego pracownika, na której opiera się przyznanie stopnia.',
};

describe('registerErrorMessage', () => {
  for (const [rule, text] of Object.entries(rules)) {
    it(`maps ${rule}`, () => {
      expect(registerErrorMessage('hr_entry_rejected', { rule })).toBe(text);
    });
  }

  it('falls back for an unknown rule or missing details', () => {
    const generic = serviceErrorMessage('hr_entry_rejected');
    expect(registerErrorMessage('hr_entry_rejected', { rule: 'other' })).toBe(generic);
    expect(registerErrorMessage('hr_entry_rejected')).toBe(generic);
    expect(registerErrorMessage('hr_entry_rejected', { rule: 'toString' })).toBe(generic);
  });

  it('passes other codes to serviceErrorMessage', () => {
    expect(registerErrorMessage('forbidden')).toBe(serviceErrorMessage('forbidden'));
  });
});

describe('runRegisterService', () => {
  const values = { a: 'b' };

  it('returns the value', async () => {
    expect(await runRegisterService(() => Promise.resolve(3), values)).toEqual({
      ok: true,
      value: 3,
    });
  });

  it('maps hr_entry_rejected to the rule message and keeps values', async () => {
    const result = await runRegisterService(
      () =>
        Promise.reject(new ServiceError('hr_entry_rejected', 'x', { rule: 'already_recorded' })),
      values,
    );
    expect(result).toEqual({
      ok: false,
      state: { values, fieldErrors: {}, formError: rules.already_recorded },
    });
  });

  it('gives another code the shared message', async () => {
    const result = await runRegisterService(
      () => Promise.reject(new ServiceError('forbidden', 'x')),
      values,
    );
    expect(result).toMatchObject({
      ok: false,
      state: { values, formError: serviceErrorMessage('forbidden') },
    });
  });

  it('turns a ZodError into field errors', async () => {
    const parsed = z.object({ date: z.string().min(1, 'Wpisz datę.') }).safeParse({ date: '' });
    const result = await runRegisterService(() => {
      throw parsed.error ?? new Error('schema should fail');
    }, values);
    expect(result).toMatchObject({ ok: false, state: { fieldErrors: { date: 'Wpisz datę.' } } });
  });
});

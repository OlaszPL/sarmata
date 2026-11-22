'use client';

import { useActionState } from 'react';
import { type FormState } from '@/lib/form-action';

export type RoundState = FormState & { round: number };

/**
 * `useActionState` that numbers every result. React resets a form after its action, and a `<select>`
 * ignores a new `defaultValue` after mount, so the form takes `key={state.round}` and remounts with the
 * values the action sent back.
 */
export function useFormRound(
  action: (previous: FormState, formData: FormData) => Promise<FormState>,
): [RoundState, (formData: FormData) => void, boolean] {
  return useActionState<RoundState, FormData>(
    async (previous, formData) => ({
      ...(await action(previous, formData)),
      round: previous.round + 1,
    }),
    { values: {}, fieldErrors: {}, round: 0 },
  );
}

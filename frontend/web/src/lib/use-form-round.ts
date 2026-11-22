'use client';

import { useActionState } from 'react';
import { type FormState } from '@/lib/form-action';

export type RoundState<S = FormState> = S & { round: number };

const EMPTY_FORM: FormState = { values: {}, fieldErrors: {} };

/**
 * `useActionState` that numbers every result. React resets a form after its action, and a `<select>`
 * (or a radio group) ignores a new `defaultValue` after mount, so the form takes `key={state.round}`
 * and remounts with the values the action sent back. `initial` is needed only for a state that is not
 * a plain `FormState`.
 */
export function useFormRound<S extends object = FormState>(
  action: (previous: S, formData: FormData) => Promise<S>,
  initial?: S,
): [RoundState<S>, (formData: FormData) => void, boolean] {
  // `Awaited` of a generic state does not resolve, the casts only restate that the state is plain.
  return useActionState<RoundState<S>, FormData>(
    async (previous, formData) => ({
      ...(await action(previous, formData)),
      round: (previous as RoundState<S>).round + 1,
    }),
    { ...((initial ?? EMPTY_FORM) as S), round: 0 } as Awaited<RoundState<S>>,
  );
}

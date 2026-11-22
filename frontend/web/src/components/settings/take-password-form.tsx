'use client';

import { useActionState } from 'react';
import { Notice, SubmitButton } from '@sarmata/ui';
import { type TakePasswordState, takePassword } from '@/app/(app)/ustawienia/konta/actions';

const initialState: TakePasswordState = {};

/**
 * Takes the temporary password of an invitation. The password lives in this client state only:
 * it is never put in the URL or logged, and the service removes it on the first read.
 */
export function TakePasswordForm({ invitationId }: { invitationId: string }) {
  const [state, formAction] = useActionState(takePassword, initialState);

  if (state.password) {
    return (
      <div className="grid max-w-[40rem] gap-4">
        <p
          data-testid="temporary-password"
          className="font-heading text-ink border-rule border bg-white px-5 py-4 text-[2rem] leading-[normal] font-semibold break-all select-all"
        >
          {state.password}
        </p>
        <Notice tone="warning" role="status">
          Zapisz albo przekaż to hasło teraz. Po opuszczeniu strony nie zobaczysz go ponownie.
        </Notice>
      </div>
    );
  }
  if (state.password === null) {
    return (
      <Notice tone="info" role="status" className="max-w-[40rem]">
        Hasło już odebrano.
      </Notice>
    );
  }

  return (
    <form action={formAction} className="grid max-w-[40rem] gap-4">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.formError ? (
        <Notice tone="error" role="alert">
          {state.formError}
        </Notice>
      ) : null}
      <div>
        <SubmitButton variant="secondary" pendingLabel="Odbieranie hasła">
          Pokaż hasło jednorazowe
        </SubmitButton>
      </div>
    </form>
  );
}

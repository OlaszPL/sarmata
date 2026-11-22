'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Checkbox, ErrorSummary, RadioGroup, SubmitButton } from '@sarmata/ui';
import { changeRole, endMembership } from '@/app/(app)/ustawienia/konta/actions';
import { roleOptions } from '@/components/settings/invite-form';
import { useErrorTitle } from '@/components/use-error-title';
import type { FormState } from '@/lib/form-action';
import { routes } from '@/lib/routes';

const initialState: FormState = { values: {}, fieldErrors: {} };

/** Remounts the form on each answer of its action, so the default values show what was sent. */
function useRemountKey(state: FormState): number {
  const [shownState, setShownState] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shownState) {
    setShownState(state);
    setVersion((current) => current + 1);
  }
  return version;
}

function RoleForm({ accountId, currentRole }: { accountId: string; currentRole: string }) {
  const [state, formAction] = useActionState(changeRole, initialState);
  const version = useRemountKey(state);
  const message = state.fieldErrors.role;
  const hasErrors = Boolean(message) || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const chosen = state.values.role;

  return (
    <div className="grid grid-cols-1 gap-6">
      {hasErrors ? (
        <ErrorSummary
          title="Nie udało się zmienić roli"
          errors={message ? [{ fieldId: 'role', message }] : []}
        >
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form
        key={version}
        action={formAction}
        noValidate
        className="grid grid-cols-1 max-w-[40rem] gap-6"
      >
        <input type="hidden" name="accountId" value={accountId} />
        <RadioGroup
          name="role"
          legend="Rola w urzędzie"
          hint="Zmiana działa od następnego odświeżenia sesji tej osoby."
          options={roleOptions}
          defaultValue={typeof chosen === 'string' ? chosen : currentRole}
          error={message}
        />
        <div>
          <SubmitButton pendingLabel="Zapisywanie roli">Zapisz rolę</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function EndForm({ accountId }: { accountId: string }) {
  const [state, formAction] = useActionState(endMembership, initialState);
  const version = useRemountKey(state);
  const message = state.fieldErrors.confirmEnd;
  const hasErrors = Boolean(message) || Boolean(state.formError);
  useErrorTitle(hasErrors);

  return (
    <div className="grid grid-cols-1 gap-6">
      {hasErrors ? (
        <ErrorSummary
          title="Nie udało się zakończyć dostępu"
          errors={message ? [{ fieldId: 'confirmEnd', message }] : []}
        >
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form
        key={version}
        action={formAction}
        noValidate
        className="grid grid-cols-1 max-w-[40rem] gap-6"
      >
        <input type="hidden" name="accountId" value={accountId} />
        <Checkbox
          id="confirmEnd"
          name="confirmEnd"
          value="1"
          label="Rozumiem, że ta osoba straci dostęp od dziś"
          defaultChecked={state.values.confirmEnd === '1'}
          error={message}
        />
        <div>
          <SubmitButton variant="danger" pendingLabel="Kończenie dostępu">
            Zakończ dostęp
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

/** Edit panel of one account: change the role, or end the access. */
export function MemberEdit({
  accountId,
  name,
  currentRole,
  isMe,
}: {
  accountId: string;
  name: string;
  currentRole: string;
  isMe: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-10">
      <div className="grid grid-cols-1 gap-2">
        <p className="font-heading text-ink text-xl font-semibold">{name}</p>
        {isMe ? <p>To twoje konto.</p> : null}
      </div>
      <RoleForm accountId={accountId} currentRole={currentRole} />
      <EndForm accountId={accountId} />
      <p>
        <Link
          href={routes.settingsAccounts}
          className="font-heading text-link font-medium underline"
        >
          Anuluj
        </Link>
      </p>
    </div>
  );
}

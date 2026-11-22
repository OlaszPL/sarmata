import { Notice } from '@sarmata/ui';
import { PollingRefresh } from '@/components/polling-refresh';
import { TakePasswordForm } from '@/components/settings/take-password-form';
import type { InvitationView } from '@/lib/accounts/accounts-view';

/** Status panel of an invitation: the result, polling while the worker has not answered, the password form. */
export function InvitationStatus({ id, view }: { id: string; view: InvitationView }) {
  return (
    <div className="grid grid-cols-1 max-w-[40rem] gap-4">
      <Notice tone={view.tone} title={view.title} role="status">
        <p className="max-w-[70ch]">{view.body}</p>
      </Notice>
      <PollingRefresh
        active={view.pending}
        intervalMs={2000}
        maxMs={120000}
        timeoutMessage="Zaproszenie nadal czeka. Sprawdź, czy działa usługa w tle, i odśwież stronę później."
      />
      {view.canTakePassword ? <TakePasswordForm invitationId={id} /> : null}
    </div>
  );
}

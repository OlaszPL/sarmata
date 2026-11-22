import type { Metadata } from 'next';
import { type InboxItem, servicesFor } from '@sarmata/services';
import { Button, EmptyState, Notice, PageHero, Section } from '@sarmata/ui';
import { InboxTable } from '@/components/notifications/inbox-table';
import { requireMember } from '@/lib/account';
import { todayInWarsaw } from '@/lib/format';
import { inboxView } from '@/lib/notifications/inbox';
import { type SearchParams, single } from '@/lib/search-params';
import { createSupabase } from '@/lib/supabase';
import { markAllNotificationsRead } from './actions';

export const metadata: Metadata = { title: 'Powiadomienia' };

const LIMIT = 200;
const META = 'Przypomnienia o terminach ocen i zadania po terminie.';

/** Inbox of an evaluator or hr (`/powiadomienia`): unread, read and resolved entries. */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const account = await requireMember();
  const params = await searchParams;

  if (account.role === 'admin') {
    return (
      <div className="flex flex-1 flex-col">
        <PageHero title="Powiadomienia" meta={META} />
        <div className="px-6 py-8 sm:px-10">
          <Notice tone="info">
            <p>Powiadomienia dostają oceniający i kadry. Administrator ich nie dostaje.</p>
          </Notice>
        </div>
      </div>
    );
  }

  let items: InboxItem[] | null = null;
  try {
    items = await servicesFor(await createSupabase()).notifications.inbox({ limit: LIMIT });
  } catch (error) {
    console.error('notifications: inbox failed', error);
  }

  if (items === null) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHero title="Powiadomienia" meta={META} />
        <div className="px-6 py-8 sm:px-10">
          <Notice tone="error">
            <p>Nie udało się wczytać powiadomień. Odśwież stronę.</p>
          </Notice>
        </div>
      </div>
    );
  }

  const view = inboxView(items, todayInWarsaw());
  const { unread, read, resolved } = view.groups;
  const marked = single(params.oznaczono);
  const failed = single(params.blad) === '1';

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Powiadomienia"
        meta={META}
        stats={[
          { label: 'Nieprzeczytane', value: String(view.unread) },
          { label: 'Otwarte zadania', value: String(view.openTasks) },
          { label: 'Załatwione', value: String(view.resolved) },
        ]}
      />
      {marked === 'jedno' || marked === 'wszystkie' || failed ? (
        <div className="px-6 pt-8 sm:px-10">
          {failed ? (
            <Notice tone="error" role="alert">
              <p>Nie udało się oznaczyć powiadomienia. Spróbuj ponownie.</p>
            </Notice>
          ) : (
            <Notice tone="success" role="status">
              <p>
                {marked === 'jedno'
                  ? 'Oznaczono jako przeczytane.'
                  : 'Oznaczono wszystkie jako przeczytane.'}
              </p>
            </Notice>
          )}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="Nie masz powiadomień">
          <p className="max-w-[70ch]">
            Tu pojawią się przypomnienia o zbliżających się terminach ocen i zadania po terminie.
            Sarmata dodaje je raz dziennie.
          </p>
        </EmptyState>
      ) : (
        <>
          <Section
            title="Nieprzeczytane"
            actions={
              unread.length > 0 ? (
                <form action={markAllNotificationsRead}>
                  <Button type="submit" variant="secondary">
                    Oznacz wszystkie jako przeczytane
                  </Button>
                </form>
              ) : undefined
            }
          >
            {unread.length > 0 ? (
              <InboxTable caption="Nieprzeczytane powiadomienia" entries={unread} markable />
            ) : (
              <p className="max-w-[70ch]">Wszystko przeczytane.</p>
            )}
          </Section>
          {read.length > 0 ? (
            <Section title="Przeczytane">
              <InboxTable caption="Przeczytane powiadomienia" entries={read} markable={false} />
            </Section>
          ) : null}
          {resolved.length > 0 ? (
            <Section title="Załatwione">
              <InboxTable caption="Załatwione zadania" entries={resolved} markable={false} />
            </Section>
          ) : null}
          {items.length >= LIMIT ? (
            <p className="max-w-[70ch] px-6 py-8 sm:px-10">
              Pokazano {LIMIT} pierwszych powiadomień.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

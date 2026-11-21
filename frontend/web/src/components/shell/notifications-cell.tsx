import Link from 'next/link';
import { Bell } from 'lucide-react';
import { servicesFor } from '@sarmata/services';
import { createSupabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';

async function loadUnread(): Promise<number | null> {
  try {
    return await servicesFor(await createSupabase()).notifications.unreadCount();
  } catch {
    return null;
  }
}

/** Bell with the number of unread notifications. Shows only the bell when the count fails. */
export async function NotificationsCell() {
  const unread = await loadUnread();
  const label = unread === null ? 'Powiadomienia' : `Powiadomienia, nieprzeczytane: ${unread}`;

  return (
    <div className="border-rule flex border-l">
      <Link
        href={routes.notifications}
        aria-label={label}
        className="flex min-h-16 items-center gap-2 px-5"
      >
        <Bell className="size-5" aria-hidden />
        {unread ? (
          <span
            className="bg-brand-red font-heading inline-flex min-w-6 items-center justify-center px-1 py-0.5 text-sm font-bold text-white"
            aria-hidden
          >
            {unread}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

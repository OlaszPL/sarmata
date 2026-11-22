'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ServiceError, servicesFor } from '@sarmata/services';
import { requireMember } from '@/lib/account';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

const uuid = z.uuid();

/** Marks the targets as read and comes back to the inbox with a status in the query. */
async function markAndReturn(target: readonly string[] | 'all', done: string): Promise<never> {
  const account = await requireMember();
  if (account.role === 'admin') redirect(routes.notifications);
  try {
    await servicesFor(await createSupabase()).notifications.markRead(target);
  } catch (error) {
    // Only the redirect below leaves this function, so it stays outside the try block.
    if (!(error instanceof ServiceError)) console.error('notifications: mark read failed', error);
    redirect(`${routes.notifications}?blad=1`);
  }
  revalidatePath('/', 'layout');
  redirect(`${routes.notifications}?oznaczono=${done}`);
}

/** Marks one notification as read (`id` field). An invalid id changes nothing. */
export async function markNotificationRead(formData: FormData): Promise<never> {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) redirect(routes.notifications);
  return markAndReturn([id.data], 'jedno');
}

/** Marks the whole inbox as read. */
export async function markAllNotificationsRead(): Promise<never> {
  return markAndReturn('all', 'wszystkie');
}

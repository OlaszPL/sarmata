import { type InboxItem, type NotificationRepository } from '@sarmata/repositories';
import { z } from 'zod';

const idsSchema = z.array(z.uuid()).min(1).max(100);
const limitSchema = z.number().int().min(1).max(200);

/** The inbox of the signed-in account. */
export interface NotificationService {
  /** Open unread first, then by deadline, resolved tasks last. `limit` caps the list (1 to 200). */
  inbox(options?: { readonly unreadOnly?: boolean; readonly limit?: number }): Promise<InboxItem[]>;
  /** Open and unread only. */
  unreadCount(): Promise<number>;
  /** Throws `ZodError` for ids that are not UUIDs. `'all'` marks the whole inbox. */
  markRead(target: readonly string[] | 'all'): Promise<void>;
}

/**
 * Deliberately thin (no test breaks if it is removed): it exists because the frontend only knows
 * `servicesFor`, and it checks the ids before they reach the database.
 */
export function createNotificationService(
  notifications: NotificationRepository,
): NotificationService {
  return {
    async inbox(options = {}) {
      const items = await notifications.list({
        ...(options.unreadOnly === undefined ? {} : { unreadOnly: options.unreadOnly }),
        ...(options.limit === undefined ? {} : { limit: limitSchema.parse(options.limit) }),
      });
      return items;
    },
    unreadCount: () => notifications.unreadCount(),
    async markRead(target) {
      await notifications.markRead(target === 'all' ? 'all' : idsSchema.parse(target));
    },
  };
}

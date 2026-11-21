import { z } from 'zod';

/** Same values as the `notification_kind` enum in the database. */
export const notificationKindSchema = z.enum([
  'deadline_reminder',
  'deadline_overdue',
  'objection_decision',
  'grade_by_law',
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

/** A reminder only informs, a task stays open until its deadline stops applying. */
export type NotificationCategory = 'reminder' | 'task';

export const notificationStatusSchema = z.enum(['open', 'resolved']);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export function notificationCategory(kind: NotificationKind): NotificationCategory {
  return kind === 'deadline_reminder' ? 'reminder' : 'task';
}

/**
 * Type of the queue message that sends the digest e-mail. The same literal is queued by
 * `public.collect_notifications` (migration 20261122160200_notifications.sql).
 */
export const DIGEST_JOB_TYPE = 'notifications.send_digest';

/** Route of the inbox in the app. The link in the digest e-mail points here. */
export const NOTIFICATIONS_PATH = '/powiadomienia';

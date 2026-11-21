import {
  type CalendarDate,
  type DeadlineSlot,
  type NotificationCategory,
  type NotificationKind,
  type NotificationStatus,
  calendarDate,
  notificationCategory,
} from '@sarmata/domain';
import { type Db } from './db';
import { RepositoryError } from './errors';

/**
 * One entry of the inbox of the signed-in account. The employee name is allowed here: the inbox is
 * inside the app, only the digest e-mail must stay free of personal data.
 */
export interface InboxItem {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly category: NotificationCategory;
  readonly evaluationId: string;
  readonly employeeName: string;
  readonly slot: DeadlineSlot;
  readonly dueOn: CalendarDate;
  readonly leadDays: number | null;
  readonly createdOn: CalendarDate;
  readonly status: NotificationStatus;
  readonly resolvedAt: string | null;
  readonly readAt: string | null;
}

export interface NotificationRepository {
  /** Open unread first, then by deadline, resolved tasks last. */
  list(options?: { readonly unreadOnly?: boolean; readonly limit?: number }): Promise<InboxItem[]>;
  /** Open and unread only: a resolved task is not counted. */
  unreadCount(): Promise<number>;
  /** Marks unread entries as read and returns how many changed. `'all'` marks the whole inbox. */
  markRead(target: readonly string[] | 'all'): Promise<number>;
}

const COLUMNS =
  'id, kind, evaluation_id, slot, due_on, lead_days, created_on, status, resolved_at, read_at, evaluations(employees(first_name, last_name))' as const;

interface InboxRow {
  id: string;
  kind: NotificationKind;
  evaluation_id: string;
  slot: string;
  due_on: string;
  lead_days: number | null;
  created_on: string;
  status: string;
  resolved_at: string | null;
  read_at: string | null;
  evaluations: { employees: { first_name: string; last_name: string } | null } | null;
}

const toItem = (row: InboxRow): InboxItem => {
  const employee = row.evaluations?.employees ?? null;
  return {
    id: row.id,
    kind: row.kind,
    category: notificationCategory(row.kind),
    evaluationId: row.evaluation_id,
    employeeName: employee === null ? '' : `${employee.first_name} ${employee.last_name}`,
    // The database stores the slot as text, the evaluation service writes only known slot names.
    slot: row.slot as DeadlineSlot,
    dueOn: calendarDate(row.due_on),
    leadDays: row.lead_days,
    createdOn: calendarDate(row.created_on),
    status: row.status === 'resolved' ? 'resolved' : 'open',
    resolvedAt: row.resolved_at,
    readAt: row.read_at,
  };
};

export function createNotificationRepository(db: Db): NotificationRepository {
  return {
    async list(options = {}) {
      let query = db
        .from('notifications')
        .select(COLUMNS)
        .order('status', { ascending: true })
        .order('read_at', { ascending: true, nullsFirst: true })
        .order('due_on', { ascending: true });
      if (options.unreadOnly === true) query = query.eq('status', 'open').is('read_at', null);
      if (options.limit !== undefined) query = query.limit(options.limit);
      const { data, error } = await query;
      if (error) throw new RepositoryError('notifications.list', error);
      return data.map(toItem);
    },

    async unreadCount() {
      const { count, error } = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .is('read_at', null);
      if (error) throw new RepositoryError('notifications.unreadCount', error);
      return count ?? 0;
    },

    async markRead(target) {
      let query = db.from('notifications').update({ read_at: new Date().toISOString() });
      if (target !== 'all') query = query.in('id', [...target]);
      const { data, error } = await query.is('read_at', null).select('id');
      if (error) throw new RepositoryError('notifications.markRead', error);
      return data.length;
    },
  };
}

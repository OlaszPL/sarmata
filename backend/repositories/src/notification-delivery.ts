import { type CalendarDate, calendarDate } from '@sarmata/domain';
import type { Database } from '@sarmata/database';
import { type ServiceDb } from './db';
import { RepositoryError } from './errors';

/** SMTP account used to send a digest. The password comes from Vault, never from a client. */
export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string | null;
  readonly password: string | null;
  readonly from: string;
  readonly fromName: string;
}

/** What the digest e-mail of one account and day is built from. */
export interface DigestFacts {
  readonly officeId: string;
  readonly email: string | null;
  readonly status: 'queued' | 'sent' | 'failed' | 'skipped';
  readonly unreadCount: number;
  readonly nearestDueOn: CalendarDate | null;
}

export interface CollectReport {
  readonly created: number;
  readonly queued: number;
  readonly resolved: number;
}

/** System side of the notifications (worker, scripts): collection, digest facts, SMTP and the send log. */
export interface NotificationDeliveryStore {
  collect(day: CalendarDate): Promise<CollectReport>;
  /** `null` when there is no digest row for the account and day. */
  digestFacts(accountId: string, day: CalendarDate): Promise<DigestFacts | null>;
  /** `null` when the office has no complete SMTP settings. */
  officeSmtp(officeId: string): Promise<SmtpSettings | null>;
  recordResult(
    accountId: string,
    day: CalendarDate,
    result: { readonly status: 'sent' | 'failed' | 'skipped'; readonly error: string | null },
  ): Promise<void>;
}

type RecordDigestArgs = Database['public']['Functions']['record_digest_result']['Args'];

/** Generated RPC types mark nullable results and arguments non-null, SQL returns and accepts null for them. */
interface FactsRow {
  office_id: string;
  email: string | null;
  status: string;
  unread_count: number;
  nearest_due_on: string | null;
}
interface SmtpRow {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  sender: string;
  sender_name: string;
}

const asDigestStatus = (value: string): DigestFacts['status'] =>
  value === 'sent' || value === 'failed' || value === 'skipped' ? value : 'queued';

export function createNotificationDeliveryStore(db: ServiceDb): NotificationDeliveryStore {
  return {
    async collect(day) {
      const { data, error } = await db.rpc('collect_notifications', { p_today: day });
      if (error) throw new RepositoryError('notificationDelivery.collect', error);
      const row = data[0];
      if (row === undefined) {
        throw new RepositoryError('notificationDelivery.collect', { message: 'No report' });
      }
      return { created: row.created, queued: row.queued, resolved: row.resolved };
    },

    async digestFacts(accountId, day) {
      const { data, error } = await db.rpc('notification_digest_facts', {
        p_account_id: accountId,
        p_day: day,
      });
      if (error) throw new RepositoryError('notificationDelivery.digestFacts', error);
      const row = data[0] as FactsRow | undefined;
      if (row === undefined) return null;
      return {
        officeId: row.office_id,
        email: row.email,
        status: asDigestStatus(row.status),
        unreadCount: row.unread_count,
        nearestDueOn: row.nearest_due_on === null ? null : calendarDate(row.nearest_due_on),
      };
    },

    async officeSmtp(officeId) {
      const { data, error } = await db.rpc('office_smtp_settings', { p_office_id: officeId });
      if (error) throw new RepositoryError('notificationDelivery.officeSmtp', error);
      const row = data[0] as SmtpRow | undefined;
      if (row === undefined) return null;
      return {
        host: row.host,
        port: row.port,
        user: row.username,
        password: row.password,
        from: row.sender,
        fromName: row.sender_name,
      };
    },

    async recordResult(accountId, day, result) {
      const { error } = await db.rpc('record_digest_result', {
        p_account_id: accountId,
        p_day: day,
        p_status: result.status,
        p_error: result.error,
      } as unknown as RecordDigestArgs);
      if (error) throw new RepositoryError('notificationDelivery.recordResult', error);
    },
  };
}

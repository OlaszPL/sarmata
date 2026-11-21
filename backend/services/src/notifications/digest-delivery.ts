import {
  type CalendarDate,
  NOTIFICATIONS_PATH,
  digestMessage,
  errorMessage,
} from '@sarmata/domain';
import { type NotificationDeliveryStore, type SmtpSettings } from '@sarmata/repositories';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Port to the SMTP server. The nodemailer adapter lives in the worker, tests use a fake. */
export interface Mailer {
  send(message: MailMessage, smtp: SmtpSettings): Promise<void>;
}

export type DigestOutcome =
  | { readonly status: 'sent' }
  | {
      readonly status: 'skipped';
      readonly reason:
        'already_sent' | 'unknown_digest' | 'no_email' | 'nothing_unread' | 'no_smtp';
    };

export interface NotificationDelivery {
  /**
   * Sends the digest of one account and day. Skips what is already sent, has nothing to say or has no
   * SMTP. A mailer failure is logged as `failed` and rethrown, so the queue delivers the job again.
   */
  sendDigest(accountId: string, day: CalendarDate): Promise<DigestOutcome>;
}

export interface NotificationDeliveryDependencies {
  readonly store: NotificationDeliveryStore;
  readonly mailer: Mailer;
  /** Public address of the app, the link in the mail points to its inbox. */
  readonly siteUrl: string;
  /** SMTP of the installation, used when the office has none of its own. */
  readonly defaultSmtp: SmtpSettings | null;
}

export function createNotificationDelivery(
  deps: NotificationDeliveryDependencies,
): NotificationDelivery {
  const { store, mailer } = deps;
  const link = `${deps.siteUrl.replace(/\/+$/, '')}${NOTIFICATIONS_PATH}`;

  return {
    async sendDigest(accountId, day) {
      const facts = await store.digestFacts(accountId, day);
      if (facts === null) return { status: 'skipped', reason: 'unknown_digest' };
      if (facts.status === 'sent') return { status: 'skipped', reason: 'already_sent' };

      const skip = async (
        reason: 'no_email' | 'nothing_unread' | 'no_smtp',
      ): Promise<DigestOutcome> => {
        await store.recordResult(accountId, day, { status: 'skipped', error: reason });
        return { status: 'skipped', reason };
      };

      if (facts.email === null) return skip('no_email');
      if (facts.unreadCount === 0) return skip('nothing_unread');
      // The office SMTP wins over the one of the installation.
      const smtp = (await store.officeSmtp(facts.officeId)) ?? deps.defaultSmtp;
      if (smtp === null) return skip('no_smtp');

      const message = digestMessage({
        count: facts.unreadCount,
        nearestDueOn: facts.nearestDueOn,
        link,
      });
      try {
        await mailer.send({ to: facts.email, ...message }, smtp);
      } catch (error) {
        await store.recordResult(accountId, day, { status: 'failed', error: errorMessage(error) });
        throw error;
      }
      await store.recordResult(accountId, day, { status: 'sent', error: null });
      return { status: 'sent' };
    },
  };
}

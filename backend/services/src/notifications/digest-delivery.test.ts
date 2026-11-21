import { calendarDate } from '@sarmata/domain';
import {
  type DigestFacts,
  type NotificationDeliveryStore,
  type SmtpSettings,
} from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { type MailMessage, type Mailer, createNotificationDelivery } from './digest-delivery';

const DAY = calendarDate('2026-12-01');
const ACCOUNT = 'account-1';
const OFFICE = 'office-1';

const smtp = (host: string): SmtpSettings => ({
  host,
  port: 587,
  user: null,
  password: null,
  from: 'oceny@example.test',
  fromName: 'Urząd',
});

const baseFacts: DigestFacts = {
  officeId: OFFICE,
  email: 'ola@example.test',
  status: 'queued',
  unreadCount: 2,
  nearestDueOn: calendarDate('2026-12-05'),
};

interface Recorded {
  readonly status: string;
  readonly error: string | null;
}

function setup(
  options: {
    facts?: DigestFacts | null;
    officeSmtp?: SmtpSettings | null;
    defaultSmtp?: SmtpSettings | null;
    failure?: Error;
  } = {},
) {
  const results: Recorded[] = [];
  const sent: { message: MailMessage; smtp: SmtpSettings }[] = [];
  let facts: DigestFacts | null = options.facts === undefined ? baseFacts : options.facts;
  const store: NotificationDeliveryStore = {
    collect: () => Promise.reject(new Error('unused')),
    digestFacts: () => Promise.resolve(facts),
    officeSmtp: () => Promise.resolve(options.officeSmtp ?? null),
    recordResult: (_account, _day, result) => {
      results.push(result);
      // A stored result changes what the next delivery of the same job sees.
      if (facts !== null) facts = { ...facts, status: result.status };
      return Promise.resolve();
    },
  };
  const mailer: Mailer = {
    send: (message, settings) => {
      if (options.failure !== undefined) return Promise.reject(options.failure);
      sent.push({ message, smtp: settings });
      return Promise.resolve();
    },
  };
  const delivery = createNotificationDelivery({
    store,
    mailer,
    siteUrl: 'https://sarmata.example/',
    defaultSmtp: options.defaultSmtp === undefined ? null : options.defaultSmtp,
  });
  return { delivery, results, sent };
}

describe('sendDigest', () => {
  it('sends one digest with count and nearest date', async () => {
    const { delivery, results, sent } = setup({ officeSmtp: smtp('office.test') });
    expect(await delivery.sendDigest(ACCOUNT, DAY)).toEqual({ status: 'sent' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.message.to).toBe('ola@example.test');
    expect(sent[0]?.message.subject).toBe('Sarmata: zadania do wykonania');
    expect(sent[0]?.message.text).toContain('Masz 2 zadania, najbliższy termin 05.12.');
    expect(results).toEqual([{ status: 'sent', error: null }]);
  });

  it('mail carries only count, date and link', async () => {
    const { delivery, sent } = setup({
      officeSmtp: smtp('office.test'),
      facts: { ...baseFacts, email: 'jan.kowalski@example.test' },
    });
    await delivery.sendDigest(ACCOUNT, DAY);
    expect(sent[0]?.message.text).toBe(
      'Masz 2 zadania, najbliższy termin 05.12.\n\nhttps://sarmata.example/powiadomienia',
    );
    expect(sent[0]?.message.text).not.toMatch(/kowalski/i);
    expect(sent[0]?.message.html).not.toMatch(/kowalski/i);
  });

  it('mail link points to the notifications route', async () => {
    const { delivery, sent } = setup({ officeSmtp: smtp('office.test') });
    await delivery.sendDigest(ACCOUNT, DAY);
    expect(sent[0]?.message.html).toContain('href="https://sarmata.example/powiadomienia"');
  });

  it('office smtp wins over installer smtp', async () => {
    const { delivery, sent } = setup({
      officeSmtp: smtp('office.test'),
      defaultSmtp: smtp('installer.test'),
    });
    await delivery.sendDigest(ACCOUNT, DAY);
    expect(sent[0]?.smtp.host).toBe('office.test');
  });

  it('installer smtp used when office has none', async () => {
    const { delivery, sent } = setup({ defaultSmtp: smtp('installer.test') });
    await delivery.sendDigest(ACCOUNT, DAY);
    expect(sent[0]?.smtp.host).toBe('installer.test');
  });

  it('no smtp skips and logs no_smtp', async () => {
    const { delivery, results, sent } = setup();
    expect(await delivery.sendDigest(ACCOUNT, DAY)).toEqual({
      status: 'skipped',
      reason: 'no_smtp',
    });
    expect(sent).toHaveLength(0);
    expect(results).toEqual([{ status: 'skipped', error: 'no_smtp' }]);
  });

  it('nothing unread skips', async () => {
    const { delivery, results, sent } = setup({
      officeSmtp: smtp('office.test'),
      facts: { ...baseFacts, unreadCount: 0 },
    });
    expect(await delivery.sendDigest(ACCOUNT, DAY)).toEqual({
      status: 'skipped',
      reason: 'nothing_unread',
    });
    expect(sent).toHaveLength(0);
    expect(results).toEqual([{ status: 'skipped', error: 'nothing_unread' }]);
  });

  it('account without e-mail skips', async () => {
    const { delivery } = setup({
      officeSmtp: smtp('office.test'),
      facts: { ...baseFacts, email: null },
    });
    expect(await delivery.sendDigest(ACCOUNT, DAY)).toEqual({
      status: 'skipped',
      reason: 'no_email',
    });
  });

  it('unknown digest is skipped without a log entry', async () => {
    const { delivery, results } = setup({ facts: null });
    expect(await delivery.sendDigest(ACCOUNT, DAY)).toEqual({
      status: 'skipped',
      reason: 'unknown_digest',
    });
    expect(results).toHaveLength(0);
  });

  it('redelivered job does not send twice', async () => {
    const { delivery, results, sent } = setup({ officeSmtp: smtp('office.test') });
    await delivery.sendDigest(ACCOUNT, DAY);
    expect(await delivery.sendDigest(ACCOUNT, DAY)).toEqual({
      status: 'skipped',
      reason: 'already_sent',
    });
    expect(sent).toHaveLength(1);
    expect(results).toHaveLength(1);
  });

  it('smtp failure is logged and rethrown', async () => {
    const { delivery, results } = setup({
      officeSmtp: smtp('office.test'),
      failure: new Error('connect ECONNREFUSED'),
    });
    await expect(delivery.sendDigest(ACCOUNT, DAY)).rejects.toThrow('ECONNREFUSED');
    expect(results).toEqual([{ status: 'failed', error: 'connect ECONNREFUSED' }]);
  });
});

import { DIGEST_JOB_TYPE, calendarDate } from '@sarmata/domain';
import type { Database } from '@sarmata/database';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  type ServiceDb,
  createJobQueue,
  createNotificationDeliveryStore,
  createNotificationRepository,
  createOfficeSettingsRepository,
  createServiceClient,
} from './index';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

async function signedIn(email: string): Promise<Db> {
  const db: Db = createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password: 'Haslo-Demo-2026' });
  if (error) throw error;
  return db;
}

const serviceClient = (): ServiceDb =>
  createServiceClient({ url: env('SUPABASE_URL'), secretKey: env('SUPABASE_SECRET_KEY') });

const today = calendarDate(new Date().toISOString().slice(0, 10));

const addDays = (date: string, days: number) =>
  calendarDate(new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10));

async function accountId(db: Db): Promise<string> {
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  return data.user.id;
}

async function demoDeadline(service: ServiceDb, slot: string) {
  const { data, error } = await service
    .from('evaluation_deadlines')
    .select('evaluation_id, due_on')
    .eq('slot', slot)
    .not('due_on', 'is', null)
    .limit(1)
    .single();
  if (error) throw error;
  return { evaluationId: data.evaluation_id, dueOn: calendarDate(data.due_on) };
}

describe('notifications', () => {
  it('collect gives hr an objection task visible in inbox', async () => {
    await createNotificationDeliveryStore(serviceClient()).collect(today);
    const hr = createNotificationRepository(await signedIn('kadry@kropka.test'));
    const items = await hr.list();
    const task = items.find((item) => item.kind === 'objection_decision');
    expect(task).toMatchObject({
      category: 'task',
      employeeName: 'Stefan Sprzeciwny',
      status: 'open',
      readAt: null,
    });
  });

  it('evaluator does not see hr notifications', async () => {
    const evaluator = createNotificationRepository(await signedIn('oceniajacy@kropka.test'));
    const kinds = (await evaluator.list()).map((item) => item.kind);
    expect(kinds).not.toContain('objection_decision');
    expect(kinds).not.toContain('grade_by_law');
  });

  it('mark read lowers unread count', async () => {
    const hr = createNotificationRepository(await signedIn('kadry@kropka.test'));
    const before = await hr.unreadCount();
    const [first] = await hr.list({ unreadOnly: true, limit: 1 });
    if (first === undefined) throw new Error('hr has no unread notification');
    expect(await hr.markRead([first.id])).toBe(1);
    expect(await hr.markRead([first.id])).toBe(0);
    expect(await hr.unreadCount()).toBe(before - 1);
    const unread = await hr.list({ unreadOnly: true });
    expect(unread.map((item) => item.id)).not.toContain(first.id);
    expect(await hr.markRead('all')).toBe(before - 1);
    expect(await hr.unreadCount()).toBe(0);
  });

  it('collect again on the same day adds nothing', async () => {
    const report = await createNotificationDeliveryStore(serviceClient()).collect(today);
    expect(report).toMatchObject({ created: 0, queued: 0 });
  });

  it('queued job type is DIGEST_JOB_TYPE', async () => {
    const jobs = await createJobQueue(serviceClient()).read(100, 1);
    const types = jobs.map((job) => (job.message as { type?: string }).type);
    expect(types).toContain(DIGEST_JOB_TYPE);
  });

  it('evaluator gets a reminder before the deadline', async () => {
    const service = serviceClient();
    const deadline = await demoDeadline(service, 'evaluationDeadline');
    const store = createNotificationDeliveryStore(service);
    // Ten days ahead: the nearest default lead (14) applies.
    await store.collect(addDays(deadline.dueOn, -10));
    const evaluator = createNotificationRepository(await signedIn('oceniajacy@kropka.test'));
    const reminder = (await evaluator.list()).find(
      (item) => item.kind === 'deadline_reminder' && item.evaluationId === deadline.evaluationId,
    );
    expect(reminder).toMatchObject({ category: 'reminder', leadDays: 14, dueOn: deadline.dueOn });
  });

  it('digest facts and office smtp for the demo office', async () => {
    const service = serviceClient();
    const store = createNotificationDeliveryStore(service);
    const hr = await signedIn('kadry@kropka.test');
    const facts = await store.digestFacts(await accountId(hr), today);
    expect(facts).toMatchObject({ email: 'kadry@kropka.test', status: 'queued' });
    expect(facts?.unreadCount).toBeGreaterThanOrEqual(0);

    const admin = createOfficeSettingsRepository(await signedIn('admin@kropka.test'));
    await admin.update({
      smtp: { host: '127.0.0.1', port: 55425, user: null, from: 'oceny@kropka.test' },
    });
    await admin.setSmtpPassword('Haslo-Smtp-2026');
    const officeId = facts?.officeId ?? '';
    const smtp = await store.officeSmtp(officeId);
    expect(smtp).toMatchObject({
      host: '127.0.0.1',
      port: 55425,
      user: null,
      password: 'Haslo-Smtp-2026',
      from: 'oceny@kropka.test',
    });
    expect(smtp?.fromName).toContain('Urząd');
  });

  it('resolved task shows in inbox as resolved', async () => {
    const service = serviceClient();
    const store = createNotificationDeliveryStore(service);
    const deadline = await demoDeadline(service, 'objectionDecision');
    const { error } = await service
      .from('evaluation_deadlines')
      .update({ due_on: null })
      .eq('evaluation_id', deadline.evaluationId)
      .eq('slot', 'objectionDecision');
    if (error) throw error;
    const report = await store.collect(today);
    expect(report.resolved).toBeGreaterThanOrEqual(1);
    const hr = createNotificationRepository(await signedIn('kadry@kropka.test'));
    const items = await hr.list();
    const resolved = items.find(
      (item) => item.kind === 'objection_decision' && item.status === 'resolved',
    );
    expect(resolved?.category).toBe('task');
    expect(resolved?.readAt).not.toBeNull();
    expect(items.at(-1)?.status).toBe('resolved');
    const restore = await service
      .from('evaluation_deadlines')
      .update({ due_on: deadline.dueOn })
      .eq('evaluation_id', deadline.evaluationId)
      .eq('slot', 'objectionDecision');
    if (restore.error) throw restore.error;
  });
});

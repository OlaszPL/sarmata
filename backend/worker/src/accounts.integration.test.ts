import { type Database, type Db, type ServiceDb, createServiceClient } from '@sarmata/repositories';
import { servicesFor } from '@sarmata/services';
import { createSystemServices } from '@sarmata/services/system';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { jobHandlersFor } from './handlers/index';
import { type Logger } from './logger';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

async function signedIn(email: string, password = 'Haslo-Demo-2026'): Promise<Db> {
  const db: Db = createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return db;
}

const service: ServiceDb = createServiceClient({
  url: env('SUPABASE_URL'),
  secretKey: env('SUPABASE_SECRET_KEY'),
});
const system = createSystemServices(service);
const silent: Logger = { info: () => undefined, error: () => undefined };

/** The worker, with the handler of the job called directly: what pgmq delivers for the insert trigger. */
async function runInviteJob(invitationId: string): Promise<void> {
  const unused = () => Promise.reject(new Error('unused'));
  const handler = jobHandlersFor({
    delivery: { sendDigest: unused },
    closing: { closeUnobjected: unused },
    retention: { run: unused },
    invitations: system.accountInvitations,
  }).find((entry) => entry.type === 'accounts.invite');
  if (handler === undefined) throw new Error('accounts.invite has no handler');
  const outcome = await handler.run(
    { invitationId },
    { signal: new AbortController().signal, logger: silent },
  );
  expect(outcome).toEqual({ status: 'done' });
}

const unique = `${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`;
const accountIds: string[] = [];
const employeeEmails: string[] = [];

afterAll(async () => {
  for (const email of employeeEmails) {
    await service.from('employees').delete().eq('email', email);
  }
  for (const id of accountIds) await service.auth.admin.deleteUser(id);
});

describe('account administration against the database', () => {
  it('invites an account, changes its role and ends its membership', async () => {
    const adminDb = await signedIn('admin@kropka.test');
    const accounts = servicesFor(adminDb).accounts;
    const email = `zaproszony${unique}@kropka.test`;
    employeeEmails.push(email);

    // A record of the same e-mail already exists, so the invitation links it instead of duplicating it.
    const existing = await servicesFor(await signedIn('kadry@kropka.test')).employees.create({
      firstName: 'Zofia',
      lastName: `Zaproszona${unique}`,
      email,
    });

    const invitationId = await accounts.invite({
      email: email.toUpperCase(),
      role: 'evaluator',
      firstName: 'Inne',
      lastName: 'Imię',
    });
    // The insert trigger queued accounts.invite (checked in pgTAP). Until the worker runs it the request is pending.
    const pending = await accounts.invitation(invitationId);
    expect(pending).toMatchObject({ status: 'pending', email, mode: null, finishedAt: null });

    await runInviteJob(invitationId);
    const invited = await accounts.invitation(invitationId);
    expect(invited).toMatchObject({ status: 'sent', errorCode: null });
    if (invited.accountId === null) throw new Error('the invitation has no account id');
    const accountId = invited.accountId;
    accountIds.push(accountId);
    expect(['invitation', 'temporary_password']).toContain(invited.mode);
    expect(invited.employeeId).toBe(existing.id);
    // A second delivery of the same job changes nothing.
    await runInviteJob(invitationId);
    expect(await accounts.invitation(invitationId)).toEqual(invited);

    const temporaryPassword = await accounts.takeInvitationPassword(invitationId);
    expect(temporaryPassword !== null).toBe(invited.mode === 'temporary_password');
    expect(invited.temporaryPasswordWaiting).toBe(invited.mode === 'temporary_password');
    expect(await accounts.takeInvitationPassword(invitationId)).toBeNull();

    let member = (await accounts.list()).find((entry) => entry.accountId === accountId);
    expect(member).toMatchObject({ role: 'evaluator', endedOn: null, lastName: existing.lastName });

    await accounts.changeRole(accountId, 'hr');
    member = (await accounts.list()).find((entry) => entry.accountId === accountId);
    expect(member?.role).toBe('hr');

    if (temporaryPassword !== null) {
      const db = await signedIn(email, temporaryPassword);
      const claims = await db.auth.getClaims();
      expect(claims.data?.claims.office_role).toBe('hr');
    }

    await expect(accounts.endMembership(accountId)).resolves.toEqual({
      openAsEvaluator: 0,
    });
    member = (await accounts.list()).find((entry) => entry.accountId === accountId);
    expect(member?.endedOn).not.toBeNull();

    // Inviting the same e-mail again reactivates the membership.
    const againId = await accounts.invite({
      email,
      role: 'evaluator',
      firstName: 'X',
      lastName: 'Y',
    });
    await runInviteJob(againId);
    expect(await accounts.invitation(againId)).toMatchObject({
      status: 'sent',
      mode: 'existing_account',
      accountId,
    });
    member = (await accounts.list()).find((entry) => entry.accountId === accountId);
    expect(member).toMatchObject({ role: 'evaluator', endedOn: null });
  });

  it('finishes an invitation of a person who already has an office account as failed', async () => {
    const accounts = servicesFor(await signedIn('admin@kropka.test')).accounts;
    const id = await accounts.invite({
      email: 'kadry@kropka.test',
      role: 'hr',
      firstName: 'Kadry',
      lastName: 'Kropka',
    });
    await runInviteJob(id);
    expect(await accounts.invitation(id)).toMatchObject({
      status: 'failed',
      mode: null,
      errorCode: 'account_exists',
    });
  });

  it('keeps accounts away from everyone but an admin and protects the last admin', async () => {
    const hr = servicesFor(await signedIn('kadry@kropka.test')).accounts;
    await expect(hr.list()).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      hr.invite({ email: `hr${unique}@kropka.test`, role: 'hr', firstName: 'A', lastName: 'B' }),
    ).rejects.toMatchObject({ code: 'forbidden' });

    const adminDb = await signedIn('admin@kropka.test');
    const admin = servicesFor(adminDb).accounts;
    await expect(
      admin.changeRole('22222222-2222-4222-8222-000000000001', 'hr'),
    ).rejects.toMatchObject({ code: 'last_admin' });
    await expect(admin.endMembership('22222222-2222-4222-8222-000000000001')).rejects.toMatchObject(
      {
        code: 'last_admin',
      },
    );
  });

  it('imports employees from CSV: dry run first, then commit, and a re-import updates', async () => {
    const hr = servicesFor(await signedIn('kadry@kropka.test')).employeeImport;
    const email = `import${unique}@kropka.test`;
    employeeEmails.push(email);
    const csv = `Imię;Nazwisko;E-mail;Stanowisko\nIga;Qwxz${unique.replace(/\d/g, (digit) => 'bcdfghjklm'[Number(digit)] ?? 'b')};${email};Referent`;
    const proposal = hr.proposeMapping(csv);
    expect(proposal.missing).toEqual([]);

    const dry = await hr.dryRun(csv, proposal.mapping);
    expect(dry.rows.map((row) => row.proposedAction)).toEqual(['create']);

    const first = await hr.commit(csv, proposal.mapping);
    expect(first).toMatchObject({ created: 1, updated: 0, failed: [] });

    const again = csv.replace('Referent', 'Starszy referent');
    expect((await hr.dryRun(again, proposal.mapping)).rows[0]?.proposedAction).toBe('update');
    expect(await hr.commit(again, proposal.mapping)).toMatchObject({ created: 0, updated: 1 });

    const evaluator = servicesFor(await signedIn('oceniajacy@kropka.test')).employeeImport;
    await expect(evaluator.dryRun(csv, proposal.mapping)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

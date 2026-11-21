import { type Database, type Db, type ServiceDb, createServiceClient } from '@sarmata/repositories';
import { servicesFor } from '@sarmata/services';
import { createSystemServices } from '@sarmata/services/system';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

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
    const accounts = servicesFor(adminDb, {
      accountAdministration: createSystemServices(service).accounts,
    }).accounts;
    const email = `zaproszony${unique}@kropka.test`;
    employeeEmails.push(email);

    // A record of the same e-mail already exists, so the invitation links it instead of duplicating it.
    const existing = await servicesFor(await signedIn('kadry@kropka.test')).employees.create({
      firstName: 'Zofia',
      lastName: `Zaproszona${unique}`,
      email,
    });

    const invited = await accounts.invite({
      email,
      role: 'evaluator',
      firstName: 'Inne',
      lastName: 'Imię',
    });
    accountIds.push(invited.accountId);
    expect(['invitation', 'temporary_password']).toContain(invited.mode);
    expect(invited.employeeId).toBe(existing.id);

    let member = (await accounts.list()).find((entry) => entry.accountId === invited.accountId);
    expect(member).toMatchObject({ role: 'evaluator', endedOn: null, lastName: existing.lastName });

    await accounts.changeRole(invited.accountId, 'hr');
    member = (await accounts.list()).find((entry) => entry.accountId === invited.accountId);
    expect(member?.role).toBe('hr');

    if (invited.temporaryPassword !== undefined) {
      const db = await signedIn(email, invited.temporaryPassword);
      const claims = await db.auth.getClaims();
      expect(claims.data?.claims.office_role).toBe('hr');
    }

    await expect(accounts.endMembership(invited.accountId)).resolves.toEqual({
      openAsEvaluator: 0,
    });
    member = (await accounts.list()).find((entry) => entry.accountId === invited.accountId);
    expect(member?.endedOn).not.toBeNull();

    // Inviting the same e-mail again reactivates the membership.
    const again = await accounts.invite({
      email,
      role: 'evaluator',
      firstName: 'X',
      lastName: 'Y',
    });
    expect(again).toMatchObject({ mode: 'existing_account', accountId: invited.accountId });
    member = (await accounts.list()).find((entry) => entry.accountId === invited.accountId);
    expect(member).toMatchObject({ role: 'evaluator', endedOn: null });
  });

  it('keeps accounts away from everyone but an admin and protects the last admin', async () => {
    const hr = servicesFor(await signedIn('kadry@kropka.test')).accounts;
    await expect(hr.list()).rejects.toMatchObject({ code: 'forbidden' });

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

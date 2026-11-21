import { type AccountAdminStore, RepositoryError } from '@sarmata/repositories';
import { describe, expect, it, vi } from 'vitest';
import { createAccountAdministration } from './account-administration';
import { createAccountsService } from './accounts-service';

function store(override: Partial<AccountAdminStore> = {}) {
  const calls: string[] = [];
  const fake: AccountAdminStore = {
    findAccountIdByEmail: () => Promise.resolve(null),
    inviteByEmail: (email) => {
      calls.push(`invite ${email}`);
      return Promise.resolve('acc-new');
    },
    createWithPassword: (email, password) => {
      calls.push(`create ${email} ${password}`);
      return Promise.resolve('acc-new');
    },
    deleteAccount: (id) => {
      calls.push(`delete ${id}`);
      return Promise.resolve();
    },
    admit: (input) => {
      calls.push(`admit ${input.accountId} ${input.role}`);
      return Promise.resolve('emp-1');
    },
    ...override,
  };
  return { fake, calls };
}

const request = {
  officeId: 'o1',
  email: ' Nowy@Urzad.test ',
  role: 'evaluator' as const,
  firstName: 'Nina',
  lastName: 'Nowa',
};

describe('account administration', () => {
  it('invites by e-mail and admits the membership', async () => {
    const { fake, calls } = store();
    const result = await createAccountAdministration({ store: fake }).invite(request);
    expect(result).toEqual({ accountId: 'acc-new', employeeId: 'emp-1', mode: 'invitation' });
    expect(calls).toEqual(['invite nowy@urzad.test', 'admit acc-new evaluator']);
  });

  it('falls back to a temporary password without a working SMTP', async () => {
    const { fake, calls } = store({
      inviteByEmail: () => Promise.reject(new RepositoryError('invite', { message: 'smtp' })),
    });
    const result = await createAccountAdministration({
      store: fake,
      generatePassword: () => 'Tymczasowe-Haslo-1',
    }).invite(request);
    expect(result).toMatchObject({
      mode: 'temporary_password',
      temporaryPassword: 'Tymczasowe-Haslo-1',
    });
    expect(calls).toEqual(['create nowy@urzad.test Tymczasowe-Haslo-1', 'admit acc-new evaluator']);
  });

  it('generates a password of at least 12 characters by default', async () => {
    const { fake } = store({
      inviteByEmail: () => Promise.reject(new RepositoryError('invite', { message: 'smtp' })),
    });
    const result = await createAccountAdministration({ store: fake }).invite(request);
    expect(result.temporaryPassword?.length).toBeGreaterThanOrEqual(12);
  });

  it('admits an existing login without sending anything', async () => {
    const { fake, calls } = store({ findAccountIdByEmail: () => Promise.resolve('acc-old') });
    const result = await createAccountAdministration({ store: fake }).invite(request);
    expect(result.mode).toBe('existing_account');
    expect(calls).toEqual(['admit acc-old evaluator']);
  });

  it('removes the login it made when the membership fails', async () => {
    const { fake, calls } = store({
      admit: () =>
        Promise.reject(
          new RepositoryError('admit', { message: 'x', code: 'employee_has_account' }),
        ),
    });
    await expect(
      createAccountAdministration({ store: fake }).invite(request),
    ).rejects.toMatchObject({
      code: 'account_exists',
    });
    expect(calls).toContain('delete acc-new');
  });

  it('keeps an existing login when its membership fails', async () => {
    const { fake, calls } = store({
      findAccountIdByEmail: () => Promise.resolve('acc-old'),
      admit: () =>
        Promise.reject(new RepositoryError('admit', { message: 'x', code: 'membership_exists' })),
    });
    await expect(
      createAccountAdministration({ store: fake }).invite(request),
    ).rejects.toMatchObject({
      code: 'account_exists',
    });
    expect(calls).toEqual([]);
  });
});

describe('accounts service', () => {
  const repository = () => ({
    list: vi.fn(() => Promise.resolve([])),
    changeRole: vi.fn(() => Promise.resolve()),
    endMembership: vi.fn(() => Promise.resolve(2)),
  });
  const admin = { officeId: 'o1', role: 'admin' as const };

  it('works for an admin only', async () => {
    const repo = repository();
    const service = createAccountsService({
      repository: repo,
      current: () => Promise.resolve({ officeId: 'o1', role: 'hr' }),
    });
    await expect(service.list()).rejects.toMatchObject({ code: 'forbidden' });
    await expect(service.changeRole('a', 'hr')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(service.endMembership('a')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      service.invite({ email: 'a@b.test', role: 'hr', firstName: 'A', lastName: 'B' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(repo.changeRole).not.toHaveBeenCalled();
  });

  it('invites into the office of the admin and validates the input', async () => {
    const invite = vi.fn(() =>
      Promise.resolve({ accountId: 'a', employeeId: 'e', mode: 'invitation' as const }),
    );
    const service = createAccountsService({
      repository: repository(),
      current: () => Promise.resolve(admin),
      administration: { invite },
    });
    await service.invite({ email: 'a@b.test', role: 'hr', firstName: 'A', lastName: 'B' });
    expect(invite).toHaveBeenCalledWith(expect.objectContaining({ officeId: 'o1', role: 'hr' }));
    await expect(
      service.invite({ email: 'not-an-email', role: 'hr', firstName: 'A', lastName: 'B' }),
    ).rejects.toThrow();
  });

  it('reports open evaluations and maps the last admin rule', async () => {
    const repo = repository();
    const service = createAccountsService({
      repository: repo,
      current: () => Promise.resolve(admin),
    });
    expect(await service.endMembership('a')).toEqual({ openAsEvaluator: 2 });
    repo.changeRole.mockRejectedValueOnce(
      new RepositoryError('accounts.changeRole', { message: 'last_admin', code: 'last_admin' }),
    );
    await expect(service.changeRole('a', 'hr')).rejects.toMatchObject({ code: 'last_admin' });
  });
});

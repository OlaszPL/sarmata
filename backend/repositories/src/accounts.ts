import { type Database } from '@sarmata/database';
import { type Db, type ServiceDb } from './db';
import { RepositoryError } from './errors';

export type OfficeRoleName = Database['public']['Enums']['office_role'];

export interface Member {
  readonly accountId: string;
  readonly role: OfficeRoleName;
  /** First day without access, `null` while the membership is active. */
  readonly endedOn: string | null;
  readonly email: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

/** Memberships of the own office for an admin, with role changes. Every call goes through the JWT of the admin. */
export interface AccountRepository {
  list(): Promise<Member[]>;
  changeRole(accountId: string, role: OfficeRoleName): Promise<void>;
  /** Ends the access from today. Returns the number of open evaluations the account leads. */
  endMembership(accountId: string): Promise<number>;
}

const RULES = [
  'last_admin',
  'membership_missing',
  'membership_exists',
  'employment_ended',
  'employee_has_account',
  'account_missing',
] as const;

/** SQL raises these rule names in P0001, the code of the error becomes the rule. */
function toRepositoryError(operation: string, error: { message: string; code?: string }) {
  if (error.code === 'P0001') {
    for (const code of RULES) {
      if (error.message.includes(code)) return new RepositoryError(operation, { ...error, code });
    }
  }
  return new RepositoryError(operation, error);
}

export function createAccountRepository(db: Db): AccountRepository {
  return {
    async list() {
      const [memberships, employees] = await Promise.all([
        db.from('memberships').select('user_id, role, ended_on').order('created_at'),
        db
          .from('employees')
          .select('user_id, first_name, last_name, email')
          .not('user_id', 'is', null),
      ]);
      if (memberships.error) throw new RepositoryError('accounts.list', memberships.error);
      if (employees.error) throw new RepositoryError('accounts.list', employees.error);
      const byAccount = new Map(employees.data.map((employee) => [employee.user_id, employee]));
      return memberships.data.map((membership) => {
        const employee = byAccount.get(membership.user_id);
        return {
          accountId: membership.user_id,
          role: membership.role,
          endedOn: membership.ended_on,
          email: employee?.email ?? null,
          firstName: employee?.first_name ?? null,
          lastName: employee?.last_name ?? null,
        };
      });
    },

    async changeRole(accountId, role) {
      const { error } = await db.rpc('change_member_role', {
        p_account_id: accountId,
        p_role: role,
      });
      if (error) throw toRepositoryError('accounts.changeRole', error);
    },

    async endMembership(accountId) {
      const { data, error } = await db.rpc('end_membership', { p_account_id: accountId });
      if (error) throw toRepositoryError('accounts.endMembership', error);
      return data;
    },
  };
}

export interface AdmitInput {
  readonly accountId: string;
  readonly officeId: string;
  readonly role: OfficeRoleName;
  readonly firstName: string;
  readonly lastName: string;
}

/** Login accounts through Supabase Auth admin and the membership of a new account. Service client only. */
export interface AccountAdminStore {
  /** Id of the login account with this e-mail, `null` when there is none. */
  findAccountIdByEmail(email: string): Promise<string | null>;
  /** Sends an invitation e-mail and returns the id of the new, unconfirmed account. Fails without a working SMTP. */
  inviteByEmail(email: string, redirectTo?: string): Promise<string>;
  /** Creates a confirmed account with a password, for installations without SMTP. */
  createWithPassword(email: string, password: string): Promise<string>;
  deleteAccount(accountId: string): Promise<void>;
  /** Adds the membership and links or creates the employee record. Returns the employee id. */
  admit(input: AdmitInput): Promise<string>;
}

const PAGE = 200;
const MAX_PAGES = 50;

/** An Auth API error as a repository error (its `code` can be undefined). */
const authFailure = (operation: string, error: { message: string; code?: string | undefined }) =>
  new RepositoryError(operation, {
    message: error.message,
    ...(error.code === undefined ? {} : { code: error.code }),
  });

export function createAccountAdminStore(db: ServiceDb): AccountAdminStore {
  return {
    async findAccountIdByEmail(email) {
      const wanted = email.toLowerCase();
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE });
        if (error) throw authFailure('accounts.findAccountIdByEmail', error);
        const found = data.users.find((user) => user.email?.toLowerCase() === wanted);
        if (found !== undefined) return found.id;
        if (data.users.length < PAGE) return null;
      }
      return null;
    },

    async inviteByEmail(email, redirectTo) {
      const { data, error } = await db.auth.admin.inviteUserByEmail(
        email,
        redirectTo === undefined ? undefined : { redirectTo },
      );
      if (error) throw authFailure('accounts.inviteByEmail', error);
      return data.user.id;
    },

    async createWithPassword(email, password) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw authFailure('accounts.createWithPassword', error);
      return data.user.id;
    },

    async deleteAccount(accountId) {
      const { error } = await db.auth.admin.deleteUser(accountId);
      if (error) throw authFailure('accounts.deleteAccount', error);
    },

    async admit(input) {
      const { data, error } = await db.rpc('admit_account', {
        p_account_id: input.accountId,
        p_office_id: input.officeId,
        p_role: input.role,
        p_first_name: input.firstName,
        p_last_name: input.lastName,
      });
      if (error) throw toRepositoryError('accounts.admit', error);
      return data;
    },
  };
}

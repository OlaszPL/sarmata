import {
  type AccountAdminStore,
  type OfficeRoleName,
  RepositoryError,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';

export interface InviteRequest {
  readonly officeId: string;
  readonly email: string;
  readonly role: OfficeRoleName;
  readonly firstName: string;
  readonly lastName: string;
  /** Where the link of the invitation e-mail leads. */
  readonly redirectTo?: string;
}

export interface InviteResult {
  readonly accountId: string;
  readonly employeeId: string;
  /**
   * `invitation`: Supabase Auth sent an e-mail. `temporary_password`: no working SMTP, the admin hands the
   * password over. `existing_account`: the person already had a login (e.g. without an office), nothing is sent.
   */
  readonly mode: 'invitation' | 'temporary_password' | 'existing_account';
  /** Only with `temporary_password`, shown once. */
  readonly temporaryPassword?: string;
}

/** The part of account administration that needs the service client: it creates login accounts. */
export interface AccountAdministration {
  invite(request: InviteRequest): Promise<InviteResult>;
}

export interface AccountAdministrationDependencies {
  readonly store: AccountAdminStore;
  /** Defaults to 18 random characters. */
  readonly generatePassword?: () => string;
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => ALPHABET.charAt(byte % ALPHABET.length)).join('');
}

function admitError(error: unknown): unknown {
  if (error instanceof RepositoryError) {
    if (error.code === 'membership_exists' || error.code === 'employee_has_account') {
      return new ServiceError('account_exists', 'This person already has an account in an office');
    }
    if (error.code === 'employment_ended') {
      return new ServiceError('invalid_account', 'The employment of this person has ended');
    }
  }
  return error;
}

/**
 * Invites an account by e-mail: Supabase Auth invitation, or a temporary password when the invitation cannot
 * be sent (no SMTP). Then it adds the membership and links the employee record of the same e-mail, or creates one.
 * A login account made here is removed again when the membership fails, so nothing half-done stays.
 */
export function createAccountAdministration(
  deps: AccountAdministrationDependencies,
): AccountAdministration {
  const { store } = deps;
  const generatePassword = deps.generatePassword ?? randomPassword;

  return {
    async invite(request) {
      const email = request.email.trim().toLowerCase();
      const admission = {
        officeId: request.officeId,
        role: request.role,
        firstName: request.firstName,
        lastName: request.lastName,
      };

      const existing = await store.findAccountIdByEmail(email);
      if (existing !== null) {
        try {
          const employeeId = await store.admit({ ...admission, accountId: existing });
          return { accountId: existing, employeeId, mode: 'existing_account' };
        } catch (error) {
          throw admitError(error);
        }
      }

      let accountId: string;
      let mode: 'invitation' | 'temporary_password';
      let temporaryPassword: string | undefined;
      try {
        accountId = await store.inviteByEmail(email, request.redirectTo);
        mode = 'invitation';
      } catch {
        temporaryPassword = generatePassword();
        accountId = await store.createWithPassword(email, temporaryPassword);
        mode = 'temporary_password';
      }

      try {
        const employeeId = await store.admit({ ...admission, accountId });
        return {
          accountId,
          employeeId,
          mode,
          ...(temporaryPassword === undefined ? {} : { temporaryPassword }),
        };
      } catch (error) {
        await store.deleteAccount(accountId).catch(() => undefined);
        throw admitError(error);
      }
    },
  };
}

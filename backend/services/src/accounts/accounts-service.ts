import {
  type AccountRepository,
  type Member,
  type OfficeRoleName,
  RepositoryError,
} from '@sarmata/repositories';
import { z } from 'zod';
import { ServiceError } from '../errors';
import { type AccountAdministration, type InviteResult } from './account-administration';

export const inviteInputSchema = z.strictObject({
  email: z.email(),
  role: z.enum(['evaluator', 'hr', 'admin']),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});

export type InviteInput = z.input<typeof inviteInputSchema>;

export interface EndMembershipResult {
  /** Open evaluations the account still leads: hr hands them over (change of evaluator). */
  readonly openAsEvaluator: number;
}

/** Accounts of the own office. Admin only: any other role gets `forbidden`. */
export interface AccountsService {
  list(): Promise<Member[]>;
  /**
   * Invites an account with a role, creates the membership and links the employee record by e-mail (or creates
   * one). Throws `ZodError` for invalid input, `account_exists` when the person already belongs to an office.
   */
  invite(input: InviteInput): Promise<InviteResult>;
  /** Takes effect at the next token refresh. Fails with `last_admin` for the only admin. */
  changeRole(accountId: string, role: OfficeRoleName): Promise<void>;
  /** Ends the access from today, the row stays. Fails with `last_admin` for the only admin. */
  endMembership(accountId: string): Promise<EndMembershipResult>;
}

export interface AccountsServiceDependencies {
  readonly repository: AccountRepository;
  /** Office and role of the signed-in account, `null` without an office. */
  readonly current: () => Promise<{ officeId: string; role: OfficeRoleName } | null>;
  /** Needs the service client. Without it `invite` fails: the frontend cannot create that client. */
  readonly administration?: AccountAdministration;
}

function mapped(error: unknown): unknown {
  if (error instanceof RepositoryError) {
    if (error.code === '42501') {
      return new ServiceError('forbidden', 'Only an admin can manage accounts');
    }
    if (error.code === 'last_admin') {
      return new ServiceError('last_admin', 'The office needs at least one active admin');
    }
    if (error.code === 'membership_missing') {
      return new ServiceError('not_found', 'No active membership of this account in your office');
    }
  }
  return error;
}

export function createAccountsService(deps: AccountsServiceDependencies): AccountsService {
  async function admin(): Promise<{ officeId: string }> {
    const current = await deps.current();
    if (current?.role !== 'admin') {
      throw new ServiceError('forbidden', 'Only an admin can manage accounts');
    }
    return current;
  }

  return {
    async list() {
      await admin();
      return deps.repository.list();
    },

    async invite(rawInput) {
      const input = inviteInputSchema.parse(rawInput);
      const { officeId } = await admin();
      if (deps.administration === undefined) {
        throw new Error('Account invitations need the system account administration');
      }
      return deps.administration.invite({ ...input, officeId });
    },

    async changeRole(accountId, role) {
      await admin();
      try {
        await deps.repository.changeRole(accountId, role);
      } catch (error) {
        throw mapped(error);
      }
    },

    async endMembership(accountId) {
      await admin();
      try {
        return { openAsEvaluator: await deps.repository.endMembership(accountId) };
      } catch (error) {
        throw mapped(error);
      }
    },
  };
}

import {
  type AccountInvitation,
  type AccountInvitationRepository,
  type AccountRepository,
  type Member,
  type OfficeRoleName,
  RepositoryError,
} from '@sarmata/repositories';
import { z } from 'zod';
import { ServiceError } from '../errors';

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
   * Requests the invitation of an account with a role and returns the id of the request. The worker invites the
   * account, creates the membership and links the employee record by e-mail (or creates one), then writes the
   * result: poll it with `invitation`. Throws `ZodError` for invalid input.
   */
  invite(input: InviteInput): Promise<string>;
  /** The request and its result (`status`, `mode`, `errorCode` such as `account_exists`). `not_found` when unknown. */
  invitation(id: string): Promise<AccountInvitation>;
  /**
   * The temporary password of a sent invitation, shown once: it is removed on the way. Only invitations with
   * `mode` `temporary_password` have one (no working SMTP). `null` when none waits. The admin hands it over.
   */
  takeInvitationPassword(id: string): Promise<string | null>;
  /** Takes effect at the next token refresh. Fails with `last_admin` for the only admin. */
  changeRole(accountId: string, role: OfficeRoleName): Promise<void>;
  /** Ends the access from today, the row stays. Fails with `last_admin` for the only admin. */
  endMembership(accountId: string): Promise<EndMembershipResult>;
}

export interface AccountsServiceDependencies {
  readonly repository: AccountRepository;
  /** Office and role of the signed-in account, `null` without an office. */
  readonly current: () => Promise<{ officeId: string; role: OfficeRoleName } | null>;
  readonly invitations: AccountInvitationRepository;
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
  async function admin(): Promise<void> {
    const current = await deps.current();
    if (current?.role !== 'admin') {
      throw new ServiceError('forbidden', 'Only an admin can manage accounts');
    }
  }

  return {
    async list() {
      await admin();
      return deps.repository.list();
    },

    async invite(rawInput) {
      const input = inviteInputSchema.parse(rawInput);
      await admin();
      try {
        return await deps.invitations.request({ ...input, email: input.email.toLowerCase() });
      } catch (error) {
        throw mapped(error);
      }
    },

    async invitation(id) {
      await admin();
      const invitation = await deps.invitations.get(id);
      if (invitation === null) throw new ServiceError('not_found', 'No such invitation');
      return invitation;
    },

    async takeInvitationPassword(id) {
      await admin();
      try {
        return await deps.invitations.takePassword(id);
      } catch (error) {
        throw mapped(error);
      }
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

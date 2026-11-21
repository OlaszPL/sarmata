import { type AccountInvitationStore } from '@sarmata/repositories';
import { ServiceError } from '../errors';
import { type AccountAdministration, type InviteResult } from './account-administration';

export interface InvitationProcessingDependencies {
  readonly store: AccountInvitationStore;
  readonly administration: AccountAdministration;
  /** Where the link of the invitation e-mail leads. */
  readonly redirectTo?: string;
}

export type InvitationProcessingResult =
  | { readonly status: 'sent'; readonly mode: InviteResult['mode'] }
  | { readonly status: 'failed'; readonly errorCode: string; readonly cause: unknown }
  | { readonly status: 'skipped' };

/** Carries out the requests of `account_invitations` for the worker. */
export interface InvitationProcessing {
  /**
   * Invites the account of the request and writes the result into it. Any failure of the invitation
   * (a rule such as `account_exists`, or an unexpected one) finishes the request as failed: the admin sees the
   * reason and asks again, and the cause comes back in the result for the worker log. A database error while
   * writing the result is thrown, so the queue delivers the job again. A request that is not pending
   * (a second delivery) is skipped.
   */
  process(invitationId: string): Promise<InvitationProcessingResult>;
}

export function createInvitationProcessing(
  deps: InvitationProcessingDependencies,
): InvitationProcessing {
  const { store, administration } = deps;

  return {
    async process(invitationId) {
      const invitation = await store.get(invitationId);
      if (invitation?.status !== 'pending') return { status: 'skipped' };

      let result: InviteResult;
      try {
        result = await administration.invite({
          officeId: invitation.officeId,
          email: invitation.email,
          role: invitation.role,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          ...(deps.redirectTo === undefined ? {} : { redirectTo: deps.redirectTo }),
        });
      } catch (error) {
        const rule = error instanceof ServiceError;
        const errorCode = rule ? error.code : 'unexpected';
        await store.finish(invitationId, {
          kind: 'failed',
          errorCode,
          error: rule ? error.message : 'The invitation failed, see the worker log',
        });
        return { status: 'failed', errorCode, cause: error };
      }

      const written = await store.finish(invitationId, {
        kind: 'sent',
        mode: result.mode,
        accountId: result.accountId,
        employeeId: result.employeeId,
        ...(result.temporaryPassword === undefined
          ? {}
          : { temporaryPassword: result.temporaryPassword }),
      });
      return written ? { status: 'sent', mode: result.mode } : { status: 'skipped' };
    },
  };
}

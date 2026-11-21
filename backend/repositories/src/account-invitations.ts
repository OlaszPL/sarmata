import { type Database } from '@sarmata/database';
import { type OfficeRoleName } from './accounts';
import { type Db, type ServiceDb } from './db';
import { RepositoryError } from './errors';

export type AccountInvitationStatus = Database['public']['Enums']['account_invitation_status'];
export type AccountInvitationMode = Database['public']['Enums']['account_invitation_mode'];

export interface InvitationRequestInput {
  /** Already normalized (trimmed, lower case): the table refuses anything else. */
  readonly email: string;
  readonly role: OfficeRoleName;
  readonly firstName: string;
  readonly lastName: string;
}

/** Zaproszenie konta: the request of an admin and the result the worker wrote. */
export interface AccountInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: OfficeRoleName;
  readonly firstName: string;
  readonly lastName: string;
  readonly requestedAt: string;
  readonly status: AccountInvitationStatus;
  /** Null while pending and after a failure. */
  readonly mode: AccountInvitationMode | null;
  readonly accountId: string | null;
  readonly employeeId: string | null;
  /** A temporary password waits for the admin to take it (once). */
  readonly temporaryPasswordWaiting: boolean;
  readonly errorCode: string | null;
  readonly error: string | null;
  readonly finishedAt: string | null;
}

/** Requests and results through the JWT of an admin. Row security allows admins of the office only. */
export interface AccountInvitationRepository {
  /** Inserts the request, the database trigger queues the job. Returns the id of the invitation. */
  request(input: InvitationRequestInput): Promise<string>;
  /** `null` when there is none in the own office. */
  get(id: string): Promise<AccountInvitation | null>;
  /** The temporary password, once: it is removed on the way. `null` when there is none. */
  takePassword(id: string): Promise<string | null>;
}

const COLUMNS =
  'id, email, role, first_name, last_name, requested_at, status, mode, account_id, employee_id, temporary_password_set, error_code, error, finished_at';

type Row = Pick<
  Database['public']['Tables']['account_invitations']['Row'],
  | 'id'
  | 'email'
  | 'role'
  | 'first_name'
  | 'last_name'
  | 'requested_at'
  | 'status'
  | 'mode'
  | 'account_id'
  | 'employee_id'
  | 'temporary_password_set'
  | 'error_code'
  | 'error'
  | 'finished_at'
>;

function toInvitation(row: Row): AccountInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    requestedAt: row.requested_at,
    status: row.status,
    mode: row.mode,
    accountId: row.account_id,
    employeeId: row.employee_id,
    temporaryPasswordWaiting: row.temporary_password_set,
    errorCode: row.error_code,
    error: row.error,
    finishedAt: row.finished_at,
  };
}

export function createAccountInvitationRepository(db: Db): AccountInvitationRepository {
  return {
    async request(input) {
      const { data, error } = await db
        .from('account_invitations')
        .insert({
          email: input.email,
          role: input.role,
          first_name: input.firstName,
          last_name: input.lastName,
        })
        .select('id')
        .single();
      if (error) throw new RepositoryError('accountInvitations.request', error);
      return data.id;
    },

    async get(id) {
      const { data, error } = await db
        .from('account_invitations')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new RepositoryError('accountInvitations.get', error);
      return data === null ? null : toInvitation(data);
    },

    async takePassword(id) {
      const { data, error } = await db.rpc('take_invitation_password', {
        p_invitation_id: id,
      });
      if (error) throw new RepositoryError('accountInvitations.takePassword', error);
      return data;
    },
  };
}

/** What the worker needs of an invitation to carry it out. */
export interface PendingInvitation {
  readonly id: string;
  readonly officeId: string;
  readonly email: string;
  readonly role: OfficeRoleName;
  readonly firstName: string;
  readonly lastName: string;
  readonly status: AccountInvitationStatus;
}

export type InvitationOutcome =
  | {
      readonly kind: 'sent';
      readonly mode: AccountInvitationMode;
      readonly accountId: string;
      readonly employeeId: string;
      readonly temporaryPassword?: string;
    }
  | { readonly kind: 'failed'; readonly errorCode: string; readonly error: string };

/** Results of invitations. Service client only: the result columns are not writable for accounts. */
export interface AccountInvitationStore {
  /** `null` when the invitation does not exist (anymore). */
  get(id: string): Promise<PendingInvitation | null>;
  /** Writes the result of a pending invitation. Returns false when it was not pending anymore. */
  finish(id: string, outcome: InvitationOutcome): Promise<boolean>;
}

export function createAccountInvitationStore(db: ServiceDb): AccountInvitationStore {
  return {
    async get(id) {
      const { data, error } = await db
        .from('account_invitations')
        .select('id, office_id, email, role, first_name, last_name, status')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new RepositoryError('accountInvitations.store.get', error);
      if (data === null) return null;
      return {
        id: data.id,
        officeId: data.office_id,
        email: data.email,
        role: data.role,
        firstName: data.first_name,
        lastName: data.last_name,
        status: data.status,
      };
    },

    async finish(id, outcome) {
      const now = new Date().toISOString();
      const result =
        outcome.kind === 'sent'
          ? {
              status: 'sent' as const,
              mode: outcome.mode,
              account_id: outcome.accountId,
              employee_id: outcome.employeeId,
              temporary_password: outcome.temporaryPassword ?? null,
              temporary_password_set: outcome.temporaryPassword !== undefined,
              finished_at: now,
            }
          : {
              status: 'failed' as const,
              error_code: outcome.errorCode,
              error: outcome.error,
              finished_at: now,
            };
      const { data, error } = await db
        .from('account_invitations')
        .update(result)
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');
      if (error) throw new RepositoryError('accountInvitations.store.finish', error);
      return data.length > 0;
    },
  };
}

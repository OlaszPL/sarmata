import { z } from 'zod';
import { findOfficeName, readAccountClaims, type Database, type Db } from '@sarmata/repositories';

export type OfficeRole = Database['public']['Enums']['office_role'];

const officeRoles = ['admin', 'hr', 'evaluator'] as const satisfies readonly OfficeRole[];

export interface MemberAccount {
  status: 'member';
  userId: string;
  email: string;
  office: { id: string; name: string };
  role: OfficeRole;
}

export type CurrentAccount =
  { status: 'signed-out' } | { status: 'no-office'; userId: string; email: string } | MemberAccount;

// Claim contract set by access.custom_access_token_hook (plan 2).
const claimsSchema = z.object({
  sub: z.uuid(),
  email: z.string().default(''),
  office_id: z.uuid().optional(),
  office_role: z.enum(officeRoles).optional(),
});

/**
 * Who is signed in, in which office and with which role. Reads the verified JWT through the
 * account's own client. Throws when the token breaks the claim contract or the office from the
 * token is not visible, because both mean a broken installation, not a user mistake.
 */
export async function getCurrentAccount(db: Db): Promise<CurrentAccount> {
  const claims = await readAccountClaims(db);
  if (claims === null) return { status: 'signed-out' };

  const parsed = claimsSchema.parse(claims);
  if (!parsed.office_id || !parsed.office_role) {
    return { status: 'no-office', userId: parsed.sub, email: parsed.email };
  }

  const officeName = await findOfficeName(db, parsed.office_id);
  if (officeName === null) {
    throw new Error(
      `Office ${parsed.office_id} from the JWT is not visible to account ${parsed.sub}`,
    );
  }

  return {
    status: 'member',
    userId: parsed.sub,
    email: parsed.email,
    office: { id: parsed.office_id, name: officeName },
    role: parsed.office_role,
  };
}

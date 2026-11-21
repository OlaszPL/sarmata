import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAccount, type CurrentAccount, type MemberAccount } from '@sarmata/services';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

/** The account of this request. React `cache` makes it one service call per request. */
export const currentAccount = cache(async (): Promise<CurrentAccount> =>
  getCurrentAccount(await createSupabase()),
);

/**
 * The account with an office and a role. Redirects to the sign-in page when nobody is signed in
 * and to the no-office page when the account has no membership.
 */
export async function requireMember(): Promise<MemberAccount> {
  const account = await currentAccount();
  if (account.status === 'signed-out') redirect(routes.signIn);
  if (account.status === 'no-office') redirect(routes.noOffice);
  return account;
}

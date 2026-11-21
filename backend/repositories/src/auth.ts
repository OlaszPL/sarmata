import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import type { Db } from './db';

/**
 * Verified JWT claims of the signed-in account, or null when nobody is signed in or the session
 * is no longer valid. Network failures are rethrown, because they do not mean a sign-out.
 */
export async function readAccountClaims(db: Db): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.auth.getClaims();
  if (error) {
    if (isAuthRetryableFetchError(error)) throw error;
    return null;
  }
  return data?.claims ?? null;
}

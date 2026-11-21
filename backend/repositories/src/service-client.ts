import type { Database } from '@sarmata/database';
import { createClient } from '@supabase/supabase-js';
import { type Db } from './db';

/**
 * Client with the secret (service) key. It bypasses RLS, so only the worker and system tasks use it,
 * never code that acts for a signed-in user.
 */
export function createServiceClient(options: { url: string; secretKey: string }): Db {
  return createClient<Database>(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

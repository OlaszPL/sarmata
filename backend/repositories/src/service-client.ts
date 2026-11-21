import type { Database } from '@sarmata/database';
import { createClient } from '@supabase/supabase-js';
import { type ServiceDb } from './db';

/**
 * Client with the secret (service) key. It bypasses RLS, so only the worker, scripts and integration
 * tests use it (enforced by ESLint), never code that acts for a signed-in user.
 */
export function createServiceClient(options: { url: string; secretKey: string }): ServiceDb {
  // The brand exists only in the type, this is the one place that applies it.
  return createClient<Database>(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as ServiceDb;
}

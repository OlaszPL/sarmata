import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@sarmata/database';

/**
 * Supabase client acting as the signed-in account (its JWT), so every query goes through RLS.
 * The optional `__dbRole` brand only exists to keep a `ServiceDb` from being passed here.
 */
export type Db = SupabaseClient<Database> & { readonly __dbRole?: 'user' };

/**
 * Supabase client with the secret key: it bypasses RLS. A distinct type, so it cannot be passed
 * where code acts for a signed-in user, and only the worker and system tasks can ask for it.
 */
export type ServiceDb = SupabaseClient<Database> & { readonly __dbRole: 'service' };

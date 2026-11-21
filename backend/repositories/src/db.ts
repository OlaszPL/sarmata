import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@sarmata/database';

/** Supabase client acting as the signed-in account (its JWT), so every query goes through RLS. */
export type Db = SupabaseClient<Database>;

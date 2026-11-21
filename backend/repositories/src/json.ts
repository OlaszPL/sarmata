import type { Database } from '@sarmata/database';

export type Json = Database['public']['Tables']['regulation_versions']['Insert']['document'];

/** Plain JSON copy of a value for a jsonb column or an RPC argument. */
export const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

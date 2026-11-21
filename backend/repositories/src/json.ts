import type { Json } from '@sarmata/database';

/** Plain JSON copy of a value for a jsonb column or an RPC argument (never null). */
export const toJson = (value: unknown): NonNullable<Json> =>
  JSON.parse(JSON.stringify(value)) as NonNullable<Json>;

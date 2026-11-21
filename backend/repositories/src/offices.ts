import type { Db } from './db';
import { RepositoryError } from './errors';

/** Name of the office, or null when it does not exist or RLS hides it from the account. */
export async function findOfficeName(db: Db, officeId: string): Promise<string | null> {
  const { data, error } = await db.from('offices').select('name').eq('id', officeId).maybeSingle();
  if (error) throw new RepositoryError('offices.findName', error);
  return data?.name ?? null;
}

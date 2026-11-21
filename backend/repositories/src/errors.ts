/** A failed database call. `code` is the Postgres or PostgREST error code, e.g. 42501 for a denied access. */
export class RepositoryError extends Error {
  readonly code: string | null;

  constructor(operation: string, cause: { message: string; code?: string }) {
    super(`${operation}: ${cause.message}`, { cause });
    this.name = 'RepositoryError';
    this.code = cause.code ?? null;
  }
}

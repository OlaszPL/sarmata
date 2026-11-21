import { z } from 'zod';

/**
 * Validates environment variables with a zod schema. Empty variables count as unset (compose files
 * pass `VAR=` for settings left out). A failure throws one error that lists every problem, so a
 * broken installation is fixed in one pass. `hint` is appended for the operator.
 */
export function parseEnv<S extends z.ZodType>(
  schema: S,
  env: Record<string, string | undefined>,
  label: string,
  hint?: string,
): z.output<S> {
  const present = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = schema.safeParse(present);
  if (!result.success) {
    const suffix = hint === undefined ? '' : `\n${hint}`;
    throw new Error(`Invalid ${label} configuration:\n${z.prettifyError(result.error)}${suffix}`);
  }
  return result.data;
}

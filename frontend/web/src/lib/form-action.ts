import { ServiceError } from '@sarmata/services';
import { z } from 'zod';
import { approvalIssueMessage, approvalIssuesOf, serviceErrorMessage } from './service-errors';

/** Raw values of a form as posted: one string per field, an array for repeated names. */
export type FormValues = Record<string, string | string[]>;

/**
 * State of a form handled by a server action with `useActionState`. `values` keep what was typed,
 * `fieldErrors` are keyed by control id (the ids `ErrorSummary` links to).
 */
export interface FormState<V = FormValues> {
  values: V;
  fieldErrors: Partial<Record<string, string>>;
  formError?: string;
  ok?: boolean;
}

/** Form data as plain values: a single entry stays a string, repeated names become an array. */
export function formValues(formData: FormData): FormValues {
  const values: FormValues = {};
  for (const [key, entry] of formData.entries()) {
    if (typeof entry !== 'string') continue;
    const previous = values[key];
    if (previous === undefined) values[key] = entry;
    else values[key] = Array.isArray(previous) ? [...previous, entry] : [previous, entry];
  }
  return values;
}

/** Field errors of a zod error, the first message per field. A path joins with dots. */
function zodFieldErrors(error: z.ZodError): {
  fieldErrors: Record<string, string>;
  formError?: string;
} {
  const fieldErrors: Record<string, string> = {};
  let formError: string | undefined;
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.');
    if (key === '') formError ??= issue.message;
    else fieldErrors[key] ??= issue.message;
  }
  return formError === undefined ? { fieldErrors } : { fieldErrors, formError };
}

/** Shapes of the schema fields that expect an array, so a single checkbox still parses as one. */
function arrayKeys(schema: z.ZodType): Set<string> {
  const keys = new Set<string>();
  if (schema instanceof z.ZodObject) {
    const shape: Record<string, z.ZodType> = schema.shape;
    for (const [key, field] of Object.entries(shape)) {
      let inner: z.ZodType = field;
      while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) {
        inner = inner.unwrap() as z.ZodType;
      }
      if (inner instanceof z.ZodArray) keys.add(key);
    }
  }
  return keys;
}

/**
 * Parses posted form data. On failure returns a state that keeps the typed values and has one
 * message per field. Missing fields read as an empty string (or an empty list for array fields).
 */
export function parseForm<T>(
  schema: z.ZodType<T>,
  formData: FormData,
): { data: T } | { state: FormState } {
  const values = formValues(formData);
  const lists = arrayKeys(schema);
  const input: Record<string, unknown> = { ...values };
  for (const key of lists) {
    const value = values[key];
    input[key] = value === undefined ? [] : Array.isArray(value) ? value : [value];
  }
  if (schema instanceof z.ZodObject) {
    for (const key of Object.keys(schema.shape)) input[key] ??= '';
  }
  const parsed = schema.safeParse(input);
  if (parsed.success) return { data: parsed.data };
  return { state: { values, ...zodFieldErrors(parsed.error) } };
}

function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError || (error instanceof Error && error.name === 'ZodError');
}

/**
 * Runs a service call and turns expected failures into form state: gate issues of
 * `approval_blocked` and `criteria_invalid` become field errors (field ids remapped by `fieldMap`,
 * from the id of `approvalIssueMessage` to the control id of the form), every code gets a form
 * error in Polish, zod errors of a service become field errors. Anything else is rethrown, so a
 * redirect of Next.js or a real bug still surfaces.
 */
export async function runService<T>(
  fn: () => Promise<T>,
  fieldMap?: Record<string, string>,
  values: FormValues = {},
  criterionName?: (criterionId: string) => string,
): Promise<{ ok: true; value: T } | { ok: false; state: FormState }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof ServiceError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of approvalIssuesOf(error.details)) {
        const { fieldId, message } = approvalIssueMessage(issue, criterionName);
        fieldErrors[fieldMap?.[fieldId] ?? fieldId] ??= message;
      }
      return {
        ok: false,
        state: {
          values,
          fieldErrors,
          formError: serviceErrorMessage(error.code, error.details),
        },
      };
    }
    if (isZodError(error)) {
      return { ok: false, state: { values, ...zodFieldErrors(error) } };
    }
    throw error;
  }
}

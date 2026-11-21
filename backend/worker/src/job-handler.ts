import { z } from 'zod';
import { type Logger } from './logger';

export interface JobContext {
  /** Aborted on shutdown. Long handlers pass it to fetch and stop early. */
  readonly signal: AbortSignal;
  readonly logger: Logger;
}

export type JobOutcome =
  { readonly status: 'done' } | { readonly status: 'invalid_payload'; readonly message: string };

/** A handler as the worker sees it: the payload is still unknown until the handler validates it. */
export interface JobHandler<Type extends string = string> {
  readonly type: Type;
  run(payload: unknown, context: JobContext): Promise<JobOutcome>;
}

/** Defines a handler for one job type with a zod schema of its payload. */
export function defineJobHandler<const Type extends string, S extends z.ZodType>(definition: {
  readonly type: Type;
  readonly payload: S;
  handle(payload: z.output<S>, context: JobContext): Promise<void>;
}): JobHandler<Type> {
  return {
    type: definition.type,
    async run(payload, context) {
      const parsed = definition.payload.safeParse(payload);
      if (!parsed.success)
        return { status: 'invalid_payload', message: z.prettifyError(parsed.error) };
      await definition.handle(parsed.data, context);
      return { status: 'done' };
    },
  };
}

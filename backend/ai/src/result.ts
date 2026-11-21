export type AiFailureReason =
  'disabled' | 'timeout' | 'unavailable' | 'rejected' | 'invalid_response';

export interface AiFailure {
  readonly ok: false;
  readonly reason: AiFailureReason;
  readonly message: string;
}

/** Result of an AI call. AI is optional, so every caller handles the failure path. */
export type AiResult<T> = { readonly ok: true; readonly value: T } | AiFailure;

export const failure = (reason: AiFailureReason, message: string): AiFailure => ({
  ok: false,
  reason,
  message,
});

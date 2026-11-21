import { type CalendarDate } from '@sarmata/domain';
import { type EvaluationClosingStore } from '@sarmata/repositories';

/** Closes delivered evaluations after the objection window. Acts for the system, not for an account. */
export interface EvaluationClosing {
  /** Returns only the number: no identifiers reach the logs. */
  closeUnobjected(day: CalendarDate): Promise<{ closed: number }>;
}

export function createEvaluationClosing(store: EvaluationClosingStore): EvaluationClosing {
  return {
    async closeUnobjected(day) {
      const closed = await store.closeUnobjected(day);
      return { closed: closed.length };
    },
  };
}

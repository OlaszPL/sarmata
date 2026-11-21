import type { CalendarDate } from '../deadlines/calendar-date';

export type EvaluationStatus =
  | 'criteria'
  | 'criteria_awaiting_signature'
  | 'period'
  | 'interview'
  | 'drafted'
  | 'delivered'
  | 'closed';

export type EvaluationCommand =
  | { type: 'approve_part_one'; startingInterviewOn: CalendarDate }
  | { type: 'record_part_one_signature'; signedOn: CalendarDate }
  | { type: 'record_evaluation_interview'; heldOn: CalendarDate }
  | { type: 'approve_sheet'; draftedOn: CalendarDate }
  | { type: 'record_acquaintance'; acquaintedOn: CalendarDate; signatureRefused: boolean }
  | { type: 'close_after_objection_window'; closedOn: CalendarDate };

export interface EvaluationTransition {
  from: EvaluationStatus;
  to: EvaluationStatus;
  eventKind: string;
  lockSheet: boolean;
}

/** Mirror of SQL `public.evaluation_transitions()`. The single transition table in TypeScript. */
export const evaluationTransitions: readonly EvaluationTransition[] = [
  {
    from: 'criteria',
    to: 'criteria_awaiting_signature',
    eventKind: 'part_one_approved',
    lockSheet: false,
  },
  {
    from: 'criteria_awaiting_signature',
    to: 'period',
    eventKind: 'part_one_signed',
    lockSheet: false,
  },
  { from: 'period', to: 'interview', eventKind: 'evaluation_interview_held', lockSheet: false },
  { from: 'interview', to: 'drafted', eventKind: 'sheet_approved', lockSheet: true },
  { from: 'drafted', to: 'delivered', eventKind: 'acquainted', lockSheet: false },
  { from: 'drafted', to: 'delivered', eventKind: 'signature_refused', lockSheet: false },
  { from: 'delivered', to: 'closed', eventKind: 'closed', lockSheet: false },
];

export interface TransitionPlan {
  next: EvaluationStatus;
  eventKind: string;
  occurredOn: CalendarDate;
  lockSheet: boolean;
}

export class TransitionError extends Error {
  readonly code = 'invalid_transition';
  constructor(status: EvaluationStatus, command: EvaluationCommand) {
    super(`Command ${command.type} is not allowed in status ${status}`);
    this.name = 'TransitionError';
  }
}

interface CommandFacts {
  to: EvaluationStatus;
  eventKind: string;
  occurredOn: CalendarDate;
}

function commandFacts(command: EvaluationCommand): CommandFacts {
  switch (command.type) {
    case 'approve_part_one':
      return {
        to: 'criteria_awaiting_signature',
        eventKind: 'part_one_approved',
        occurredOn: command.startingInterviewOn,
      };
    case 'record_part_one_signature':
      return { to: 'period', eventKind: 'part_one_signed', occurredOn: command.signedOn };
    case 'record_evaluation_interview':
      return {
        to: 'interview',
        eventKind: 'evaluation_interview_held',
        occurredOn: command.heldOn,
      };
    case 'approve_sheet':
      return { to: 'drafted', eventKind: 'sheet_approved', occurredOn: command.draftedOn };
    case 'record_acquaintance':
      return {
        to: 'delivered',
        eventKind: command.signatureRefused ? 'signature_refused' : 'acquainted',
        occurredOn: command.acquaintedOn,
      };
    case 'close_after_objection_window':
      return { to: 'closed', eventKind: 'closed', occurredOn: command.closedOn };
  }
}

/** Plans the next status from the transition table. Throws `TransitionError` for a pair not in the table. */
export function planTransition(
  status: EvaluationStatus,
  command: EvaluationCommand,
): TransitionPlan {
  const facts = commandFacts(command);
  const row = evaluationTransitions.find(
    (candidate) =>
      candidate.from === status &&
      candidate.to === facts.to &&
      candidate.eventKind === facts.eventKind,
  );
  if (!row) throw new TransitionError(status, command);
  return {
    next: row.to,
    eventKind: row.eventKind,
    occurredOn: facts.occurredOn,
    lockSheet: row.lockSheet,
  };
}

import { describe, expect, it } from 'vitest';
import { calendarDate } from '../deadlines/calendar-date';
import {
  DEFAULT_REFUSAL_NOTE,
  type EvaluationCommand,
  type EvaluationStatus,
  commandPayload,
  planTransition,
  TransitionError,
} from './state-machine';

const day = calendarDate('2026-03-01');

describe('planTransition', () => {
  it.each([
    [
      'criteria',
      { type: 'approve_part_one', startingInterviewOn: day },
      'criteria_awaiting_signature',
      'part_one_approved',
      false,
    ],
    [
      'criteria_awaiting_signature',
      { type: 'record_part_one_signature', signedOn: day },
      'period',
      'part_one_signed',
      false,
    ],
    [
      'period',
      { type: 'record_evaluation_interview', heldOn: day },
      'interview',
      'evaluation_interview_held',
      false,
    ],
    ['interview', { type: 'approve_sheet', draftedOn: day }, 'drafted', 'sheet_approved', true],
    [
      'drafted',
      { type: 'record_acquaintance', acquaintedOn: day, signatureRefused: false },
      'delivered',
      'acquainted',
      false,
    ],
    [
      'delivered',
      { type: 'close_after_objection_window', closedOn: day },
      'closed',
      'closed',
      false,
    ],
  ] as const satisfies readonly (readonly [
    EvaluationStatus,
    EvaluationCommand,
    EvaluationStatus,
    string,
    boolean,
  ])[])('%s + %j', (status, command, next, eventKind, lockSheet) => {
    expect(planTransition(status, command)).toEqual({
      next,
      eventKind,
      occurredOn: day,
      lockSheet,
    });
  });

  it('approve_sheet from period throws invalid_transition', () => {
    const run = () => planTransition('period', { type: 'approve_sheet', draftedOn: day });
    expect(run).toThrow(TransitionError);
    expect(run).toThrow(expect.objectContaining({ code: 'invalid_transition' }));
  });

  it('record_acquaintance with signatureRefused records signature_refused', () => {
    const plan = planTransition('drafted', {
      type: 'record_acquaintance',
      acquaintedOn: day,
      signatureRefused: true,
    });
    expect(plan.eventKind).toBe('signature_refused');
    expect(plan.next).toBe('delivered');
  });

  it('file_objection from delivered goes to objection', () => {
    expect(planTransition('delivered', { type: 'file_objection', filedOn: day })).toEqual({
      next: 'objection',
      eventKind: 'objection_filed',
      occurredOn: day,
      lockSheet: false,
    });
  });

  it.each([
    'criteria',
    'criteria_awaiting_signature',
    'period',
    'interview',
    'drafted',
    'delivered',
    'objection',
  ] as const)('interrupt allowed from %s', (status) => {
    expect(
      planTransition(status, { type: 'interrupt', interruptedOn: day, reason: 'transfer' }),
    ).toEqual({ next: 'interrupted', eventKind: 'interrupted', occurredOn: day, lockSheet: false });
  });

  it.each(['closed', 'interrupted'] as const)(
    'interrupt from %s throws invalid_transition',
    (status) => {
      const run = () =>
        planTransition(status, { type: 'interrupt', interruptedOn: day, reason: 'x' });
      expect(run).toThrow(TransitionError);
      expect(run).toThrow(expect.objectContaining({ code: 'invalid_transition' }));
    },
  );
});

describe('commandPayload', () => {
  const refused: EvaluationCommand = {
    type: 'record_acquaintance',
    acquaintedOn: day,
    signatureRefused: true,
  };

  it('defaults the refusal note and ignores a note when the signature is not refused', () => {
    expect(commandPayload(refused, null)).toEqual({ refusalNote: DEFAULT_REFUSAL_NOTE });
    expect(commandPayload({ ...refused, signatureRefused: false, refusalNote: 'x' }, null)).toEqual(
      {},
    );
  });

  it('keeps a given note, trims witnesses and drops empty ones', () => {
    expect(
      commandPayload({ ...refused, refusalNote: ' Odmowa ', witnesses: [' Ala ', ' '] }, null),
    ).toEqual({ refusalNote: 'Odmowa', witnesses: ['Ala'] });
  });

  it('takes the place from the command, else from the default', () => {
    const approve: EvaluationCommand = { type: 'approve_sheet', draftedOn: day };
    expect(commandPayload(approve, 'Warszawa')).toEqual({ place: 'Warszawa' });
    expect(commandPayload({ ...approve, place: 'Łódź' }, 'Warszawa')).toEqual({ place: 'Łódź' });
    expect(commandPayload(approve, null)).toEqual({});
  });

  it('keeps the interrupt reason', () => {
    expect(
      commandPayload({ type: 'interrupt', interruptedOn: day, reason: 'Left' }, 'Warszawa'),
    ).toEqual({ reason: 'Left' });
  });
});

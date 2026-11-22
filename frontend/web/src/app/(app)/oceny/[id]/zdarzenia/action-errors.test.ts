import { describe, expect, it } from 'vitest';
import { fieldErrorsOf } from './action-errors';

describe('fieldErrorsOf', () => {
  it('puts a late objection on the filing date', () => {
    expect(fieldErrorsOf('objection_late', { dueOn: '2026-11-20' }, 'X')).toEqual({ filedOn: 'X' });
  });

  it('puts a term change issue on its control', () => {
    expect(fieldErrorsOf('term_change_invalid', ['term_change_too_early'], 'X')).toEqual({
      noticeOn: 'X',
    });
    expect(fieldErrorsOf('term_change_invalid', ['term_change_reason_unknown'], 'X')).toEqual({
      reason: 'X',
    });
    expect(fieldErrorsOf('term_change_invalid', ['term_change_after_negative'], 'X')).toEqual({});
  });

  it('puts an invalid evaluator on the account select', () => {
    expect(fieldErrorsOf('invalid_evaluator', undefined, 'X')).toEqual({ accountId: 'X' });
  });

  it('leaves other codes without a field', () => {
    expect(fieldErrorsOf('stale_status', undefined, 'X')).toEqual({});
    expect(fieldErrorsOf('objection_lowers_outcome', undefined, 'X')).toEqual({});
  });
});

import { type EvaluationStatus, type EvaluationView } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { canRemoveGradeRequest, checkMode, gradeRequestMode, partTwoMode } from './sheet-access';

const statuses: EvaluationStatus[] = [
  'criteria',
  'criteria_awaiting_signature',
  'period',
  'interview',
  'drafted',
  'delivered',
  'closed',
  'objection',
  'interrupted',
];

describe('sheet access', () => {
  it('partTwoMode for every status', () => {
    const table = statuses.map((status) => [
      status,
      partTwoMode(status, true),
      partTwoMode(status, false),
    ]);
    expect(table).toEqual([
      ['criteria', 'not_open', 'not_open'],
      ['criteria_awaiting_signature', 'not_open', 'not_open'],
      ['period', 'period', 'read'],
      ['interview', 'edit', 'read'],
      ['drafted', 'read', 'read'],
      ['delivered', 'read', 'read'],
      ['closed', 'read', 'read'],
      ['objection', 'read', 'read'],
      ['interrupted', 'read', 'read'],
    ]);
  });

  it('checkMode for every status', () => {
    const table = statuses.map((status) => [
      status,
      checkMode(status, true, 0),
      checkMode(status, true, 2),
      checkMode(status, false, 0),
    ]);
    expect(table).toEqual([
      ['criteria', 'read', 'read', 'read'],
      ['criteria_awaiting_signature', 'read', 'read', 'read'],
      ['period', 'period', 'period', 'read'],
      ['interview', 'approve', 'blocked', 'read'],
      ['drafted', 'approved', 'approved', 'approved'],
      ['delivered', 'approved', 'approved', 'approved'],
      ['closed', 'approved', 'approved', 'approved'],
      ['objection', 'approved', 'approved', 'approved'],
      ['interrupted', 'read', 'read', 'read'],
    ]);
  });

  describe('gradeRequestMode', () => {
    function input(
      status: EvaluationStatus,
      serviceStatus: string,
      grade: number | null,
      outcome: 'positive' | 'negative' | null,
    ) {
      return { status, snapshot: { serviceStatus, grade }, score: { outcome } } as unknown as Pick<
        EvaluationView,
        'status' | 'snapshot' | 'score'
      >;
    }

    it('gives one mode per case', () => {
      expect(gradeRequestMode(input('interview', 'employee', 3, 'positive'), true)).toBe(
        'not_civil_servant',
      );
      expect(gradeRequestMode(input('interview', 'civil_servant', 9, 'positive'), true)).toBe(
        'max_grade',
      );
      expect(gradeRequestMode(input('interview', 'civil_servant', 4, 'negative'), true)).toBe(
        'negative',
      );
      expect(gradeRequestMode(input('interview', 'civil_servant', 4, null), true)).toBe(
        'incomplete',
      );
      expect(gradeRequestMode(input('interview', 'civil_servant', 4, 'positive'), true)).toBe(
        'form',
      );
      expect(gradeRequestMode(input('period', 'civil_servant', 4, 'positive'), true)).toBe('form');
      expect(gradeRequestMode(input('interview', 'civil_servant', 4, 'positive'), false)).toBe(
        'read',
      );
      expect(gradeRequestMode(input('drafted', 'civil_servant', 4, 'positive'), true)).toBe('read');
    });

    it('needs a grade in the data of a civil servant', () => {
      expect(gradeRequestMode(input('interview', 'civil_servant', null, 'positive'), true)).toBe(
        'no_grade',
      );
      expect(gradeRequestMode(input('interview', 'employee', null, 'positive'), true)).toBe(
        'not_civil_servant',
      );
    });
  });

  describe('canRemoveGradeRequest', () => {
    function withRequest(
      status: EvaluationStatus,
      serviceStatus: string,
      grade: number | null,
      outcome: 'positive' | 'negative' | null,
      requested: boolean,
    ) {
      return {
        status,
        snapshot: { serviceStatus, grade },
        score: { outcome },
        sheet: {
          content: {
            partTwo: { gradeRequest: requested ? { requestedGrade: 5, motivation: 'M' } : null },
          },
        },
      } as unknown as Parameters<typeof canRemoveGradeRequest>[0];
    }

    it('offers the removal when a saved request is no longer allowed', () => {
      expect(
        canRemoveGradeRequest(withRequest('interview', 'civil_servant', 4, 'negative', true), true),
      ).toBe(true);
      expect(
        canRemoveGradeRequest(withRequest('period', 'employee', 4, 'positive', true), true),
      ).toBe(true);
      expect(
        canRemoveGradeRequest(withRequest('interview', 'civil_servant', 9, 'positive', true), true),
      ).toBe(true);
    });

    it('does not offer it without a request, in the form, read only or after approval', () => {
      expect(
        canRemoveGradeRequest(
          withRequest('interview', 'civil_servant', 4, 'negative', false),
          true,
        ),
      ).toBe(false);
      expect(
        canRemoveGradeRequest(withRequest('interview', 'civil_servant', 4, 'positive', true), true),
      ).toBe(false);
      expect(
        canRemoveGradeRequest(
          withRequest('interview', 'civil_servant', 4, 'negative', true),
          false,
        ),
      ).toBe(false);
      expect(
        canRemoveGradeRequest(withRequest('drafted', 'civil_servant', 4, 'negative', true), true),
      ).toBe(false);
    });
  });
});

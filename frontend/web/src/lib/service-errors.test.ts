import { type ApprovalIssue } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import {
  approvalIssueItems,
  approvalIssueMessage,
  approvalIssueCodes,
  serviceErrorCodes,
  serviceErrorMessage,
} from './service-errors';

/** Codes the plan names explicitly. The `Record` in service-errors.ts covers the rest of the union. */
const planCodes = [
  'invalid_transition',
  'approval_blocked',
  'criteria_invalid',
  'part_locked',
  'stale_status',
  'objection_late',
  'objection_lowers_outcome',
  'term_change_invalid',
  'forbidden',
  'invalid_evaluator',
  'no_locked_sheet',
  'not_found',
  'sensitive_data',
  'ai_disabled',
  'ai_run_not_done',
  'ai_fragment_unknown',
  'not_eligible',
  'regulation_invalid',
  'regulation_not_draft',
];

const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(nie|jest|ta|ten|z|w|do|dla|je|albo|i)\b/;
/** UI rules: no en or em dashes, semicolons, ellipses. */
const FORBIDDEN = /[–—;…]/;

describe('serviceErrorMessage', () => {
  it('covers every code the plan lists', () => {
    expect(serviceErrorCodes).toEqual(expect.arrayContaining(planCodes));
  });

  it.each(serviceErrorCodes)('gives a Polish sentence for %s', (code) => {
    const message = serviceErrorMessage(code);
    expect(message.trim().length).toBeGreaterThan(10);
    expect(message).toMatch(POLISH);
    expect(message).not.toMatch(FORBIDDEN);
    expect(message.endsWith('.')).toBe(true);
  });

  it('falls back for an unknown code', () => {
    expect(serviceErrorMessage('something_new')).toMatch(/Spróbuj ponownie/);
  });

  it('explains why a supervisor cannot be set', () => {
    expect(serviceErrorMessage('invalid_supervisor', { reason: 'cycle' })).toMatch(/podwładnym/);
    expect(serviceErrorMessage('invalid_supervisor', { reason: 'self' })).toMatch(
      /swoim przełożonym/,
    );
    expect(serviceErrorMessage('invalid_supervisor', { reason: 'other_office' })).toMatch(/urzędu/);
    expect(serviceErrorMessage('invalid_supervisor', { reason: 'not_allowed' })).toMatch(/kadry/);
    expect(serviceErrorMessage('invalid_supervisor', { reason: 'new_one' })).toMatch(/przełożon/);
  });

  it('explains why an employee is not eligible', () => {
    expect(serviceErrorMessage('not_eligible', { reason: 'fixed_term' })).toMatch(/czas określony/);
    expect(serviceErrorMessage('not_eligible', { reason: 'employment_ended' })).toMatch(/ustało/);
    expect(serviceErrorMessage('not_eligible', { reason: 'evaluation_in_progress' })).toMatch(
      /w toku/,
    );
  });

  it('names the passed objection deadline in dd.mm.rrrr', () => {
    expect(serviceErrorMessage('objection_late', { dueOn: '2026-11-30' })).toContain('30.11.2026');
  });

  it('explains a rejected term change', () => {
    expect(serviceErrorMessage('term_change_invalid', ['term_change_after_negative'])).toMatch(
      /negatywn/,
    );
  });
});

const sampleIssues: ApprovalIssue[] = approvalIssueCodes.map((code) => ({
  code,
  criterionId: 'knowledge-use',
}));

describe('approvalIssueMessage', () => {
  it.each(sampleIssues)('maps $code to a field and a Polish message', (issue) => {
    const { fieldId, message } = approvalIssueMessage(issue);
    expect(fieldId).toMatch(/^[a-zA-Z][\w-]*$/);
    expect(message).toMatch(POLISH);
    expect(message).not.toMatch(FORBIDDEN);
  });

  it('links a missing rating to the tile of its criterion and names it', () => {
    const result = approvalIssueMessage(
      { code: 'rating_missing', criterionId: 'knowledge-use' },
      (id) => (id === 'knowledge-use' ? 'Wykorzystywanie wiedzy' : id),
    );
    expect(result.fieldId).toBe('rating-knowledge-use');
    expect(result.message).toContain('Wykorzystywanie wiedzy');
  });

  it('links missing conclusions to the conclusions field', () => {
    expect(approvalIssueMessage({ code: 'development_conclusions_missing' })).toEqual({
      fieldId: 'developmentConclusions',
      message: 'Wpisz wnioski do indywidualnego programu rozwoju zawodowego (IPRZ).',
    });
  });
});

describe('approvalIssueItems', () => {
  it('turns a gate preview into summary items with form ids, without duplicates', () => {
    const items = approvalIssueItems(
      [{ code: 'development_conclusions_missing' }, { code: 'too_many' }, { code: 'too_many' }],
      undefined,
      { developmentConclusions: 'conclusions' },
    );
    expect(items.map((item) => item.fieldId)).toEqual(['conclusions', 'additionalCriteria']);
  });
});

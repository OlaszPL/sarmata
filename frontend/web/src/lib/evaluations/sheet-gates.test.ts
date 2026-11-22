import { type ApprovalIssue } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { fieldErrorLinks, gateHref, gateLinks, gateTab, gateTitle } from './sheet-gates';

describe('sheet gates', () => {
  it('maps fields to tabs', () => {
    expect(gateTab('rating-reliability')).toBe('czesc-2');
    expect(gateTab('interviewOn')).toBe('czesc-2');
    expect(gateTab('gradeRequest')).toBe('czesc-3');
    expect(gateTab('dueOn')).toBe('czesc-1');
    expect(gateTab('closedOn')).toBeNull();
  });

  it('builds the href of a field on its tab', () => {
    expect(gateHref('e1', 'developmentConclusions')).toBe(
      '/oceny/e1/czesc-2#developmentConclusions',
    );
    expect(gateHref('e1', 'gradeRequestMotivation')).toMatch(/\/czesc-3#gradeRequestMotivation$/);
    expect(gateHref('e1', 'closedOn')).toBeNull();
  });

  it('declines the title', () => {
    expect(gateTitle(1)).toBe('Zanim zatwierdzisz ocenę, uzupełnij 1 pole');
    expect(gateTitle(2)).toBe('Zanim zatwierdzisz ocenę, uzupełnij 2 pola');
    expect(gateTitle(5)).toBe('Zanim zatwierdzisz ocenę, uzupełnij 5 pól');
  });

  const issues = [
    { code: 'development_conclusions_missing' },
    { code: 'rating_missing', criterionId: 'reliability' },
    { code: 'grade_request_not_allowed' },
  ] as ApprovalIssue[];

  it('links fields of other tabs and keeps fields of the current tab as ids', () => {
    const onPartTwo = gateLinks('e1', issues, () => 'Rzetelność', 'czesc-2');
    expect(onPartTwo).toHaveLength(3);
    expect(onPartTwo[0]).toEqual({
      fieldId: 'developmentConclusions',
      message: expect.any(String) as string,
    });
    expect(onPartTwo[1]).toMatchObject({ fieldId: 'rating-reliability' });
    expect(onPartTwo[1]).not.toHaveProperty('href');
    expect(onPartTwo[1]?.message).toContain('Rzetelność');
    expect(onPartTwo[2]).toMatchObject({
      fieldId: 'gradeRequest',
      href: '/oceny/e1/czesc-3#gradeRequest',
    });
  });

  it('links every sheet field from the check page', () => {
    const onCheck = gateLinks('e1', issues, () => 'Rzetelność', 'sprawdz');
    expect(onCheck.map((item) => item.href)).toEqual([
      '/oceny/e1/czesc-2#developmentConclusions',
      '/oceny/e1/czesc-2#rating-reliability',
      '/oceny/e1/czesc-3#gradeRequest',
    ]);
  });

  it('keeps only the field id for fields without a tab', () => {
    const links = gateLinks(
      'e1',
      [{ code: 'objection_window_open' }] as ApprovalIssue[],
      (id) => id,
      'sprawdz',
    );
    expect(links[0]).toEqual({ fieldId: 'closedOn', message: expect.any(String) as string });
    expect(fieldErrorLinks('e1', { draftedOn: 'x' }, 'sprawdz')).toEqual([
      { fieldId: 'draftedOn', message: 'x' },
    ]);
  });

  it('links field errors to their tab and skips empty ones', () => {
    expect(fieldErrorLinks('e1', { justification: 'Wpisz', other: undefined }, 'sprawdz')).toEqual([
      { fieldId: 'justification', message: 'Wpisz', href: '/oceny/e1/czesc-2#justification' },
    ]);
    expect(fieldErrorLinks('e1', { justification: 'Wpisz' }, 'czesc-2')).toEqual([
      { fieldId: 'justification', message: 'Wpisz' },
    ]);
  });
});

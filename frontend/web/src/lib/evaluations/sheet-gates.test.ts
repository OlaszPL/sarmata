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

  it('turns issues into links with the criterion name', () => {
    const issues = [
      { code: 'development_conclusions_missing' },
      { code: 'rating_missing', criterionId: 'reliability' },
    ] as ApprovalIssue[];
    const links = gateLinks('e1', issues, () => 'Rzetelność');
    expect(links).toHaveLength(2);
    expect(links[0]?.href).toBe('/oceny/e1/czesc-2#developmentConclusions');
    expect(links[1]).toMatchObject({ href: '/oceny/e1/czesc-2#rating-reliability' });
    expect(links[1]?.message).toContain('Rzetelność');
  });

  it('keeps the field anchor for fields without a tab', () => {
    const links = gateLinks(
      'e1',
      [{ code: 'objection_window_open' }] as ApprovalIssue[],
      (id) => id,
    );
    expect(links[0]?.href).toBe('#closedOn');
    expect(fieldErrorLinks('e1', { draftedOn: 'x' })).toEqual([
      { href: '#draftedOn', message: 'x' },
    ]);
  });

  it('links field errors to their tab and skips empty ones', () => {
    expect(fieldErrorLinks('e1', { justification: 'Wpisz', other: undefined })).toEqual([
      { href: '/oceny/e1/czesc-2#justification', message: 'Wpisz' },
    ]);
  });
});

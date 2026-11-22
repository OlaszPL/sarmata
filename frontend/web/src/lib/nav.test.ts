import { describe, expect, it } from 'vitest';
import { canStartEvaluation, navForRole } from './nav';

const evaluatorItems = [
  { href: '/', label: 'Pulpit' },
  { href: '/pracownicy', label: 'Moi pracownicy' },
  { href: '/oceny', label: 'Oceny' },
  { href: '/notatki', label: 'Notatki' },
];

describe('navForRole', () => {
  it('gives the evaluator the working sections', () => {
    expect(navForRole('evaluator')).toEqual(evaluatorItems);
  });

  it('adds HR to the evaluator sections for hr', () => {
    expect(navForRole('hr')).toEqual([...evaluatorItems, { href: '/kadry', label: 'Kadry' }]);
  });

  it('gives admin the settings and the AI log, no dashboard', () => {
    expect(navForRole('admin')).toEqual([
      { href: '/ustawienia', label: 'Ustawienia' },
      { href: '/dziennik-ai', label: 'Dziennik AI' },
    ]);
  });
});

describe('canStartEvaluation', () => {
  it('is false only for admin', () => {
    expect(canStartEvaluation('admin')).toBe(false);
    expect(canStartEvaluation('hr')).toBe(true);
    expect(canStartEvaluation('evaluator')).toBe(true);
  });
});

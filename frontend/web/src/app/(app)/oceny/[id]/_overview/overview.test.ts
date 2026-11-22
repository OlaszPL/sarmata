import { type EvaluationView, calendarDate } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { type NextStep } from '@/lib/evaluations/next-step';
import { routes } from '@/lib/routes';
import { issueTab, stepCard, warningText } from './overview';

const today = calendarDate('2026-11-22');

function view(status: string): EvaluationView {
  return { id: 'e1', status } as unknown as EvaluationView;
}

function step(overrides: Partial<NextStep> = {}): NextStep {
  return {
    stage: 'Kryteria',
    action: 'Ustal kryteria',
    owner: 'evaluator',
    dueOn: null,
    missingFields: null,
    ...overrides,
  };
}

describe('stepCard', () => {
  it('links the evaluator to part I as the primary action', () => {
    const card = stepCard({
      view: view('criteria'),
      step: step({ dueOn: calendarDate('2026-11-27') }),
      canWrite: true,
      isHr: false,
      today,
    });
    expect(card).toEqual({
      stage: 'Kryteria',
      action: 'Ustal kryteria',
      who: 'Ty',
      due: '27.11.2026, za 5 dni',
      link: { href: routes.evaluationPart1('e1'), label: 'Przejdź do części I', primary: true },
    });
  });

  it('makes the objection step primary for hr', () => {
    const card = stepCard({
      view: view('objection'),
      step: step({ owner: 'hr' }),
      canWrite: false,
      isHr: true,
      today,
    });
    expect(card?.who).toBe('Kadry');
    expect(card?.link).toEqual({
      href: routes.evaluationEvents('e1'),
      label: 'Przejdź do zdarzeń',
      primary: true,
    });
  });

  it('keeps the link secondary for an admin', () => {
    const card = stepCard({
      view: view('interview'),
      step: step({ stage: 'Część II' }),
      canWrite: false,
      isHr: false,
      today,
    });
    expect(card?.who).toBe('Osoba oceniająca');
    expect(card?.link).toEqual({
      href: routes.evaluationPart2('e1'),
      label: 'Przejdź do części II',
      primary: false,
    });
  });

  it('has no link once the case is closed and says to wait when nobody acts', () => {
    const card = stepCard({
      view: view('delivered'),
      step: step({ owner: 'nobody' }),
      canWrite: true,
      isHr: false,
      today,
    });
    expect(card?.who).toBe('Nikt, wystarczy poczekać');
    expect(
      stepCard({ view: view('closed'), step: step(), canWrite: true, isHr: false, today })?.link,
    ).toBeNull();
  });

  it('returns null without a step', () => {
    expect(
      stepCard({ view: view('closed'), step: null, canWrite: true, isHr: false, today }),
    ).toBeNull();
  });
});

describe('issueTab', () => {
  it('points at the part the next approval checks', () => {
    expect(issueTab(view('criteria'))).toBe(routes.evaluationPart1('e1'));
    expect(issueTab(view('interview'))).toBe(routes.evaluationPart2('e1'));
    expect(issueTab(view('period'))).toBeNull();
  });
});

describe('warningText', () => {
  it('names the date and the article of the grade by law', () => {
    const text = warningText({ code: 'grade_due_by_law', dueOn: calendarDate('2026-12-01') });
    expect(text).toContain('01.12.2026');
    expect(text).toContain('art. 89 ust. 2');
  });

  it('names the article of the second negative evaluation', () => {
    expect(warningText({ code: 'second_consecutive_negative' })).toContain('art. 71');
  });
});

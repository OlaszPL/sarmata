import { type EvaluationView, type SheetContent } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import {
  NO_GRADE_MESSAGE,
  partTwoDefaults,
  sheetFromGradeRequestForm,
  sheetFromPartTwoForm,
} from './sheet-form';

function content(partTwo: Partial<SheetContent['partTwo']> = {}): SheetContent {
  return {
    partOne: { additionalCriteria: ['focus'], dueOn: '2026-12-04' },
    partTwo: {
      interviewOn: null,
      periodFrom: null,
      periodTo: null,
      ratings: { cooperation: 5 },
      justification: 'saved',
      developmentConclusions: '',
      gradeRequest: { requestedGrade: 5, motivation: 'old' },
      ...partTwo,
    },
  } as unknown as SheetContent;
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function view(partTwo: Partial<SheetContent['partTwo']>, heldOn?: string): EvaluationView {
  return {
    cycleStart: '2025-12-01',
    sheet: { content: content(partTwo) },
    events: heldOn
      ? [{ kind: 'evaluation_interview_held', occurredOn: heldOn }]
      : [{ kind: 'created', occurredOn: '2025-12-01' }],
  } as unknown as EvaluationView;
}

describe('sheet form', () => {
  describe('sheetFromPartTwoForm', () => {
    const criteria = ['reliability', 'cooperation'];

    it('keeps known ratings and drops unknown or empty ones', () => {
      const result = sheetFromPartTwoForm(
        content(),
        criteria,
        form({ 'rating-reliability': '7', 'rating-x': '7', 'rating-cooperation': '' }),
      );
      expect(result.partTwo.ratings).toEqual({ reliability: 7 });
    });

    it('turns an empty date into null and keeps a filled one', () => {
      const result = sheetFromPartTwoForm(
        content(),
        criteria,
        form({ interviewOn: '', periodFrom: '2026-01-02' }),
      );
      expect(result.partTwo.interviewOn).toBeNull();
      expect(result.partTwo.periodFrom).toBe('2026-01-02');
    });

    it('trims the texts at the ends', () => {
      const result = sheetFromPartTwoForm(
        content(),
        criteria,
        form({ developmentConclusions: '  tekst \n', justification: ' a ' }),
      );
      expect(result.partTwo.developmentConclusions).toBe('tekst');
      expect(result.partTwo.justification).toBe('a');
    });

    it('leaves part one and the grade request as saved', () => {
      const saved = content();
      const result = sheetFromPartTwoForm(saved, criteria, form({ justification: 'new' }));
      expect(result.partOne).toEqual(saved.partOne);
      expect(result.partTwo.gradeRequest).toEqual(saved.partTwo.gradeRequest);
    });
  });

  describe('sheetFromGradeRequestForm', () => {
    it('sets the next grade for yes', () => {
      const result = sheetFromGradeRequestForm(
        content({ gradeRequest: null }),
        4,
        form({ request: 'yes', gradeRequestMotivation: ' Powód ' }),
      );
      expect(result).toMatchObject({
        content: { partTwo: { gradeRequest: { requestedGrade: 5, motivation: 'Powód' } } },
      });
    });

    it('clears the request for no', () => {
      const result = sheetFromGradeRequestForm(content(), 4, form({ request: 'no' }));
      expect(result).toMatchObject({ content: { partTwo: { gradeRequest: null } } });
    });

    it('asks for a motivation with yes', () => {
      const result = sheetFromGradeRequestForm(
        content(),
        4,
        form({ request: 'yes', gradeRequestMotivation: '  ' }),
      );
      expect(result).toEqual({
        fieldErrors: { gradeRequestMotivation: 'Napisz umotywowanie wniosku' },
      });
    });

    it('asks for a choice', () => {
      const result = sheetFromGradeRequestForm(content(), 4, form({}));
      expect(result).toEqual({
        fieldErrors: { gradeRequest: 'Wybierz, czy składasz wniosek o stopień' },
      });
    });

    it('removes a request without a grade but refuses a new one', () => {
      const saved = content({ gradeRequest: { requestedGrade: 5, motivation: 'Powód' } });
      expect(sheetFromGradeRequestForm(saved, null, form({ request: 'no' }))).toMatchObject({
        content: { partTwo: { gradeRequest: null } },
      });
      expect(
        sheetFromGradeRequestForm(
          saved,
          null,
          form({ request: 'yes', gradeRequestMotivation: 'Powód' }),
        ),
      ).toEqual({ fieldErrors: { gradeRequest: NO_GRADE_MESSAGE } });
    });
  });

  describe('partTwoDefaults', () => {
    it('fills null dates from the cycle start and the interview event', () => {
      const defaults = partTwoDefaults(view({}, '2026-11-18'));
      expect(defaults.periodFrom).toBe('2025-12-01');
      expect(defaults.interviewOn).toBe('2026-11-18');
      expect(defaults.periodTo).toBe('2026-11-18');
    });

    it('leaves dates null without an interview event', () => {
      const defaults = partTwoDefaults(view({}));
      expect(defaults.interviewOn).toBeNull();
      expect(defaults.periodTo).toBeNull();
    });

    it('prefers saved dates', () => {
      const defaults = partTwoDefaults(
        view(
          { periodFrom: '2026-01-01', interviewOn: '2026-11-01', periodTo: '2026-11-02' } as never,
          '2026-11-18',
        ),
      );
      expect(defaults).toMatchObject({
        periodFrom: '2026-01-01',
        interviewOn: '2026-11-01',
        periodTo: '2026-11-02',
        justification: 'saved',
      });
      expect('gradeRequest' in defaults).toBe(false);
    });
  });
});

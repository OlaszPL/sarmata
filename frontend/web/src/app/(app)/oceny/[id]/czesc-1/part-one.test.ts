import {
  type CalendarDate,
  type EvaluationView,
  type RegulationDocument,
  type SheetContent,
} from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { parseForm } from '@/lib/form-action';
import { latestDueOn, partOneContent, partOneSchema } from './part-one';

const content: SheetContent = {
  partOne: { additionalCriteria: ['creativity'], dueOn: '2027-01-15' as CalendarDate },
  partTwo: {
    interviewOn: null,
    periodFrom: null,
    periodTo: null,
    ratings: { reliability: 5 },
    justification: 'Uzasadnienie',
    developmentConclusions: '',
    gradeRequest: null,
  },
};

/** Minimal regulation with the deadline slots part I reads. */
const document = {
  id: 'regulation-2016',
  deadlines: {
    startingInterview: {
      strategy: 'daysFromEvent',
      event: 'cycleStart',
      days: 30,
      shiftToWorkingDay: false,
      basis: '§ 9',
    },
    evaluationDeadline: {
      strategy: 'monthsFromEvent',
      event: 'cycleStart',
      months: 24,
      extendByAbsencesLongerThanMonth: true,
      shiftToWorkingDay: false,
      basis: 'art. 81',
    },
  },
} as unknown as RegulationDocument;

function viewWith(dueOn: string | null): EvaluationView {
  return {
    id: 'evaluation-1',
    status: 'criteria',
    cycleStart: '2026-01-01',
    afterNegative: false,
    events: [],
    deadlines: [],
    sheet: {
      version: 1,
      state: 'draft',
      content: { ...content, partOne: { ...content.partOne, dueOn } },
    },
  } as unknown as EvaluationView;
}

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe('partOneContent', () => {
  it('replaces only part one and keeps part two', () => {
    const next = partOneContent(content, {
      additionalCriteria: ['communication', 'creativity'],
      dueOn: '2026-12-31',
    });
    expect(next.partOne).toEqual({
      additionalCriteria: ['communication', 'creativity'],
      dueOn: '2026-12-31',
    });
    expect(next.partTwo).toBe(content.partTwo);
  });

  it('turns an empty due date into null', () => {
    expect(partOneContent(content, { additionalCriteria: [], dueOn: '' }).partOne.dueOn).toBeNull();
  });
});

describe('partOneSchema', () => {
  it('requires the starting interview date to approve', () => {
    const result = parseForm(
      partOneSchema,
      form([
        ['intent', 'approve'],
        ['additionalCriteria', 'creativity'],
        ['dueOn', ''],
        ['startingInterviewOn', ''],
        ['place', ''],
      ]),
    );
    expect('state' in result && result.state.fieldErrors.startingInterviewOn).toBe(
      'Wpisz datę rozmowy rozpoczynającej',
    );
  });

  it('saves without the starting interview date and reads one checkbox as a list', () => {
    const result = parseForm(
      partOneSchema,
      form([
        ['intent', 'save'],
        ['additionalCriteria', 'creativity'],
        ['dueOn', ''],
        ['startingInterviewOn', ''],
        ['place', ''],
      ]),
    );
    expect('data' in result && result.data.additionalCriteria).toEqual(['creativity']);
  });

  it('rejects a date that does not exist', () => {
    const result = parseForm(
      partOneSchema,
      form([
        ['intent', 'save'],
        ['dueOn', '2026-02-30'],
      ]),
    );
    expect('state' in result && result.state.fieldErrors.dueOn).toBe(
      'Wpisz datę w formacie dd.mm.rrrr',
    );
  });
});

describe('latestDueOn', () => {
  it('gives the deadline from the regulation whatever due date part I has set', () => {
    expect(latestDueOn(viewWith('2026-06-30'), document)).toBe('2028-01-01');
    expect(latestDueOn(viewWith(null), document)).toBe('2028-01-01');
  });
});

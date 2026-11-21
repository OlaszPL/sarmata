import {
  calendarDate,
  emptySheetContent,
  partOneIssues,
  sheetApprovalIssues,
  sheetCriteria,
  type SheetContent,
} from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

const first = officialRegulations[0];
if (!first) throw new Error('missing official regulation');
const regulation = first;

const extraCriteria = (sheetId: string, count: number): string[] => {
  const mandatory =
    regulation.sheets.find((sheet) => sheet.id === sheetId)?.mandatoryCriteria ?? [];
  return regulation.criteria.catalog
    .map((criterion) => criterion.id)
    .filter((id) => !mandatory.includes(id))
    .slice(0, count);
};

function contentFor(
  sheetId: string,
  points: readonly number[],
  partTwo: Partial<SheetContent['partTwo']> = {},
): SheetContent {
  const mandatory = sheetCriteria(regulation, sheetId, []).length;
  const additional = extraCriteria(sheetId, points.length - mandatory);
  const criteria = sheetCriteria(regulation, sheetId, additional);
  const content = emptySheetContent();
  content.partOne.additionalCriteria = additional;
  content.partTwo = {
    ...content.partTwo,
    interviewOn: calendarDate('2026-03-01'),
    ratings: Object.fromEntries(criteria.map((id, index) => [id, points[index] ?? 0])),
    justification: 'Justified.',
    developmentConclusions: 'Training in negotiation.',
    ...partTwo,
  };
  return content;
}

const issueCodes = (input: Parameters<typeof sheetApprovalIssues>[0]) =>
  sheetApprovalIssues(input).map((issue) => issue.code);

const servant = { serviceStatus: 'civil_servant', grade: 4 } as const;

describe('sheetApprovalIssues', () => {
  it('reports an off-scale rating instead of throwing', () => {
    const content = contentFor('C', [5, 5, 5, 5, 5]);
    content.partTwo.ratings.reliability = 4;
    const issues = sheetApprovalIssues({ regulation, sheetId: 'C', content, evaluated: servant });
    expect(issues).toContainEqual({ code: 'rating_out_of_scale', criterionId: 'reliability' });
  });

  it('flags an empty justification for a negative result (EX-4 ratings)', () => {
    const content = contentFor('C', [5, 1, 5, 5, 5], { justification: '' });
    expect(issueCodes({ regulation, sheetId: 'C', content, evaluated: servant })).toEqual([
      'justification_missing',
    ]);
  });

  it('flags empty development conclusions also for a positive result', () => {
    const content = contentFor('B', [9, 5, 7, 7, 7, 5, 7, 7], { developmentConclusions: ' ' });
    expect(issueCodes({ regulation, sheetId: 'B', content, evaluated: servant })).toEqual([
      'development_conclusions_missing',
    ]);
  });

  it('flags missing ratings and interview date', () => {
    const content = emptySheetContent();
    content.partTwo.developmentConclusions = 'x';
    const codes = issueCodes({ regulation, sheetId: 'C', content, evaluated: servant });
    expect(codes).toContain('rating_missing');
    expect(codes).toContain('interview_date_missing');
  });

  it('rejects a grade request for an employee', () => {
    const content = contentFor('B', [9, 5, 7, 7, 7, 5, 7, 7], {
      gradeRequest: { requestedGrade: 5, motivation: 'Great work.' },
    });
    expect(
      issueCodes({
        regulation,
        sheetId: 'B',
        content,
        evaluated: { serviceStatus: 'employee', grade: 4 },
      }),
    ).toEqual(['grade_request_not_allowed']);
  });

  it('rejects a grade request above the maximum grade', () => {
    const content = contentFor('B', [9, 5, 7, 7, 7, 5, 7, 7], {
      gradeRequest: { requestedGrade: 10, motivation: 'Great work.' },
    });
    expect(
      issueCodes({
        regulation,
        sheetId: 'B',
        content,
        evaluated: { serviceStatus: 'civil_servant', grade: 9 },
      }),
    ).toEqual(['grade_request_max_grade']);
  });

  it('flags a wrong requested grade and a missing motivation', () => {
    const content = contentFor('B', [9, 5, 7, 7, 7, 5, 7, 7], {
      gradeRequest: { requestedGrade: 6, motivation: '' },
    });
    expect(issueCodes({ regulation, sheetId: 'B', content, evaluated: servant })).toEqual([
      'grade_request_wrong_grade',
      'grade_request_motivation_missing',
    ]);
  });

  it('accepts a complete EX-2 sheet with a grade IV to V request', () => {
    const content = contentFor('B', [9, 5, 7, 7, 7, 5, 7, 7], {
      gradeRequest: { requestedGrade: 5, motivation: 'Consistently above expectations.' },
    });
    expect(sheetApprovalIssues({ regulation, sheetId: 'B', content, evaluated: servant })).toEqual(
      [],
    );
  });
});

describe('partOneIssues', () => {
  it('flags a due date later than computed', () => {
    const content = emptySheetContent();
    content.partOne.dueOn = calendarDate('2026-07-15');
    expect(
      partOneIssues(regulation, 'C', content, calendarDate('2026-06-30')).map((i) => i.code),
    ).toEqual(['due_after_deadline']);
  });

  it('reports additional criteria issues', () => {
    const content = emptySheetContent();
    content.partOne.additionalCriteria = ['nonexistent'];
    expect(partOneIssues(regulation, 'C', content, null).map((i) => i.code)).toEqual(['unknown']);
  });
});

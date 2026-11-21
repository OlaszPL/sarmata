import type { CalendarDate } from '../deadlines/calendar-date';
import type { RegulationDocument } from '../regulations/regulation-document';
import type { ServiceStatus } from '../employees/employee';
import { additionalCriteriaIssues, sheetCriteria, type CriteriaIssue } from './criteria';
import { scoreSheet } from './score';
import type { SheetContent } from './sheet-content';

export interface ApprovalIssue {
  code:
    | CriteriaIssue['code']
    | 'due_after_deadline'
    | 'rating_missing'
    | 'development_conclusions_missing'
    | 'justification_missing'
    | 'grade_request_not_allowed'
    | 'grade_request_max_grade'
    | 'grade_request_motivation_missing'
    | 'grade_request_wrong_grade'
    | 'interview_date_missing';
  criterionId?: string;
}

const MAX_GRADE = 9;

/** Gate for approving part one: criteria limits and the due date against the computed deadline. */
export function partOneIssues(
  regulation: RegulationDocument,
  sheetId: string,
  content: SheetContent,
  computedDue: CalendarDate | null,
): ApprovalIssue[] {
  const issues: ApprovalIssue[] = additionalCriteriaIssues(
    regulation,
    sheetId,
    content.partOne.additionalCriteria,
  );
  const { dueOn } = content.partOne;
  if (dueOn !== null && computedDue !== null && dueOn > computedDue)
    issues.push({ code: 'due_after_deadline' });
  return issues;
}

/** Gate for approving the whole sheet (part two). Returns the list of problems, never throws on them. */
export function sheetApprovalIssues(input: {
  regulation: RegulationDocument;
  sheetId: string;
  content: SheetContent;
  evaluated: { serviceStatus: ServiceStatus; grade: number | null };
}): ApprovalIssue[] {
  const { regulation, sheetId, content, evaluated } = input;
  const { partTwo } = content;
  const issues: ApprovalIssue[] = [];

  const criteria = sheetCriteria(regulation, sheetId, content.partOne.additionalCriteria);
  for (const id of criteria) {
    if (partTwo.ratings[id] === undefined) issues.push({ code: 'rating_missing', criterionId: id });
  }
  const score = scoreSheet(regulation, criteria, partTwo.ratings);

  if (partTwo.developmentConclusions.trim() === '')
    issues.push({ code: 'development_conclusions_missing' });
  if (
    score.outcome === 'negative' &&
    regulation.justification.requiredForNegative &&
    partTwo.justification.trim() === ''
  )
    issues.push({ code: 'justification_missing' });
  if (partTwo.interviewOn === null) issues.push({ code: 'interview_date_missing' });

  const request = partTwo.gradeRequest;
  if (request !== null) {
    if (evaluated.serviceStatus !== 'civil_servant' || score.outcome !== 'positive') {
      issues.push({ code: 'grade_request_not_allowed' });
    } else {
      if (evaluated.grade === MAX_GRADE) issues.push({ code: 'grade_request_max_grade' });
      else if (evaluated.grade !== null && request.requestedGrade !== evaluated.grade + 1)
        issues.push({ code: 'grade_request_wrong_grade' });
      if (request.motivation.trim() === '')
        issues.push({ code: 'grade_request_motivation_missing' });
    }
  }
  return issues;
}

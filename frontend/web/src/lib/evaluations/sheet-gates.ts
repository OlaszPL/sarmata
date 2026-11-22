import { type ApprovalIssue } from '@sarmata/services';
import { pluralPl } from '@/lib/format';
import { routes } from '@/lib/routes';
import { approvalIssueItems } from '@/lib/service-errors';

export type SheetTab = 'czesc-1' | 'czesc-2' | 'czesc-3';

const part2Fields = new Set([
  'interviewOn',
  'periodFrom',
  'periodTo',
  'justification',
  'developmentConclusions',
]);
const part3Fields = new Set(['gradeRequest', 'gradeRequestMotivation', 'requestedGrade']);
const part1Fields = new Set(['additionalCriteria', 'dueOn']);

/** The sheet tab that holds the control of a gate field, `null` for fields outside the sheet. */
export function gateTab(fieldId: string): SheetTab | null {
  if (fieldId.startsWith('rating-') || part2Fields.has(fieldId)) return 'czesc-2';
  if (part3Fields.has(fieldId)) return 'czesc-3';
  if (part1Fields.has(fieldId)) return 'czesc-1';
  return null;
}

const tabRoutes: Record<SheetTab, (id: string) => string> = {
  'czesc-1': routes.evaluationPart1,
  'czesc-2': routes.evaluationPart2,
  'czesc-3': routes.evaluationPart3,
};

export function gateHref(evaluationId: string, fieldId: string): string | null {
  const tab = gateTab(fieldId);
  return tab === null ? null : `${tabRoutes[tab](evaluationId)}#${fieldId}`;
}

export function gateTitle(count: number): string {
  return `Zanim zatwierdzisz ocenę, uzupełnij ${count} ${pluralPl(count, 'pole', 'pola', 'pól')}`;
}

export interface GateLink {
  href: string;
  message: string;
}

/** approvalIssueItems + gateHref, items without a tab keep `#fieldId`. */
export function gateLinks(
  evaluationId: string,
  issues: readonly ApprovalIssue[],
  criterionName: (id: string) => string,
): GateLink[] {
  return approvalIssueItems(issues, criterionName).map(({ fieldId, message }) => ({
    href: gateHref(evaluationId, fieldId) ?? `#${fieldId}`,
    message,
  }));
}

/** Field errors of a FormState (approve action) as links, fieldId -> gateHref ?? `#fieldId`. */
export function fieldErrorLinks(
  evaluationId: string,
  fieldErrors: Partial<Record<string, string>>,
): GateLink[] {
  return Object.entries(fieldErrors).flatMap(([fieldId, message]) =>
    message === undefined
      ? []
      : [{ href: gateHref(evaluationId, fieldId) ?? `#${fieldId}`, message }],
  );
}

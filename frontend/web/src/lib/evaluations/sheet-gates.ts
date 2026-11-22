import { type ApprovalIssue } from '@sarmata/services';
import type { ErrorSummaryItem } from '@sarmata/ui';
import { pluralPl } from '@/lib/format';
import { routes } from '@/lib/routes';
import { approvalIssueItems } from '@/lib/service-errors';

export type SheetTab = 'czesc-1' | 'czesc-2' | 'czesc-3';

/** The page that shows an error summary: a sheet tab or the check page. */
export type SheetPage = SheetTab | 'sprawdz';

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

/** An item of `ErrorSummary`: a field on another tab gets `href`, a field on this page only its id. */
export type GateLink = ErrorSummaryItem;

function gateLink(
  evaluationId: string,
  fieldId: string,
  message: string,
  currentPage: SheetPage,
): GateLink {
  const tab = gateTab(fieldId);
  if (tab === null || tab === currentPage) return { fieldId, message };
  return { fieldId, message, href: `${tabRoutes[tab](evaluationId)}#${fieldId}` };
}

/** Gate issues as summary items. Fields of `currentPage` and fields outside the sheet keep no href. */
export function gateLinks(
  evaluationId: string,
  issues: readonly ApprovalIssue[],
  criterionName: (id: string) => string,
  currentPage: SheetPage,
): GateLink[] {
  return approvalIssueItems(issues, criterionName).map(({ fieldId, message }) =>
    gateLink(evaluationId, fieldId, message, currentPage),
  );
}

/** Field errors of a FormState (e.g. the approve action) as summary items, empty ones skipped. */
export function fieldErrorLinks(
  evaluationId: string,
  fieldErrors: Partial<Record<string, string>>,
  currentPage: SheetPage,
): GateLink[] {
  return Object.entries(fieldErrors).flatMap(([fieldId, message]) =>
    message === undefined ? [] : [gateLink(evaluationId, fieldId, message, currentPage)],
  );
}

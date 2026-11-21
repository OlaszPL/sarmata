import type { RegulationDocument } from '../regulations/regulation-document';

export interface CriteriaIssue {
  code: 'too_many' | 'duplicate' | 'mandatory_as_additional' | 'unknown';
  criterionId?: string;
}

function sheetOf(regulation: RegulationDocument, sheetId: string) {
  const sheet = regulation.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw new RangeError(`Unknown sheet ${sheetId}`);
  return sheet;
}

/** Criteria of a sheet in rating order: mandatory ones as in the regulation, then the additional ones. */
export function sheetCriteria(
  regulation: RegulationDocument,
  sheetId: string,
  additional: readonly string[],
): string[] {
  return [...sheetOf(regulation, sheetId).mandatoryCriteria, ...additional];
}

/** Checks the additional criteria chosen by the evaluator against the limits of the regulation. */
export function additionalCriteriaIssues(
  regulation: RegulationDocument,
  sheetId: string,
  ids: readonly string[],
): CriteriaIssue[] {
  const sheet = sheetOf(regulation, sheetId);
  const rules = regulation.additionalCriteria;
  const catalog = new Set(regulation.criteria.catalog.map((criterion) => criterion.id));
  const issues: CriteriaIssue[] = [];
  if (ids.length > rules.max) issues.push({ code: 'too_many' });
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push({ code: 'duplicate', criterionId: id });
      continue;
    }
    seen.add(id);
    if (!catalog.has(id)) {
      issues.push({ code: 'unknown', criterionId: id });
    } else if (!rules.fromMandatoryAllowed && sheet.mandatoryCriteria.includes(id)) {
      issues.push({ code: 'mandatory_as_additional', criterionId: id });
    }
  }
  return issues;
}

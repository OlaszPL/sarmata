import type { PositionKind } from '../employees/employee';
import type { RegulationDocument } from '../regulations/regulation-document';

const REGULATION_SPELLING = {
  office_head: 'office-head',
  manages_people: 'manages-people',
  other: 'other',
} as const satisfies Record<PositionKind, string>;

/** Id of the sheet that applies to a position kind in the given regulation version. */
export function proposeSheet(regulation: RegulationDocument, positionKind: PositionKind): string {
  const sheet = regulation.sheets.find(
    (candidate) => candidate.positionKind === REGULATION_SPELLING[positionKind],
  );
  if (!sheet) throw new RangeError(`No sheet for position kind ${positionKind}`);
  return sheet.id;
}

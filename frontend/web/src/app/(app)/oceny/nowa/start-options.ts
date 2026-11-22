import {
  type Employee,
  type Evaluation,
  type PositionKind,
  type RegulationDocument,
} from '@sarmata/services';
import { z } from 'zod';

/**
 * Why an employee cannot start an evaluation now, shown under the name on the picker. The service
 * decides for real (`not_eligible`), this is only a hint before the choice.
 */
export function eligibilityNote(
  employee: Pick<Employee, 'employmentBasis' | 'employmentEndedOn'>,
  open: Pick<Evaluation, 'status'> | null,
): string | null {
  if (open) return 'Ma ocenę w toku';
  if (employee.employmentBasis === 'fixed_term')
    return 'Umowa na czas określony, nie podlega ocenie';
  if (employee.employmentEndedOn) return 'Zatrudnienie ustało';
  return null;
}

type SheetPositionKind = RegulationDocument['sheets'][number]['positionKind'];

/** The employee position kind as the regulation document spells it. */
const sheetPositionKinds: Record<PositionKind, SheetPositionKind> = {
  office_head: 'office-head',
  manages_people: 'manages-people',
  other: 'other',
};

export interface SheetOption {
  id: string;
  label: string;
  hint: string;
  proposed: boolean;
}

/** One option per sheet of the regulation, the one proposed for the position kind first. */
export function sheetOptions(
  document: RegulationDocument,
  positionKind: PositionKind,
): SheetOption[] {
  const wanted = sheetPositionKinds[positionKind];
  const options = document.sheets.map((sheet) => ({
    id: sheet.id,
    label: `Arkusz ${sheet.id}`,
    hint: sheet.position,
    proposed: sheet.positionKind === wanted,
  }));
  return [...options.filter((option) => option.proposed), ...options.filter((o) => !o.proposed)];
}

export const startSchema = z.object({
  employeeId: z.uuid({ error: 'Wybierz pracownika' }),
  sheetId: z.string().regex(/^[A-Z]$/, { error: 'Wybierz arkusz' }),
});

export type StartInput = z.infer<typeof startSchema>;

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

/** Lower case without Polish diacritics, so "oceniajaca" matches "Oceniająca". */
function folded(text: string): string {
  return text
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l');
}

/**
 * Employees for the search on the picker: first those whose name contains the search (a first
 * name alone works), then the typo-tolerant matches of `employees.findSimilar` (`similarIds`, best
 * first). The similarity search alone misses a short fragment such as "Ewa".
 */
export function searchEmployees<T extends Pick<Employee, 'id' | 'firstName' | 'lastName'>>(
  employees: readonly T[],
  similarIds: readonly string[],
  search: string,
): T[] {
  const needle = folded(search.trim());
  const direct = employees.filter((employee) => {
    const name = folded(`${employee.firstName} ${employee.lastName}`);
    const reversed = folded(`${employee.lastName} ${employee.firstName}`);
    return needle !== '' && (name.includes(needle) || reversed.includes(needle));
  });
  const seen = new Set(direct.map((employee) => employee.id));
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const similar = similarIds.flatMap((id) => {
    const employee = byId.get(id);
    if (employee === undefined || seen.has(id)) return [];
    seen.add(id);
    return [employee];
  });
  return [...direct, ...similar];
}

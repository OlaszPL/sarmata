import type { ColumnMapping, ImportField, RowDecision, RowPreview } from '@sarmata/services';
import type { TagTone } from '@sarmata/ui';

/** Polish labels of the import fields, in the order the mapping step lists them. */
export const importFieldLabels: Record<ImportField, string> = {
  firstName: 'Imię',
  lastName: 'Nazwisko',
  email: 'Adres e-mail',
  positionTitle: 'Stanowisko',
  orgUnit: 'Komórka organizacyjna',
  positionKind: 'Rodzaj stanowiska',
  serviceStatus: 'Status w służbie cywilnej',
  employmentBasis: 'Podstawa zatrudnienia',
  employmentStart: 'Data nawiązania stosunku pracy',
  appointmentYear: 'Rok mianowania',
  grade: 'Stopień służbowy',
  gradeGrantedOn: 'Data przyznania stopnia',
  supervisorEmployeeId: 'Przełożony (identyfikator)',
};

export const importFieldKeys = Object.keys(importFieldLabels) as ImportField[];

export const actionLabels: Record<RowPreview['proposedAction'], { label: string; tone: TagTone }> =
  {
    create: { label: 'Nowy pracownik', tone: 'progress' },
    update: { label: 'Aktualizacja', tone: 'neutral' },
    needs_decision: { label: 'Wymaga decyzji', tone: 'attention' },
    invalid: { label: 'Błąd', tone: 'attention' },
  };

/** Column mapping from the `map.<field>` selects. An empty value means the field is not imported. */
export function mappingFromForm(formData: FormData): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const field of importFieldKeys) {
    const value = formData.get(`map.${field}`);
    if (typeof value === 'string' && value !== '') mapping[field] = value;
  }
  return mapping;
}

/** Decisions from the `decision.<row>` radios: `create`, `skip` or `update:<employeeId>`. */
export function decisionsFromForm(formData: FormData): Record<number, RowDecision> {
  const decisions: Record<number, RowDecision> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('decision.') || typeof value !== 'string') continue;
    const row = Number(key.slice('decision.'.length));
    if (!Number.isInteger(row)) continue;
    if (value === 'create' || value === 'skip') decisions[row] = value;
    else if (value.startsWith('update:') && value.length > 'update:'.length) {
      decisions[row] = { updateEmployeeId: value.slice('update:'.length) };
    }
  }
  return decisions;
}

import type {
  ColumnMapping,
  ImportField,
  ImportRowErrorCode,
  RowDecision,
  RowError,
  RowPreview,
} from '@sarmata/services';
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

/** A failed row without row errors, e.g. a write rejected for a reason the backend does not name. */
export const FAILED_ROW_TEXT = 'nie zapisano, popraw dane w pliku i zaimportuj go ponownie';

/** What is wrong with a value, by the stable code of the row error. */
const rowErrorCodeTexts: Record<ImportRowErrorCode, string> = {
  missing_field: 'brak wartości',
  invalid_date: 'nieprawidłowa data',
  unknown_value: 'wartość spoza listy dozwolonych',
  not_a_number: 'wpisz liczbę',
  out_of_range: 'wartość poza dozwolonym zakresem',
  civil_servant_only: 'dotyczy tylko urzędników służby cywilnej',
  invalid_format: 'nieprawidłowy format',
  duplicate_email: 'powtarza się wcześniej w pliku',
  unknown_supervisor: 'takiego przełożonego nie ma w urzędzie',
  invalid_supervisor: 'tego przełożonego nie można ustawić',
  write_failed: 'nie udało się zapisać',
  invalid_value: 'nieprawidłowa wartość',
};

/** A row error for the user: the Polish field label and what is wrong, from the error code. */
export function rowErrorText(error: RowError): string {
  const text = rowErrorCodeTexts[error.code];
  if (error.field === null) return text.charAt(0).toUpperCase() + text.slice(1);
  return `${importFieldLabels[error.field]}: ${text}`;
}

/** Why a row was not saved: its row errors, or the general hint when the backend gave none. */
export function failedRowText(errors: readonly RowError[]): string {
  return errors.length > 0 ? errors.map(rowErrorText).join('. ') : FAILED_ROW_TEXT;
}

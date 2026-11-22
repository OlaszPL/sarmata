import { describe, expect, it } from 'vitest';
import { importFields } from '@sarmata/services';
import {
  actionLabels,
  decisionsFromForm,
  importFieldLabels,
  mappingFromForm,
  postedDecisions,
  FAILED_ROW_TEXT,
  failedRowText,
  rowErrorText,
} from './import';

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe('mappingFromForm', () => {
  it('keeps mapped fields and drops empty ones', () => {
    const mapping = mappingFromForm(
      form({ 'map.firstName': 'Imię', 'map.lastName': 'Nazwisko', 'map.email': '' }),
    );
    expect(mapping).toEqual({ firstName: 'Imię', lastName: 'Nazwisko' });
  });
});

describe('decisionsFromForm', () => {
  it('reads create, skip and update with an id, and ignores absent rows', () => {
    const decisions = decisionsFromForm(
      form({
        'decision.2': 'update:abc-1',
        'decision.3': 'skip',
        'decision.5': 'create',
        'decision.7': 'garbage',
        other: 'skip',
      }),
    );
    expect(decisions).toEqual({ 2: { updateEmployeeId: 'abc-1' }, 3: 'skip', 5: 'create' });
    expect(decisions[4]).toBeUndefined();
  });
});

describe('postedDecisions', () => {
  it('keeps the raw choice of every decision row for the radios after a failed commit', () => {
    expect(
      postedDecisions(form({ 'decision.2': 'update:abc-1', 'decision.3': 'skip', csv: 'a;b' })),
    ).toEqual({ '2': 'update:abc-1', '3': 'skip' });
  });
});

describe('labels', () => {
  it('cover every import field', () => {
    expect(Object.keys(importFieldLabels).sort()).toEqual([...importFields].sort());
  });

  it('cover every proposed action with text', () => {
    for (const { label } of Object.values(actionLabels)) expect(label).not.toBe('');
    expect(Object.keys(actionLabels)).toHaveLength(4);
  });
});

describe('rowErrorText', () => {
  it('names the field in Polish and says what is wrong from the code', () => {
    expect(
      rowErrorText({ field: 'employmentStart', code: 'invalid_date', message: 'invalid date' }),
    ).toBe('Data nawiązania stosunku pracy: nieprawidłowa data');
  });

  it('explains a repeated e-mail', () => {
    expect(rowErrorText({ field: 'email', code: 'duplicate_email', message: 'repeats' })).toBe(
      'Adres e-mail: powtarza się wcześniej w pliku',
    );
  });

  it('starts with a capital letter when no field is known', () => {
    expect(rowErrorText({ field: null, code: 'write_failed', message: 'whatever' })).toBe(
      'Nie udało się zapisać',
    );
  });
});

describe('failedRowText', () => {
  it('lists the row errors', () => {
    expect(
      failedRowText([
        { field: 'email', code: 'invalid_format', message: 'x' },
        { field: null, code: 'unknown_supervisor', message: 'y' },
      ]),
    ).toBe('Adres e-mail: nieprawidłowy format. Takiego przełożonego nie ma w urzędzie');
  });

  it('falls back to the general hint without row errors', () => {
    expect(failedRowText([])).toBe(FAILED_ROW_TEXT);
  });
});

import { type RegulationDocument } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { eligibilityNote, searchEmployees, sheetOptions, startSchema } from './start-options';

const sheet = (id: string, positionKind: string, position: string) => ({
  id,
  annex: id.charCodeAt(0) - 64,
  positionKind,
  basis: `zał. ${id}`,
  position,
  mandatoryCriteria: ['reliability'],
  orgUnitFields: true,
  objectionAddressee: null,
});

const document = {
  sheets: [
    sheet('A', 'office-head', 'Dyrektor generalny urzędu'),
    sheet('B', 'manages-people', 'Stanowisko kierujące zespołem'),
    sheet('C', 'other', 'Pozostałe stanowiska'),
  ],
} as unknown as RegulationDocument;

describe('eligibilityNote', () => {
  const indefinite = { employmentBasis: 'indefinite', employmentEndedOn: null } as const;

  it('marks an employee with an evaluation in progress', () => {
    expect(eligibilityNote(indefinite, { status: 'criteria' })).toBe('Ma ocenę w toku');
  });

  it('marks a fixed-term employee', () => {
    expect(eligibilityNote({ employmentBasis: 'fixed_term', employmentEndedOn: null }, null)).toBe(
      'Umowa na czas określony, nie podlega ocenie',
    );
  });

  it('marks an ended employment', () => {
    expect(
      eligibilityNote(
        { employmentBasis: 'indefinite', employmentEndedOn: '2026-01-31' as never },
        null,
      ),
    ).toBe('Zatrudnienie ustało');
  });

  it('has no note for an eligible employee', () => {
    expect(eligibilityNote(indefinite, null)).toBeNull();
  });
});

describe('sheetOptions', () => {
  it('proposes sheet C first for an other position', () => {
    const options = sheetOptions(document, 'other');
    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({
      id: 'C',
      label: 'Arkusz C',
      hint: 'Pozostałe stanowiska',
      proposed: true,
    });
    expect(options.slice(1).map((option) => [option.id, option.proposed])).toEqual([
      ['A', false],
      ['B', false],
    ]);
  });

  it('maps the employee position kind to the sheet position kind', () => {
    expect(sheetOptions(document, 'office_head')[0]?.id).toBe('A');
    expect(sheetOptions(document, 'manages_people')[0]?.id).toBe('B');
  });
});

describe('startSchema', () => {
  it('rejects an empty employee with its message', () => {
    const parsed = startSchema.safeParse({ employeeId: '', sheetId: 'C' });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['employeeId']);
    expect(parsed.error?.issues[0]?.message).toBe('Wybierz pracownika');
  });

  it('rejects a missing sheet with its message', () => {
    const parsed = startSchema.safeParse({
      employeeId: '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
      sheetId: '',
    });
    expect(parsed.error?.issues[0]?.message).toBe('Wybierz arkusz');
  });
});

describe('searchEmployees', () => {
  const people = [
    { id: 'e', firstName: 'Ewa', lastName: 'Ewidencyjna' },
    { id: 'a', firstName: 'Anna', lastName: 'Administracyjna' },
    { id: 'o', firstName: 'Olga', lastName: 'Oceniająca' },
  ];

  it('finds a first name alone, ignoring case and Polish letters', () => {
    expect(searchEmployees(people, [], 'ewa').map((p) => p.id)).toEqual(['e']);
    expect(searchEmployees(people, [], 'oceniajaca').map((p) => p.id)).toEqual(['o']);
  });

  it('adds the typo-tolerant matches after the direct ones, without repeats', () => {
    expect(searchEmployees(people, ['a', 'e'], 'Ewa').map((p) => p.id)).toEqual(['e', 'a']);
  });

  it('skips similar ids that are not in the list', () => {
    expect(searchEmployees(people, ['x'], 'zzz')).toEqual([]);
  });
});

import { calendarDate, type EvaluationEvent } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { journalRows } from './journal';

function event(overrides: Partial<EvaluationEvent>): EvaluationEvent {
  return {
    id: 'e1',
    kind: 'created',
    occurredOn: calendarDate('2026-11-22'),
    payload: {},
    recordedBy: 'acc-1',
    recordedAt: '2026-11-22T10:05:00Z',
    ...overrides,
  };
}

const names = new Map([['acc-1', 'Anna Nowak']]);

describe('journalRows', () => {
  it('sorts ascending by occurrence date, then by recording time', () => {
    const rows = journalRows(
      [
        event({ id: 'late', occurredOn: calendarDate('2026-11-23') }),
        event({ id: 'b', recordedAt: '2026-11-22T12:00:00Z' }),
        event({ id: 'a', recordedAt: '2026-11-22T09:00:00Z' }),
      ],
      names,
    );
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'late']);
  });

  it('labels in Polish and formats dates in Warsaw time', () => {
    const [row] = journalRows([event({ kind: 'part_one_approved' })], names);
    expect(row?.label).toBe('Część I zatwierdzona');
    expect(row?.occurredOn).toBe('22.11.2026');
    expect(row?.recordedAt).toBe('22.11.2026, 11:05');
    expect(row?.recordedBy).toBe('Anna Nowak');
  });

  it('lists place, witnesses and refusal note as details', () => {
    const [row] = journalRows(
      [
        event({
          payload: {
            place: 'Warszawa',
            witnesses: ['Jan Kowalski', 'Ewa Lis'],
            refusalNote: 'Brak',
          },
        }),
      ],
      names,
    );
    expect(row?.details).toEqual([
      'Miejscowość: Warszawa',
      'Świadkowie: Jan Kowalski, Ewa Lis',
      'Adnotacja: Brak',
    ]);
  });

  it('names an author outside the employee list', () => {
    const [row] = journalRows([event({ recordedBy: 'unknown' })], names);
    expect(row?.recordedBy).toBe('Konto spoza listy pracowników');
    expect(row?.details).toEqual([]);
  });
});

import {
  type CalendarDate,
  type EvaluationEvent,
  type EvaluationStatus,
  type EvaluationView,
} from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import {
  type PanelInput,
  absencesOf,
  eventPanels,
  objectionWindow,
  savedKeyOf,
  sideEventRows,
} from './panels';

const date = (value: string) => value as CalendarDate;

function panels(status: EvaluationStatus, overrides: Partial<PanelInput>): string[] {
  const input: PanelInput = {
    status,
    sheetState: 'draft',
    canWrite: false,
    isHr: false,
    isAdmin: false,
    ...overrides,
  };
  return [...eventPanels(input)].sort();
}

function event(
  id: string,
  kind: string,
  occurredOn: string,
  payload: Record<string, unknown>,
): EvaluationEvent {
  return {
    id,
    kind,
    occurredOn: date(occurredOn),
    payload,
    recordedBy: 'account',
    recordedAt: '2027-01-01T10:00:00Z',
  } as EvaluationEvent;
}

const names = {
  reason: (r: string) => `przyczyna ${r}`,
  account: (id: string) => `konto ${id}`,
};

describe('eventPanels', () => {
  it('gives the leading evaluator acquaintance and side events in drafted', () => {
    expect(panels('drafted', { canWrite: true })).toEqual(['acquaintance', 'sideEvents']);
  });

  it('gives hr every hr panel in objection', () => {
    expect(panels('objection', { isHr: true })).toEqual([
      'evaluatorChange',
      'interruption',
      'objectionDecision',
      'sideEvents',
    ]);
  });

  it('gives hr closing and objection filing in delivered', () => {
    expect(panels('delivered', { isHr: true })).toEqual([
      'closing',
      'evaluatorChange',
      'interruption',
      'objectionFiling',
      'sideEvents',
    ]);
  });

  it('gives an admin only the correction in a closed locked sheet', () => {
    expect(panels('closed', { isAdmin: true, sheetState: 'locked' })).toEqual(['correction']);
  });

  it('gives an evaluator who does not lead the case nothing in period', () => {
    expect(panels('period', {})).toEqual([]);
  });

  it('gives nobody side events in closed or interrupted', () => {
    expect(panels('closed', { canWrite: true, isHr: true })).not.toContain('sideEvents');
    expect(panels('interrupted', { canWrite: true, isHr: true })).not.toContain('sideEvents');
  });

  it('gives no correction to an admin while the sheet is a draft', () => {
    expect(panels('drafted', { isAdmin: true })).toEqual([]);
  });
});

describe('absencesOf', () => {
  it('keeps the last entry per absence id', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const list = absencesOf([
      event('e1', 'absence', '2027-01-10', { absenceId: id, from: '2027-01-10', to: null }),
      event('e2', 'created', '2027-01-11', {}),
      event('e3', 'absence', '2027-01-20', { absenceId: id, from: '2027-01-10', to: '2027-01-20' }),
    ]);
    expect(list).toEqual([{ absenceId: id, from: '2027-01-10', to: '2027-01-20' }]);
  });
});

describe('objectionWindow', () => {
  const view = (dueOn: string | null, slot = 'objection') =>
    ({
      deadlines: [{ slot, windowStart: null, dueOn: dueOn && date(dueOn), suspendedSince: null }],
    }) as unknown as EvaluationView;

  it('is open with one day left when the deadline is tomorrow', () => {
    expect(objectionWindow(view('2027-03-02'), date('2027-03-01'))).toEqual({
      dueOn: '2027-03-02',
      daysLeft: 1,
      open: true,
    });
  });

  it('is closed after the deadline', () => {
    expect(objectionWindow(view('2027-03-01'), date('2027-03-02'))).toMatchObject({
      daysLeft: -1,
      open: false,
    });
  });

  it('is null without the objection slot', () => {
    expect(
      objectionWindow(view('2027-03-02', 'evaluationDeadline'), date('2027-03-01')),
    ).toBeNull();
  });
});

describe('sideEventRows', () => {
  it('describes side events in journal order, one row per absence', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const view = {
      events: [
        event('a1', 'absence', '2027-01-10', { absenceId: id, from: '2027-01-10', to: null }),
        event('t1', 'term_changed', '2027-02-01', {
          newDueOn: '2027-05-01',
          reason: 'requestOfEvaluated',
          noticeOn: '2027-02-01',
        }),
        event('a2', 'absence', '2027-01-20', {
          absenceId: id,
          from: '2027-01-10',
          to: '2027-01-20',
        }),
        event('p1', 'position_changed', '2027-02-05', {
          changedOn: '2027-02-05',
          significant: true,
          justification: 'x',
          positionTitle: 'Starszy specjalista',
          orgUnit: 'Wydział A',
        }),
        event('c1', 'evaluator_changed', '2027-02-06', { from: 'old', to: 'new', reason: 'Urlop' }),
        event('o1', 'objection_outcome', '2027-02-07', { outcome: 'rejected' }),
        event('i1', 'interrupted', '2027-02-08', { reason: 'Koniec zatrudnienia' }),
      ],
    } as unknown as EvaluationView;
    const rows = sideEventRows(view, names);
    expect(rows.map((row) => row.id)).toEqual(['t1', 'a2', 'p1', 'c1', 'o1', 'i1']);
    expect(rows[0]).toMatchObject({
      occurredOn: '01.02.2027',
      details: 'Nowy termin 01.05.2027, przyczyna requestOfEvaluated',
      noticeEventId: 't1',
    });
    expect(rows[1]).toMatchObject({ details: 'od 10.01.2027 do 20.01.2027', noticeEventId: null });
    expect(rows[2]?.details).toBe('Starszy specjalista, Wydział A, istotna zmiana obowiązków');
    expect(rows[3]?.details).toBe('konto new, Urlop');
    expect(rows[4]?.details).toBe('Sprzeciw nieuwzględniony');
    expect(rows[5]?.details).toBe('Koniec zatrudnienia');
  });

  it('writes an ongoing absence as running', () => {
    const view = {
      events: [
        event('a1', 'absence', '2027-01-10', { absenceId: 'x', from: '2027-01-10', to: null }),
      ],
    } as unknown as EvaluationView;
    expect(sideEventRows(view, names)[0]?.details).toBe('od 10.01.2027, trwa');
  });
});

describe('savedKeyOf', () => {
  it('knows a saved key and ignores anything else', () => {
    expect(savedKeyOf('term')).toBe('term');
    expect(savedKeyOf('x')).toBeNull();
    expect(savedKeyOf(['term'])).toBeNull();
    expect(savedKeyOf(undefined)).toBeNull();
    expect(savedKeyOf('toString')).toBeNull();
  });
});

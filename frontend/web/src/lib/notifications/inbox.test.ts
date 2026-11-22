import { type DeadlineSlot, type InboxItem, calendarDate } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { inboxView } from './inbox';

const today = calendarDate('2028-11-07');

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'n1',
    kind: 'deadline_reminder',
    category: 'reminder',
    evaluationId: 'e1',
    employeeName: 'Ewa Ewidencyjna',
    slot: 'evaluationDeadline',
    dueOn: calendarDate('2028-11-21'),
    leadDays: 14,
    createdOn: calendarDate('2028-11-07'),
    status: 'open',
    resolvedAt: null,
    readAt: null,
    ...overrides,
  };
}

const first = (items: InboxItem[]) => {
  const view = inboxView(items, today);
  const entry = [...view.groups.unread, ...view.groups.read, ...view.groups.resolved][0];
  if (!entry) throw new Error('expected one entry');
  return entry;
};

describe('inboxView', () => {
  it('describes a 14 day reminder', () => {
    expect(first([item({ id: 'abc' })])).toMatchObject({
      group: 'unread',
      employeeName: 'Ewa Ewidencyjna',
      title: 'Sporządzenie oceny',
      summary: 'Termin mija 21.11.2028. Przypomnienie 14 dni przed terminem.',
      kindLabel: 'Przypomnienie',
      dueOn: '21.11.2028',
      dueText: 'za 14 dni',
      overdue: false,
      href: '/oceny/e1',
    });
  });

  it('uses the singular for a one day lead time', () => {
    expect(first([item({ leadDays: 1 })]).summary).toBe(
      'Termin mija 21.11.2028. Przypomnienie 1 dzień przed terminem.',
    );
  });

  it('names an employee hidden by RLS', () => {
    expect(first([item({ employeeName: '' })]).employeeName).toBe('Pracownik bez dostępu');
  });

  it('drops the lead sentence when there is no lead time', () => {
    expect(first([item({ leadDays: null })]).summary).toBe('Termin mija 21.11.2028.');
  });

  it('marks an open task past due', () => {
    const entry = first([
      item({
        kind: 'deadline_overdue',
        category: 'task',
        dueOn: calendarDate('2028-11-04'),
        leadDays: null,
      }),
    ]);
    expect(entry).toMatchObject({
      kindLabel: 'Zadanie',
      summary: 'Termin minął 04.11.2028.',
      dueText: '3 dni po terminie',
      overdue: true,
    });
  });

  it('writes the copy of the other task kinds', () => {
    expect(
      first([item({ kind: 'objection_decision', category: 'task', slot: 'objectionDecision' })])
        .summary,
    ).toBe('Wpisz rozstrzygnięcie sprzeciwu do 21.11.2028.');
    expect(
      first([item({ kind: 'grade_by_law', category: 'task', slot: 'gradeByLawGrant' })]).summary,
    ).toBe('Przyznaj stopień z mocy prawa w rejestrze kadr do 21.11.2028.');
  });

  it('links to the case tab that holds the action', () => {
    expect(first([item({ slot: 'objectionDecision' })]).href).toBe('/oceny/e1/zdarzenia');
    expect(first([item({ slot: 'gradeByLawGrant' })]).href).toBe('/kadry/rejestr?ocena=e1#stopien');
    expect(first([item({ slot: 'startingInterview' })]).href).toBe('/oceny/e1/czesc-1');
    expect(first([item({ slot: 'reevaluationAfterNegative' })]).href).toBe('/oceny/e1');
  });

  it('puts a resolved item in its own group and never calls it overdue', () => {
    const entry = first([
      item({
        kind: 'deadline_overdue',
        category: 'task',
        status: 'resolved',
        dueOn: calendarDate('2028-11-01'),
        readAt: '2028-11-02T10:00:00Z',
      }),
    ]);
    expect(entry).toMatchObject({ group: 'resolved', overdue: false, dueText: 'załatwione' });
  });

  it('keeps the input order inside each group', () => {
    const view = inboxView(
      [item({ id: 'b' }), item({ id: 'x', readAt: '2028-11-02T10:00:00Z' }), item({ id: 'a' })],
      today,
    );
    expect(view.groups.unread.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(view.groups.read.map((entry) => entry.id)).toEqual(['x']);
  });

  it('counts unread, open tasks and resolved', () => {
    const view = inboxView(
      [
        item({ id: '1' }),
        item({ id: '2', kind: 'deadline_overdue', category: 'task' }),
        item({ id: '3', kind: 'grade_by_law', category: 'task', readAt: '2028-11-02T10:00:00Z' }),
        item({ id: '4', kind: 'deadline_overdue', category: 'task', status: 'resolved' }),
      ],
      today,
    );
    expect(view).toMatchObject({ unread: 2, openTasks: 2, resolved: 1 });
  });

  it('gives every slot a title', () => {
    const slots: DeadlineSlot[] = [
      'startingInterview',
      'startingInterviewAfterNegative',
      'evaluationDeadline',
      'reevaluationAfterNegative',
      'criteriaResetAfterPositionChange',
      'evaluationOnPositionChange',
      'objection',
      'objectionDecision',
      'labourCourtAppeal',
      'gradeByLawGrant',
    ];
    for (const slot of slots) expect(first([item({ slot })]).title).not.toBe('');
  });
});

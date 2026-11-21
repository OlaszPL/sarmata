import { calendarDate } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { type InboxItem, sortInbox } from './notifications';

const item = (id: string, dueOn: string, patch: Partial<InboxItem> = {}): InboxItem => ({
  id,
  kind: 'deadline_overdue',
  category: 'task',
  evaluationId: 'e1',
  employeeName: 'Ewa Ewidencyjna',
  slot: 'objection',
  dueOn: calendarDate(dueOn),
  leadDays: null,
  createdOn: calendarDate('2026-11-01'),
  status: 'open',
  resolvedAt: null,
  readAt: null,
  ...patch,
});

describe('sortInbox', () => {
  it('puts open unread first, then open read, then resolved, each by deadline', () => {
    const sorted = sortInbox([
      item('resolved', '2026-11-01', { status: 'resolved', readAt: '2026-11-02T10:00:00Z' }),
      item('read-late', '2026-12-05', { readAt: '2026-11-03T10:00:00Z' }),
      item('read-early-read-later', '2026-12-01', { readAt: '2026-11-09T10:00:00Z' }),
      item('unread-late', '2026-12-20'),
      item('unread-early', '2026-12-10'),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual([
      'unread-early',
      'unread-late',
      'read-early-read-later',
      'read-late',
      'resolved',
    ]);
  });
});

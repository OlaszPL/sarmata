import { describe, expect, it } from 'vitest';
import {
  DIGEST_JOB_TYPE,
  NOTIFICATIONS_PATH,
  notificationCategory,
  notificationKindSchema,
  notificationStatusSchema,
} from './notification';

describe('notification kinds', () => {
  it('categories of kinds', () => {
    expect(notificationCategory('deadline_reminder')).toBe('reminder');
    expect(notificationCategory('deadline_overdue')).toBe('task');
    expect(notificationCategory('objection_decision')).toBe('task');
    expect(notificationCategory('grade_by_law')).toBe('task');
  });

  it('schemas list the database values', () => {
    expect(notificationKindSchema.options).toEqual([
      'deadline_reminder',
      'deadline_overdue',
      'objection_decision',
      'grade_by_law',
    ]);
    expect(notificationStatusSchema.options).toEqual(['open', 'resolved']);
  });

  it('inbox path constant', () => {
    expect(NOTIFICATIONS_PATH).toBe('/powiadomienia');
    expect(DIGEST_JOB_TYPE).toBe('notifications.send_digest');
  });
});

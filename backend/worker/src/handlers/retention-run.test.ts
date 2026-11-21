import { RETENTION_JOB_TYPE, calendarDate } from '@sarmata/domain';
import { type NotificationDelivery, type RetentionService } from '@sarmata/services/system';
import { describe, expect, it } from 'vitest';
import { type Logger } from '../logger';
import { jobHandlersFor } from './index';
import { retentionRunHandler } from './retention-run';

function recordingLogger(): Logger & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    info: (message) => messages.push(message),
    error: (message) => messages.push(message),
  };
}

function fakeRetention(failure?: Error) {
  const days: string[] = [];
  const retention: RetentionService = {
    run: (day) => {
      days.push(day);
      return failure === undefined
        ? Promise.resolve({ notes: 4, aiRuns: 2, anonymized: 1, failed: 0 })
        : Promise.reject(failure);
    },
  };
  return { retention, days };
}

const context = (logger: Logger) => ({ signal: new AbortController().signal, logger });

describe('retentionRunHandler', () => {
  it('valid payload calls retention once and logs counts', async () => {
    const { retention, days } = fakeRetention();
    const logger = recordingLogger();
    const outcome = await retentionRunHandler(retention).run(
      { day: '2026-12-01' },
      context(logger),
    );
    expect(outcome).toEqual({ status: 'done' });
    expect(days).toEqual([calendarDate('2026-12-01')]);
    expect(logger.messages).toEqual([
      'retention: purged 4 notes and the content of 2 AI runs, anonymized 1 employees',
    ]);
  });

  it('invalid day is reported as invalid payload', async () => {
    const { retention, days } = fakeRetention();
    const outcome = await retentionRunHandler(retention).run(
      { day: '2026-02-30' },
      context(recordingLogger()),
    );
    expect(outcome.status).toBe('invalid_payload');
    expect(days).toHaveLength(0);
  });

  it('failure is rethrown for retry', async () => {
    const { retention } = fakeRetention(new Error('2 employees failed'));
    await expect(
      retentionRunHandler(retention).run({ day: '2026-12-01' }, context(recordingLogger())),
    ).rejects.toThrow('2 employees failed');
  });

  it('registry contains the retention job type', () => {
    const delivery: NotificationDelivery = {
      sendDigest: () => Promise.reject(new Error('unused')),
    };
    const types = jobHandlersFor({
      delivery,
      closing: { closeUnobjected: () => Promise.resolve({ closed: 0 }) },
      retention: fakeRetention().retention,
    }).map((handler) => handler.type);
    expect(types).toContain(RETENTION_JOB_TYPE);
    expect(RETENTION_JOB_TYPE).toBe('retention.run');
  });
});

import { calendarDate } from '@sarmata/domain';
import { type EvaluationClosing, type NotificationDelivery } from '@sarmata/services/system';
import { describe, expect, it } from 'vitest';
import { type Logger } from '../logger';
import { closeUnobjectedHandler } from './close-unobjected';
import { jobHandlersFor } from './index';

function recordingLogger(): Logger & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    info: (message) => messages.push(message),
    error: (message) => messages.push(message),
  };
}

function fakeClosing(closed = 3, failure?: Error) {
  const days: string[] = [];
  const closing: EvaluationClosing = {
    closeUnobjected: (day) => {
      days.push(day);
      return failure === undefined ? Promise.resolve({ closed }) : Promise.reject(failure);
    },
  };
  return { closing, days };
}

const context = (logger: Logger) => ({ signal: new AbortController().signal, logger });

describe('closeUnobjectedHandler', () => {
  it('valid payload calls closing once and logs the count', async () => {
    const { closing, days } = fakeClosing(3);
    const logger = recordingLogger();
    const outcome = await closeUnobjectedHandler(closing).run(
      { day: '2026-12-01' },
      context(logger),
    );
    expect(outcome).toEqual({ status: 'done' });
    expect(days).toEqual([calendarDate('2026-12-01')]);
    expect(logger.messages).toEqual(['closed 3 evaluations after the objection window']);
  });

  it('logs the line also when nothing was closed', async () => {
    const logger = recordingLogger();
    await closeUnobjectedHandler(fakeClosing(0).closing).run(
      { day: '2026-12-01' },
      context(logger),
    );
    expect(logger.messages).toEqual(['closed 0 evaluations after the objection window']);
  });

  it('invalid day is reported as invalid payload', async () => {
    const { closing, days } = fakeClosing();
    const outcome = await closeUnobjectedHandler(closing).run(
      { day: '2026-02-30' },
      context(recordingLogger()),
    );
    expect(outcome.status).toBe('invalid_payload');
    expect(days).toHaveLength(0);
  });

  it('closing error is rethrown for retry', async () => {
    const { closing } = fakeClosing(0, new Error('database down'));
    await expect(
      closeUnobjectedHandler(closing).run({ day: '2026-12-01' }, context(recordingLogger())),
    ).rejects.toThrow('database down');
  });

  it('registry contains close job type', () => {
    const delivery: NotificationDelivery = {
      sendDigest: () => Promise.reject(new Error('unused')),
    };
    const types = jobHandlersFor({ delivery, closing: fakeClosing().closing }).map(
      (handler) => handler.type,
    );
    expect(types).toContain('evaluations.close_unobjected');
  });
});

/* eslint-disable @typescript-eslint/unbound-method -- the vi.fn mocks are asserted through the delivery object */
import { DIGEST_JOB_TYPE, calendarDate } from '@sarmata/domain';
import { type NotificationDelivery } from '@sarmata/services/system';
import { describe, expect, it, vi } from 'vitest';
import { type Logger } from '../logger';
import { jobHandlersFor } from './index';
import { sendDigestHandler } from './send-digest';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const logger: Logger = { info: vi.fn(), error: vi.fn() };
const context = { signal: new AbortController().signal, logger };

function fakeDelivery(): NotificationDelivery & { sendDigest: ReturnType<typeof vi.fn> } {
  return { sendDigest: vi.fn(() => Promise.resolve({ status: 'sent' as const })) };
}

describe('sendDigestHandler', () => {
  it('invalid day is reported as invalid payload', async () => {
    const delivery = fakeDelivery();
    const outcome = await sendDigestHandler(delivery).run(
      { accountId: ACCOUNT, day: '2026-02-30' },
      context,
    );
    expect(outcome.status).toBe('invalid_payload');
    expect(delivery.sendDigest).not.toHaveBeenCalled();
  });

  it('valid payload calls delivery once', async () => {
    const delivery = fakeDelivery();
    const outcome = await sendDigestHandler(delivery).run(
      { accountId: ACCOUNT, day: '2026-12-01' },
      context,
    );
    expect(outcome).toEqual({ status: 'done' });
    expect(delivery.sendDigest).toHaveBeenCalledTimes(1);
    expect(delivery.sendDigest).toHaveBeenCalledWith(ACCOUNT, calendarDate('2026-12-01'));
  });

  it('registry contains the digest job type', () => {
    const types = jobHandlersFor({
      delivery: fakeDelivery(),
      closing: { closeUnobjected: () => Promise.resolve({ closed: 0 }) },
      retention: { run: () => Promise.reject(new Error('unused')) },
      invitations: { process: () => Promise.reject(new Error('unused')) },
    }).map((handler) => handler.type);
    expect(types).toContain(DIGEST_JOB_TYPE);
  });
});

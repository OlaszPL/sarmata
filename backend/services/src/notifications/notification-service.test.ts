/* eslint-disable @typescript-eslint/unbound-method -- the vi.fn mocks are asserted through the repository object */
import { type NotificationRepository } from '@sarmata/repositories';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { createNotificationService } from './notification-service';

function fakeRepository(): NotificationRepository {
  return {
    list: vi.fn(() => Promise.resolve([])),
    unreadCount: vi.fn(() => Promise.resolve(0)),
    markRead: vi.fn(() => Promise.resolve(0)),
  };
}

describe('createNotificationService', () => {
  it('markRead rejects non uuid ids', async () => {
    const repository = fakeRepository();
    const service = createNotificationService(repository);
    await expect(service.markRead(['not-a-uuid'])).rejects.toBeInstanceOf(ZodError);
    await expect(service.markRead([])).rejects.toBeInstanceOf(ZodError);
    expect(repository.markRead).not.toHaveBeenCalled();
  });

  it('markRead passes valid ids and the all target through', async () => {
    const repository = fakeRepository();
    const service = createNotificationService(repository);
    const id = '11111111-1111-4111-8111-111111111111';
    await service.markRead([id]);
    await service.markRead('all');
    expect(repository.markRead).toHaveBeenNthCalledWith(1, [id]);
    expect(repository.markRead).toHaveBeenNthCalledWith(2, 'all');
  });
});

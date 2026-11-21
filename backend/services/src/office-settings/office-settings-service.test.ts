/* eslint-disable @typescript-eslint/unbound-method -- the vi.fn mocks are asserted through the repository object */
import {
  type OfficeSettings,
  type OfficeSettingsRepository,
  RepositoryError,
} from '@sarmata/repositories';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { ServiceError } from '../errors';
import { createOfficeSettingsService } from './office-settings-service';

const settings: OfficeSettings = {
  officeId: 'o1',
  aiEnabled: true,
  notesRetentionMonths: 36,
  reminderLeadDays: [14, 3],
  evaluationVisibility: 'office',
  defaultPlace: null,
  objectionAddresseeSheetA: null,
  smtp: { host: null, port: null, user: null, from: null, passwordSet: false },
};

function fakeRepository(
  overrides: Partial<OfficeSettingsRepository> = {},
): OfficeSettingsRepository {
  return {
    get: vi.fn(() => Promise.resolve(settings)),
    update: vi.fn(() => Promise.resolve(settings)),
    setSmtpPassword: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe('office settings service', () => {
  it('get fails not_found without a row', async () => {
    const service = createOfficeSettingsService(
      fakeRepository({ get: () => Promise.resolve(null) }),
    );
    await expect(service.get()).rejects.toMatchObject({ code: 'not_found' });
  });

  it('settings update rejects lead days out of range', async () => {
    const repository = fakeRepository();
    await expect(
      createOfficeSettingsService(repository).update({ reminderLeadDays: [0] }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('update passes the normalized patch', async () => {
    const repository = fakeRepository();
    await createOfficeSettingsService(repository).update({ reminderLeadDays: [3, 14] });
    expect(repository.update).toHaveBeenCalledWith({ reminderLeadDays: [14, 3] });
  });

  it('settings update by non-admin fails forbidden', async () => {
    const service = createOfficeSettingsService(
      fakeRepository({ update: () => Promise.resolve(null) }),
    );
    await expect(service.update({ aiEnabled: false })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('setSmtpPassword maps 42501 to forbidden', async () => {
    const service = createOfficeSettingsService(
      fakeRepository({
        setSmtpPassword: () =>
          Promise.reject(
            new RepositoryError('officeSettings.setSmtpPassword', {
              message: 'denied',
              code: '42501',
            }),
          ),
      }),
    );
    const error: unknown = await service.setSmtpPassword('x').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toMatchObject({ code: 'forbidden' });
  });

  it('setSmtpPassword rethrows other failures', async () => {
    const failure = new RepositoryError('officeSettings.setSmtpPassword', {
      message: 'boom',
      code: 'XX000',
    });
    const service = createOfficeSettingsService(
      fakeRepository({ setSmtpPassword: () => Promise.reject(failure) }),
    );
    await expect(service.setSmtpPassword('x')).rejects.toBe(failure);
  });
});

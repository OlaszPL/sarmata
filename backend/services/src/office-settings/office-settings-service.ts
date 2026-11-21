import { z } from 'zod';
import { type OfficeSettingsPatchInput, officeSettingsPatchSchema } from '@sarmata/domain';
import {
  type NotesRetentionPreview,
  type NotesRetentionPreviewRepository,
  type OfficeSettings,
  type OfficeSettingsRepository,
  RepositoryError,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';

const smtpPasswordSchema = z.string().min(1);
const retentionMonthsSchema = z.number().int().min(1).max(120);

export interface OfficeSettingsService {
  get(): Promise<OfficeSettings>;
  /** Admin only: anybody else gets `forbidden`. Throws `ZodError` for invalid input. */
  update(patch: OfficeSettingsPatchInput): Promise<OfficeSettings>;
  /** Admin only, stored in Vault. Throws `ZodError` for an empty password. The password is never returned, `get` only says it is set. */
  setSmtpPassword(password: string): Promise<void>;
  /**
   * What the next nightly run would remove if the notes retention were `months` (admin and hr). Shortening
   * the period works backwards, so the settings screen warns with this count before the admin saves.
   * Throws `ZodError` for a period outside 1 to 120 months and `forbidden` for other roles.
   */
  notesRetentionPreview(months: number): Promise<NotesRetentionPreview>;
}

export function createOfficeSettingsService(
  settings: OfficeSettingsRepository,
  retentionPreview?: NotesRetentionPreviewRepository,
): OfficeSettingsService {
  return {
    async get() {
      const current = await settings.get();
      if (current === null) throw new ServiceError('not_found', 'Office settings not found');
      return current;
    },

    async update(patch) {
      const updated = await settings.update(officeSettingsPatchSchema.parse(patch));
      if (updated === null) {
        throw new ServiceError('forbidden', 'Only the office admin can change the settings');
      }
      return updated;
    },

    async setSmtpPassword(password) {
      try {
        await settings.setSmtpPassword(smtpPasswordSchema.parse(password));
      } catch (error) {
        if (error instanceof RepositoryError && error.code === '42501') {
          throw new ServiceError('forbidden', 'Only the office admin can set the SMTP password');
        }
        throw error;
      }
    },

    async notesRetentionPreview(months) {
      const valid = retentionMonthsSchema.parse(months);
      if (retentionPreview === undefined) {
        throw new ServiceError('not_found', 'The retention preview is not available here');
      }
      try {
        return await retentionPreview.preview(valid);
      } catch (error) {
        if (error instanceof RepositoryError && error.code === '42501') {
          throw new ServiceError(
            'forbidden',
            'Only the office admin can see the retention preview',
          );
        }
        throw error;
      }
    },
  };
}

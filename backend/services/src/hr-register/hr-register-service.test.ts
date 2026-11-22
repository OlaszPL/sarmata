/* eslint-disable @typescript-eslint/unbound-method -- the vi.fn mocks are asserted through the repository object */
import { readFileSync } from 'node:fs';
import { DEFAULT_EVALUATOR_FLAG_THRESHOLDS, calendarDate } from '@sarmata/domain';
import {
  type HrRegisterRepository,
  type OfficeSettings,
  type OfficeSettingsRepository,
  RepositoryError,
} from '@sarmata/repositories';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { createOfficeSettingsService } from '../office-settings/office-settings-service';
import { createHrRegisterService } from './hr-register-service';

const id = '2f6b1c0e-5a43-4d3e-9b8a-1c2d3e4f5a6b';
const appeal = { evaluationId: id, filedOn: calendarDate('2026-07-01') };
const grant = {
  employeeId: id,
  evaluationId: id,
  basis: 'by_law' as const,
  grantedOn: calendarDate('2026-08-01'),
  newGrade: 4,
};

function fakeRepository(overrides: Partial<HrRegisterRepository> = {}): HrRegisterRepository {
  return {
    recordLabourCourtAppeal: vi.fn(() => Promise.resolve('event')),
    recordGradeGrant: vi.fn(() => Promise.resolve('grant')),
    gradeGrants: vi.fn(() => Promise.resolve([])),
    ...overrides,
  };
}

describe('hr register service', () => {
  it('appeal is passed to the repository', async () => {
    const repository = fakeRepository();
    await createHrRegisterService({ repository }).recordLabourCourtAppeal(appeal);
    expect(repository.recordLabourCourtAppeal).toHaveBeenCalledWith(appeal);
  });

  it('42501 maps to forbidden', async () => {
    const service = createHrRegisterService({
      repository: fakeRepository({
        recordGradeGrant: () =>
          Promise.reject(new RepositoryError('x', { message: 'no', code: '42501' })),
      }),
    });
    await expect(service.recordGradeGrant(grant)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it.each([
    'no_rejected_objection',
    'already_recorded',
    'date_before_outcome',
    'not_civil_servant',
    'grade_not_higher',
    'date_before_previous_grant',
    'evaluation_required',
  ])('rule violation %s maps to hr_entry_rejected', async (rule) => {
    const failing = () =>
      Promise.reject(new RepositoryError('x', { message: rule, code: 'P0001' }));
    const service = createHrRegisterService({
      repository: fakeRepository({
        recordLabourCourtAppeal: failing,
        recordGradeGrant: failing,
      }),
    });
    const error: unknown = await service.recordLabourCourtAppeal(appeal).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'hr_entry_rejected', details: { rule } });
    await expect(service.recordGradeGrant(grant)).rejects.toMatchObject({
      code: 'hr_entry_rejected',
    });
  });

  it('23505 maps to already_recorded', async () => {
    const service = createHrRegisterService({
      repository: fakeRepository({
        recordGradeGrant: () =>
          Promise.reject(new RepositoryError('x', { message: 'dup', code: '23505' })),
      }),
    });
    await expect(service.recordGradeGrant(grant)).rejects.toMatchObject({
      code: 'hr_entry_rejected',
      details: { rule: 'already_recorded' },
    });
  });

  it('invalid input throws ZodError without calling the repository', async () => {
    const repository = fakeRepository();
    const service = createHrRegisterService({ repository });
    await expect(service.recordGradeGrant({ ...grant, evaluationId: null })).rejects.toBeInstanceOf(
      ZodError,
    );
    expect(repository.recordGradeGrant).not.toHaveBeenCalled();
  });

  it('admin updates evaluator flags through office settings', async () => {
    const current: OfficeSettings = {
      officeId: 'o1',
      aiEnabled: true,
      notesRetentionMonths: 36,
      reminderLeadDays: [14, 3],
      evaluationVisibility: 'office',
      defaultPlace: null,
      objectionAddresseeSheetA: null,
      appreciationGapDays: 30,
      evaluatorFlags: { minEvaluations: 3, centralShare: 0.75, leniencyPoints: 1.5 },
      accessibility: {
        officeAddress: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        architecture: null,
        signLanguage: null,
      },
      smtp: { host: null, port: null, user: null, from: null, passwordSet: false },
    };
    const settings: OfficeSettingsRepository = {
      get: () => Promise.resolve(current),
      update: vi.fn(() => Promise.resolve(current)),
      setSmtpPassword: () => Promise.resolve(),
    };
    const updated = await createOfficeSettingsService(settings).update({
      evaluatorFlags: { minEvaluations: 3 },
    });
    expect(settings.update).toHaveBeenCalledWith({ evaluatorFlags: { minEvaluations: 3 } });
    expect(updated.evaluatorFlags.minEvaluations).toBe(3);
  });

  it('default thresholds match the column defaults', () => {
    const migration = readFileSync(
      new URL(
        '../../../../database/supabase/migrations/20261122170020_office_settings_evaluator_flags.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const defaults = [...migration.matchAll(/default ([\d.]+)/g)].map((match) => Number(match[1]));
    expect(defaults).toEqual([
      DEFAULT_EVALUATOR_FLAG_THRESHOLDS.minEvaluations,
      DEFAULT_EVALUATOR_FLAG_THRESHOLDS.centralShare,
      DEFAULT_EVALUATOR_FLAG_THRESHOLDS.leniencyPoints,
    ]);
  });
});

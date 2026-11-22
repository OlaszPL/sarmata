import type { OfficeSettings } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { parseForm } from '@/lib/form-action';
import {
  needsRetentionConfirmation,
  officeSettingsFieldMap,
  officeSettingsFormSchema,
  remapFieldErrors,
  settingsFormValues,
} from './office-settings-form';

function fd(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const valid = {
  aiEnabled: '1',
  notesRetentionMonths: '24',
  reminderLeadDays: '30, 14, 7',
  evaluationVisibility: 'office',
  defaultPlace: '',
  objectionAddresseeSheetA: '',
  minEvaluations: '5',
  centralSharePercent: '80',
  leniencyPoints: '1',
  appreciationGapDays: '90',
  smtpHost: '',
  smtpPort: '',
  smtpUser: '',
  smtpFrom: '',
};

const demo: OfficeSettings = {
  officeId: 'office-1',
  aiEnabled: false,
  notesRetentionMonths: 36,
  reminderLeadDays: [30, 14, 7],
  evaluationVisibility: 'tree',
  defaultPlace: 'Warszawa',
  objectionAddresseeSheetA: 'Dyrektor Generalny',
  evaluatorFlags: { minEvaluations: 6, centralShare: 0.75, leniencyPoints: 1.5 },
  appreciationGapDays: 120,
  smtp: {
    host: 'smtp.example.gov.pl',
    port: 587,
    user: 'sarmata',
    from: 'sarmata@example.gov.pl',
    passwordSet: true,
  },
};

describe('officeSettingsFormSchema', () => {
  it('parses a full form into a patch', () => {
    const result = parseForm(
      officeSettingsFormSchema,
      fd({
        ...valid,
        aiEnabled: '0',
        reminderLeadDays: '7, 30,14',
        centralSharePercent: '80',
        leniencyPoints: '1,5',
      }),
    );
    expect('data' in result).toBe(true);
    if (!('data' in result)) return;
    expect(result.data.aiEnabled).toBe(false);
    expect(result.data.reminderLeadDays).toEqual([7, 30, 14]);
    expect(result.data.evaluatorFlags?.centralShare).toBe(0.8);
    expect(result.data.evaluatorFlags?.leniencyPoints).toBe(1.5);
    expect(result.data.defaultPlace).toBeNull();
    expect(result.data.smtp?.port).toBeNull();
    expect(result.data.notesRetentionMonths).toBe(24);
  });

  it('rejects out of range values with Polish messages at the field id', () => {
    const result = parseForm(
      officeSettingsFormSchema,
      fd({
        ...valid,
        notesRetentionMonths: '0',
        reminderLeadDays: '7, abc',
        smtpFrom: 'x',
      }),
    );
    expect('state' in result).toBe(true);
    if (!('state' in result)) return;
    expect(result.state.fieldErrors.notesRetentionMonths).toBeTruthy();
    expect(result.state.fieldErrors.reminderLeadDays).toBeTruthy();
    expect(result.state.fieldErrors.smtpFrom).toBeTruthy();
    expect(result.state.fieldErrors.minEvaluations).toBeUndefined();
  });

  it('rejects too many reminder days and a central share below 50 percent', () => {
    const result = parseForm(
      officeSettingsFormSchema,
      fd({ ...valid, reminderLeadDays: '1,2,3,4,5,6', centralSharePercent: '49' }),
    );
    expect('state' in result).toBe(true);
    if (!('state' in result)) return;
    expect(result.state.fieldErrors.reminderLeadDays).toBeTruthy();
    expect(result.state.fieldErrors.centralSharePercent).toBeTruthy();
  });
});

describe('settingsFormValues', () => {
  it('round-trips through the form schema', () => {
    const values = settingsFormValues(demo);
    const result = parseForm(officeSettingsFormSchema, fd(values));
    expect('data' in result).toBe(true);
    if (!('data' in result)) return;
    expect(result.data).toEqual({
      aiEnabled: false,
      notesRetentionMonths: 36,
      reminderLeadDays: [30, 14, 7],
      evaluationVisibility: 'tree',
      defaultPlace: 'Warszawa',
      objectionAddresseeSheetA: 'Dyrektor Generalny',
      evaluatorFlags: { minEvaluations: 6, centralShare: 0.75, leniencyPoints: 1.5 },
      appreciationGapDays: 120,
      smtp: {
        host: 'smtp.example.gov.pl',
        port: 587,
        user: 'sarmata',
        from: 'sarmata@example.gov.pl',
      },
    });
  });

  it('never carries the SMTP password flag into the values', () => {
    expect(Object.keys(settingsFormValues(demo))).not.toContain('smtpPassword');
  });
});

describe('needsRetentionConfirmation', () => {
  it('asks only when the period gets shorter and the warning is not confirmed', () => {
    expect(needsRetentionConfirmation(24, 12, false)).toBe(true);
    expect(needsRetentionConfirmation(24, 12, true)).toBe(false);
    expect(needsRetentionConfirmation(12, 24, false)).toBe(false);
    expect(needsRetentionConfirmation(12, 12, false)).toBe(false);
  });
});

describe('remapFieldErrors', () => {
  it('moves domain paths to control ids', () => {
    expect(
      remapFieldErrors(
        {
          'evaluatorFlags.centralShare': 'a',
          'smtp.from': 'b',
          'reminderLeadDays.2': 'c',
          other: 'd',
        },
        officeSettingsFieldMap,
      ),
    ).toEqual({ centralSharePercent: 'a', smtpFrom: 'b', reminderLeadDays: 'c', other: 'd' });
  });
});

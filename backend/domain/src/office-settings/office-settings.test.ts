import { describe, expect, it } from 'vitest';
import { officeSettingsPatchSchema } from './office-settings';

describe('officeSettingsPatchSchema', () => {
  it('lead days are deduplicated and sorted descending', () => {
    expect(officeSettingsPatchSchema.parse({ reminderLeadDays: [3, 14, 3] })).toEqual({
      reminderLeadDays: [14, 3],
    });
  });

  it('rejects zero lead days', () => {
    expect(officeSettingsPatchSchema.safeParse({ reminderLeadDays: [0] }).success).toBe(false);
  });

  it('rejects retention over 120 months', () => {
    expect(officeSettingsPatchSchema.safeParse({ notesRetentionMonths: 121 }).success).toBe(false);
  });

  it('accepts an empty patch and a partial smtp block', () => {
    expect(officeSettingsPatchSchema.parse({})).toEqual({});
    expect(officeSettingsPatchSchema.parse({ smtp: { host: null, port: 587 } })).toEqual({
      smtp: { host: null, port: 587 },
    });
  });

  it('accepts the default place and the sheet A addressee, null clears them', () => {
    expect(
      officeSettingsPatchSchema.parse({
        defaultPlace: ' Warszawa ',
        objectionAddresseeSheetA: null,
      }),
    ).toEqual({ defaultPlace: 'Warszawa', objectionAddresseeSheetA: null });
    expect(officeSettingsPatchSchema.safeParse({ defaultPlace: '  ' }).success).toBe(false);
  });

  it('thresholds are bounded', () => {
    expect(
      officeSettingsPatchSchema.safeParse({ evaluatorFlags: { centralShare: 0.3 } }).success,
    ).toBe(false);
    expect(
      officeSettingsPatchSchema.safeParse({ evaluatorFlags: { minEvaluations: 0 } }).success,
    ).toBe(false);
  });

  it('partial thresholds patch is accepted', () => {
    expect(officeSettingsPatchSchema.parse({ evaluatorFlags: { leniencyPoints: 1.5 } })).toEqual({
      evaluatorFlags: { leniencyPoints: 1.5 },
    });
  });

  it('office settings patch accepts appreciation gap days', () => {
    expect(officeSettingsPatchSchema.parse({ appreciationGapDays: 14 })).toEqual({
      appreciationGapDays: 14,
    });
  });

  it('rejects gap days over 365', () => {
    expect(officeSettingsPatchSchema.safeParse({ appreciationGapDays: 366 }).success).toBe(false);
    expect(officeSettingsPatchSchema.safeParse({ appreciationGapDays: 0 }).success).toBe(false);
  });

  it('rejects an invalid sender address', () => {
    expect(officeSettingsPatchSchema.safeParse({ smtp: { from: 'nope' } }).success).toBe(false);
  });
});

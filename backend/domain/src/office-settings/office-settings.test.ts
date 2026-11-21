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

  it('rejects an invalid sender address', () => {
    expect(officeSettingsPatchSchema.safeParse({ smtp: { from: 'nope' } }).success).toBe(false);
  });
});

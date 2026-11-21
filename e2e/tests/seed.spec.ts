import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  DEMO_OFFICE_NAME,
  DEMO_PASSWORD,
  demoAccounts,
  noOfficeAccount,
} from '../src/demo-accounts';

// The e2e demo accounts are written by hand next to the seed. This keeps them from drifting apart.
const read = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const seed = read('database/supabase/seed.sql');
const roleLabels = read('frontend/web/src/lib/role-labels.ts');

test.describe('demo accounts match the seed and the UI', () => {
  test('the seed holds the office, the password and the account without a membership', () => {
    expect(seed).toContain(DEMO_OFFICE_NAME);
    expect(seed).toContain(DEMO_PASSWORD);
    expect(seed).toContain(noOfficeAccount.email);
  });

  for (const account of demoAccounts) {
    test(`${account.role}: e-mail and role in the seed, label in the UI`, () => {
      expect(seed).toMatch(new RegExp(`${account.email}'[\\s\\S]{0,200}?'${account.role}'`));
      expect(roleLabels).toContain(`${account.role}: '${account.roleLabel}'`);
    });
  }
});

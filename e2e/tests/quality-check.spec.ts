import { expect, test } from '@playwright/test';
import { caseIdOf } from '../src/cases';
import { demoAccount } from '../src/demo-accounts';
import { expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

// Read-only: the panel renders next to the justification. Starting a check writes an AI run, and
// its result depends on the model, so the start itself is not clicked here.
test.describe('text quality check in part II', () => {
  test('Ewa: the justification offers the check with an optional criterion', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    const ewa = await caseIdOf(page, 'Ewa Ewidencyjna');
    await page.goto(`/oceny/${ewa}/czesc-2`);

    await expect(page.getByText('Kontrola jakości tekstu')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sprawdź tekst' })).toBeVisible();
    const criterion = page.getByLabel('Sprawdź pod kątem kryterium');
    await expect(criterion).toHaveValue('');
    // "Bez kryterium" and at least one criterion of the sheet.
    expect(await criterion.locator('option').count()).toBeGreaterThan(1);
    await expectNoViolations(page);
  });
});

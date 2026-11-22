import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

test.describe('notes page', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/notatki');
    await expect(page.getByRole('heading', { level: 1, name: 'Notatki' })).toBeVisible();
  });

  test('shows the version history of an edited note', async ({ page }) => {
    await page.getByRole('link', { name: /Historia zmian.*14\.09\.2026/ }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Historia zmian notatki' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Wersja 2, obecna' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Wersja 1' })).toBeVisible();
  });

  test('meets WCAG 2.1 AA', async ({ page }) => {
    await expectNoViolations(page);
  });
});

import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

test.describe('notes page', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/notatki');
    await expect(page.getByRole('heading', { level: 1, name: 'Notatki' })).toBeVisible();
  });

  test('lists every missing field of an empty note at once', async ({ page }) => {
    await page.getByRole('button', { name: 'Zapisz notatkę' }).click();
    const summary = errorSummary(page, 'Popraw notatkę');
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('link', { name: 'Wybierz pracownika' })).toBeVisible();
    await expect(summary.getByRole('link', { name: 'Wybierz rodzaj notatki' })).toBeVisible();
    await expect(summary.getByRole('link', { name: 'Wpisz treść notatki' })).toBeVisible();
    await expect(page).toHaveTitle(/^Błąd: /);
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

import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary } from '../src/page-checks';
import { signIn } from '../src/session';

// These tests change the demo data, so they run after the read-only ones (project `mutating`).
test.describe('employee changes', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
  });

  test('rejects the hr signal', async ({ page }) => {
    await page.goto('/pracownicy');
    await page
      .getByRole('table', { name: 'Lista pracowników' })
      .getByRole('link', { name: 'Marek Merytoryczny', exact: true })
      .click();
    const signal = page.getByRole('region', { name: 'Możliwe przeciążenie' });
    await signal.getByRole('button', { name: 'Nie zgadzam się z sygnałem' }).click();
    await expect(signal.getByText('Odrzucono')).toBeVisible();
  });

  test('adds an employee after fixing errors', async ({ page }) => {
    await page.goto('/pracownicy/nowy');
    await page.getByRole('button', { name: 'Dodaj pracownika' }).click();

    const summary = errorSummary(page, 'Popraw dane pracownika');
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('link', { name: 'Wpisz imię' })).toHaveAttribute(
      'href',
      '#firstName',
    );
    await expect(page).toHaveTitle(/^Błąd: /);

    const lastName = `Probny${Date.now()}`;
    await page.getByLabel('Imię', { exact: true }).fill('Piotr');
    await page.getByLabel('Nazwisko', { exact: true }).fill(lastName);
    await page.getByRole('button', { name: 'Dodaj pracownika' }).click();

    await expect(page).toHaveURL(/\/pracownicy\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1, name: `Piotr ${lastName}` })).toBeVisible();
    await expect(page.getByText('Dodano pracownika.')).toBeVisible();
    await expect(page.getByText('Brak ocen', { exact: true })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary } from '../src/page-checks';
import { signIn } from '../src/session';

/** A capitalized run of random letters, unlike any name in the demo data. */
function randomName(): string {
  const letters = Array.from({ length: 8 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join('');
  return letters.charAt(0).toUpperCase() + letters.slice(1);
}

// These tests change the demo data, so they run after the read-only ones (project `mutating`).
// A rerun without `pnpm db:reset` finds the signal already rejected, the test accepts that.
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
    await expect(signal).toBeVisible();
    const reject = signal.getByRole('button', { name: 'Nie zgadzam się z sygnałem' });
    if ((await reject.count()) > 0) await reject.click();
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

    // Random letters on both names, so a rerun does not match the person of the previous run.
    const firstName = randomName();
    const lastName = randomName();
    const lastNameField = page.getByLabel('Nazwisko', { exact: true });
    const grade = page.getByLabel('Stopień służbowy');

    // A grade is only for a civil servant, the default status is "Pracownik służby cywilnej".
    await lastNameField.fill(lastName);
    await grade.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Dodaj pracownika' }).click();
    await expect(
      summary.getByRole('link', {
        name: 'Stopień i rok mianowania podaje się tylko dla urzędnika służby cywilnej',
      }),
    ).toHaveAttribute('href', '#grade');
    await expect(summary.getByRole('link', { name: 'Wpisz imię' })).toBeVisible();
    await expect(page).toHaveTitle(/^Błąd: /);
    await expect(lastNameField).toHaveValue(lastName);

    await page.getByLabel('Imię', { exact: true }).fill(firstName);
    await grade.selectOption('');
    await page.getByRole('button', { name: 'Dodaj pracownika' }).click();

    await expect(page).toHaveURL(/\/pracownicy\/[0-9a-f-]{36}/);
    await expect(
      page.getByRole('heading', { level: 1, name: `${firstName} ${lastName}` }),
    ).toBeVisible();
    await expect(page.getByText('Dodano pracownika.')).toBeVisible();
    await expect(page.getByText('Brak ocen', { exact: true })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

// These tests save notes, so they run after the read-only ones (project `mutating`).
// The AI worker does not run during e2e, so every check waits for "Zapisz bez czekania na AI".
// A worker on the shared database could finish the check before that click, run them without one.
test.describe('saving notes', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
  });

  test('saves a sensitive note only after confirming the warning', async ({ page }) => {
    const body = `Był na zwolnieniu lekarskim po operacji. ${Date.now()}`;
    await page.goto('/pracownicy');
    await page
      .getByRole('table', { name: 'Lista pracowników' })
      .getByRole('link', { name: 'Marek Merytoryczny', exact: true })
      .click();
    await page.getByRole('link', { name: 'Dodaj notatkę' }).click();

    await page.getByRole('radio', { name: 'Obserwacja' }).check();
    await page.getByRole('radio', { name: 'Minus' }).check();
    await page.getByLabel('Treść notatki').fill(body);
    await page.getByRole('button', { name: 'Zapisz notatkę' }).click();
    await page.getByRole('button', { name: 'Zapisz bez czekania na AI' }).click();

    await expect(
      page.getByText('Notatka może zawierać dane wrażliwe', { exact: true }),
    ).toBeVisible();
    // Nothing is saved until the warning is confirmed, and the typed text stays.
    await expect(page.getByLabel('Treść notatki')).toHaveValue(body);
    await page.getByRole('checkbox', { name: /Rozumiem ryzyko/ }).check();
    await page.getByRole('button', { name: 'Zapisz mimo ostrzeżeń' }).click();

    await expect(page.getByText('Zapisano notatkę.')).toBeVisible();
    await expect(page.getByText(body)).toBeVisible();
  });

  test('saves a plain note from the notes page', async ({ page }) => {
    const body = `Sprawnie poprowadziła spotkanie z klientem. ${Date.now()}`;
    await page.goto('/notatki');
    await page.getByLabel('Pracownik', { exact: true }).selectOption({ label: 'Ewa Ewidencyjna' });
    await page.getByRole('radio', { name: 'Obserwacja' }).check();
    await page.getByRole('radio', { name: 'Plus' }).check();
    await page.getByLabel('Treść notatki').fill(body);
    await page.getByRole('button', { name: 'Zapisz notatkę' }).click();
    await page.getByRole('button', { name: 'Zapisz bez czekania na AI' }).click();

    await expect(page.getByText('Zapisano notatkę.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Twoje notatki' })).toBeVisible();
    await expect(page.getByText(body)).toBeVisible();
    // The form starts over, so a second click cannot save the same note again.
    await expect(page.getByLabel('Treść notatki')).toHaveValue('');
    await expect(page.getByRole('radio', { name: 'Plus' })).not.toBeChecked();
  });
});

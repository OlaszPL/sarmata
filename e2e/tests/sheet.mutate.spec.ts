import { expect, test } from '@playwright/test';
import { caseIdOf } from '../src/cases';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

// These tests change the demo data, so they run in the "mutating" project after the read-only
// specs, one after another. They start from a freshly reset database.
test.describe.serial('case sheet changes', () => {
  test('Marek: recording the evaluation interview opens part II', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    const marek = await caseIdOf(page, 'Marek Merytoryczny');
    await page.goto(`/oceny/${marek}/czesc-2`);

    const heldOn = page.getByLabel('Data rozmowy oceniającej');
    await heldOn.fill(await heldOn.inputValue());
    await page.getByRole('button', { name: 'Odnotuj rozmowę oceniającą' }).click();

    const stages = page.getByRole('main').getByRole('list', { name: 'Etapy oceny' });
    await expect(stages.locator('[aria-current="step"]')).toContainText('Część II');
    await expect(page.getByRole('button', { name: 'Sprawdź i zatwierdź ocenę' })).toBeVisible();
  });

  test('Ewa: conclusions then approval moves to acquaintance', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    const ewa = await caseIdOf(page, 'Ewa Ewidencyjna');
    await page.goto(`/oceny/${ewa}/czesc-2`);

    await page
      .locator('#developmentConclusions')
      .fill('Rozwijać umiejętność prowadzenia rejestrów w nowym systemie.');
    await expect(page.getByText(/Zapisano o/)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('heading', { level: 2, name: /Zanim zatwierdzisz ocenę/ }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Sprawdź i zatwierdź ocenę' }).click();
    await expect(page).toHaveURL(/\/sprawdz$/);

    await page.getByRole('button', { name: 'Zatwierdź i przekaż do zapoznania' }).click();
    await expect(page.getByText('Arkusz zatwierdzony.')).toBeVisible();
    const stages = page.getByRole('main').getByRole('list', { name: 'Etapy oceny' });
    await expect(stages.locator('[aria-current="step"]')).toContainText('Zapoznanie');
  });
});

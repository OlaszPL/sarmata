import { expect, test } from '@playwright/test';
import { caseIdOf, nextServerAction } from '../src/cases';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

// Changes the demo data, so it runs in the "mutating" project, one file after another in name order.
// It approves Ewa's sheet through the UI, which case-events.mutate.spec.ts then takes from the
// drafted state (acquaintance and closing), so this file sorts before it.
test.describe.serial('case sheet approval', () => {
  test('Ewa: conclusions then approval moves to acquaintance', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    const ewa = await caseIdOf(page, 'Ewa Ewidencyjna');
    await page.goto(`/oceny/${ewa}/czesc-2`);

    // Typed right after the load, possibly before hydration: the autosave still sends it.
    const saved = nextServerAction(page);
    await page
      .locator('#developmentConclusions')
      .fill('Rozwijać umiejętność prowadzenia rejestrów w nowym systemie.');
    await saved;
    await expect(page.getByText(/Zapisano o/)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Zanim zatwierdzisz ocenę/ }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Sprawdź i zatwierdź ocenę' }).click();
    await expect(page).toHaveURL(/\/sprawdz$/);

    await page.getByRole('button', { name: 'Zatwierdź i przekaż do zapoznania' }).click();
    await expect(page.getByText('Arkusz zatwierdzony.')).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('heading', { level: 2, name: 'Zatwierdzony arkusz' }),
    ).toBeVisible();
    const stages = page.getByRole('main').getByRole('list', { name: 'Etapy oceny' });
    await expect(stages.locator('[aria-current="step"]')).toContainText('Zapoznanie');
  });
});

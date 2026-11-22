import { expect, test, type Page, type Response } from '@playwright/test';
import { caseIdOf } from '../src/cases';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

/**
 * The response of the next server action call (a POST with the `Next-Action` header), e.g. an
 * autosave. Its arrival also proves the page is hydrated, without waiting a fixed time.
 */
function nextServerAction(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && 'next-action' in response.request().headers(),
  );
}

// These tests change the demo data, so they run in the "mutating" project after the read-only
// specs, one after another. They start from a freshly reset database.
test.describe.serial('case sheet changes', () => {
  test('Marek: recording the evaluation interview opens part II', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    const marek = await caseIdOf(page, 'Marek Merytoryczny');
    await page.goto(`/oceny/${marek}/czesc-2`);

    // A tile chosen right after the load is saved by the autosave, also when it was clicked before
    // hydration (the editor takes over what the controls hold). The autosave also means the page is
    // hydrated, so the button below submits through React.
    const firstCriterion = page.locator('#part-two section[aria-labelledby^="criterion-"]').first();
    const tiles = firstCriterion.getByRole('radiogroup');
    const nine = tiles.locator('input[type="radio"][value="9"]');
    await expect(nine).not.toBeChecked();
    const tileSaved = nextServerAction(page);
    await tiles.locator('label:has(input[value="9"])').click();
    await expect(nine).toBeChecked();
    await tileSaved;

    // A draft saved by the button keeps the chosen tile (no form reset), and the next autosave
    // stores it, so it is still there after a reload.
    await page.getByRole('button', { name: 'Zapisz szkic' }).click();
    await expect(page.getByText(/Zapisano o/)).toBeVisible({ timeout: 15_000 });
    await expect(nine).toBeChecked();
    const textSaved = nextServerAction(page);
    await page.locator('#justification').fill('Szkic uzasadnienia przed rozmową.');
    await textSaved;

    // The editor has its own interview date field with the same label, so the id picks the form's.
    const heldOn = page.locator('#heldOn');
    await heldOn.fill(await heldOn.inputValue());
    await page.getByRole('button', { name: 'Odnotuj rozmowę oceniającą' }).click();

    await expect(page.locator(':focus')).toContainText('Rozmowę odnotowano.');
    const stages = page.getByRole('main').getByRole('list', { name: 'Etapy oceny' });
    await expect(stages.locator('[aria-current="step"]')).toContainText('Część II');
    await expect(page.getByRole('button', { name: 'Sprawdź i zatwierdź ocenę' })).toBeVisible();

    await page.reload();
    await expect(nine).toBeChecked();
    await expect(page.locator('#justification')).toHaveValue('Szkic uzasadnienia przed rozmową.');
  });

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

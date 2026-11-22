import { expect, test } from '@playwright/test';
import { caseIdOf, nextServerAction } from '../src/cases';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

// Changes the demo data, so it runs in the "mutating" project, one file after another in name order.
// Marek must still be in the evaluation period when case-events.mutate.spec.ts records his side
// events, so this file sorts after it.
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
    const draftSaved = nextServerAction(page);
    await page.getByRole('button', { name: 'Zapisz szkic' }).click();
    await draftSaved;
    await expect(page.getByText(/Zapisano o/)).toBeVisible();
    await expect(nine).toBeChecked();

    // Text typed right before recording the interview is saved first, within the autosave pause.
    // The editor has its own interview date field with the same label, so the id picks the form's.
    const justification = 'Szkic uzasadnienia przed rozmową.';
    const textSaved = nextServerAction(page, justification);
    await page.locator('#justification').fill(justification);
    const heldOn = page.locator('#heldOn');
    const heldOnValue = await heldOn.inputValue();
    await page.getByRole('button', { name: 'Odnotuj rozmowę oceniającą' }).click();
    await textSaved;

    await expect(page.locator(':focus')).toContainText('Rozmowę odnotowano.');
    const stages = page.getByRole('main').getByRole('list', { name: 'Etapy oceny' });
    await expect(stages.locator('[aria-current="step"]')).toContainText('Część II');
    await expect(page.getByRole('button', { name: 'Sprawdź i zatwierdź ocenę' })).toBeVisible();

    await page.reload();
    await expect(nine).toBeChecked();
    await expect(page.locator('#justification')).toHaveValue(justification);
    // The sheet save before the interview did not wipe the interview date the action set.
    await expect(page.locator('#interviewOn')).toHaveValue(heldOnValue);
  });
});

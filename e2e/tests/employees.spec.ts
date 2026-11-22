import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { expectNoSidewaysScroll, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

/** Opens the card of a person by clicking the name on the employee list. */
async function openCard(page: Page, name: string): Promise<void> {
  await page.goto('/pracownicy');
  await page
    .getByRole('table', { name: 'Lista pracowników' })
    .getByRole('link', { name, exact: true })
    .click();
  await expect(page).toHaveURL(/\/pracownicy\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test.describe('employee list and card', () => {
  test("lists the evaluator's people with the current stage", async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/pracownicy');
    await expect(page.getByRole('heading', { level: 1, name: 'Moi pracownicy' })).toBeVisible();

    const table = page.getByRole('table', { name: 'Lista pracowników' });
    for (const name of ['Marek Merytoryczny', 'Ewa Ewidencyjna', 'Stefan Sprzeciwny']) {
      await expect(table.getByRole('rowheader', { name })).toBeVisible();
    }

    await page.getByLabel('Szukaj po imieniu, nazwisku, stanowisku').fill('merytor');
    await page.getByRole('button', { name: 'Szukaj' }).click();
    await expect(table.getByRole('rowheader')).toHaveCount(1);
    await expect(table.getByRole('rowheader', { name: 'Marek Merytoryczny' })).toBeVisible();
  });

  test('shows the card of Marek with the hr signal and the rating history', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await openCard(page, 'Marek Merytoryczny');

    const panel = page.getByRole('complementary', { name: 'HR partner' });
    await expect(panel.getByText('Możliwe przeciążenie')).toBeVisible();
    await expect(panel.getByText('71%')).toBeVisible();

    await expect(page.getByRole('heading', { level: 2, name: 'Przebieg ocen' })).toBeVisible();
    await expect(page.getByText('Okres oceny trwa')).toBeVisible();
  });

  test('shows the archived evaluation of Stefan', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await openCard(page, 'Stefan Sprzeciwny');
    await expect(page.getByRole('heading', { level: 3, name: '2023' })).toBeVisible();
    await expect(page.getByText('Archiwalna, wpisana ręcznie').first()).toBeVisible();
  });

  test('hides writing actions from the admin', async ({ page }) => {
    await signIn(page, demoAccount('admin'));
    await openCard(page, 'Marek Merytoryczny');
    await expect(page.getByRole('link', { name: 'Dodaj notatkę' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Przeanalizuj notatki' })).toHaveCount(0);
    // Admin does not read notes, so the card says who does instead of an empty list.
    await expect(
      page.getByText(
        'Notatki o tej osobie czytają autor, kadry i osoba prowadząca jej otwartą ocenę.',
      ),
    ).toBeVisible();
    await expect(page.getByText('Brak notatek', { exact: true })).toHaveCount(0);
    const panel = page.getByRole('complementary', { name: 'HR partner' });
    await expect(
      panel.getByText(
        'Analizy HR partnera czytają autor, kadry i osoba prowadząca otwartą ocenę tej osoby.',
      ),
    ).toBeVisible();
  });

  test('shows hr actions to hr only', async ({ page }) => {
    await signIn(page, demoAccount('hr'));
    await openCard(page, 'Marek Merytoryczny');
    await expect(page.getByRole('heading', { name: 'Wpisz ocenę archiwalną' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zakończ zatrudnienie' })).toBeVisible();
    await page.context().clearCookies();

    await signIn(page, demoAccount('evaluator'));
    await openCard(page, 'Marek Merytoryczny');
    await expect(page.getByRole('heading', { name: 'Wpisz ocenę archiwalną' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zakończ zatrudnienie' })).toHaveCount(0);
  });

  test('meets WCAG 2.1 AA', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/pracownicy');
    await expect(page.getByRole('heading', { level: 1, name: 'Moi pracownicy' })).toBeVisible();
    await expectNoViolations(page);

    await page.goto('/pracownicy/nowy');
    await expect(page.getByRole('heading', { level: 1, name: 'Nowy pracownik' })).toBeVisible();
    await expectNoViolations(page);

    await openCard(page, 'Marek Merytoryczny');
    await expectNoViolations(page);
    await page.setViewportSize({ width: 400, height: 900 });
    await expectNoSidewaysScroll(page);
  });
});

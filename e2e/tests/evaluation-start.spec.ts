import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary, expectNoSidewaysScroll, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

/** Opens the case of an employee from the evaluations list. */
async function openCase(page: Page, name: string): Promise<void> {
  await page.goto('/oceny');
  await page.getByRole('main').getByRole('link', { name }).first().click();
  await expect(page).toHaveURL(/\/oceny\/[0-9a-f-]{36}$/);
}

test.describe('evaluations list', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/oceny');
  });

  test('lists the demo evaluations and filters them by stage', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Oceny' })).toBeVisible();
    const table = page.getByRole('table', { name: 'Oceny okresowe' });
    for (const name of ['Ewa Ewidencyjna', 'Marek Merytoryczny', 'Stefan Sprzeciwny']) {
      await expect(table.getByRole('link', { name })).toBeVisible();
    }

    await page.getByLabel('Etap').selectOption({ label: 'Okres oceny' });
    await page.getByRole('button', { name: 'Pokaż oceny' }).click();
    await expect(page).toHaveURL(/status=period/);
    await expect(table.getByRole('link', { name: 'Marek Merytoryczny' })).toBeVisible();
    await expect(table.getByRole('link', { name: 'Ewa Ewidencyjna' })).toHaveCount(0);
  });

  test('shows an empty state when no evaluation matches', async ({ page }) => {
    await page.goto('/oceny?status=interrupted');
    await expect(page.getByText('Żadna ocena nie pasuje do filtrów')).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Wyczyść filtry' }).last(),
    ).toBeVisible();
  });

  test('filters fit a narrow screen with larger text', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sarmata.textSize', 'large');
    });
    await page.setViewportSize({ width: 400, height: 900 });
    await page.reload();
    await expect(page.getByLabel('Pracownik')).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test('meets WCAG 2.1 AA and fits a narrow screen', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Oceny' })).toBeVisible();
    await expectNoViolations(page);
    await page.setViewportSize({ width: 400, height: 900 });
    await expectNoSidewaysScroll(page);
  });
});

test.describe('case overview', () => {
  test('shows the next step, the missing field and the case data of Ewa', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await openCase(page, 'Ewa Ewidencyjna');
    const main = page.getByRole('main');
    await expect(main.getByText('Wpisz wnioski do IPRZ i zatwierdź ocenę')).toBeVisible();
    await expect(main.getByRole('link', { name: 'Przejdź do części II' })).toHaveAttribute(
      'href',
      /\/czesc-2$/,
    );
    await expect(main.getByRole('link', { name: /wnioski/i }).first()).toHaveAttribute(
      'href',
      /\/czesc-2#developmentConclusions$/,
    );
    await expectNoViolations(page);
  });
});

test.describe('new evaluation', () => {
  test('refuses an employee with an evaluation in progress', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/oceny/nowa');
    await page.getByLabel('Szukaj pracownika').fill('Ewa');
    await page.getByRole('button', { name: 'Szukaj' }).click();
    await page.getByRole('radio', { name: /Ewa Ewidencyjna/ }).check();
    await page.getByRole('button', { name: 'Dalej' }).click();
    await page.getByRole('button', { name: 'Rozpocznij ocenę' }).click();

    const summary = errorSummary(page, 'Nie udało się rozpocząć oceny');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Ten pracownik ma już ocenę w toku');
    await expect(summary).toBeFocused();
    await expect(page).toHaveTitle(/^Błąd: /);
    await expectNoViolations(page);
  });

  test('asks for a choice when nobody is picked', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/oceny/nowa');
    await page.getByRole('button', { name: 'Dalej' }).click();
    const summary = errorSummary(page, 'Nie można przejść dalej');
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('link', { name: 'Wybierz pracownika' })).toHaveAttribute(
      'href',
      '#pracownik',
    );
    await expect(page).toHaveTitle(/^Błąd: /);
  });

  test('admin cannot start an evaluation', async ({ page }) => {
    await signIn(page, demoAccount('admin'));
    await page.goto('/oceny/nowa');
    await expect(page.getByText(/Ocenę rozpoczyna osoba oceniająca albo kadry/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dalej' })).toHaveCount(0);
    await expectNoViolations(page);
  });
});

test('admin sees part I of Ewa without forms', async ({ page }) => {
  await signIn(page, demoAccount('admin'));
  await openCase(page, 'Ewa Ewidencyjna');
  await page
    .getByRole('navigation', { name: 'Części sprawy' })
    .getByRole('link', { name: /^Część I Kryteria/ })
    .click();
  await expect(page).toHaveURL(/\/czesc-1$/);
  await expect(page.getByRole('heading', { level: 2, name: /Część I/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zatwierdź część I|Odnotuj podpis/ })).toHaveCount(
    0,
  );
  await expectNoViolations(page);
});

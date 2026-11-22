import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations).toEqual([]);
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The GOV.UK error summary: a focusable block led by its H2 title. */
function errorSummary(page: Page, title: string) {
  return page.locator('[tabindex="-1"]', {
    has: page.getByRole('heading', { level: 2, name: title }),
  });
}

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
      page.getByRole('main').getByRole('link', { name: 'Wyczyść filtry' }),
    ).toBeVisible();
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

// Starts a real evaluation, so the steps share one browser page and run in order.
test.describe.serial('new evaluation of Anna through part I', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signIn(page, demoAccount('evaluator'));
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('finds Anna despite a typo and proposes sheet C', async () => {
    await page.goto('/oceny/nowa');
    await page.getByLabel('Szukaj pracownika').fill('Ana Administracyjna');
    await page.getByRole('button', { name: 'Szukaj' }).click();
    await page.getByRole('radio', { name: /Anna Administracyjna/ }).check();
    await page.getByRole('button', { name: 'Dalej' }).click();
    await expect(page.getByRole('radio', { name: /Arkusz C/ })).toBeChecked();
    await expectNoViolations(page);
    await page.getByRole('button', { name: 'Rozpocznij ocenę' }).click();
    await expect(page).toHaveURL(/\/oceny\/[0-9a-f-]{36}\/czesc-1$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Anna Administracyjna' }),
    ).toBeVisible();
  });

  test('part I rejects too many additional criteria and keeps the ticks', async () => {
    const criteria = page.getByRole('group', { name: /Kryteria dodatkowe/ }).getByRole('checkbox');
    for (let index = 0; index < 4; index += 1) await criteria.nth(index).check();
    await page.getByRole('button', { name: 'Zatwierdź część I' }).click();

    const summary = errorSummary(page, 'Popraw część I');
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('link').first()).toHaveAttribute('href', '#additionalCriteria');
    await expect(page).toHaveTitle(/^Błąd: /);
    for (let index = 0; index < 4; index += 1) await expect(criteria.nth(index)).toBeChecked();
    await expectNoViolations(page);
  });

  test('part I approves with one criterion and records the signature', async () => {
    const criteria = page.getByRole('group', { name: /Kryteria dodatkowe/ }).getByRole('checkbox');
    for (let index = 1; index < 4; index += 1) await criteria.nth(index).uncheck();
    await page.getByRole('button', { name: 'Zatwierdź część I' }).click();

    await expect(page.getByRole('button', { name: 'Odnotuj podpis części I' })).toBeVisible();
    await expect(page).not.toHaveTitle(/^Błąd: /);
    await page.getByRole('button', { name: 'Odnotuj podpis części I' }).click();

    const stages = page.getByRole('list', { name: 'Etapy oceny' });
    await expect(stages.locator('[aria-current="step"]')).toContainText('Okres oceny');
    await expect(
      page.getByText('Część I jest zatwierdzona i nie można jej zmienić.'),
    ).toBeVisible();
    await expectNoViolations(page);
  });

  test('the journal lists the entries with their author', async () => {
    await page
      .getByRole('navigation', { name: 'Części sprawy' })
      .getByRole('link', { name: /^Dziennik/ })
      .click();
    await expect(page).toHaveURL(/\/dziennik$/);
    const table = page.getByRole('table', { name: 'Dziennik zdarzeń oceny' });
    for (const label of [
      'Ocena rozpoczęta',
      'Część I zatwierdzona',
      'Podpis części I odnotowany',
    ]) {
      await expect(table.getByRole('rowheader', { name: new RegExp(label) })).toBeVisible();
    }
    await expect(table).toContainText('Olga Oceniająca');
    await expectNoViolations(page);
    await page.setViewportSize({ width: 400, height: 900 });
    await expectNoSidewaysScroll(page);
  });
});

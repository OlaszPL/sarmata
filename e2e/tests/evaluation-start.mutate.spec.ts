import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary, expectNoSidewaysScroll, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

// Starts a real evaluation, so the steps share one browser page and run in order.
test.describe.serial('new evaluation of Anna through part I', () => {
  let page: Page;
  let interviewDate = '';

  test.beforeAll(async ({ browser }) => {
    // AxeBuilder needs a page of an explicit context.
    page = await (await browser.newContext()).newPage();
    await signIn(page, demoAccount('evaluator'));
  });

  test.afterAll(async () => {
    await page.context().close();
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
    // A missing interview date must not hide the gate errors: everything is listed at once.
    const interview = page.getByLabel('Data rozmowy rozpoczynającej');
    interviewDate = await interview.inputValue();
    await interview.fill('');
    await page.getByRole('button', { name: 'Zatwierdź część I' }).click();

    const summary = errorSummary(page, 'Popraw część I');
    await expect(summary.getByRole('link')).toHaveCount(2);
    await expect(summary.getByRole('link').nth(1)).toHaveAttribute('href', '#startingInterviewOn');
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
    await page.getByLabel('Data rozmowy rozpoczynającej').fill(interviewDate);
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

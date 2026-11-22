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

/** Opens the events tab of an employee's case from the evaluations list. */
async function openEvents(page: Page, name: string): Promise<void> {
  await page.goto('/oceny');
  await page.getByRole('main').getByRole('link', { name }).first().click();
  await expect(page).toHaveURL(/\/oceny\/[0-9a-f-]{36}$/);
  await page.goto(`${new URL(page.url()).pathname}/zdarzenia`);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Zapoznanie i sprzeciw' }),
  ).toBeVisible();
}

test.describe('events tab of the objection case of Stefan', () => {
  test('the evaluator sees who decides and no forms of the decision or interruption', async ({
    page,
  }) => {
    await signIn(page, demoAccount('evaluator'));
    await openEvents(page, 'Stefan Sprzeciwny');
    const main = page.getByRole('main');
    await expect(main.getByText('Sprzeciw rozpatrzują kadry')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Zapisz wynik sprzeciwu' })).toHaveCount(0);
    await expect(main.getByRole('heading', { level: 2, name: 'Przerwanie oceny' })).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('the admin has no forms of the stage but sees the sheet correction', async ({ page }) => {
    await signIn(page, demoAccount('admin'));
    await openEvents(page, 'Stefan Sprzeciwny');
    const main = page.getByRole('main');
    for (const name of ['Zapisz wynik sprzeciwu', 'Przerwij ocenę', 'Odnotuj nieobecność']) {
      await expect(main.getByRole('button', { name })).toHaveCount(0);
    }
    await expect(main.getByRole('heading', { level: 2, name: 'Korekta arkusza' })).toBeVisible();
  });

  test('hr reveals the rating tiles for a changed outcome and fits a narrow screen', async ({
    page,
  }) => {
    await signIn(page, demoAccount('hr'));
    await openEvents(page, 'Stefan Sprzeciwny');
    const decision = page.locator('form', { has: page.locator('#decision-outcome') });
    await expect(decision.getByRole('radiogroup')).toHaveCount(0);
    await decision.getByRole('radio', { name: /^Zmiana oceny/ }).check();
    await expect(decision.getByRole('radiogroup').first()).toBeVisible();
    await expectNoViolations(page);
    await page.setViewportSize({ width: 400, height: 900 });
    await expectNoSidewaysScroll(page);
  });
});

test('the evaluator sees the notice and the empty side events of Marek in the period', async ({
  page,
}) => {
  await signIn(page, demoAccount('evaluator'));
  await openEvents(page, 'Marek Merytoryczny');
  const main = page.getByRole('main');
  await expect(main.getByText('Zapoznanie odnotujesz po zatwierdzeniu arkusza')).toBeVisible();
  await expect(main.getByRole('heading', { level: 2, name: 'Zdarzenia boczne' })).toBeVisible();
  await expect(main.getByText('Nie odnotowano zdarzeń bocznych.')).toBeVisible();
  await expectNoViolations(page);
});

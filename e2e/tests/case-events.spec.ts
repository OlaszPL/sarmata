import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary, expectNoSidewaysScroll, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

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
    await expect(main.getByText('Sprzeciw rozpatrują kadry')).toBeVisible();
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

test('hr keeps the chosen evaluator after a missing reason', async ({ page }) => {
  await signIn(page, demoAccount('hr'));
  await openEvents(page, 'Marek Merytoryczny');
  await page.locator('summary', { hasText: 'Zmień osobę oceniającą' }).click();
  const person = page.getByLabel('Nowa osoba oceniająca');
  await person.selectOption({ index: 1 });
  const chosen = await person.inputValue();
  await page.getByRole('button', { name: 'Zmień osobę oceniającą' }).click();

  await expect(errorSummary(page, 'Popraw zmianę osoby oceniającej')).toBeFocused();
  await expect(person).toHaveValue(chosen);
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

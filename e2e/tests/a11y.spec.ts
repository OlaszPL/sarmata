import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

// WCAG 2.1 AA: the legal minimum (docs/sources/ux-standardy/FINDINGS.md, section 1).
const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations).toEqual([]);
}

test('sign-in page meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/logowanie');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expectNoViolations(page);
});

test('sign-in page with errors meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/logowanie');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page.getByText('Popraw dane w formularzu')).toBeVisible();
  await expectNoViolations(page);
});

for (const role of ['hr', 'evaluator']) {
  test(`signed-in shell as ${role} meets WCAG 2.1 AA`, async ({ page }) => {
    await signIn(page, demoAccount(role));
    await expectNoViolations(page);
  });
}

test('accessibility statement meets WCAG 2.1 AA', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  await page.goto('/deklaracja-dostepnosci');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Deklaracja dostępności' }),
  ).toBeVisible();
  await expectNoViolations(page);
});

test('first Tab stop is the skip link and the current section is marked', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  // A fresh page load: after the sign-in redirect the focus stays where the form left it.
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Przejdź do treści' })).toBeFocused();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Pulpit' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

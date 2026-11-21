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

test('signed-in shell meets WCAG 2.1 AA', async ({ page }) => {
  await signIn(page, demoAccount('hr'));
  await expectNoViolations(page);
});

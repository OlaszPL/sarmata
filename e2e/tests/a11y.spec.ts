import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { accountMenuButton, signIn } from '../src/session';

// WCAG 2.1 AA: the legal minimum (docs/sources/ux-standardy/FINDINGS.md, section 1).
const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/\S/);
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

test('an unknown case shows the Polish not-found page', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  // A case link from before a database reset: the demo evaluations get new ids.
  const response = await page.goto('/oceny/00000000-0000-4000-8000-000000000000');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Nie znaleziono strony' }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/^Nie znaleziono strony/);
  await expect(page.getByRole('link', { name: 'Przejdź do pulpitu' })).toBeVisible();
  await expectNoViolations(page);
});

test('accessibility statement is public and meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/logowanie');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Deklaracja dostępności' }).click();
  await expect(page).toHaveURL(/\/deklaracja-dostepnosci$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Deklaracja dostępności' }),
  ).toBeVisible();
  await expectNoViolations(page);
});

test('accessibility statement for a member meets WCAG 2.1 AA', async ({ page }) => {
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

test('focus is visible on the navy header cells', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  for (const name of [/^Sarmata/, 'Nowa ocena']) {
    const link = page.getByRole('banner').getByRole('link', { name });
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const ring = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle, shadow: style.boxShadow };
    });
    expect(ring.outline).not.toBe('none');
    expect(ring.shadow).toContain('rgb(255, 255, 255)');
  }
});

test('accessibility tools show their state and survive a reload', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  const larger = page.getByRole('button', { name: 'A+ Powiększ tekst' });
  const contrast = page.getByRole('button', { name: 'Wysoki kontrast' });
  await expect(larger).toHaveAttribute('aria-pressed', 'false');
  await larger.click();
  await contrast.click();
  await expect(larger).toHaveAttribute('aria-pressed', 'true');
  await expect(contrast).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await expect(larger).toHaveAttribute('aria-pressed', 'true');
  await expect(contrast).toHaveAttribute('aria-pressed', 'true');
  await expectNoViolations(page);
});

test('account menu opens, closes with Escape and returns focus', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  const menu = accountMenuButton(page);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Wyloguj się' })).toBeVisible();
  await expectNoViolations(page);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Wyloguj się' })).toBeHidden();
  await expect(menu).toBeFocused();
});

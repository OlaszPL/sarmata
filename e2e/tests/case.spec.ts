import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('evaluation case frame', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page
      .getByRole('region', { name: 'Zrób teraz' })
      .getByRole('link', { name: 'Ewa Ewidencyjna' })
      .click();
    await expect(page).toHaveURL(/\/oceny\/[0-9a-f-]{36}$/);
  });

  test('opens the case of Ewa with the hero, stages and tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Ewa Ewidencyjna' })).toBeVisible();
    await expect(page).toHaveTitle(/Przegląd sprawy, Ewa Ewidencyjna/);
    const main = page.getByRole('main');
    await expect(main.getByText('Arkusz C', { exact: true })).toBeVisible();
    await expect(main.getByText('Wynik na żywo')).toBeVisible();

    const stages = main.getByRole('list', { name: 'Etapy oceny' });
    await expect(stages.locator('[aria-current="step"]')).toContainText('Część II');

    const tabs = main.getByRole('navigation', { name: 'Części sprawy' });
    await expect(tabs.getByRole('link', { name: 'Przegląd sprawy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(main.getByRole('heading', { level: 2, name: 'Przegląd sprawy' })).toBeVisible();

    await tabs.getByRole('link', { name: /Część II/ }).click();
    await expect(page).toHaveURL(/\/czesc-2$/);
    await expect(tabs.getByRole('link', { name: /Część II/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(main.getByRole('heading', { level: 2, name: /Część II/ })).toBeVisible();

    const side = page.getByRole('complementary', { name: 'Informacje o sprawie' });
    await expect(side.getByRole('link', { name: 'Arkusz PDF według wzoru' })).toHaveAttribute(
      'href',
      /\/api\/oceny\/[0-9a-f-]{36}\/eksport\/arkusz-pdf$/,
    );
    await expect(side.locator('li', { hasText: 'Ta ocena' })).toContainText('6 do 8');
  });

  test('meets WCAG 2.1 AA', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Ewa Ewidencyjna' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
    expect(results.violations).toEqual([]);
  });

  test('does not scroll sideways on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await expect(page.getByRole('heading', { level: 1, name: 'Ewa Ewidencyjna' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('unknown case id gives the not found page', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  const response = await page.goto('/oceny/00000000-0000-4000-8000-000000000000');
  expect(response?.status()).toBe(404);
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { caseIdOf } from '../src/cases';
import { demoAccount } from '../src/demo-accounts';
import { signIn, signOut } from '../src/session';

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const GATE_TITLE = 'Zanim zatwierdzisz ocenę, uzupełnij 1 pole';

/** Signs in as the evaluator and returns the ids of the cases of Ewa and Marek (seed state). */
async function evaluatorCases(page: Page): Promise<{ ewa: string; marek: string }> {
  await signIn(page, demoAccount('evaluator'));
  return {
    ewa: await caseIdOf(page, 'Ewa Ewidencyjna'),
    marek: await caseIdOf(page, 'Marek Merytoryczny'),
  };
}

test.describe('case sheet', () => {
  test('part II of Ewa shows the IPRZ gate and links to the field', async ({ page }) => {
    const { ewa } = await evaluatorCases(page);
    await page.goto(`/oceny/${ewa}/czesc-2`);

    const banner = page.getByRole('heading', { level: 2, name: GATE_TITLE }).locator('..');
    await expect(banner).toBeVisible();
    const link = banner.getByRole('link');
    await expect(link).toHaveAttribute('href', /#developmentConclusions$/);

    await link.click();
    await expect(page.locator('#developmentConclusions')).toBeFocused();
  });

  test('check page of Ewa lists the gate and hides the approval', async ({ page }) => {
    const { ewa } = await evaluatorCases(page);
    await page.goto(`/oceny/${ewa}/sprawdz`);

    const summary = page.getByRole('heading', { level: 2, name: GATE_TITLE }).locator('..');
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('link')).toHaveAttribute(
      'href',
      /\/czesc-2#developmentConclusions$/,
    );
    await expect(
      page.getByRole('button', { name: 'Zatwierdź i przekaż do zapoznania' }),
    ).toHaveCount(0);
  });

  test('meets WCAG 2.1 AA on parts II, III and the check page', async ({ page }) => {
    const { ewa, marek } = await evaluatorCases(page);
    const paths = [
      `/oceny/${ewa}/czesc-2`,
      `/oceny/${ewa}/czesc-3`,
      `/oceny/${ewa}/sprawdz`,
      `/oceny/${marek}/czesc-2`,
    ];
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
      expect(results.violations, path).toEqual([]);
    }
  });

  test('hr sees the sheet read only', async ({ page }) => {
    const { ewa } = await evaluatorCases(page);
    await signOut(page);
    await signIn(page, demoAccount('hr'));
    const main = page.getByRole('main');

    await page.goto(`/oceny/${ewa}/czesc-2`);
    await expect(main.getByText('Arkusz jest tylko do odczytu.')).toBeVisible();
    await expect(main.locator('form:has(button[type="submit"])')).toHaveCount(0);

    await page.goto(`/oceny/${ewa}/czesc-3`);
    await expect(main.getByText('Arkusz jest tylko do odczytu.')).toBeVisible();
    await expect(main.locator('form:has(button[type="submit"])')).toHaveCount(0);

    await page.goto(`/oceny/${ewa}/sprawdz`);
    await expect(main.getByRole('heading', { level: 2, name: 'Arkusz oceny' })).toBeVisible();
    await expect(main.getByText('Arkusz jest tylko do odczytu.')).toBeVisible();
    await expect(main.locator('form:has(button[type="submit"])')).toHaveCount(0);
  });

  test('part II of Marek shows the seeded AI draft', async ({ page }) => {
    const { marek } = await evaluatorCases(page);
    await page.goto(`/oceny/${marek}/czesc-2`);
    await expect(
      page.getByRole('heading', { level: 3, name: /^Szkic AI jest gotowy/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Przyjmij \d$/ }).first()).toBeVisible();
  });

  test('does not scroll sideways at 400 px', async ({ page }) => {
    const { ewa } = await evaluatorCases(page);
    await page.setViewportSize({ width: 400, height: 900 });
    await page.goto(`/oceny/${ewa}/czesc-2`);
    await expect(page.getByRole('heading', { level: 1, name: 'Ewa Ewidencyjna' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

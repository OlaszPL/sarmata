import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations).toEqual([]);
}

export async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The GOV.UK error summary: a focusable block led by its H2 title. */
export function errorSummary(page: Page, title: string) {
  return page.locator('div[tabindex="-1"][aria-labelledby]', {
    has: page.getByRole('heading', { level: 2, name: title }),
  });
}

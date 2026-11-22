import { randomUUID } from 'node:crypto';
import { type Page, expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary, expectNoSidewaysScroll, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

async function guideOrder(page: Page): Promise<string[]> {
  const titles = await page.locator('h2').allTextContents();
  return titles.map((title) => title.trim()).filter((title) => title.startsWith('Dla '));
}

async function openHelp(page: Page, role: string, query = '') {
  await signIn(page, demoAccount(role));
  await page.goto(`/pomoc${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Pomoc' })).toBeVisible();
}

test.describe('help page as evaluator', () => {
  test.beforeEach(async ({ page }) => {
    await openHelp(page, 'evaluator');
  });

  test('shows the evaluator guide first with numbered steps', async ({ page }) => {
    expect(await guideOrder(page)).toEqual(['Dla oceniającego', 'Dla kadr']);
    const steps = page.locator('#instrukcja-oceniajacy ol > li');
    await expect(steps).toHaveCount(7);
    await expect(steps.first().getByRole('heading', { level: 3 })).toContainText(
      'Rozpocznij ocenę',
    );
  });

  test('lists the error of an empty question and keeps the page usable', async ({ page }) => {
    await page.getByRole('button', { name: 'Zadaj pytanie' }).click();
    const summary = errorSummary(page, 'Popraw pytanie');
    await expect(summary).toBeFocused();
    await expect(
      summary.getByRole('link', { name: 'Wpisz pytanie, co najmniej 10 znaków.' }),
    ).toHaveAttribute('href', '#question');
    await expect(page).toHaveTitle(/^Błąd: /);
    await expectNoViolations(page);
  });

  test('meets WCAG 2.1 AA and fits a 400 px screen', async ({ page }) => {
    await expectNoViolations(page);
    await page.setViewportSize({ width: 400, height: 800 });
    await expectNoSidewaysScroll(page);
  });

  test('ignores a garbage run id and says when the question is unknown', async ({ page }) => {
    await page.goto('/pomoc?pytanie=nie-uuid');
    await expect(page.getByRole('heading', { level: 1, name: 'Pomoc' })).toBeVisible();
    await expect(page.getByText('Nie znaleziono tego pytania')).toBeHidden();

    await page.goto(`/pomoc?pytanie=${randomUUID()}&tresc=Ile%20dni%20na%20sprzeciw%3F`);
    await expect(
      page.getByText('Nie znaleziono tego pytania. Zadaj je jeszcze raz.'),
    ).toBeVisible();
    await expect(page.getByLabel('Twoje pytanie o przepisy')).toHaveValue('Ile dni na sprzeciw?');
  });

  test('says when the case of a question is unknown', async ({ page }) => {
    await page.goto('/pomoc?ocena=nie-uuid');
    await expect(page.getByText('Nie znaleziono tej oceny.')).toBeVisible();
    await page.goto(`/pomoc?ocena=${randomUUID()}`);
    await expect(page.getByText('Nie znaleziono tej oceny.')).toBeVisible();
    await expect(page.getByLabel('Twoje pytanie o przepisy')).toBeVisible();
  });

  test('the error summary takes the focus again on a second empty send', async ({ page }) => {
    const send = page.getByRole('button', { name: 'Zadaj pytanie' });
    await send.click();
    const summary = errorSummary(page, 'Popraw pytanie');
    await expect(summary).toBeFocused();
    await send.focus();
    await send.click();
    await expect(summary).toBeFocused();
  });
});

test.describe('help page as hr', () => {
  test('shows the guide for kadry first', async ({ page }) => {
    await openHelp(page, 'hr');
    expect(await guideOrder(page)).toEqual(['Dla kadr', 'Dla oceniającego']);
  });
});

test.describe('help page as admin', () => {
  test('explains who the assistant answers and offers no question field', async ({ page }) => {
    await openHelp(page, 'admin');
    await expect(
      page.getByText('Asystent przepisów odpowiada oceniającym i kadrom.'),
    ).toBeVisible();
    await expect(page.getByLabel('Twoje pytanie o przepisy')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Dla oceniającego' })).toBeVisible();
  });
});

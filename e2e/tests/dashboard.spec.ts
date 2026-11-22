import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('evaluator dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
  });

  test('greets and lists the next steps from the demo data', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dzień dobry.');

    const todo = page.getByRole('region', { name: 'Zrób teraz' });
    await expect(todo.getByRole('link', { name: 'Ewa Ewidencyjna' })).toBeVisible();
    await expect(todo).toContainText('Wpisz wnioski do IPRZ i zatwierdź ocenę');
    await expect(todo).toContainText('Arkusz C, część II, brakuje 1 pola');

    const hero = page.getByRole('region', { name: /Dzień dobry/ });
    await expect(hero).toContainText('Czeka na osobę ocenianą');
    await expect(hero).toContainText(`Zamknięte w ${new Date().getFullYear()} r.`);

    const main = page.getByRole('main');
    await expect(main).toContainText('Marek Merytoryczny');
    await expect(main).toContainText('Odnotuj rozmowę oceniającą');
    await expect(main).toContainText('Stefan Sprzeciwny');
    await expect(main).toContainText('Kadry rozpatrują sprzeciw');
  });

  test('suggests a conversation from the AI signals', async ({ page }) => {
    const panel = page.getByRole('region', { name: 'Warto porozmawiać' });
    await expect(panel).toContainText('Marek Merytoryczny');
    await expect(panel).toContainText('Sugestia AI. Decyzję podejmujesz Ty.');
  });

  test('meets WCAG 2.1 AA', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dzień dobry.');
    await expect(page).toHaveTitle(/\S/);
    const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
    expect(results.violations).toEqual([]);
  });

  test('does not scroll sideways on a narrow screen, also with larger text', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dzień dobry.');
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'A+ Powiększ tekst' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test('keeps the header on one line at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Pulpit' })).toBeVisible();
    const box = await header.boundingBox();
    // One row of 4rem cells plus the bottom line.
    expect(box?.height).toBeLessThanOrEqual(66);
  });

  test('keeps the account name readable with larger text at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: /Powiększ tekst/ }).click();
    const account = page.getByRole('banner').getByRole('button', { name: /Menu konta/ });
    // With A+ the navigation moves to a second row, so the account cell keeps its name.
    await expect(account).toContainText('Olga');
    const name = await account.locator('span').first().boundingBox();
    expect(name?.width).toBeGreaterThan(150);
    await page.getByRole('button', { name: /Powiększ tekst/ }).click();
  });

  test('shows the year for a deadline in another year', async ({ page }) => {
    // The demo cycle starts on the day of the seed, so its deadline falls two years later.
    const todo = page.getByRole('region', { name: 'Zrób teraz' });
    await expect(todo).toContainText(
      new RegExp(`\\d{2}\\.\\d{2}\\.${new Date().getFullYear() + 2}`),
    );
  });
});

test('admin lands on the office settings instead of an empty dashboard', async ({ page }) => {
  await signIn(page, demoAccount('admin'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/ustawienia$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia urzędu' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Pulpit' })).toHaveCount(0);
});

test('hr sees its task count with a link to the hr panel', async ({ page }) => {
  await signIn(page, demoAccount('hr'));
  await page.goto('/');
  const block = page.getByRole('region', { name: 'Zadania kadr' });
  await expect(block).toBeVisible();
  await expect(block.getByRole('link', { name: 'Przejdź do panelu kadr' })).toHaveAttribute(
    'href',
    '/kadry',
  );
});

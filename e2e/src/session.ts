import { expect, type Page } from '@playwright/test';
import { DEMO_PASSWORD, type DemoAccount } from './demo-accounts';

/** The account cell of the header: a disclosure button that holds "Wyloguj się". */
export function accountMenuButton(page: Page) {
  return page.getByRole('button', { name: /Menu konta/ });
}

export async function signIn(page: Page, account: DemoAccount): Promise<void> {
  await page.goto('/logowanie');
  await page.getByLabel('Adres e-mail').fill(account.email);
  await page.getByLabel('Hasło', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(accountMenuButton(page)).toBeVisible();
}

/** Signs out from the account menu of the header, or from the page when it has no menu. */
export async function signOut(page: Page): Promise<void> {
  const menu = accountMenuButton(page);
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeVisible();
}

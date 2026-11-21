import { expect, type Page } from '@playwright/test';
import { DEMO_PASSWORD, type DemoAccount } from './demo-accounts';

export async function signIn(page: Page, account: DemoAccount): Promise<void> {
  await page.goto('/logowanie');
  await page.getByLabel('Adres e-mail').fill(account.email);
  await page.getByLabel('Hasło', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page.getByRole('button', { name: 'Wyloguj się' })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeVisible();
}

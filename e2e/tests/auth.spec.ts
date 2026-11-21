import { expect, test } from '@playwright/test';
import {
  DEMO_OFFICE_NAME,
  DEMO_PASSWORD,
  demoAccounts,
  noOfficeAccount,
} from '../src/demo-accounts';
import { signIn, signOut } from '../src/session';

test('redirects a signed-out visitor to the sign-in page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/logowanie$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeVisible();
});

for (const account of demoAccounts) {
  test(`signs in and out as ${account.email}`, async ({ page }) => {
    await signIn(page, account);
    await expect(page).toHaveURL(/\/$/);

    const header = page.getByRole('banner');
    await expect(header).toContainText(DEMO_OFFICE_NAME);
    await expect(header).toContainText(account.email);
    await expect(header).toContainText(account.roleLabel);

    await signOut(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/logowanie$/);
  });
}

test('sends an account without an office to the no-office page', async ({ page }) => {
  await page.goto('/logowanie');
  await page.getByLabel('Adres e-mail').fill(noOfficeAccount.email);
  await page.getByLabel('Hasło', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  await expect(page).toHaveURL(/\/brak-urzedu$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Konto bez przypisanego urzędu' }),
  ).toBeVisible();
  await expect(page.getByText(noOfficeAccount.email)).toBeVisible();
  await signOut(page);
});

test('rejects a wrong password with a message', async ({ page }) => {
  await page.goto('/logowanie');
  await page.getByLabel('Adres e-mail').fill('kadry@kropka.test');
  await page.getByLabel('Hasło', { exact: true }).fill('zle-haslo');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'Nie udało się zalogować' });
  await expect(alert).toContainText('Nieprawidłowy adres e-mail lub hasło');
  await expect(page).toHaveURL(/\/logowanie$/);
  await expect(page.getByLabel('Adres e-mail')).toHaveValue('kadry@kropka.test');
});

test('lists field errors for an empty form', async ({ page }) => {
  await page.goto('/logowanie');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  const summary = page.getByRole('alert').filter({ hasText: 'Popraw dane w formularzu' });
  await expect(summary).toContainText('Wpisz adres e-mail.');
  await expect(summary).toContainText('Wpisz hasło.');
  await expect(page.getByLabel('Adres e-mail')).toHaveAttribute('aria-invalid', 'true');
});

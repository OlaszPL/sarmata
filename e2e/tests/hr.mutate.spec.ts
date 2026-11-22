import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

const warsawToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());

async function grantGrade(page: Page, grade: string): Promise<void> {
  await page.goto('/kadry/rejestr');
  await page
    .getByLabel('Pracownik', { exact: true })
    .selectOption({ label: 'Ewa Ewidencyjna, obecny stopień 4' });
  await page.getByRole('radio', { name: 'Na wniosek z oceny' }).check();
  await page.getByLabel('Data przyznania').fill(warsawToday());
  await page.getByLabel('Nowy stopień').selectOption(grade);
  await page.getByRole('button', { name: 'Przyznaj stopień' }).click();
}

async function changeSupervisor(page: Page, employee: string, supervisor: string): Promise<void> {
  await page.goto('/kadry/struktura');
  await page.getByRole('link', { name: `Zmień przełożonego: ${employee}` }).click();
  await page.getByLabel('Przełożony').selectOption({ label: supervisor });
  await page.getByRole('button', { name: 'Zapisz przełożonego' }).click();
}

test.beforeEach(async ({ page }) => {
  await signIn(page, demoAccount('hr'));
});

test.describe('grade grant', () => {
  test('refuses a grade that is not higher than the current one', async ({ page }) => {
    await grantGrade(page, '4');
    const summary = errorSummary(page, 'Nie udało się przyznać stopnia');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Nowy stopień musi być wyższy');
    // What was typed stays in the form, the selects included.
    await expect(page.getByLabel('Pracownik')).not.toHaveValue('');
    await expect(page.getByLabel('Nowy stopień')).toHaveValue('4');
    await expect(page).toHaveTitle(/^Błąd: /);
    await expectNoViolations(page);
  });

  test('records a higher grade in the register', async ({ page }) => {
    await grantGrade(page, '5');
    await expect(page.getByText('Zapisano wpis w rejestrze.')).toBeVisible();
    const table = page.getByRole('table', { name: 'Przyznane stopnie' });
    await expect(table.getByRole('row', { name: /Ewa Ewidencyjna/ })).toBeVisible();
  });
});

test.describe('supervisor', () => {
  test('refuses a choice that closes a cycle', async ({ page }) => {
    await changeSupervisor(page, 'Olga Oceniająca', 'Ewa Ewidencyjna, Wydział Kontroli');
    const summary = errorSummary(page, 'Nie udało się zmienić przełożonego');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Ta osoba podlega już temu pracownikowi');
    await expect(page.getByLabel('Przełożony')).toHaveValue(/.+/);
    await expect(page).toHaveTitle(/^Błąd: /);
  });

  test('saves a valid supervisor and shows Olga under Karol', async ({ page }) => {
    await changeSupervisor(page, 'Olga Oceniająca', 'Karol Kadrowy, Wydział Kadr i Rozwoju');
    await expect(page).toHaveURL(/zmieniono=/);
    await expect(page.getByText('Zapisano przełożonego: Olga Oceniająca.')).toBeVisible();
    const underKarol = page
      .locator('li', { has: page.getByText('Karol Kadrowy', { exact: true }) })
      .locator('li', { hasText: 'Olga Oceniająca' });
    await expect(underKarol.first()).toBeVisible();
  });
});

test('the import creates a new person who shows in the structure', async ({ page }) => {
  await page.goto('/kadry/import');
  await page.getByLabel('Plik z listą pracowników').setInputFiles({
    name: 'zenon.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Imię;Nazwisko;E-mail;Stanowisko;Komórka organizacyjna\n' +
        'Zenon;Importowany;zenon.importowany@kropka.test;Referent;Wydział Kadr i Rozwoju\n',
      'utf8',
    ),
  });
  await page.getByRole('button', { name: 'Sprawdź kolumny' }).click();
  await page.getByRole('button', { name: 'Wykonaj przebieg próbny' }).click();
  await expect(
    page.getByRole('table', { name: 'Wynik przebiegu próbnego' }).getByText('Nowy pracownik'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Zaimportuj pracowników' }).click();
  await expect(page.getByText('Import zakończony')).toBeVisible();
  await expect(page.getByText('Dodano nowych pracowników: 1')).toBeVisible();

  await page.goto('/kadry/struktura');
  await expect(page.getByText('Zenon Importowany', { exact: true })).toBeVisible();
});

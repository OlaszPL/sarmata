import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary } from '../src/page-checks';
import { signIn } from '../src/session';

// These tests change the office settings, request invitations and make regulation drafts, so they run
// after the read-only ones (project `mutating`). The worker does not run during e2e, so an invitation
// stays pending.
test.describe('admin changes', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('admin'));
  });

  test('saves the default place of the office', async ({ page }) => {
    const place = `Kropka Wielka ${Date.now()}`;
    await page.goto('/ustawienia');
    await page.getByLabel('Domyślna miejscowość').fill(place);
    await page.getByRole('button', { name: 'Zapisz ustawienia urzędu' }).click();

    await expect(page.getByText('Zapisano ustawienia urzędu.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Domyślna miejscowość')).toHaveValue(place);
  });

  test('a shorter notes retention asks for confirmation before saving', async ({ page }) => {
    await page.goto('/ustawienia');
    const months = page.getByLabel('Okres przechowywania notatek w miesiącach');
    const before = await months.inputValue();
    await months.fill('1');
    await page.getByRole('button', { name: 'Zapisz ustawienia urzędu' }).click();

    await expect(page.getByText('Krótszy okres usunie dane')).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: /Rozumiem, że nocne zadanie usunie/ }),
    ).toBeVisible();
    await expect(months).toHaveValue('1');

    // A second save without the tick is an error at the checkbox, nothing is stored.
    await page.getByRole('button', { name: 'Zapisz ustawienia urzędu' }).click();
    await expect(errorSummary(page, 'Popraw ustawienia urzędu')).toBeVisible();
    await page.goto('/ustawienia');
    await expect(months).toHaveValue(before);
  });

  test('an invalid value is reported at its field and the typed values stay', async ({ page }) => {
    await page.goto('/ustawienia');
    await page.getByLabel('Dni przed terminem').fill('7, abc');
    await page.getByLabel('Domyślna miejscowość').fill('Kropka');
    await page.getByRole('button', { name: 'Zapisz ustawienia urzędu' }).click();

    const summary = errorSummary(page, 'Popraw ustawienia urzędu');
    await expect(summary).toBeFocused();
    await expect(page).toHaveTitle(/^Błąd: /);
    await expect(page.getByLabel('Dni przed terminem')).toHaveValue('7, abc');
    await expect(page.getByLabel('Domyślna miejscowość')).toHaveValue('Kropka');
  });

  test('an invalid accessibility phone is reported at its field and nothing is saved', async ({
    page,
  }) => {
    await page.goto('/ustawienia');
    const phone = page.getByLabel('Telefon w sprawie dostępności');
    const before = await phone.inputValue();
    await phone.fill('zadzwoń');
    await page.getByRole('button', { name: 'Zapisz ustawienia urzędu' }).click();

    const summary = errorSummary(page, 'Popraw ustawienia urzędu');
    await expect(summary).toBeFocused();
    await expect(
      summary.getByRole('link', { name: /Wpisz numer telefonu z cyframi/ }),
    ).toHaveAttribute('href', '#accessibilityContactPhone');
    await expect(phone).toHaveValue('zadzwoń');
    await page.goto('/ustawienia');
    await expect(phone).toHaveValue(before);
  });

  test('an invitation shows its pending status', async ({ page }) => {
    await page.goto('/ustawienia/konta');
    await page.getByLabel('Imię', { exact: true }).fill('Tadeusz');
    await page.getByLabel('Nazwisko').fill('Testowy');
    await page.getByLabel('Adres e-mail').fill(`test-${Date.now()}@kropka.test`);
    await page.getByRole('radio', { name: 'Oceniający', exact: true }).check();
    await page.getByRole('button', { name: 'Wyślij zaproszenie' }).click();

    await expect(page).toHaveURL(/zaproszenie=/);
    await expect(page.getByText('Zaproszenie czeka na wysłanie')).toBeVisible();
  });

  test('the only admin cannot give up the admin role', async ({ page }) => {
    await page.goto('/ustawienia/konta');
    await page.getByRole('link', { name: 'Zmień, Anna Administracyjna' }).click();
    const panel = page.locator('#konto');
    await expect(panel.getByRole('heading', { name: 'Zmiana konta' })).toBeVisible();
    await panel.getByRole('radio', { name: 'Kadry', exact: true }).check();
    await panel.getByRole('button', { name: 'Zapisz rolę' }).click();

    await expect(errorSummary(page, 'Nie udało się zmienić roli')).toBeVisible();
    await expect(
      page.getByText('Urząd musi mieć co najmniej jednego aktywnego administratora.'),
    ).toBeVisible();
    await page.goto('/ustawienia/konta');
    await expect(
      page.getByRole('row', { name: /admin@kropka.test/ }).getByText('Administrator'),
    ).toBeVisible();
  });

  test('clones the regulation in force, runs its worked examples and deletes the draft', async ({
    page,
  }) => {
    const name = `Wersja testowa ${Date.now()}`;
    await page.goto('/ustawienia/przepisy');
    await page.getByLabel('Nazwa nowej wersji').fill(name);
    await page.getByRole('button', { name: 'Utwórz szkic' }).click();

    await expect(page.getByText('Utworzono szkic.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    const results = page.getByRole('table', { name: 'Wyniki przypadków testowych' });
    await expect(results.getByRole('row').nth(1)).toBeVisible();

    // A value the rules refuse: the summary links to the field and the typed text stays.
    const max = page.getByLabel('Największa liczba kryteriów dodatkowych');
    await max.fill('abc');
    await page.getByRole('button', { name: 'Zapisz i uruchom testy' }).click();
    const summary = errorSummary(page, 'Popraw parametry wersji');
    await expect(summary).toBeFocused();
    await expect(max).toHaveValue('abc');
    await summary.getByRole('link').first().click();
    await expect(max).toBeFocused();

    await max.fill('2');
    await page.getByRole('button', { name: 'Zapisz i uruchom testy' }).click();
    await expect(page.getByText('Zapisano parametry. Wyniki testów są poniżej.')).toBeVisible();
    await expect(max).toHaveValue('2');

    // A deadline slot is a closed group: an error inside it opens the group and the summary link
    // reaches the field.
    const objection = page.locator('details', {
      has: page.locator('summary', { hasText: 'Termin na sprzeciw' }),
    });
    await expect(objection).not.toHaveAttribute('open');
    await objection.locator('summary').click();
    await objection.getByLabel('Liczba dni').fill('abc');
    await page.getByRole('button', { name: 'Zapisz i uruchom testy' }).click();
    await expect(errorSummary(page, 'Popraw parametry wersji')).toBeFocused();
    await expect(objection).toHaveAttribute('open');
    await errorSummary(page, 'Popraw parametry wersji').getByRole('link').first().click();
    await expect(objection.getByLabel('Liczba dni')).toBeFocused();
    await objection.getByLabel('Liczba dni').fill('7');
    await page.getByRole('button', { name: 'Zapisz i uruchom testy' }).click();
    await expect(page.getByText('Zapisano parametry. Wyniki testów są poniżej.')).toBeVisible();

    await page
      .getByRole('checkbox', { name: 'Rozumiem, że usunięcia szkicu nie da się cofnąć' })
      .check();
    await page.getByRole('button', { name: 'Usuń szkic' }).click();
    await expect(page.getByText('Usunięto szkic.')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Wersje przepisów' }).getByText(name)).toHaveCount(
      0,
    );
  });
});

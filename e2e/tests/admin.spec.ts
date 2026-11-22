import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary, expectNoSidewaysScroll, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

// Read-only checks of the admin screens. Nothing here saves data.

/** The sheet draft of Olga about Marek from the seed, with one edited fragment. */
const SEEDED_RUN_ID = '44444444-4444-4444-8444-000000000001';

test.describe('admin screens as the admin', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('admin'));
  });

  const pages = [
    { path: '/ustawienia', heading: 'Ustawienia urzędu' },
    { path: '/ustawienia/konta', heading: 'Konta' },
    { path: '/ustawienia/przepisy', heading: 'Wersje przepisów' },
    { path: '/dziennik-ai', heading: 'Dziennik użycia AI' },
  ];

  for (const { path, heading } of pages) {
    test(`${path} opens with its heading and no axe violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectNoViolations(page);
    });
  }

  test('the menu leads to the settings and the AI log', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Główna nawigacja' });
    await expect(nav.getByRole('link', { name: 'Ustawienia' })).toBeVisible();
    await nav.getByRole('link', { name: 'Dziennik AI' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dziennik użycia AI' })).toBeVisible();
  });

  test('settings tabs mark the current section', async ({ page }) => {
    await page.goto('/ustawienia/konta');
    const tabs = page.getByRole('navigation', { name: 'Ustawienia' });
    await expect(tabs.getByRole('link', { name: 'Konta' })).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: 'Wersje przepisów' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Wersje przepisów' })).toBeVisible();
  });

  test('settings fit a 400 px screen', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    for (const path of [
      '/ustawienia',
      '/ustawienia/konta',
      '/ustawienia/przepisy',
      '/dziennik-ai',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
  });

  test('the office settings form shows the saved values', async ({ page }) => {
    await page.goto('/ustawienia');
    await expect(page.getByLabel('Serwer')).toHaveValue('127.0.0.1');
    await expect(page.getByLabel('Port')).toHaveValue('55425');
    await expect(page.getByLabel('E-mail w sprawie dostępności')).toHaveValue(
      'dostepnosc@kropka.test',
    );
    await expect(page.getByLabel('Telefon w sprawie dostępności')).toHaveValue('+48 61 000 00 00');
    await expect(page.getByLabel('Adres urzędu')).toHaveValue(
      'ul. Testowa 1, 62-000 Kropka Wielkopolska',
    );
    await expect(page.getByRole('button', { name: 'Zapisz ustawienia urzędu' })).toBeVisible();
  });

  test('an empty invitation shows the error summary and keeps the page usable', async ({
    page,
  }) => {
    await page.goto('/ustawienia/konta');
    await page.getByRole('button', { name: 'Wyślij zaproszenie' }).click();
    const summary = errorSummary(page, 'Popraw dane zaproszenia');
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('link', { name: 'Wpisz imię' })).toBeVisible();
    await expect(page).toHaveTitle(/^Błąd: /);
    await summary.getByRole('link', { name: 'Wpisz imię' }).click();
    await expect(page.getByLabel('Imię', { exact: true })).toBeFocused();
  });

  test('the account list shows the demo accounts', async ({ page }) => {
    await page.goto('/ustawienia/konta');
    const table = page.getByRole('table', { name: 'Konta w urzędzie' });
    await expect(table.getByText('admin@kropka.test')).toBeVisible();
    await expect(table.getByText('kadry@kropka.test')).toBeVisible();
  });

  test('a regulation version shows its worked examples and connections', async ({ page }) => {
    await page.goto('/ustawienia/przepisy');
    const versions = page.getByRole('table', { name: 'Wersje przepisów' });
    await versions.getByRole('link').first().click();
    await expect(page).toHaveURL(/wersja=/);
    await expect(page.getByRole('table', { name: 'Wyniki przypadków testowych' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Powiązania przepisów' })).toBeVisible();
    await expectNoViolations(page);
    await page.setViewportSize({ width: 400, height: 900 });
    await expectNoSidewaysScroll(page);
  });

  test('a draft shows its deadline slots as closed groups', async ({ page }) => {
    await page.goto('/ustawienia/przepisy');
    await page
      .getByRole('table', { name: 'Wersje przepisów' })
      .getByRole('link', { name: 'Przepisy urzędu, szkic demo' })
      .click();
    await expect(page.getByRole('button', { name: 'Zapisz i uruchom testy' })).toBeVisible();
    // A saved draft has no errors: every slot group is there and none is expanded.
    await expect(
      page.locator('details > summary', { hasText: 'Termin na sprzeciw' }),
    ).toBeVisible();
    await expect(page.locator('details[open]')).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('the AI log shows the office usage log without content to the admin', async ({ page }) => {
    await page.goto('/dziennik-ai');
    const table = page.getByRole('table', { name: 'Przebiegi AI' });
    await expect(table.getByRole('row', { name: /Szkic arkusza/ })).toBeVisible();
    await page.goto('/dziennik-ai?przebieg=44444444-4444-4444-8444-000000000001');
    await expect(page.getByRole('heading', { name: 'Decyzje o fragmentach' })).toBeVisible();
    await expect(
      page.getByText('Dziennik administratora pokazuje decyzje bez treści sugestii i poprawek.'),
    ).toBeVisible();
    await expect(page.getByText('przejął dwie dodatkowe sprawy')).toHaveCount(0);
    await expectNoViolations(page);
  });
});

test.describe('admin screens for other roles', () => {
  test('an evaluator sees who changes the settings and no forms', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/ustawienia');
    await expect(page.getByText('Ustawienia urzędu zmienia administrator urzędu.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zapisz ustawienia urzędu' })).toHaveCount(0);
    await page.goto('/ustawienia/konta');
    await expect(page.getByText('Konta urzędu zmienia administrator urzędu.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wyślij zaproszenie' })).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('hr sees the seeded AI runs and the fragment decisions of one', async ({ page }) => {
    await signIn(page, demoAccount('hr'));
    await page.goto('/dziennik-ai');
    const table = page.getByRole('table', { name: 'Przebiegi AI' });
    await expect(table.getByText('Szkic arkusza').first()).toBeVisible();
    await expectNoViolations(page);

    await page.goto(`/dziennik-ai?przebieg=${SEEDED_RUN_ID}`);
    await expect(page.getByRole('heading', { name: 'Decyzje o fragmentach' })).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Decyzje o fragmentach przebiegu' }).getByRole('row'),
    ).not.toHaveCount(1);
    const decisions = page.getByRole('table', { name: 'Decyzje o fragmentach przebiegu' });
    await expect(decisions).not.toContainText('communication');
    await expect(decisions).toContainText('Komunikacja');
  });

  test('hr sees the AI log without sideways scroll at 400 px', async ({ page }) => {
    await signIn(page, demoAccount('hr'));
    await page.setViewportSize({ width: 400, height: 900 });
    await page.goto('/dziennik-ai');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test('hr filters the AI log by kind', async ({ page }) => {
    await signIn(page, demoAccount('hr'));
    await page.goto('/dziennik-ai');
    await page.getByLabel('Rodzaj').selectOption({ label: 'Pytanie o procedurę' });
    await page.getByRole('button', { name: 'Pokaż' }).click();
    await expect(page).toHaveURL(/rodzaj=procedure_question/);
    await expect(page.getByRole('table', { name: 'Przebiegi AI' })).toHaveCount(0);
    await expect(page.getByText('Żaden przebieg nie pasuje do filtrów.')).toBeVisible();
  });
});

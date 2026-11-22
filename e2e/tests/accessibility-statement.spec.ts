import { expect, test } from '@playwright/test';
import { DEMO_OFFICE_NAME, demoAccount } from '../src/demo-accounts';
import { expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

const SECTIONS = [
  'Wstęp',
  'Daty',
  'Stan dostępności cyfrowej',
  'Przygotowanie deklaracji',
  'Skróty klawiaturowe',
  'Udogodnienia',
  'Informacje zwrotne i dane kontaktowe',
  'Procedura wnioskowo-skargowa',
  'Dostępność architektoniczna',
  'Tłumacz języka migowego',
  'Aplikacje mobilne',
];

const DATE_IDS = [
  'a11y-data-publikacja',
  'a11y-data-aktualizacja',
  'a11y-data-sporzadzenie',
  'a11y-data-przeglad',
];

test('statement is complete, with iso dates and the RPO link, for a visitor', async ({ page }) => {
  await page.goto('/deklaracja-dostepnosci');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Deklaracja dostępności' }),
  ).toBeVisible();
  await expect(page.locator('main h2')).toHaveText(SECTIONS);
  for (const id of DATE_IDS) await expect(page.locator(`#${id}`)).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.locator('#a11y-status')).toContainText('częściowo zgodna');
  await expect(page.locator('#a11y-podmiot')).toHaveText('Urząd korzystający z aplikacji');
  // A visitor has no office, so the office data of the settings stays out.
  await expect(page.locator('#a11y-email')).toHaveCount(0);
  await expect(page.locator('#a11y-rpo')).toHaveAttribute('href', 'https://bip.brpo.gov.pl/');
  await expectNoViolations(page);
});

test('statement names the office of a signed-in member', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  await page.goto('/deklaracja-dostepnosci');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Deklaracja dostępności' }),
  ).toBeVisible();
  await expect(page.locator('#a11y-podmiot')).toHaveText(DEMO_OFFICE_NAME);
  await expect(page.locator('main h2')).toHaveText(SECTIONS);
  await expect(page.locator('#a11y-rpo')).toBeVisible();
  await expectNoViolations(page);
});

test('statement shows the accessibility data of the office settings to a member', async ({
  page,
}) => {
  await signIn(page, demoAccount('hr'));
  await page.goto('/deklaracja-dostepnosci');
  await expect(page.locator('#a11y-osoba')).toHaveText(
    'Wydział Kadr i Rozwoju, koordynator do spraw dostępności',
  );
  await expect(page.locator('#a11y-email')).toHaveAttribute(
    'href',
    'mailto:dostepnosc@kropka.test',
  );
  await expect(page.locator('#a11y-telefon')).toHaveAttribute('href', 'tel:+48610000000');
  await expect(
    page.getByText('Adres urzędu: ul. Testowa 1, 62-000 Kropka Wielkopolska'),
  ).toBeVisible();
  await expect(page.getByText(/Winda obsługuje wszystkie piętra/)).toBeVisible();
  await expect(page.getByText(/Tłumacza polskiego języka migowego zapewniamy/)).toBeVisible();
  await expect(page.getByText('Opis dostępności architektonicznej budynków jest w')).toHaveCount(0);
  await expectNoViolations(page);
});
